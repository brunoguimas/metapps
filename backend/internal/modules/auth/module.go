package auth

import (
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/modules/mail"
	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
)

type Module struct {
	Service Service
	Handler *Handler
}

func NewModule(repo user.Repository, users user.Service, tokens jwt.Service, emails mail.Service, profileService profile.Service, c *config.Config) *Module {
	service := NewService(repo, profileService)

	return &Module{
		Service: service,
		Handler: NewHandler(service, users, tokens, emails, *c),
	}
}
