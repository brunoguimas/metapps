package goal

import "github.com/brunoguimas/metapps/backend/internal/platform/database/db"

type Module struct {
	Repository Repository
	Service    Service
	Handler    *Handler
}

func NewModule(q *db.Queries) *Module {
	r := NewRepository(q)
	s := NewService(r)
	h := NewHandler(s)

	return &Module{
		Repository: r,
		Service:    s,
		Handler:    h,
	}
}
