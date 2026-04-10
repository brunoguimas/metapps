package auth

import (
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/modules/mail"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
)

type Module struct {
	Service AuthService
	Handler *AuthHandler
}

func NewModule(repo user.UserRepository, users user.UserService, tokens jwt.JWTService, emails mail.EmailService, c *config.Config) *Module {
	service := NewAuthService(repo)

	return &Module{
		Service: service,
		Handler: NewAuthHandler(service, users, tokens, emails, *c),
	}
}
