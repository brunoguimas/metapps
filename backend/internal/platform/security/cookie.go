package security

import (
	"net/http"
	"strings"

	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/gin-gonic/gin"
)

const (
	refreshToken = "refresh_token"
	oauthState   = "oauth_state"
)

func SetRefreshTokenCookie(c *gin.Context, token string, cfg config.Config) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		refreshToken,
		token,
		int(cfg.RefreshTokenTTL.Seconds()),
		cfg.JWTTokenCookiePath,
		normalizeCookieDomain(cfg.CookieDomainRefresh),
		cfg.CookieSecure,
		true,
	)
}

func SetOAuthStateCookie(c *gin.Context, state string, cfg config.Config) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		oauthState,
		state,
		int(cfg.OAuthStateTTL.Seconds()),
		cfg.OAuthStateCookiePath,
		normalizeCookieDomain(cfg.CookieDomainOAuthState),
		cfg.CookieSecure,
		true,
	)
}

func RemoveAuthStateCookie(c *gin.Context, cfg config.Config) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		oauthState,
		"",
		-1,
		cfg.OAuthStateCookiePath,
		normalizeCookieDomain(cfg.CookieDomainOAuthState),
		cfg.CookieSecure,
		true,
	)
}

func normalizeCookieDomain(domain string) string {
	domain = strings.TrimSpace(domain)
	switch domain {
	case "", "localhost", "127.0.0.1", "::1":
		return ""
	default:
		return domain
	}
}
