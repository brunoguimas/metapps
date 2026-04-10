package main

import (
	"context"
	"log"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/auth"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/health"
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/modules/mail"
	"github.com/brunoguimas/metapps/backend/internal/modules/oauth"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/brunoguimas/metapps/backend/internal/platform/jobs"
	"github.com/brunoguimas/metapps/backend/internal/router"
)

func main() {
	cfg := config.Load()

	conn := database.Connect(cfg)
	queries := db.New(conn)

	mailModule, err := mail.NewModule(queries, cfg)
	if err != nil {
		log.Fatal("couldn't setup mailer")
	}
	jwtModule := jwt.NewModule(queries, cfg)
	userModule := user.NewModule(queries)
	goalModule := goal.NewModule(queries)
	oauthModule := oauth.NewModule(queries, userModule.Repository, jwtModule.Service, cfg)
	authModule := auth.NewModule(userModule.Repository, userModule.Service, jwtModule.Service, mailModule.Service, cfg)
	healthModule := health.NewModule(queries)
	aiClient := ai.NewGroqClient()
	taskModule := task.NewTaskModule(queries, aiClient, goalModule.Service, cfg)

	r := router.NewRouter(
		authModule.Handler,
		oauthModule.Handler,
		healthModule.Handler,
		goalModule.Handler,
		taskModule.Handler,
		jwtModule.Service,
		cfg,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go jobs.RefreshTokensCleanup(ctx, *queries, cfg.CleanupInterval)

	if err := r.Run(cfg.Port); err != nil {
		log.Fatal("couldn't run server: ", err.Error())
	}
}
