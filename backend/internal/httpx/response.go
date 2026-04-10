package httpx

import (
	"log"
	"net/http"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
)

func OK(c *gin.Context, payload gin.H) {
	c.JSON(http.StatusOK, payload)
}

func Message(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"message": msg})
}

func Error(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"error": msg})
}

func ErrorFrom(c *gin.Context, err error) {
	if err == nil {
		return
	}

	if appErr, ok := apperrors.As(err); ok {
		if appErr.Unwrap() != nil {
			log.Printf("request error: %s: %v", appErr.Error(), appErr.Unwrap())
		} else {
			log.Printf("request error: %s", appErr.Error())
		}
		c.JSON(appErr.Status(), gin.H{
			"error": appErr.Error(),
			"code":  appErr.Code(),
		})
		return
	}

	log.Printf("request error: %v", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
}
