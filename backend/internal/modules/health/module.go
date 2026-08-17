package health

import (
	"time"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Repository DBchecker
	AI AIChecker
	Handler    *HealthHandler
}

func NewModule(q *db.Queries, aiClient ai.Client, t time.Time) *Module {
	r := NewDBChecker(q)
	a := NewAIChecker(aiClient)
	h := NewHealthHandler(r, a, t)

	return &Module{
		Repository: r,
		AI: a,
		Handler:    h,
	}
}
