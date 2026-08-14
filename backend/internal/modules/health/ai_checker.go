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
	if a.client == nil {
		return StatusService{
			Status:    "down",
			LatencyMS: 0,
			Error:     "ai client is not configured",
		}
	}

	start := time.Now()

	_, err := a.client.Generate(context.Background(), "Qual sua MPB favorita?")

	latency := time.Since(start).Milliseconds()

	if err != nil {
		return StatusService{
			Status:    "down",
			LatencyMS: int64(latency),
			Error:     err.Error(),
		}
	}
	if latency > 2000 {
		return StatusService{
			Status:    "slow",
			LatencyMS: int64(latency),
		}
	}

	return StatusService{
		Status:    "up",
		LatencyMS: int64(latency),
	}
}
