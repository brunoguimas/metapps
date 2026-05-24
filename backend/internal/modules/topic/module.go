package topic

import (
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type TopicModule struct {
	Repository TopicRepository
	Service    TopicService
	Handler    *TopicHandler
}

func NewModule(d topic_dependency.TopicDependencyService, g goal.GoalService, queries *db.Queries, c *config.Config) *TopicModule {
	r := NewTopicRepository(queries)
	s := NewTopicService(r, d, c)
	h := NewTopicHandler(s, g)

	return &TopicModule{
		Repository: r,
		Service: s,
		Handler: h,
	}
}
