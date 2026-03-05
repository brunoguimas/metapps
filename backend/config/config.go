package config

import (
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	DatabaseDriver  string
	DatabaseURL     string
	FrontendOrigin  string
	JWTSecret       string
	Issuer          string
	AcessTokenTTL   time.Duration
	RefreshTokenTTL time.Duration
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Fatal(".env missing")
	}

	port := getEnv("PORT", "8080")
	origin := getEnv("FRONTEND_ORIGIN", "http://localhost:5173")
	issuer := getEnv("ISSUER", "metapps")
	accessTtlStr := getEnv("ACCESS_TOKEN_TTL", "5m")
	refreshTtlStr := getEnv("REFRESH_TOKEN_TTL", "24h")

	accessTtl, err := time.ParseDuration(accessTtlStr)
	if err != nil {
		log.Printf("invalid TOKEN_TTL=%q, using 15m", accessTtlStr)
		accessTtl = 15 * time.Minute
	}
	refreshTtl, err := time.ParseDuration(refreshTtlStr)
	if err != nil {
		log.Printf("invalid TOKEN_TTL=%q, using 24h", refreshTtlStr)
		refreshTtl = 24 * time.Hour
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
		accessTtl,
		refreshTtl,
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
