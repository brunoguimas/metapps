package topic_dependency

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	Create(ctx context.Context, d *TopicDependency) (*TopicDependency, error)
	GetByTopicIDs(ctx context.Context, topicIDs []uuid.UUID) ([]*TopicDependency, error)
}

type Service interface {
	Create(c context.Context, d *TopicDependency) (*TopicDependency, error)
	GetByTopicIDs(c context.Context, topicIDs []uuid.UUID) ([]*TopicDependency, error)
}

type topicDependencyService struct {
	repo Repository
}

func NewService(r Repository) Service {
	return &topicDependencyService{
		repo: r,
	}
}

func (s *topicDependencyService) Create(c context.Context, d *TopicDependency) (*TopicDependency, error) {
	return s.repo.Create(c, d)
}

func (s *topicDependencyService) GetByTopicIDs(c context.Context, topicIDs []uuid.UUID) ([]*TopicDependency, error) {
	return s.repo.GetByTopicIDs(c, topicIDs)
}
