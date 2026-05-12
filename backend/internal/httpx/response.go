package httpx

import (
	"net/http"

	"github.com/brunoguimas/metapps/backend/internal/platform/logger"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
)

func OK(c *gin.Context, payload gin.H) {
	logger.LogResponse(c, "request completed", http.StatusOK)
	c.JSON(http.StatusOK, payload)
}

func Created(c *gin.Context, payload gin.H) {
	logger.LogResponse(c, "resource created", http.StatusCreated)
	c.JSON(http.StatusCreated, payload)
}

func Status(c *gin.Context, status int, payload gin.H, msg string) {
	logger.LogResponse(c, msg, status)
	c.JSON(status, payload)
}

func Message(c *gin.Context, status int, msg string) {
	logger.LogResponse(c, msg, status)
	c.JSON(status, gin.H{"message": msg})
}

func Error(c *gin.Context, status int, msg string) {
	logError(c, nil, msg, status)
	c.JSON(status, gin.H{"error": msg})
}

func ErrorFrom(c *gin.Context, err error) {
	if err == nil {
		return
	}

	if appErr, ok := apperrors.As(err); ok {
		logError(c, err, appErr.Error(), appErr.Status())
		c.JSON(appErr.Status(), gin.H{
			"error": appErr.Error(),
			"code":  appErr.Code(),
		})
		return
	}

	logError(c, err, "internal server error", http.StatusInternalServerError)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
}

func logError(c *gin.Context, err error, msg string, status int) {
	logFn := logger.SeverityForStatus(status)
	if logFn == nil {
		logger.LogResponse(c, msg, status)
		return
	}

	logFn(c, err, msg, status)
}
