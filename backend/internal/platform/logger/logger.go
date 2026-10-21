package logger

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

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

// rootCause percorre toda a cadeia de wraps e devolve o erro de origem.
// O repositorio/servico embrulham AppError dentro de AppError, entao
// desembrulhar um unico nivel esconderia a causa real (ex.: erro do driver).
func rootCause(err error) error {
	cause := err
	for {
		next := errors.Unwrap(cause)
		if next == nil {
			return cause
		}
		cause = next
	}
}

func causeAttrs(err error) []any {
	root := rootCause(err)
	if root == nil || root == err {
		return nil
	}

	attrs := []any{"cause", root.Error()}

	// com varios niveis de AppError embrulhado, a causa raiz sozinha perde o
	// contexto de onde o erro nasceu: a cadeia completa ajuda a localizar
	chain := make([]string, 0, 4)
	for e := err; e != nil; e = errors.Unwrap(e) {
		chain = append(chain, e.Error())
	}
	if len(chain) > 2 {
		attrs = append(attrs, "chain", strings.Join(chain, " <- "))
	}

	return attrs
}

// LogError logs an error with the given context and status.
// It should be used for errors that warrant an error-level log.
func LogError(c *gin.Context, err error, msg string, status int) {
	attrs := append(requestAttrs(c), "status", status)

	if err != nil {
		attrs = append(attrs, "error", err.Error())

		if appErr, ok := apperrors.As(err); ok {
			attrs = append(attrs, "code", string(appErr.Code()))
		}
		attrs = append(attrs, causeAttrs(err)...)
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
		}
		attrs = append(attrs, causeAttrs(err)...)
	} else {
		attrs = append(attrs, "error", "no error")
	}

	slog.Warn(msg, attrs...)
}
