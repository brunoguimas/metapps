package logger

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func requestAttrs(c *gin.Context) []any {
	requestID, _ := c.Get("request_id")

	return []any{
		"request_id", requestID,
		"method", c.Request.Method,
		"path", c.Request.URL.Path,
		"client_ip", c.ClientIP(),
	}
}

func LogInfo(c *gin.Context, msg string) {
	slog.Info(msg, requestAttrs(c)...)
}

func LogWithUser(c *gin.Context, msg string, user_id uuid.UUID) {
	attrs := append(requestAttrs(c), "user_id", user_id)
	slog.Info(msg, attrs...)
}

func LogWarn(c *gin.Context, err error, msg string, status int) {
	logWithStatus(c, err, msg, status, slog.Warn)
}

func LogError(c *gin.Context, err error, msg string, status int) {
	logWithStatus(c, err, msg, status, slog.Error)
}

func LogResponse(c *gin.Context, msg string, status int) {
	attrs := append(requestAttrs(c), "status", status)
	slog.Info(msg, attrs...)
}

func logWithStatus(c *gin.Context, err error, msg string, status int, logFn func(string, ...any)) {
	errStr := "no error"
	if err != nil {
		errStr = err.Error()
	}

	attrs := append(requestAttrs(c),
		"error", errStr,
		"status", status,
	)
	logFn(msg, attrs...)
}

func LogSystemInfo(msg string, attrs ...any) {
	slog.Info(msg, attrs...)
}

func LogSystemWarn(msg string, attrs ...any) {
	slog.Warn(msg, attrs...)
}

func LogSystemError(msg string, err error, attrs ...any) {
	if err != nil {
		attrs = append(attrs, "error", err.Error())
	}

	slog.Error(msg, attrs...)
}

func SeverityForStatus(status int) func(*gin.Context, error, string, int) {
	if status >= http.StatusInternalServerError {
		return LogError
	}

	if status >= http.StatusBadRequest {
		return LogWarn
	}

	return nil
}
