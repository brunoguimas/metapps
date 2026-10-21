package middleware

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// ─── LIMITADOR POR IP ────────────────────────────────────────────
//
// Um token bucket por IP protege as rotas de /auth, onde cada tentativa
// custa bcrypt (CPU) e, no cadastro, envio de e-mail (SMTP).
//
// Três correções em relação à versão anterior deste arquivo:
//
//  1. c.Abort() é obrigatório. Sem ele o Gin segue percorrendo a cadeia
//     de handlers depois que o middleware retorna, ou seja, a resposta 429
//     era escrita e o handler real executava do mesmo jeito — o limitador
//     segurava a resposta, não o trabalho.
//  2. Retry-After precisa ser escrito ANTES do corpo, senão a resposta já
//     foi flushada e o header nunca chega no cliente.
//  3. O map de buckets cresce sem limite (um IP por entrada, para sempre).
//     Buckets ociosos são descartados periodicamente.

const (
	// ratePerSecond é o ritmo de reposição do bucket.
	ratePerSecond rate.Limit = 5
	// burst é quantas requisições podem passar de uma vez.
	burst = 10
	// bucketTTL é quanto tempo um bucket ocioso sobrevive sem ser usado.
	bucketTTL = 10 * time.Minute
	// pruneInterval é de quanto em quanto tempo o map é varrido.
	pruneInterval = 5 * time.Minute
	// retryAfter é o segundo inteiro a esperar: com ratePerSecond >= 1, um
	// bucket cheio sempre recupera ao menos um token nesse intervalo.
	retryAfter = 1
)

type bucket struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type ipLimiter struct {
	buckets map[string]*bucket
	mu      sync.Mutex
	lastGC  time.Time
}

var limiter = ipLimiter{
	buckets: make(map[string]*bucket),
	lastGC:  time.Now(),
}

// allow consumo um token para o IP informado e devolve quantos restaram.
func (l *ipLimiter) allow(ip string) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.gcLocked()

	b, ok := l.buckets[ip]
	if !ok {
		b = &bucket{limiter: rate.NewLimiter(ratePerSecond, burst)}
		l.buckets[ip] = b
	}
	b.lastSeen = time.Now()

	// Tokens() e Allow() saem lidos sob o mesmo lock: ler o mapa por fora
	// seria acesso concorrente a um map que outras goroutines escrevem.
	ok = b.limiter.Allow()
	return ok, int(b.limiter.Tokens())
}

// gcLocked descarta buckets sem uso. O caller precisa segurar o mutex.
func (l *ipLimiter) gcLocked() {
	now := time.Now()
	if now.Sub(l.lastGC) < pruneInterval {
		return
	}
	l.lastGC = now

	for ip, b := range l.buckets {
		if now.Sub(b.lastSeen) > bucketTTL {
			delete(l.buckets, ip)
		}
	}
}

func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.RemoteIP()
		c.Header("X-RateLimit-Limit", strconv.Itoa(burst))

		allowed, remaining := limiter.allow(ip)

		if !allowed {
			// Headers primeiro: depois de escrever o corpo não dá mais
			// para acrescentar nenhum.
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("Retry-After", strconv.Itoa(retryAfter))
			c.Abort()
			httpx.Error(c, http.StatusTooManyRequests, "many requests, try again later")
			return
		}

		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Next()
	}
}
