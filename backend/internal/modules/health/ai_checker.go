package health

import (
	"context"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/ai"
)

type AIChecker interface {
	AIStatus() StatusService
}

type aiChecker struct {
	client ai.Client
}

func NewAIChecker(ai ai.Client) AIChecker {
	return &aiChecker{
		client: ai,
	}
}

func (a *aiChecker) AIStatus() StatusService {
	provider := providerName(a.client)

	if a.client == nil {
		return StatusService{
			Status:    "down",
			LatencyMS: 0,
			Provider:  provider,
			Error:     "ai client is not configured",
		}
	}

	start := time.Now()

	_, err := a.client.Generate(context.Background(), ai.Request{
		Prompt: "Qual sua MPB favorita?",
		Format: ai.OutputFormatText,
	})

	latency := time.Since(start).Milliseconds()

	if err != nil {
		return StatusService{
			Status:    "down",
			LatencyMS: int64(latency),
			Provider:  provider,
			Error:     err.Error(),
		}
	}
	if latency > 2000 {
		return StatusService{
			Status:    "slow",
			LatencyMS: int64(latency),
			Provider:  provider,
		}
	}

	return StatusService{
		Status:    "up",
		LatencyMS: int64(latency),
		Provider:  provider,
	}
}

// providerName devolve o nome do provedor em uso, quando o cliente o conhece.
func providerName(client ai.Client) string {
	if client == nil {
		return ""
	}

	if named, ok := client.(ai.NamedClient); ok {
		return named.Name()
	}

	return ""
}
