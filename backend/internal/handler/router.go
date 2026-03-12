package handler

import (
	authpkg "github.com/brunoguimas/metapps/backend/internal/auth"
	"github.com/gin-gonic/gin"
)

func NewRouter(h *UserHandler) *gin.Engine {
	r := gin.Default()

	r.GET("/hello", func(c *gin.Context) { c.Redirect(302, "https://i.imgur.com/9DggHXo.png") })
	r.GET("/aura", func(c *gin.Context) { c.Redirect(302, "https://youtu.be/W4xiDERxHx4?si=SMEl16JnqrJ9PBKv") })

	authGroup := r.Group("/auth")
	{
		authGroup.POST("/register", h.Register)
		authGroup.POST("/login", h.Login)
		authGroup.POST("/refresh", h.Refresh)
		authGroup.GET("/google/login", h.GoogleLogin)
		authGroup.GET("/google/callback", h.GoogleCallback)
	}

	protected := r.Group("/protected")
	protected.Use(authpkg.AuthMiddleware(h.jwtService))
	{
		protected.GET("/home", func(c *gin.Context) {
			userID, _ := c.Get("user_id")
			c.JSON(200, gin.H{
				"message": "Authorized",
				"user_id": userID,
			})
		})
	}

	return r
}
