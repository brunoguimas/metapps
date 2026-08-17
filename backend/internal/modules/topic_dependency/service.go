package topic_dependency

import (
	"context"

	"github.com/google/uuid"
)

// TopicDependencyRepository defines the interface for topic dependency operations.
type TopicDependencyRepository interface {
	Create(ctx context.Context, d *TopicDependency) (*TopicDependency, error)
	GetByTopicIDs(ctx context.Context, topicIDs []uuid.UUID) ([]*TopicDependency, error)
}

type TopicDependencyService struct {
	repo TopicDependencyRepository
}

// nome longo da porra
func NewTopicDependencyService(r TopicDependencyRepository) TopicDependencyService {
	return TopicDependencyService{
		repo: r,
	}
}

func (s *TopicDependencyService) Create(c context.Context, d *TopicDependency) (*TopicDependency, error) {
	return s.repo.Create(c, d)
}

func (s *TopicDependencyService) GetByTopicIDs(c context.Context, topicIDs []uuid.UUID) ([]*TopicDependency, error) {
	return s.repo.GetByTopicIDs(c, topicIDs)
}