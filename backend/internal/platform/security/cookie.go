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
	c.SetSameSite(sameSiteForConfig(cfg))
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
	c.SetSameSite(sameSiteForConfig(cfg))
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
	c.SetSameSite(sameSiteForConfig(cfg))
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

// sameSiteForConfig define o SameSite dos cookies de sessão.
//
// Em produção (COOKIE_SECURE=true, HTTPS), usamos SameSite=None + Secure
// para que os cookies sobrevivam ao round-trip cross-site do OAuth
// (app -> Google -> backend) e sejam enviados nas chamadas de refresh
// entre origens diferentes — sem isso, navegadores que bloqueiam cookies
// de terceiros descartam o refresh_token e o usuário cai de volta no
// login logo após logar com Google.
//
// Em desenvolvimento (http://localhost), SameSite=Lax é suficiente e
// obrigatório (SameSite=None sem Secure é rejeitado pelo navegador).
func sameSiteForConfig(cfg config.Config) http.SameSite {
	if cfg.CookieSecure {
		return http.SameSiteNoneMode
	}
	return http.SameSiteLaxMode
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
