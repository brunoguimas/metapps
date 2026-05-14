package health

import (
	"time"

	"github.com/jpoz/groq"
)

type AIChecker interface {
	AIStatus() StatusService
}

type aiChecker struct {
	client *groq.Client
}

func NewAIChecker(ai *groq.Client) AIChecker {
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

	_, err := a.client.CreateChatCompletion(groq.CompletionCreateParams{
		Model: "llama-3.3-70b-versatile",
		Messages: []groq.Message{
			{
				Role:    "user",
				Content: "Qual sua MPB favorita?",
			},
		},
		ResponseFormat: groq.ResponseFormat{
			Type: "text",
		},
	})

	latency := time.Since(start).Milliseconds()

	if err != nil {
		return StatusService{
			Status: "down",
			LatencyMS: int64(latency),
			Error: err.Error(),
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
