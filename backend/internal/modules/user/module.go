package user

import "github.com/brunoguimas/metapps/backend/internal/platform/database/db"

type Module struct {
	Repository Repository
	Service    Service
}

func NewModule(q *db.Queries) *Module {
	r := NewRepository(q)
	s := NewService(r)

	return &Module{
		Repository: r,
		Service:    s,
	}
}
