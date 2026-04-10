package jwt

import (
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Repository JWTRepository
	Service    JWTService
}

func NewModule(q *db.Queries, c *config.Config) *Module {
	r := NewJWTRepository(q)
	s := NewJWTService(r, c.JWTSecret, c.Issuer, c.AccessTokenTTL, c.RefreshTokenTTL)

	return &Module{
		Repository: r,
		Service:    s,
	}
}
