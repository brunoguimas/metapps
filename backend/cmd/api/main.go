package main

import (
	"log"

	"time"

	"github.com/brunoguimas/metapps/backend/config"
	"github.com/brunoguimas/metapps/backend/internal/auth"
	"github.com/brunoguimas/metapps/backend/internal/database"
	"github.com/brunoguimas/metapps/backend/internal/database/db"
	"github.com/brunoguimas/metapps/backend/internal/handler"
	"github.com/brunoguimas/metapps/backend/internal/repository"
	"github.com/brunoguimas/metapps/backend/internal/service"
	"github.com/gin-contrib/cors"
)

func main() {
	cfg := config.Load()

	conn := database.Connect(cfg)
	queries := db.New(conn)

	jwtRepo := auth.NewJWTRepository(queries)
	jwtService := auth.NewJWTService(jwtRepo, cfg.JWTSecret, cfg.Issuer, cfg.AcessTokenTTL, cfg.RefreshTokenTTL)
	userRepo := repository.NewUserRepository(queries)
	userService := service.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userService, jwtService)

	r := handler.NewRouter(userHandler)
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	log.Println("\"Piroca pronta!!!\"")
	log.Println("*Insiro no cu do Donald Trump*")

	r.Run(cfg.Port)
}
