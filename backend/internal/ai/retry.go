package ai

import (
	"context"
	"math"
	"math/rand"
	"time"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
)

// Tentativas totais por chamada de IA (inclui a primeira). O SDK do Gemini
// já repete 5x por dentro em 429/5xx, então este número é deliberadamente
// baixo: repassar o prompt inteiro dez vezes só piora o pico de demanda.
const MaxAttempts = 3

const (
	backoffBase = 1 * time.Second
	backoffCap  = 8 * time.Second
)

// IsUpstreamUnavailable reports whether err is a transient provider failure
// rather than a bad response. Callers use it to decide between waiting and
// rewriting the prompt: a 503 gets the same answer no matter how the prompt
// is worded, so feeding the error back to the model only wastes a call.
func IsUpstreamUnavailable(err error) bool {
	appErr, ok := apperrors.As(err)
	return ok && appErr.Code() == apperrors.ErrUpstreamUnavailable
}

// Backoff waits before retrying attempt (0-based) with exponential growth and
// jitter. It returns the context error if the call was cancelled or timed out
// while waiting, so callers should give up rather than keep trying.
func Backoff(ctx context.Context, attempt int) error {
	wait := time.Duration(float64(backoffBase) * math.Pow(2, float64(attempt)))
	if wait > backoffCap {
		wait = backoffCap
	}
	// Jitter total (±25%) para que várias requisições que caíram juntas no
	// mesmo pico não voltem a bater no provedor no mesmo instante.
	jitter := 1 + (rand.Float64()*0.5 - 0.25)

	timer := time.NewTimer(time.Duration(float64(wait) * jitter))
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}