package config

import (
	"log"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	DatabaseDriver  string
	DatabaseURL     string
	FrontendOrigin  string
	CookieDomain    string
	CookiePath      string
	CookieSecure    bool
	JWTSecret       string
	Issuer          string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	CleanupInterval time.Duration
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Fatal(".env missing")
	}

	port := getEnv("PORT", "8080")
	origin := getEnv("FRONTEND_ORIGIN", "http://localhost:5173")
	cookieDomain := getEnv("COOKIE_DOMAIN", "localhost")
	cookiePath := getEnv("COOKIE_PATH", "/auth/refresh")
	cookieSecure := getEnvBool("COOKIE_SECURE", false)
	issuer := getEnv("ISSUER", "metapps")
	accessTtlStr := getEnv("ACCESS_TOKEN_TTL", "5m")
	refreshTtlStr := getEnv("REFRESH_TOKEN_TTL", "24h")
	cleanupIntervalStr := getEnv("CLEANUP_INTERVAL", "30m")

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
	cleanupInterval, err := time.ParseDuration(cleanupIntervalStr)
	if err != nil {
		log.Printf("invalid CLEANUP_INTERVAL=%q, using 30m", cleanupIntervalStr)
		cleanupInterval = 30 * time.Minute
	}

	jwtSecret := mustGetenv("JWT_SECRET")
	dbURL := mustGetenv("DATABASE_URL")
	dbDriver := mustGetenv("DATABASE_DRIVER")

	return &Config{
		Port:            port,
		DatabaseDriver:  dbDriver,
		DatabaseURL:     dbURL,
		FrontendOrigin:  origin,
		CookieDomain:    cookieDomain,
		CookiePath:      cookiePath,
		CookieSecure:    cookieSecure,
		JWTSecret:       jwtSecret,
		Issuer:          issuer,
		AccessTokenTTL:  accessTtl,
		RefreshTokenTTL: refreshTtl,
		CleanupInterval: cleanupInterval,
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

func getEnvBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(v)
	if err != nil {
		log.Printf("invalid bool %s=%q, using %t", key, v, fallback)
		return fallback
	}

	return parsed
}
