package logger

import (
	"errors"
	"log/slog"
	"net/http"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
)

func requestAttrs(c *gin.Context) []any {
	attrs := make([]any, 0, 10)

	if reqID, ok := c.Get("request_id"); ok && reqID != "" {
		attrs = append(attrs, "request_id", reqID)
	}
	if userID, ok := c.Get("user_id"); ok && userID != "" {
		attrs = append(attrs, "user_id", userID)
	}

	attrs = append(attrs,
		"method", c.Request.Method,
		"path", c.Request.URL.Path,
		"client_ip", c.ClientIP(),
	)

	return attrs
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
		if cause := errors.Unwrap(err); cause != nil {
			attrs = append(attrs, "cause", cause.Error())
		}
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
	attrs := append(requestAttrs(c), "status", status)

	if err != nil {
		attrs = append(attrs, "error", err.Error())

		if appErr, ok := apperrors.As(err); ok {
			attrs = append(attrs, "code", string(appErr.Code()))
			if cause := appErr.Unwrap(); cause != nil {
				attrs = append(attrs, "cause", cause.Error())
			}
		} else if cause := errors.Unwrap(err); cause != nil {
			attrs = append(attrs, "cause", cause.Error())
		}
	} else {
		attrs = append(attrs, "error", "no error")
	}

	slog.Error(msg, attrs...)
}

// LogWarn logs a warning with the given context and status.
// It should be used for non-critical issues that warrant a warning-level log.
func LogWarn(c *gin.Context, err error, msg string, status int) {
	attrs := append(requestAttrs(c), "status", status)

	if err != nil {
		attrs = append(attrs, "error", err.Error())

		if appErr, ok := apperrors.As(err); ok {
			attrs = append(attrs, "code", string(appErr.Code()))
			if cause := appErr.Unwrap(); cause != nil {
				attrs = append(attrs, "cause", cause.Error())
			}
		} else if cause := errors.Unwrap(err); cause != nil {
			attrs = append(attrs, "cause", cause.Error())
		}
	} else {
		attrs = append(attrs, "error", "no error")
	}

	slog.Warn(msg, attrs...)
}