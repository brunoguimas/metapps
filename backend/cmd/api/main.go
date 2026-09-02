package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/auth"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/health"
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/modules/mail"
	"github.com/brunoguimas/metapps/backend/internal/modules/oauth"
	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_attempt"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_correction"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/brunoguimas/metapps/backend/internal/platform/jobs"
	platformlogger "github.com/brunoguimas/metapps/backend/internal/platform/logger"
	"github.com/brunoguimas/metapps/backend/internal/router"
	"github.com/gin-gonic/gin"
	"github.com/jpoz/groq"
)

// AppModules holds all initialized application modules.
type AppModules struct {
	MailModule           *mail.Module
	JWTModule            *jwt.Module
	UserModule           *user.Module
	GoalModule           *goal.Module
	OauthModule          *oauth.Module
	AuthModule           *auth.Module
	ProfileModule        *profile.Module
	AIClient             ai.Client
	GroqClient           *groq.Client
	HealthModule         *health.Module
	TopicDependencySvc   topic_dependency.Service
	TopicModule          *topic.Module
	TaskModule           *task.Module
	TaskAttemptModule    *task_attempt.Module
	TaskCorrectionModule *task_correction.Module
}

func newAppModules(cfg *config.Config, queries *db.Queries) (*AppModules, error) {
	// Mail module
	mailModule, err := mail.NewModule(queries, cfg)
	if err != nil {
		return nil, err
	}

	// JWT module
	jwtModule := jwt.NewModule(queries, cfg)

	// User module
	userModule := user.NewModule(queries)

	// Goal module
	goalModule := goal.NewModule(queries)

	// OAuth module
	oauthModule := oauth.NewModule(queries, userModule.Repository, jwtModule.Service, cfg)

	// Profile module
	profileModule := profile.NewModule(queries, cfg)

	// Auth module
	authModule := auth.NewModule(userModule.Repository, userModule.Service, jwtModule.Service, mailModule.Service, profileModule.Service, cfg)

	// AI clients
	geminiClient, err := ai.NewGeminiClient(context.Background(), *cfg)
	if err != nil {
		return nil, err
	}

	// Health module
	healthModule := health.NewModule(queries, geminiClient, time.Now())

	// Topic dependency service
	topicDependencyRepo := topic_dependency.NewRepository(queries)
	topicDependencyService := topic_dependency.NewService(topicDependencyRepo)

	// Topic module
	topicModule := topic.NewModule(topicDependencyService, goalModule.Service, geminiClient, queries, cfg)

	// Task module
	taskModule := task.NewModule(queries, topicModule.Service, geminiClient, goalModule, cfg)

	// Task attempt module
	taskAttemptModule := task_attempt.NewModule(queries, taskModule)

	// Task correction module
	taskCorrectionModule := task_correction.NewModule(queries, taskAttemptModule.Repository, taskModule.Repository, geminiClient, jwtModule.Service)

	return &AppModules{
		MailModule:           mailModule,
		JWTModule:            jwtModule,
		UserModule:           userModule,
		GoalModule:           goalModule,
		OauthModule:          oauthModule,
		AuthModule:           authModule,
		ProfileModule:        profileModule,
		AIClient:             geminiClient,
		HealthModule:         healthModule,
		TopicDependencySvc:   topicDependencyService,
		TopicModule:          topicModule,
		TaskModule:           taskModule,
		TaskAttemptModule:    taskAttemptModule,
		TaskCorrectionModule: taskCorrectionModule,
	}, nil
}

func newRouter(cfg *config.Config, modules *AppModules) *gin.Engine {
	return router.NewRouter(
		modules.AuthModule.Handler,
		modules.OauthModule.Handler,
		modules.HealthModule.Handler,
		modules.GoalModule.Handler,
		modules.TopicModule.Handler,
		modules.TaskModule.Handler,
		modules.TaskAttemptModule.Handler,
		modules.TaskCorrectionModule.Handler,
		modules.ProfileModule.Handler,
		modules.JWTModule.Service,
		cfg,
	)
}

func main() {
	l := slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", "metapps")
	slog.SetDefault(l)

	cfg := config.Load()
	platformlogger.LogSystemInfo("configuration loaded", "port", cfg.Port, "frontend_origin", cfg.FrontendOrigin)

	conn := database.Connect(cfg)
	queries := db.New(conn)
	platformlogger.LogSystemInfo("database connection initialized")

	modules, err := newAppModules(cfg, queries)
	if err != nil {
		platformlogger.LogSystemError("couldn't setup modules", err)
		os.Exit(1)
	}
	platformlogger.LogSystemInfo("modules initialized")

	r := newRouter(cfg, modules)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go jobs.RefreshTokensCleanup(ctx, *queries, cfg.CleanupInterval)
	platformlogger.LogSystemInfo("background jobs started", "cleanup_interval", cfg.CleanupInterval.String())

	if err := r.Run(cfg.Port); err != nil {
		platformlogger.LogSystemError("couldn't run server", err, "port", cfg.Port)
		os.Exit(1)
	}
}
