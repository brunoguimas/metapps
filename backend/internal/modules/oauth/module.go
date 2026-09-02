package oauth

import (
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Repository Repository
	Service    Service
	Handler    *Handler
}

func NewModule(q *db.Queries, users user.Repository, tokens jwt.Service, c *config.Config) *Module {
	r := NewRepository(q)
	s := NewService(r, users)
	h := NewHandler(s, tokens, *c)

	return &Module{
		Repository: r,
		Service:    s,
		Handler:    h,
	}
}
