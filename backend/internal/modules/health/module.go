package health

import "github.com/brunoguimas/metapps/backend/internal/platform/database/db"

type Module struct {
	Repository DBchecker
	Handler    *HealthHandler
}

func NewModule(q *db.Queries) *Module {
	r := NewChecker(q)
	h := NewHealthHandler(r)

	return &Module{
		Repository: r,
		Handler:    h,
	}
}
