package main

import (
	"context"
	"log"

	"time"

	"github.com/brunoguimas/metapps/backend/config"
	"github.com/brunoguimas/metapps/backend/internal/auth"
	"github.com/brunoguimas/metapps/backend/internal/database"
	"github.com/brunoguimas/metapps/backend/internal/database/db"
	"github.com/brunoguimas/metapps/backend/internal/handler"
	"github.com/brunoguimas/metapps/backend/internal/jobs"
	"github.com/brunoguimas/metapps/backend/internal/repository"
	"github.com/brunoguimas/metapps/backend/internal/service"
	"github.com/gin-contrib/cors"
)

func main() {
	cfg := config.Load()

	conn := database.Connect(cfg)
	queries := db.New(conn)

	jwtRepo := auth.NewJWTRepository(queries)
	jwtService := auth.NewJWTService(jwtRepo, cfg.JWTSecret, cfg.Issuer, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)
	userRepo := repository.NewUserRepository(queries)
	oauthAccountRepo := repository.NewOAuthAccountRepository(queries)
	oauthService := service.NewOAuthService(oauthAccountRepo, userRepo)
	userService := service.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userService, oauthService, jwtService, *cfg)

	r := handler.NewRouter(userHandler)
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go jobs.RefreshTokensCleanup(ctx, *queries, cfg.CleanupInterval)

	if err := r.Run(cfg.Port); err != nil {
		log.Fatal("couldn't run server")
	}
}
