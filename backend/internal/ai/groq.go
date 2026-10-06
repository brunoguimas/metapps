package ai

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jpoz/groq"
)

type GroqClient struct {
	client *groq.Client
	apiKey string
	model  string
}

const (
	GroqModel = "llama-3.3-70b-versatile"
	UserRole  = "user"
)

func NewGroqClient() *GroqClient {
	client := groq.NewClient()
	return &GroqClient{
		client: client,
		apiKey: os.Getenv("GROQ_API_KEY"),
		model:  GroqModel,
	}
}

func (g *GroqClient) Generate(ctx context.Context, prompt string) (string, error) {
	if g.apiKey == "" {
		return "", fmt.Errorf("GROQ_API_KEY is empty")
	}

	if err := ctx.Err(); err != nil {
		return "", err
	}

	params := groq.CompletionCreateParams{
		Model: g.model,
		Messages: []groq.Message{
			{
				Role:    UserRole,
				Content: prompt,
			},
		},
	}

	if expectsJSON(prompt) {
		params.ResponseFormat = groq.ResponseFormat{
			Type: "json_object",
		}
	}

	response, err := g.client.CreateChatCompletion(params)
	if err != nil {
		return "", err
	}

	if len(response.Choices) == 0 {
		return "", fmt.Errorf("groq returned no choices")
	}

	return response.Choices[0].Message.Content, nil
}

func expectsJSON(prompt string) bool {
	prompt = strings.ToLower(prompt)
	return strings.Contains(prompt, "json")
}
