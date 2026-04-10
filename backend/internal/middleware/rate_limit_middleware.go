package middleware

import (
	"net/http"
	"strconv"
	"sync"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type IPlimiter struct {
	ips map[string]*rate.Limiter
	mu  sync.Mutex
}

var limiter = IPlimiter{ips: make(map[string]*rate.Limiter)}

func getLimiter(ip string) *rate.Limiter {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	l, exists := limiter.ips[ip]
	if !exists {
		l = rate.NewLimiter(rate.Limit(5), 10)
		limiter.ips[ip] = l
	}

	return l
}

func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.RemoteIP()
		c.Header("X-RateLimit-Limit", strconv.Itoa(10))

		if !getLimiter(ip).Allow() {
			httpx.Error(c, http.StatusTooManyRequests, "many requests, try again later")
			c.Header("Retry-After", "1")
			return
		}

		remaining := int(limiter.ips[ip].Tokens())
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Next()
	}
}
