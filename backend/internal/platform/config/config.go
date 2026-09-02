package config

import (
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type Config struct {
	Port                     string
	DatabaseDriver           string
	DatabaseURL              string
	FrontendOrigin           string
	CookieDomainRefresh      string
	CookieDomainOAuthState   string
	JWTTokenCookiePath       string
	OAuthStateCookiePath     string
	CookieSecure             bool
	JWTSecret                string
	Issuer                   string
	AccessTokenTTL           time.Duration
	RefreshTokenTTL          time.Duration
	EmailVerificationTTL     time.Duration
	OAuthStateTTL            time.Duration
	CleanupInterval          time.Duration
	EmailFrom                string
	SMTPHost                 string
	SMTPPort                 int
	SMTPUser                 string
	SMTPPass                 string
	GoogleLogin              oauth2.Config
	RequireEmailVerification bool
	GeminiKey                string
	AvatarBaseURL            string
}

func Load() *Config {
	godotenv.Load()

	port := getEnv("PORT", "8080")
	origin := getEnv("FRONTEND_ORIGIN", "http://localhost:5173")
	cookieDomain := getEnv("COOKIE_DOMAIN", "localhost")
	cookieDomainRefresh := getEnv("COOKIE_DOMAIN_REFRESH", cookieDomain)
	cookieDomainOAuthState := getEnv("COOKIE_DOMAIN_OAUTH_STATE", cookieDomain)
	jwtCookiePath := getEnv("JWT_TOKEN_COOKIE_PATH", "/auth/refresh")
	oauthStateCookiePath := getEnv("OAUTH_STATE_COOKIE_PATH", "/auth/google/callback")
	cookieSecure := getEnvBool("COOKIE_SECURE", false)
	issuer := getEnv("ISSUER", "metapps")
	accessTtlStr := getEnv("ACCESS_TOKEN_TTL", "5m")
	refreshTtlStr := getEnv("REFRESH_TOKEN_TTL", "24h")
	emailVerificationTtlStr := getEnv("EMAIL_VERIFICATION_TTL", "24h")
	oauthStateTtlStr := getEnv("OAUTH_STATE_TTL", "1m")
	cleanupIntervalStr := getEnv("CLEANUP_INTERVAL", "30m")
	emailFrom := getEnv("EMAIL_FROM", "")
	smtpHost := getEnv("SMTP_HOST", "")
	smtpPort := getEnvInt("SMTP_PORT", 0)
	smtpUser := getEnv("SMTP_USER", "")
	smtpPass := getEnv("SMTP_PASS", "")
	requireEmailVerification := getEnvBool("REQUIRE_EMAIL_VERIFICATION", true)
	geminiKey := mustGetenv("GEMINI_API_KEY")
	avatarBaseURL := getEnv("AVATAR_BASE_URL", "http://localhost:"+port)

	accessTtl, err := time.ParseDuration(accessTtlStr)
	if err != nil {
		slog.Warn("invalid duration config", "key", "ACCESS_TOKEN_TTL", "value", accessTtlStr, "fallback", "15m")
		accessTtl = 15 * time.Minute
	}
	refreshTtl, err := time.ParseDuration(refreshTtlStr)
	if err != nil {
		slog.Warn("invalid duration config", "key", "REFRESH_TOKEN_TTL", "value", refreshTtlStr, "fallback", "24h")
		refreshTtl = 24 * time.Hour
	}
	emailVerificationTtl, err := time.ParseDuration(emailVerificationTtlStr)
	if err != nil {
		slog.Warn("invalid duration config", "key", "EMAIL_VERIFICATION_TTL", "value", emailVerificationTtlStr, "fallback", "24h")
		emailVerificationTtl = 24 * time.Hour
	}
	oauthStateTtl, err := time.ParseDuration(oauthStateTtlStr)
	if err != nil {
		slog.Warn("invalid duration config", "key", "OAUTH_STATE_TTL", "value", oauthStateTtlStr, "fallback", "1m")
		oauthStateTtl = 1 * time.Minute
	}
	cleanupInterval, err := time.ParseDuration(cleanupIntervalStr)
	if err != nil {
		slog.Warn("invalid duration config", "key", "CLEANUP_INTERVAL", "value", cleanupIntervalStr, "fallback", "30m")
		cleanupInterval = 30 * time.Minute
	}

	jwtSecret := mustGetenv("JWT_SECRET")
	dbURL := mustGetenv("DATABASE_URL")
	dbDriver := mustGetenv("DATABASE_DRIVER")
	googleRedirectUrl := mustGetenv("GOOGLE_REDIRECT_URL")
	googleClientID := mustGetenv("GOOGLE_CLIENT_ID")
	googleClientSecret := mustGetenv("GOOGLE_CLIENT_SECRET")

	googleLogin := oauth2.Config{
		RedirectURL:  googleRedirectUrl,
		ClientID:     googleClientID,
		ClientSecret: googleClientSecret,
		Scopes: []string{
			"openid",
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}

	return &Config{
		Port:                     port,
		DatabaseDriver:           dbDriver,
		DatabaseURL:              dbURL,
		FrontendOrigin:           origin,
		CookieDomainRefresh:      cookieDomainRefresh,
		CookieDomainOAuthState:   cookieDomainOAuthState,
		JWTTokenCookiePath:       jwtCookiePath,
		OAuthStateCookiePath:     oauthStateCookiePath,
		CookieSecure:             cookieSecure,
		JWTSecret:                jwtSecret,
		Issuer:                   issuer,
		AccessTokenTTL:           accessTtl,
		RefreshTokenTTL:          refreshTtl,
		EmailVerificationTTL:     emailVerificationTtl,
		OAuthStateTTL:            oauthStateTtl,
		CleanupInterval:          cleanupInterval,
		EmailFrom:                emailFrom,
		SMTPHost:                 smtpHost,
		SMTPPort:                 smtpPort,
		SMTPUser:                 smtpUser,
		SMTPPass:                 smtpPass,
		GoogleLogin:              googleLogin,
		RequireEmailVerification: requireEmailVerification,
		GeminiKey:                geminiKey,
		AvatarBaseURL:            avatarBaseURL,
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
		slog.Error("missing required env", "key", key)
		os.Exit(1)
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
		slog.Warn("invalid bool config", "key", key, "value", v, "fallback", fallback)
		return fallback
	}

	return parsed
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(v)
	if err != nil {
		slog.Warn("invalid int config", "key", key, "value", v, "fallback", fallback)
		return fallback
	}

	return parsed
}
