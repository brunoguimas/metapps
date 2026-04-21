package ai

import (
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

func NewGroqClient() *GroqClient {
	return &GroqClient{
		client: groq.NewClient(),
		model:  GroqModel,
	}
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

	return response.Choices[0].Message.Content, nil
}
