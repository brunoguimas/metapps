package topic_dependency

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/google/uuid"
)

type topicDependencyRepository struct {
	queries *db.Queries
}

func NewTopicDependencyRepository(q *db.Queries) *topicDependencyRepository {
	return &topicDependencyRepository{
		queries: q,
	}
}

func (r *topicDependencyRepository) Create(ctx context.Context, d *TopicDependency) (*TopicDependency, error) {
	dependency, err := r.queries.CreateTopicDependency(ctx, db.CreateTopicDependencyParams{
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

func (r *topicDependencyRepository) GetByTopicIDs(c context.Context, topicIDs []uuid.UUID) ([]*TopicDependency, error) {
	dependencies, err := r.queries.GetByTopicIDs(c, topicIDs)
	if err != nil {
		return nil, err
	}

	var result []*TopicDependency
	for _, dep := range dependencies {
		result = append(result, &TopicDependency{
			ID:             dep.ID,
			TopicID:        dep.TopicID,
			DependsOnTopicID: dep.DependsOnTopicID,
			CreatedAt:      dep.CreatedAt,
			UpdatedAt:      dep.UpdatedAt,
		})
	}

	return result, nil
}