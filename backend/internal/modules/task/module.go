package task

import (
	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type TaskModule struct {
	Repository TaskRepository
	Service    TaskService
	Handler    *TaskHandler
}

func NewTaskModule(q *db.Queries, ai ai.Client, g goal.GoalService, c *config.Config) *TaskModule {
	r := NewTaskRepository(q)
	s := NewTaskService(ai, r, c)
	h := NewTaskHandler(s, g, c)

	return &TaskModule{
		Repository: r,
		Service:    s,
		Handler:    h,
	}
}
