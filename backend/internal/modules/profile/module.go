package profile

import (
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Repository Repository
	Service    Service
	Handler    *Handler
}

func NewModule(q *db.Queries, c *config.Config) *Module {
	r := NewRepository(q)
	s := NewService(r)
	h := NewHandler(s, c)

	return &Module{
		Repository: r,
		Service:    s,
		Handler:    h,
	}
}
