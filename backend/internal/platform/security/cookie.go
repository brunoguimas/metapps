package security

import (
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/gin-gonic/gin"
)

const (
	refreshToken = "refresh_token"
	oauthState   = "oauth_state"
	httpOnly     = true
)

func SetRefreshTokenCookie(c *gin.Context, token string, cfg config.Config) {
	c.SetCookie(
		refreshToken,
		token,
		int(cfg.RefreshTokenTTL.Seconds()),
		cfg.CookiePath,
		cfg.CookieDomainRefresh,
		cfg.CookieSecure,
		true,
	)
}

func SetOAuthStateCookie(c *gin.Context, state string, cfg config.Config) {
	c.SetCookie(
		oauthState,
		state,
		int(cfg.OAuthStateTTL.Seconds()),
		cfg.CookiePath,
		cfg.CookieDomainOAuthState,
		cfg.CookieSecure,
		true,
	)
}

func RemoveAuthStateCookie(c *gin.Context, cfg config.Config) {
	c.SetCookie(
		oauthState,
		"",
		-1,
		cfg.CookiePath,
		cfg.CookieDomainOAuthState,
		cfg.CookieSecure,
		true,
	)
}
