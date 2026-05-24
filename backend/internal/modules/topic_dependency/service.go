package topic_dependency

import (
	"context"

)

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
