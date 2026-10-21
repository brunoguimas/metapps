package ai

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStripCodeFences(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected string
	}{
		{
			name:     "json fence with language",
			content:  "```json\n{\"a\":1}\n```",
			expected: "{\"a\":1}",
		},
		{
			name:     "json fence without language",
			content:  "```\n{\"a\":1}\n```",
			expected: "{\"a\":1}",
		},
		{
			name:     "pure json is unchanged",
			content:  "{\"a\":1}",
			expected: "{\"a\":1}",
		},
		{
			name:     "text without fence is unchanged",
			content:  "  parabéns pelo esforço  ",
			expected: "parabéns pelo esforço",
		},
		{
			name:     "fence without content",
			content:  "```json",
			expected: "",
		},
		{
			name:     "unterminated fence",
			content:  "```json\n{\"a\":1}",
			expected: "{\"a\":1}",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, stripCodeFences(tt.content))
		})
	}
}
