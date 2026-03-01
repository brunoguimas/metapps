package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func NewRouter(h *UserHandler) *gin.Engine {
	r := gin.Default()

	r.GET("/hello", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"message": "Hello, World"}) })
	r.POST("/register", h.Register)

	return r
}
