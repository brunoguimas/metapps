package ai

import (
	"context"
	"fmt"
	"sync"

	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"google.golang.org/genai"
)

const (
	Model = "models/gemini-3.5-flash-lite"
)

type GeminiClient struct {
	client   *genai.Client
	apiKey   string
	mockOnce sync.Once
}

func NewGeminiClient(ctx context.Context, cfg config.Config) (*GeminiClient, error) {
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey: cfg.GeminiKey,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create gemini client", err)
	}

	return &GeminiClient{
		client: client,
		apiKey: cfg.GeminiKey,
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
		Model,
		genai.Text(prompt),
		nil,
	)
	if err != nil {
		fmt.Printf("ERROR: Gemini API call failed: %v\n", err)
		return "", apperrors.NewAppError(apperrors.ErrInternal, "failed to generate content from gemini", err)
	}

	if resp.Text() == "" {
		return "", fmt.Errorf("no content generated")
	}

	return resp.Text(), nil
}
