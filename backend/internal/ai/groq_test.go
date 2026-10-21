package ai

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/jpoz/groq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeCompleter devolve respostas e erros scripts, guardando os params de
// cada chamada.
type fakeCompleter struct {
	responses []fakeResponse
	calls     []groq.CompletionCreateParams
}

type fakeResponse struct {
	content string
	err     error
}

func (f *fakeCompleter) CreateChatCompletion(params groq.CompletionCreateParams) (*groq.ChatCompletion, error) {
	f.calls = append(f.calls, params)
	if len(f.responses) == 0 {
		return nil, errors.New("no scripted response left")
	}
	next := f.responses[0]
	f.responses = f.responses[1:]
	if next.err != nil {
		return nil, next.err
	}
	return &groq.ChatCompletion{
		Choices: []groq.Choice{
			{Message: groq.ChoiceMessage{Content: next.content}},
		},
	}, nil
}

func newTestGroqClient(fake *fakeCompleter) *GroqClient {
	return &GroqClient{
		client:    fake,
		apiKey:    "test-key",
		model:     "openai/gpt-oss-20b",
		maxTokens: DefaultGroqMaxTokens,
	}
}

func TestGroqGenerate_RetriesInvalidJSONWithTokenLimit(t *testing.T) {
	fake := &fakeCompleter{
		responses: []fakeResponse{
			{err: errors.New("invalid_request_error: Failed to validate JSON. Please adjust your prompt.")},
			{content: `{"nodes":[]}`},
		},
	}

	content, err := newTestGroqClient(fake).Generate(context.Background(), Request{
		Prompt: "devolva um json",
		Format: OutputFormatJSON,
	})

	require.NoError(t, err)
	assert.Equal(t, `{"nodes":[]}`, content)
	require.Len(t, fake.calls, 2)

	// A primeira chamada vai sem teto (barato); a segunda, com o teto
	// que cabe a resposta inteira.
	assert.Equal(t, 0, fake.calls[0].MaxTokens)
	assert.Equal(t, DefaultGroqMaxTokens, fake.calls[1].MaxTokens)
}

func TestGroqGenerate_ReducesTokenLimitWhenRequestIsTooLarge(t *testing.T) {
	fake := &fakeCompleter{
		responses: []fakeResponse{
			{err: errors.New("invalid_request_error: Failed to validate JSON.")},
			{err: errors.New("tokens: Request too large for model `openai/gpt-oss-20b` on tokens per minute (TPM): Limit 8000, Requested 9436, please reduce your message size and try again.")},
			{content: `{"ok":true}`},
		},
	}

	content, err := newTestGroqClient(fake).Generate(context.Background(), Request{
		Prompt: "devolva um json",
		Format: OutputFormatJSON,
	})

	require.NoError(t, err)
	assert.Equal(t, `{"ok":true}`, content)
	require.Len(t, fake.calls, 3)
	assert.Equal(t, DefaultGroqMaxTokens, fake.calls[1].MaxTokens)
	assert.Equal(t, DefaultGroqMaxTokens*3/4, fake.calls[2].MaxTokens)
}

func TestGroqGenerate_ReturnsOtherErrors(t *testing.T) {
	fake := &fakeCompleter{
		responses: []fakeResponse{
			{err: errors.New("invalid_request_error: model not found")},
		},
	}

	_, err := newTestGroqClient(fake).Generate(context.Background(), Request{
		Prompt: "oi",
		Format: OutputFormatText,
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "model not found")
	assert.Len(t, fake.calls, 1)
}

func TestRetryDelay(t *testing.T) {
	err := fmt.Errorf("tokens: Rate limit reached ... Please try again in 20.835s.")
	assert.True(t, hasRetryDelay(err))
	assert.Equal(t, 20*time.Second+835*time.Millisecond, retryDelay(err))

	// O teto de espera é respeitado.
	long := fmt.Errorf("Please try again in 120s.")
	assert.Equal(t, MaxRetryDelay, retryDelay(long))

	assert.False(t, hasRetryDelay(errors.New("qualquer erro")))
}
