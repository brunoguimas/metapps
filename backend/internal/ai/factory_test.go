package ai

import (
	"context"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewClientUsesSelectedProviderAsPrimary(t *testing.T) {
	tests := []struct {
		name             string
		cfg              config.Config
		expectedPrimary  string
		expectedFallback string
	}{
		{
			name: "gemini selected",
			cfg: config.Config{
				AIProvider: config.AIProviderGemini,
				GeminiKey:  "gemini-key",
				GroqKey:    "groq-key",
			},
			expectedPrimary:  config.AIProviderGemini,
			expectedFallback: config.AIProviderGroq,
		},
		{
			name: "groq selected",
			cfg: config.Config{
				AIProvider: config.AIProviderGroq,
				GeminiKey:  "gemini-key",
				GroqKey:    "groq-key",
			},
			expectedPrimary:  config.AIProviderGroq,
			expectedFallback: config.AIProviderGemini,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewClient(context.Background(), tt.cfg)
			require.NoError(t, err)

			fallback, ok := client.(*FallbackClient)
			require.True(t, ok, "expected the client to be a fallback chain")
			assert.Equal(t, tt.expectedPrimary, clientName(fallback.primary))
			assert.Equal(t, tt.expectedFallback, clientName(fallback.fallback))
			assert.Equal(t, tt.expectedPrimary, clientName(client))
		})
	}
}

func TestNewClientWithoutFallbackKey(t *testing.T) {
	cfg := config.Config{
		AIProvider: config.AIProviderGroq,
		GroqKey:    "groq-key",
	}

	client, err := NewClient(context.Background(), cfg)
	require.NoError(t, err)

	_, ok := client.(*FallbackClient)
	assert.False(t, ok, "expected no fallback chain when the fallback key is missing")
	assert.Equal(t, config.AIProviderGroq, clientName(client))
}

func TestNewClientRequiresSelectedProviderKey(t *testing.T) {
	tests := []struct {
		name string
		cfg  config.Config
	}{
		{
			name: "gemini selected without key",
			cfg:  config.Config{AIProvider: config.AIProviderGemini, GroqKey: "groq-key"},
		},
		{
			name: "groq selected without key",
			cfg:  config.Config{AIProvider: config.AIProviderGroq, GeminiKey: "gemini-key"},
		},
		{
			name: "unsupported provider",
			cfg:  config.Config{AIProvider: "gpt", GeminiKey: "gemini-key", GroqKey: "groq-key"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewClient(context.Background(), tt.cfg)
			require.Error(t, err)
			assert.Nil(t, client)
		})
	}
}
