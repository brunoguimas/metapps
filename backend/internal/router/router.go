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
	"github.com/brunoguimas/metapps/backend/internal/modules/task_attempt"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_correction"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func NewRouter(
a *auth.AuthHandler,
o *oauth.OAuthHandler,
h *health.HealthHandler,
g *goal.GoalHandler,
tp *topic.TopicHandler,
t *task.TaskHandler,
ta *task_attempt.Handler,
tcHandler *task_correction.Handler,
jwtService jwt.JWTService,
cfg *config.Config,
) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
	r.Use(middleware.Log)

	r.GET("/health/live", h.LiveCheck)
	r.GET("/health/ready", h.ReadyCheck)
	auth := r.Group("/auth")
	auth.Use(middleware.RateLimitMiddleware())
	{
		auth.POST("/register", a.Register)
		auth.POST("/login", a.Login)
		auth.POST("/refresh", a.Refresh)
		auth.GET("/me", a.Me)
		auth.POST("/email/verify", a.EmailVerify)
		auth.POST("/email/resend", a.ResendEmailVerification)
		auth.POST("/password/forgot", a.ForgotPassword)
		auth.POST("/password/reset", a.ResetPassword)
		auth.GET("/google/login", o.GoogleLogin)
		auth.GET("/google/callback", o.GoogleCallback)
	}

	protected := r.Group("/protected")
	protected.Use(middleware.AuthMiddleware(jwtService))
	{
		goals := protected.Group("/goals")
		{
			goals.POST("", g.Create)
			goals.GET("", g.List)
			goals.GET("/:id", g.Get)
			goals.PUT("/:id", g.Update)
			goals.DELETE("/:id", g.Delete)
		}
		roadmap := protected.Group("/roadmap")
		{
			roadmap.POST("/generate", tp.GenerateRoadmap)
			roadmap.GET("/:goalID", tp.GetRoadmap)
		}
		tasks := protected.Group("/tasks")
		{
			tasks.POST("/generate", t.Generate)
			tasks.GET("", t.List)
			tasks.GET("/:id", t.Get)
			tasks.POST("/:id/attempts", ta.Submit)
			tasks.GET("/:id/attempts", ta.ListByTask)
		}
		corrections := protected.Group("/corrections")
		{
			corrections.POST("", tcHandler.CreateCorrection)
			corrections.GET("/attempt/:attemptID", tcHandler.GetCorrectionByAttemptID)
			corrections.POST("/essay/:attemptID", tcHandler.GenerateEssayCorrection)
			corrections.POST("/quiz/:attemptID", tcHandler.GenerateQuizCorrection)
		}
		protected.GET("/task-attempts", ta.ListByUser)
	}

	return r
}
