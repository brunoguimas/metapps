package middleware

import (
	"time"

	platformlogger "github.com/brunoguimas/metapps/backend/internal/platform/logger"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func Log(c *gin.Context) {
	start := time.Now()

	requestID := uuid.New().String()
	c.Set("request_id", requestID)
	c.Next()

	duration := time.Since(start)

	platformlogger.LogSystemInfo("http_request",
		"request_id", requestID,
		"method", c.Request.Method,
		"path", c.FullPath(),
		"status", c.Writer.Status(),
		"duration_ms", duration.Milliseconds(),
		"client_ip", c.ClientIP(),
	)
}
