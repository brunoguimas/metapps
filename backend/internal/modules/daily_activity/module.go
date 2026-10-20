package daily_activity

import (
	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/review"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Repository Repository
	Service    Service
	Handler    *Handler
}

func NewModule(q *db.Queries, p profile.Service, r review.Service) *Module {
	repo := NewRepository(q)
	s := NewService(repo)
	h := NewHandler(s, p, r)

	return &Module{
		Repository: repo,
		Service:    s,
		Handler:    h,
	}
}
