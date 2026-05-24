package topic_dependency

import "github.com/brunoguimas/metapps/backend/internal/platform/database/db"

type Module struct {
	Repository TopicDependencyRepository
	Service    TopicDependencyService
}

func NewModule(q *db.Queries) *Module {
	r := NewTopicDependencyRepository(q)
	s := NewTopicDependencyService(r)

	return &Module{
		Repository: r,
		Service:    s,
	}
}
