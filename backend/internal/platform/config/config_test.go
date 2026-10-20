package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseAIProvider(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		expected string
		wantErr  bool
	}{
		{name: "empty falls back to default", value: "", expected: AIProviderGemini},
		{name: "gemini", value: "gemini", expected: AIProviderGemini},
		{name: "groq", value: "groq", expected: AIProviderGroq},
		{name: "uppercase is normalized", value: "GEMINI", expected: AIProviderGemini},
		{name: "surrounding spaces are trimmed", value: "  groq  ", expected: AIProviderGroq},
		{name: "unknown provider fails", value: "gpt", wantErr: true},
		{name: "typo fails", value: "genimi", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider, err := parseAIProvider(tt.value)

			if tt.wantErr {
				require.Error(t, err)
				assert.Empty(t, provider)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expected, provider)
		})
	}
}

func TestValidateAIKeys(t *testing.T) {
	tests := []struct {
		name      string
		provider  string
		geminiKey string
		groqKey   string
		wantErr   bool
	}{
		{name: "gemini with key", provider: AIProviderGemini, geminiKey: "key"},
		{name: "gemini without key", provider: AIProviderGemini, wantErr: true},
		{name: "groq with key", provider: AIProviderGroq, groqKey: "key"},
		{name: "groq without key", provider: AIProviderGroq, wantErr: true},
		{
			name:      "fallback key is optional",
			provider:  AIProviderGroq,
			groqKey:   "key",
			geminiKey: "",
		},
		{
			name:      "fallback key present is accepted",
			provider:  AIProviderGemini,
			geminiKey: "key",
			groqKey:   "key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateAIKeys(tt.provider, tt.geminiKey, tt.groqKey)

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
		})
	}
}
