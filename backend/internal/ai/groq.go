package ai

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/jpoz/groq"
)

type GroqClient struct {
	client    chatCompleter
	apiKey    string
	model     string
	maxTokens int
}

// chatCompleter é o pedaço da lib do Groq que o cliente usa. Existe para
// poder testar o retry sem chamar a API.
type chatCompleter interface {
	CreateChatCompletion(params groq.CompletionCreateParams) (*groq.ChatCompletion, error)
}

const (
	// DefaultGroqModel é o modelo usado quando o .env não define
	// GROQ_MODEL. Precisa ser um modelo disponível na conta: o antigo
	// llama-3.3-70b-versatile foi descontinuado.
	DefaultGroqModel = "openai/gpt-oss-20b"

	// DefaultGroqMaxTokens é o teto de tokens que o modelo pode gerar
	// numa resposta.
	//
	// Sem esse valor a lib não manda max_tokens e a API usa o padrão
	// dela, que corta a resposta no meio. O corte é invisível para quem
	// pede JSON: a API devolve "Failed to validate JSON" e a geração do
	// roadmap (60-100 nós, ~6k tokens) falha sempre. Com o teto
	// explícito, a resposta cabe inteira.
	DefaultGroqMaxTokens = 8192

	// MinGroqMaxTokens é o menor teto usado na redução. Abaixo disso a
	// resposta não cabe nem uma lição, e o erro sobe para o fallback.
	MinGroqMaxTokens = 2048

	// GroqMaxAttempts é quantas vezes a mesma requisição é repetida
	// dentro do provedor, antes de devolver o erro para o fallback.
	GroqMaxAttempts = 4

	// MaxRetryDelay é o teto de espera quando a API diz quanto tempo
	// falta para a janela de taxa liberar.
	MaxRetryDelay = 30 * time.Second

	UserRole = "user"
)

func NewGroqClient(cfg config.Config) *GroqClient {
	model := cfg.GroqModel
	if model == "" {
		model = DefaultGroqModel
	}

	maxTokens := cfg.GroqMaxTokens
	if maxTokens <= 0 {
		maxTokens = DefaultGroqMaxTokens
	}

	return &GroqClient{
		client:    groq.NewClient(groq.WithAPIKey(cfg.GroqKey)),
		apiKey:    cfg.GroqKey,
		model:     model,
		maxTokens: maxTokens,
	}
}

// Name identifica o provedor ativo.
func (g *GroqClient) Name() string {
	return config.AIProviderGroq
}

func (g *GroqClient) Generate(ctx context.Context, req Request) (string, error) {
	if g.apiKey == "" {
		return "", fmt.Errorf("GROQ_API_KEY is empty")
	}

	if err := ctx.Err(); err != nil {
		return "", err
	}

	prompt := req.Prompt

	params := groq.CompletionCreateParams{
		Model: g.model,
		Messages: []groq.Message{
			{
				Role:    UserRole,
				Content: prompt,
			},
		},
	}

	// A lib serializa ResponseFormat sempre (é um struct, o omitempty não se
	// aplica), então o tipo precisa ser explícito: a API do Groq rejeita
	// "response_format" sem "type".
	params.ResponseFormat = groq.ResponseFormat{Type: "text"}

	if req.Format == OutputFormatJSON {
		params.ResponseFormat = groq.ResponseFormat{Type: "json_object"}

		// A API do Groq recusa response_format=json_object quando o prompt
		// não menciona "json". Garante a palavra sem alterar o conteúdo.
		if !strings.Contains(strings.ToLower(prompt), "json") {
			prompt = prompt + "\n\nResponda apenas com JSON válido."
			params.Messages[0].Content = prompt
		}
	}

	content, err := g.createChatCompletion(ctx, params, req.Format == OutputFormatJSON)
	if err != nil {
		return "", err
	}

	if req.Format == OutputFormatJSON {
		content = stripCodeFences(content)
	}

	return content, nil
}

