package logger

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
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

func LogResponse(c *gin.Context, msg string, status int) {
	attrs := append(requestAttrs(c), "status", status)
	slog.Info(msg, attrs...)
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

// LogError logs an error with the given context and status.
// It should be used for errors that warrant an error-level log.
func LogError(c *gin.Context, err error, msg string, status int) {
	errStr := "no error"
	if err != nil {
		errStr = err.Error()
	}

	attrs := append(requestAttrs(c),
		"error", errStr,
		"status", status,
	)
	slog.Error(msg, attrs...)
}

// LogWarn logs a warning with the given context and status.
// It should be used for non-critical issues that warrant a warning-level log.
func LogWarn(c *gin.Context, err error, msg string, status int) {
	errStr := "no error"
	if err != nil {
		errStr = err.Error()
	}

	attrs := append(requestAttrs(c),
		"error", errStr,
		"status", status,
	)
	slog.Warn(msg, attrs...)
}