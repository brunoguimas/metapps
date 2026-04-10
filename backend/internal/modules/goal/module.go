package goal

import "github.com/brunoguimas/metapps/backend/internal/platform/database/db"

type Module struct {
	Repository GoalRepository
	Service    GoalService
	Handler    *GoalHandler
}

func NewModule(q *db.Queries) *Module {
	r := NewGoalRepository(q)
	s := NewGoalService(r)
	h := NewGoalHandler(s)

	return &Module{
		Repository: r,
		Service:    s,
		Handler:    h,
	}
}
