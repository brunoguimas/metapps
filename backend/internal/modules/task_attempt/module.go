package task_attempt

import (
	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Repository Repository
	Service    Service
	Handler    *Handler
}

func NewModule(q *db.Queries, taskModule *task.Module, topics topic.Service, profiles profile.Service) *Module {
	r := NewRepository(q)
	s := NewService(r, taskModule.Repository, topics, profiles)
	h := NewHandler(s)

	return &Module{
		Repository: r,
		Service:    s,
		Handler:    h,
	}
}
