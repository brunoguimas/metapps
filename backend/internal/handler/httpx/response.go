package httpx

import (
	"net/http"

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
