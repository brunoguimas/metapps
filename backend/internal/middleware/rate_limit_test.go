package middleware

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
)

func setupRateLimitEngine() (*gin.Engine, *int) {
	gin.SetMode(gin.TestMode)

	var hits int
	r := gin.New()
	r.Use(RateLimitMiddleware())
	r.POST("/probe", func(c *gin.Context) {
		hits++
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return r, &hits
}

// O bug original: sem c.Abort(), o Gin continuava percorrendo a cadeia e o
// handler real rodava mesmo depois da resposta 429.
func TestRateLimitAbortsHandlerWhenLimited(t *testing.T) {
	resetLimiter()
	r, hits := setupRateLimitEngine()

	for range burst {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/probe", nil))
		require.Equal(t, http.StatusOK, w.Code)
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/probe", nil))

	assert.Equal(t, http.StatusTooManyRequests, w.Code)
	assert.Equal(t, burst, *hits, "o handler não pode executar depois do 429")
}

// Header precisa existir de verdade: escrevê-lo depois do corpo não o envia.
func TestRateLimitSetsRetryAfterHeader(t *testing.T) {
	resetLimiter()
	r, _ := setupRateLimitEngine()

	for range burst {
		r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/probe", nil))
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/probe", nil))

	assert.Equal(t, "1", w.Header().Get("Retry-After"))
	assert.Equal(t, "0", w.Header().Get("X-RateLimit-Remaining"))
}

func TestRateLimitReportsRemainingOnSuccess(t *testing.T) {
	resetLimiter()
	r, _ := setupRateLimitEngine()

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/probe", nil))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "10", w.Header().Get("X-RateLimit-Limit"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Remaining"))
}

func TestRateLimitRefillsOverTime(t *testing.T) {
	resetLimiter()
	r, _ := setupRateLimitEngine()

	for range burst {
		r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/probe", nil))
	}
	require.Equal(t, http.StatusTooManyRequests,
		rec(r).Code)

	// A 5 tokens/s, ~300ms já devolve tokens suficientes para uma requisição.
	time.Sleep(300 * time.Millisecond)

	assert.Equal(t, http.StatusOK, rec(r).Code)
}

// O map era lido fora do mutex na versão anterior (race detector).
func TestRateLimitIsConcurrencySafe(t *testing.T) {
	resetLimiter()
	r, _ := setupRateLimitEngine()

	var wg sync.WaitGroup
	for range 50 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/probe", nil))
		}()
	}
	wg.Wait()

	limiter.mu.Lock()
	size := len(limiter.buckets)
	limiter.mu.Unlock()
	assert.Equal(t, 1, size, "todos share a mesma origem, logo um único bucket")
}

func TestRateLimitPrunesIdleBuckets(t *testing.T) {
	resetLimiter()

	limiter.mu.Lock()
	limiter.buckets["10.0.0.1"] = &bucket{
		limiter:  rate.NewLimiter(ratePerSecond, burst),
		lastSeen: time.Now().Add(-2 * bucketTTL),
	}
	limiter.buckets["10.0.0.2"] = &bucket{
		limiter:  rate.NewLimiter(ratePerSecond, burst),
		lastSeen: time.Now(),
	}
	limiter.lastGC = time.Now().Add(-2 * pruneInterval)
	limiter.mu.Unlock()

	limiter.allow("10.0.0.3")

	limiter.mu.Lock()
	_, stale := limiter.buckets["10.0.0.1"]
	_, active := limiter.buckets["10.0.0.2"]
	limiter.mu.Unlock()

	assert.False(t, stale, "bucket ocioso deve ser descartado")
	assert.True(t, active, "bucket em uso deve sobreviver")
}

func rec(r *gin.Engine) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/probe", nil))
	return w
}

func resetLimiter() {
	limiter.mu.Lock()
	limiter.buckets = make(map[string]*bucket)
	limiter.lastGC = time.Now()
	limiter.mu.Unlock()
}
