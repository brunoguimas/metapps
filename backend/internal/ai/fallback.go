package ai

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
)

type FallbackClient struct {
	primary  Client
	fallback Client
}

func NewFallbackClient(primary, fallback Client) *FallbackClient {
	return &FallbackClient{
		primary:  primary,
		fallback: fallback,
	}
}

func (c *FallbackClient) Generate(ctx context.Context, prompt string) (string, error) {
	content, err := c.primary.Generate(ctx, prompt)
	if err == nil && strings.TrimSpace(content) != "" {
		return content, nil
	}

	primaryErr := err
	if primaryErr == nil {
		primaryErr = fmt.Errorf("primary AI returned empty content")
	}

	slog.Warn("primary AI generation failed, trying fallback", "error", primaryErr)

	content, err = c.fallback.Generate(ctx, prompt)
	if err != nil {
		return "", fmt.Errorf("primary AI failed: %w; fallback AI failed: %v", primaryErr, err)
	}

	if strings.TrimSpace(content) == "" {
		return "", fmt.Errorf("primary AI failed: %w; fallback AI returned empty content", primaryErr)
	}

	return content, nil
}
