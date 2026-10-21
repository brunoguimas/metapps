package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"

	"strings"

	"github.com/joho/godotenv"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const (
	// AIProviderGemini identifica o provedor Gemini (Google AI).
	AIProviderGemini = "gemini"
	// AIProviderGroq identifica o provedor Groq.
	AIProviderGroq = "groq"
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
	AIProvider               string
	GeminiKey                string
	GeminiModel              string
	GroqKey                  string
	GroqModel                string
	GroqMaxTokens            int
	AvatarBaseURL            string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		slog.Warn("no .env file loaded, using environment variables", "error", err)
	}

	port := getEnv("PORT", ":8080")
	rawPort := strings.TrimPrefix(port, ":")
	if port != "" && !strings.HasPrefix(port, ":") {
		port = ":" + port
	}
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
	avatarBaseURL := strings.TrimRight(getEnv("AVATAR_BASE_URL", "http://localhost:"+rawPort), "/")

	// AI: o provedor selecionado é o primário, o outro vira fallback.
	aiProvider, err := parseAIProvider(getEnv("AI_PROVIDER", AIProviderGemini))
	if err != nil {
		slog.Error("invalid AI_PROVIDER config", "error", err, "allowed", []string{AIProviderGemini, AIProviderGroq})
		os.Exit(1)
	}

	geminiKey := os.Getenv("GEMINI_API_KEY")
	geminiModel := getEnv("GEMINI_MODEL", "")
	groqKey := os.Getenv("GROQ_API_KEY")
	groqModel := getEnv("GROQ_MODEL", "")
	// Teto de tokens gerados por resposta. Sem ele a lib nao manda o campo
	// e a API usa o padrao, que corta respostas longas (o roadmap, com
	// 60-100 nos, precisa de ~6k tokens): o JSON chega cortado e a
	// geracao falha com "Failed to validate JSON".
	groqMaxTokens := getEnvInt("GROQ_MAX_TOKENS", 0)

	if err := validateAIKeys(aiProvider, geminiKey, groqKey); err != nil {
		slog.Error("invalid AI keys config", "error", err, "provider", aiProvider)
		os.Exit(1)
	}

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
		AIProvider:               aiProvider,
		GeminiKey:                geminiKey,
		GeminiModel:              geminiModel,
		GroqKey:                  groqKey,
		GroqModel:                groqModel,
		GroqMaxTokens:            groqMaxTokens,
		AvatarBaseURL:            avatarBaseURL,
	}
}

// parseAIProvider normaliza e valida o valor de AI_PROVIDER.
// Valor vazio usa o provedor padrão (gemini); valores desconhecidos são erro
// para a API não subir usando um provedor diferente do pretendido.
func parseAIProvider(value string) (string, error) {
	provider := strings.ToLower(strings.TrimSpace(value))

	switch provider {
	case "":
		return AIProviderGemini, nil
	case AIProviderGemini, AIProviderGroq:
		return provider, nil
	default:
		return "", fmt.Errorf("unknown AI provider %q (allowed: %s, %s)", value, AIProviderGemini, AIProviderGroq)
	}
}

// validateAIKeys garante que a chave do provedor selecionado exista.
// A chave do provedor alternativo é opcional: sem ela o fallback é desativado.
func validateAIKeys(provider, geminiKey, groqKey string) error {
	switch provider {
	case AIProviderGemini:
		if geminiKey == "" {
			return fmt.Errorf("GEMINI_API_KEY is required when AI_PROVIDER=%s", AIProviderGemini)
		}
	case AIProviderGroq:
		if groqKey == "" {
			return fmt.Errorf("GROQ_API_KEY is required when AI_PROVIDER=%s", AIProviderGroq)
		}
	}

	return nil
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
