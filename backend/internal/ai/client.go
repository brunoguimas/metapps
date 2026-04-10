package ai

type Client interface {
	Generate(prompt string) (string, error)
}
