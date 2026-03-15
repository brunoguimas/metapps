package main

import (
	"context"
	"log"

	"github.com/brunoguimas/metapps/backend/config"
	"github.com/brunoguimas/metapps/backend/internal/auth"
	"github.com/brunoguimas/metapps/backend/internal/database"
	"github.com/brunoguimas/metapps/backend/internal/database/db"
	"github.com/brunoguimas/metapps/backend/internal/handler"
	"github.com/brunoguimas/metapps/backend/internal/jobs"
	"github.com/brunoguimas/metapps/backend/internal/mail"
	"github.com/brunoguimas/metapps/backend/internal/repository"
	"github.com/brunoguimas/metapps/backend/internal/service"
)

func main() {
	cfg := config.Load()

	conn := database.Connect(cfg)
	queries := db.New(conn)

	mailer, err := mail.NewMailer(*cfg)
	if err != nil {
		log.Fatal("couldn't setup mailer")
	}
	jwtRepo := auth.NewJWTRepository(queries)
	jwtService := auth.NewJWTService(jwtRepo, cfg.JWTSecret, cfg.Issuer, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)
	userRepo := repository.NewUserRepository(queries)
	emailRepo := repository.NewEmailTokenRepository(queries)
	oauthAccountRepo := repository.NewOAuthAccountRepository(queries)
	oauthService := service.NewOAuthService(oauthAccountRepo, userRepo)
	userService := service.NewUserService(userRepo)
	emailService := service.NewEmailService(emailRepo, cfg, mailer)
	authHandler := handler.NewAuthHandler(userService, jwtService, emailService, *cfg)
	oauthHandler := handler.NewOAuthHandler(oauthService, jwtService, *cfg)

	r := handler.NewRouter(authHandler, oauthHandler, cfg)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go jobs.RefreshTokensCleanup(ctx, *queries, cfg.CleanupInterval)

	if err := r.Run(cfg.Port); err != nil {
		log.Fatal("couldn't run server")
	}
}
