package main

import (
	"log"

	"github.com/brunoguimas/metasapp/config"
	"github.com/brunoguimas/metasapp/internal/database"
	"github.com/brunoguimas/metasapp/internal/database/db"
	"github.com/brunoguimas/metasapp/internal/handler"
	"github.com/brunoguimas/metasapp/internal/repository/postgres"
	"github.com/brunoguimas/metasapp/internal/service"
	"github.com/gin-contrib/cors"
	"time"
)

func main() {
	cfg := config.Load()

	conn := database.Connect(cfg)
	queries := db.New(conn)

	userRepo := postgres.NewUserRepository(queries)
	userService := service.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userService)

	r := handler.NewRouter(userHandler)
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
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