// createChatCompletion chama a API do Groq e lida com os três erros que
// quebram a geração de conteúdo:
//
//  1. JSON inválido ("Failed to validate JSON"): a resposta foi cortada
//     porque a lib não manda max_tokens e a API usa o padrão dela. A
//     chamada é repetida com o teto de tokens explícito.
//
//  2. Requisição grande demais ("Request too large"): o teto de tokens
//     não cabe na janela de taxa da conta. O teto é reduzido e a
//     chamada é repetida.
//
//  3. Limite de taxa ("Rate limit reached"): a API diz quanto tempo
//     falta para a janela liberar. A chamada espera esse tempo.
func (g *GroqClient) createChatCompletion(
	ctx context.Context,
	params groq.CompletionCreateParams,
	isJSON bool,
) (string, error) {
	var lastErr error

	for attempt := 0; attempt < GroqMaxAttempts; attempt++ {
		response, err := g.client.CreateChatCompletion(params)
		if err == nil {
			if len(response.Choices) == 0 {
				return "", fmt.Errorf("groq returned no choices")
			}
			return response.Choices[0].Message.Content, nil
		}
		lastErr = err

		switch {
		case isJSON && params.MaxTokens == 0 && isInvalidJSONError(err):
			// O modelo cortou a resposta. Repete com o teto explícito.
			slog.Warn(
				"groq returned an invalid json, retrying with an explicit token limit",
				"error", err,
				"model", g.model,
				"max_tokens", g.maxTokens,
			)
			params.MaxTokens = g.maxTokens

		case isRequestTooLargeError(err) && params.MaxTokens > MinGroqMaxTokens:
			// O teto não cabe na janela da conta: reduz e repete.
			params.MaxTokens = params.MaxTokens * 3 / 4
			if params.MaxTokens < MinGroqMaxTokens {
				params.MaxTokens = MinGroqMaxTokens
			}
			slog.Warn(
				"groq request is too large for the account limit, reducing the token limit",
				"error", err,
				"max_tokens", params.MaxTokens,
			)

		case hasRetryDelay(err):
			// A janela de taxa está ocupada: espera o tempo indicado.
			delay := retryDelay(err)
			slog.Warn(
				"groq rate limit reached, waiting before retrying",
				"error", err,
				"wait", delay.String(),
			)
			if err := sleep(ctx, delay); err != nil {
				return "", err
			}

		default:
			return "", err
		}
	}

	return "", lastErr
}

// isInvalidJSONError diz se o erro da API é o de JSON inválido.
//
// A mensagem muda entre versões da API, então a checagem é por pedaço:
// "validate JSON" cobre o erro do Groq.
func isInvalidJSONError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "validate json")
}

// isRequestTooLargeError diz se o erro é o de requisição acima do limite
// de tokens por minuto da conta.
func isRequestTooLargeError(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "request too large")
}

var retryDelayPattern = regexp.MustCompile(`try again in ([0-9]+(?:\.[0-9]+)?)s`)

// retryDelay extrai da mensagem da API quanto tempo falta para a janela
// de taxa liberar.
func retryDelay(err error) time.Duration {
	if err == nil {
		return 0
	}
	match := retryDelayPattern.FindStringSubmatch(err.Error())
	if len(match) < 2 {
		return 0
	}
	seconds, convErr := strconv.ParseFloat(match[1], 64)
	if convErr != nil {
		return 0
	}
	delay := time.Duration(seconds * float64(time.Second))
	if delay > MaxRetryDelay {
		delay = MaxRetryDelay
	}
	return delay
}

// hasRetryDelay diz se a API informou quando repetir.
func hasRetryDelay(err error) bool {
	return err != nil && retryDelayPattern.MatchString(err.Error())
}

// sleep espera o tempo indicado, respeitando o cancelamento do contexto.
func sleep(ctx context.Context, delay time.Duration) error {
	if delay <= 0 {
		return nil
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
