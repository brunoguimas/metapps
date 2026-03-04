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

	port := getEnv("PORT", "8080")
	origin := getEnv("FRONTEND_ORIGIN", "http://localhost:5173")
	issuer := getEnv("ISSUER", "metapps")
	ttlStr := getEnv("TOKEN_TTL", "15m")

	ttl, err := time.ParseDuration(ttlStr)
	if err != nil {
		log.Printf("invalid TOKEN_TTL=%q, using 15m", ttlStr)
		ttl = 15 * time.Minute
	}

	jwtSecret := mustGetenv("JWT_SECRET")
	dbURL := mustGetenv("DATABASE_URL")
	dbDriver := mustGetenv("DATABASE_DRIVER")

	return &Config{
		port,
		dbDriver,
		dbURL,
		origin,
		jwtSecret,
		issuer,
		ttl,
	}
}

func getEnv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}

	return v
}

func mustGetenv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatal("missing required env: ", key)
	}

	return v
}
