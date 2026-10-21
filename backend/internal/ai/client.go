package ai

import "context"

// OutputFormat define o formato esperado da resposta do modelo.
type OutputFormat string

const (
	// OutputFormatText espera texto livre.
	OutputFormatText OutputFormat = "text"
	// OutputFormatJSON espera um JSON válido, sem cercas de markdown.
	OutputFormatJSON OutputFormat = "json"
)

// Request é a requisição enviada a um provedor de IA.
type Request struct {
	// Prompt é o texto enviado ao modelo.
	Prompt string
	// Format é o formato esperado da resposta.
	Format OutputFormat
}

// Client é a interface implementada por todos os provedores de IA.
type Client interface {
	Generate(ctx context.Context, req Request) (string, error)
}

// NamedClient expõe o nome do provedor (usado no health check).
type NamedClient interface {
	Client
	Name() string
}
