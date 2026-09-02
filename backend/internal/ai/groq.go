package ai

import (
	"fmt"

	"github.com/jpoz/groq"
)

type GroqClient struct {
	client *groq.Client
	model  string
}

const (
	GroqModel = "llama-3.3-70b-versatile"
	UserRole  = "user"
)

func NewGroqClient() (*GroqClient, *groq.Client) {
	client := groq.NewClient()
	return &GroqClient{
		client: client,
		model:  GroqModel,
	}, client
}

func (g *GroqClient) Generate(prompt string) (string, error) {
	response, err := g.client.CreateChatCompletion(groq.CompletionCreateParams{
		Model: g.model,
		Messages: []groq.Message{
			{
				Role:    UserRole,
				Content: prompt,
			},
		},
		ResponseFormat: groq.ResponseFormat{
			Type: "json_object",
		},
	})
	if err != nil {
		return "", err
	}

	if len(response.Choices) == 0 {
		return "", fmt.Errorf("groq returned no choices")
	}

	return response.Choices[0].Message.Content, nil
}
