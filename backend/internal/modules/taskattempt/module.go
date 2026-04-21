package taskattempt

import (
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Repository Repository
	Service    Service
	Handler    *Handler
}

func NewModule(q *db.Queries, taskModule *task.TaskModule) *Module {
	r := NewRepository(q)
	s := NewService(r, taskModule.Repository)
	h := NewHandler(s)

	return &Module{
		Repository: r,
		Service:    s,
		Handler:    h,
	}
}
