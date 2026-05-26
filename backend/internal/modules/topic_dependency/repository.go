package topic_dependency

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type TopicDependencyRepository struct {
	queries *db.Queries
}

func NewTopicDependencyRepository(q *db.Queries) TopicDependencyRepository {
	return TopicDependencyRepository{
		queries: q,
	}
}

func (r *TopicDependencyRepository) Create(c context.Context, d *TopicDependency) (*TopicDependency, error) {
	dependency, err := r.queries.CreateTopicDependency(c, db.CreateTopicDependencyParams{
		TopicID: d.TopicID,
		DependsOnTopicID: d.DependsOnTopicID,
	})
	if err != nil {
		return nil, err
	}

	return &TopicDependency{
		dependency.ID,
		dependency.TopicID,
		dependency.DependsOnTopicID,
		dependency.CreatedAt,
		dependency.UpdatedAt,
	}, nil
}
