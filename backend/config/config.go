package config

import (
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	DatabaseDriver string
	DatabaseURL    string
	FrontendOrigin string
	JWTSecret      string
	Issuer         string
	TokenTTL       time.Duration
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Fatal(".env missing")
	}

	ttl, err := time.ParseDuration(os.Getenv("TOKEN_TTL"))
	if err != nil {
		ttl = time.Duration(15 * time.Minute)
	}
	return &Config{
		Port:           os.Getenv("PORT"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		DatabaseDriver: os.Getenv("DATABASE_DRIVER"),
		FrontendOrigin: os.Getenv("FRONTEND_ORIGIN"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		Issuer:         os.Getenv("ISSUER"),
		TokenTTL:       ttl,
	}
}
