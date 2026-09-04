package topic_dependency

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type topicDependencyRepository struct {
	queries *db.Queries
}

func NewRepository(q *db.Queries) Repository {
	return &topicDependencyRepository{
		queries: q,
	}
}

func (r *topicDependencyRepository) Create(ctx context.Context, d *TopicDependency) (*TopicDependency, error) {
	dependency, err := r.queries.CreateTopicDependency(ctx, db.CreateTopicDependencyParams{
		TopicID:          d.TopicID,
		DependsOnTopicID: d.DependsOnTopicID,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create topic dependency", err)
	}

	return mapTopicDependency(dependency), nil
}

func (r *topicDependencyRepository) GetByTopicIDs(ctx context.Context, topicIDs []uuid.UUID) ([]*TopicDependency, error) {
	dependencies, err := r.queries.GetByTopicIDs(ctx, topicIDs)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get topic dependencies", err)
	}

	result := make([]*TopicDependency, 0, len(dependencies))
	for _, dep := range dependencies {
		result = append(result, mapTopicDependency(dep))
	}

	return result, nil
}

func mapTopicDependency(d db.TopicDependency) *TopicDependency {
	return &TopicDependency{
		ID:               d.ID,
		TopicID:          d.TopicID,
		DependsOnTopicID: d.DependsOnTopicID,
		CreatedAt:        d.CreatedAt,
		UpdatedAt:        d.UpdatedAt,
	}
}
