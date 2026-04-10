package router

import (
	"time"

	"github.com/brunoguimas/metapps/backend/internal/middleware"
	"github.com/brunoguimas/metapps/backend/internal/modules/auth"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/health"
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/modules/oauth"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func NewRouter(a *auth.AuthHandler, o *oauth.OAuthHandler, h *health.HealthHandler, g *goal.GoalHandler, t *task.TaskHandler, jwtService jwt.JWTService, cfg *config.Config) *gin.Engine {
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/health", h.HealthCheck)
	auth := r.Group("/auth")
	auth.Use(middleware.RateLimitMiddleware())
	{
		auth.POST("/register", a.Register)
		auth.POST("/login", a.Login)
		auth.POST("/refresh", a.Refresh)
		auth.GET("/me", a.Me)
		auth.GET("/email/verify", a.EmailVerify)
		auth.POST("/email/resend", a.ResendEmailVerification)
		auth.GET("/google/login", o.GoogleLogin)
		auth.GET("/google/callback", o.GoogleCallback)
	}

	protected := r.Group("/protected")
	protected.Use(middleware.AuthMiddleware(jwtService))
	{
		// protected.POST("/email/update", a.EmailUpdate)
		// protected.POST("/password/update", a.PasswordUpdate)
		protected.GET("/home", func(c *gin.Context) {
			userID, _ := c.Get("user_id")
			c.JSON(200, gin.H{
				"message": "Authorized",
				"user_id": userID,
			})
		})

		goals := protected.Group("/goals")
		{
			goals.POST("", g.Create)
			goals.GET("", g.List)
			goals.GET("/:id", g.Get)
			goals.PUT("/:id", g.Update)
			goals.DELETE("/:id", g.Delete)
		}
		tasks := protected.Group("/tasks")
		{
			tasks.POST("/generate", t.Generate)
			tasks.GET("", t.List)
			tasks.GET("/:id", t.Get)
		}
	}

	return r
}
