package ai

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/brunoguimas/metapps/backend/internal/platform/config"
)

// NewClient monta a cadeia de provedores conforme AI_PROVIDER.
//
// O provedor selecionado é sempre o primário. O outro provedor entra como
// fallback automático, desde que a chave dele exista no ambiente — sem a chave
// o fallback é desativado (nada de cliente "mock" mascarando falha).
func NewClient(ctx context.Context, cfg config.Config) (Client, error) {
	switch cfg.AIProvider {
	case config.AIProviderGemini:
		if cfg.GeminiKey == "" {
			return nil, fmt.Errorf("GEMINI_API_KEY is required when AI_PROVIDER=%s", config.AIProviderGemini)
		}

		primary, err := NewGeminiClient(ctx, cfg)
		if err != nil {
			return nil, err
		}

		return withFallback(primary, newGroqFallback(cfg)), nil

	case config.AIProviderGroq:
		if cfg.GroqKey == "" {
			return nil, fmt.Errorf("GROQ_API_KEY is required when AI_PROVIDER=%s", config.AIProviderGroq)
		}

		return withFallback(NewGroqClient(cfg), newGeminiFallback(ctx, cfg)), nil

	default:
		return nil, fmt.Errorf(
			"unsupported AI provider %q (allowed: %s, %s)",
			cfg.AIProvider,
			config.AIProviderGemini,
			config.AIProviderGroq,
		)
	}
}

// newGroqFallback cria o cliente Groq usado como fallback, quando há chave.
func newGroqFallback(cfg config.Config) Client {
	if cfg.GroqKey == "" {
		slog.Warn("AI fallback disabled: GROQ_API_KEY is empty")
		return nil
	}

	return NewGroqClient(cfg)
}

// newGeminiFallback cria o cliente Gemini usado como fallback, quando há chave.
func newGeminiFallback(ctx context.Context, cfg config.Config) Client {
	if cfg.GeminiKey == "" {
		slog.Warn("AI fallback disabled: GEMINI_API_KEY is empty")
		return nil
	}

	client, err := NewGeminiClient(ctx, cfg)
	if err != nil {
		slog.Warn("AI fallback disabled: couldn't create gemini client", "error", err)
		return nil
	}

	return client
}

// withFallback combina primário e fallback, registrando a configuração ativa.
func withFallback(primary, fallback Client) Client {
	if fallback == nil {
		slog.Info("AI provider configured", "provider", clientName(primary), "fallback", "disabled")
		return primary
	}

	slog.Info(
		"AI provider configured",
		"provider", clientName(primary),
		"fallback", clientName(fallback),
	)

	return NewFallbackClient(primary, fallback)
}

// clientName devolve o nome do provedor, quando o cliente o conhece.
func clientName(client Client) string {
	if client == nil {
		return ""
	}

	if named, ok := client.(NamedClient); ok {
		return named.Name()
	}

	return ""
}
