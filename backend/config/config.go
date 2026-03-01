package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	DatabaseDriver string
	DatabaseURL    string
	AuthStrategy   string
	JWTSecret      string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Fatal(".env missing")
	}

	return &Config{
		Port:           os.Getenv("PORT"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		DatabaseDriver: os.Getenv("DATABASE_DRIVER"),
		AuthStrategy:   os.Getenv("AUTH_STRATEGY"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
	}
}
