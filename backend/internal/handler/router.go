package handler

import (
	"time"

	"github.com/brunoguimas/metapps/backend/config"
	authpkg "github.com/brunoguimas/metapps/backend/internal/auth"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func NewRouter(a *AuthHandler, o *OAuthHandler, cfg *config.Config) *gin.Engine {
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/hello", func(c *gin.Context) { c.Redirect(302, "https://i.imgur.com/9DggHXo.png") })
	r.GET("/aura", func(c *gin.Context) { c.Redirect(302, "https://youtu.be/W4xiDERxHx4?si=SMEl16JnqrJ9PBKv") })

	auth := r.Group("/auth")
	{
		auth.POST("/register", a.Register)
		auth.POST("/login", a.Login)
		auth.POST("/refresh", a.Refresh)
		auth.GET("/google/login", o.GoogleLogin)
		auth.GET("/google/callback", o.GoogleCallback)
		auth.GET("/email/verify", a.EmailVerify)
	}

	protected := r.Group("/protected")
	protected.Use(authpkg.AuthMiddleware(a.jwt))
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
