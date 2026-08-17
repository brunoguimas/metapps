package task

import (
	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type TaskModule struct {
	Repository TaskRepository
	Service    TaskService
	Handler    *TaskHandler
}

func NewTaskModule(q *db.Queries, t topic.TopicService, ai ai.Client, g *goal.Module, c *config.Config) *TaskModule {
	r := NewTaskRepository(q)
	tr := topic.NewTopicRepository(q)
	pr := topic.NewTopicProgressRepository(q)
	tdr := topic_dependency.NewTopicDependencyRepository(q)
	td := topic_dependency.NewTopicDependencyService(tdr)
	s := NewTaskService(ai, r, t, tr, pr, td, c)
	h := NewTaskHandler(s, g.Service, c)

	return &TaskModule{
		Repository: r,
		Service:    s,
		Handler:    h,
	}
}
