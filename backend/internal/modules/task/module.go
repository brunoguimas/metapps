package task

import (
	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Repository Repository
	Service    Service
	Handler    *Handler
}

func NewModule(q *db.Queries, t topic.Service, ai ai.Client, g *goal.Module, c *config.Config) *Module {
	r := NewRepository(q)
	tr := topic.NewRepository(q)
	pr := topic.NewProgressRepository(q)
	tdr := topic_dependency.NewRepository(q)
	td := topic_dependency.NewService(tdr)
	s := NewService(ai, r, t, tr, pr, td, g.Service, c)
	h := NewHandler(s, g.Service, c)

	return &Module{
		Repository: r,
		Service:    s,
		Handler:    h,
	}
}
