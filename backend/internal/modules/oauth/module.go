package oauth

import (
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Repository OAuthAccountRepository
	Service    OAuthAccountService
	Handler    *OAuthHandler
}

func NewModule(q *db.Queries, users user.UserRepository, tokens jwt.JWTService, profiles profile.ProfileService, c *config.Config) *Module {
	r := NewOAuthAccountRepository(q)
	s := NewOAuthService(r, users, profiles)
	h := NewOAuthHandler(s, tokens, *c)

	return &Module{
		Repository: r,
		Service:    s,
		Handler:    h,
	}
}
