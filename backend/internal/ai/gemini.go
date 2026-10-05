package ai

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"

	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	platformlogger "github.com/brunoguimas/metapps/backend/internal/platform/logger"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"google.golang.org/genai"
)

const (
	Model = "models/gemini-3.6-flash"
)

type GeminiClient struct {
	client   *genai.Client
	apiKey   string
	model    string
	mockOnce sync.Once
}

func NewGeminiClient(ctx context.Context, cfg config.Config) (*GeminiClient, error) {
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey: cfg.GeminiKey,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create gemini client", err)
	}

	model := cfg.GeminiModel
	if model == "" {
		model = config.DefaultGeminiModel
	}

	return &GeminiClient{
		client: client,
		apiKey: cfg.GeminiKey,
		model:  model,
	}, nil
}

func (g *GeminiClient) Generate(ctx context.Context, prompt string) (string, error) {
	if g.apiKey == "" {
		g.mockOnce.Do(func() {
			fmt.Println("WARNING: GEMINI_KEY is empty, using mock Gemini client for health check")
		})
		return "mock response", nil
	}

	resp, err := g.client.Models.GenerateContent(
		ctx,
		g.model,
		genai.Text(prompt),
		nil,
	)
	if err != nil {
		// Deadline/cancelamento é do cliente, não do provedor: não entra na
		// classificação de transitório (context.DeadlineExceeded satisfaz
		// net.Error e cairia no caso errado).
		if ctx.Err() == nil && isUpstreamUnavailable(err) {
			// 429/5xx/queda de rede: transitório. O SDK já tentou novamente por
			// dentro; repetir no chamador só ajuda com backoff, não corrige o
			// prompt. Log em WARN porque não é falha do Metapps.
			platformlogger.LogSystemWarn("ai provider temporarily unavailable",
				"model", g.model, "error", err)
			return "", apperrors.NewAppError(
				apperrors.ErrUpstreamUnavailable,
				"ai provider is temporarily unavailable, please try again",
				err,
			)
		}
		platformlogger.LogSystemError("gemini API call failed", err, "model", g.model)
		return "", apperrors.NewAppError(apperrors.ErrInternal, "failed to generate content from gemini", err)
	}

	text := resp.Text()
	if text == "" {
		// Resposta sem texto é quase sempre finishReason MAX_TOKENS (o modelo
		// gastou o orçamento raciocinando) ou SAFETY/RECITATION (bloqueio).
		// Sem esse detalhe o log só diz "vazio" e não dá pra diagnosticar.
		return "", apperrors.NewAppError(
			apperrors.ErrInvalidAIResponse,
			"ai returned an empty response: "+describeEmptyResponse(resp),
			nil,
		)
	}

	return text, nil
}

// describeEmptyResponse explains why a successful HTTP call carried no text.
func describeEmptyResponse(resp *genai.GenerateContentResponse) string {
	var reasons []string

	if len(resp.Candidates) == 0 {
		reasons = append(reasons, "no candidates returned")
	} else {
		switch fr := resp.Candidates[0].FinishReason; fr {
		case genai.FinishReasonMaxTokens:
			reasons = append(reasons, "finish reason MAX_TOKENS: budget spent before any text was produced (raise maxOutputTokens, or shorten the prompt)")
		case genai.FinishReasonSafety, genai.FinishReasonRecitation:
			reasons = append(reasons, "finish reason "+string(fr)+": response blocked by a safety filter")
		case genai.FinishReasonStop:
			reasons = append(reasons, "finish reason STOP but no text parts")
		default:
			reasons = append(reasons, "finish reason "+string(fr))
		}
	}

	if resp.PromptFeedback != nil && resp.PromptFeedback.BlockReason != "" {
		reasons = append(reasons, "prompt blocked: "+string(resp.PromptFeedback.BlockReason))
	}

	return strings.Join(reasons, "; ")
}

// isUpstreamUnavailable reports whether err is a transient provider/network
// problem (worth retrying) rather than a permanent request problem.
func isUpstreamUnavailable(err error) bool {
	var apiErr genai.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.Code {
		case http.StatusRequestTimeout,
			http.StatusTooManyRequests,
			http.StatusInternalServerError,
			http.StatusBadGateway,
			http.StatusServiceUnavailable,
			http.StatusGatewayTimeout:
			return true
		default:
			return false
		}
	}

	// Connection reset, DNS failure, i/o timeout: same story, no HTTP code.
	var netErr net.Error
	return errors.As(err, &netErr)
}
