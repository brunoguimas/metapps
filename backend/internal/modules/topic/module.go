package topic

import (
	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Repository Repository
	Service    Service
	Handler    *Handler
}

func NewModule(d topic_dependency.Service, g goal.Service, a ai.Client, queries *db.Queries, c *config.Config) *Module {
	r := NewRepository(queries)
	pr := NewProgressRepository(queries)
	s := NewService(r, d, a, c, pr)
	h := NewHandler(s, g)

	return &Module{
		Repository: r,
		Service:    s,
		Handler:    h,
	}
}
