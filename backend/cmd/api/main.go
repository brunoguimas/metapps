package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/auth"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/health"
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/modules/mail"
	"github.com/brunoguimas/metapps/backend/internal/modules/oauth"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/taskattempt"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/brunoguimas/metapps/backend/internal/platform/jobs"
	platformlogger "github.com/brunoguimas/metapps/backend/internal/platform/logger"
	"github.com/brunoguimas/metapps/backend/internal/router"
)

func main() {
	l := slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", "metapps")
	slog.SetDefault(l)

	cfg := config.Load()
	platformlogger.LogSystemInfo("configuration loaded", "port", cfg.Port, "frontend_origin", cfg.FrontendOrigin)

	conn := database.Connect(cfg)
	queries := db.New(conn)
	platformlogger.LogSystemInfo("database connection initialized")

	mailModule, err := mail.NewModule(queries, cfg)
	if err != nil {
		platformlogger.LogSystemError("couldn't setup mailer", err)
		os.Exit(1)
	}

	jwtModule := jwt.NewModule(queries, cfg)
	userModule := user.NewModule(queries)
	goalModule := goal.NewModule(queries)
	oauthModule := oauth.NewModule(queries, userModule.Repository, jwtModule.Service, cfg)
	authModule := auth.NewModule(userModule.Repository, userModule.Service, jwtModule.Service, mailModule.Service, cfg)
	healthModule := health.NewModule(queries)
	aiClient := ai.NewGroqClient()
	taskModule := task.NewTaskModule(queries, aiClient, goalModule, cfg)
	taskAttemptModule := taskattempt.NewModule(queries, taskModule)
	platformlogger.LogSystemInfo("modules initialized")

	r := router.NewRouter(
		authModule.Handler,
		oauthModule.Handler,
		healthModule.Handler,
		goalModule.Handler,
		taskModule.Handler,
		taskAttemptModule.Handler,
		jwtModule.Service,
		cfg,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go jobs.RefreshTokensCleanup(ctx, *queries, cfg.CleanupInterval)
	platformlogger.LogSystemInfo("background jobs started", "cleanup_interval", cfg.CleanupInterval.String())

	if err := r.Run(cfg.Port); err != nil {
		platformlogger.LogSystemError("couldn't run server", err, "port", cfg.Port)
		os.Exit(1)
	}
}
