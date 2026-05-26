package topic

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/google/uuid"
)

type TopicRepository interface {
	Create(c context.Context, t *Topic) (*Topic, error)
	Get(c context.Context, topicID uuid.UUID) (*Topic, error)
}

type topicRepository struct {
	queries *db.Queries
}

func NewTopicRepository(q *db.Queries) TopicRepository {
	return topicRepository{
		queries: q,
	}
}

func (r topicRepository) Create(c context.Context, t *Topic) (*Topic, error) {
	topic, err := r.queries.CreateTopic(c, db.CreateTopicParams{
		GoalID:          t.GoalID,
		ParentTopicID:   t.ParentTopicID,
		Title:           t.Title,
		Description:     t.Description,
		RequiredMastery: t.RequiredMastery,
		Weight:          t.Weight,
		OrderIndex:      t.OrderIndex,
	})
	if err != nil {
		return nil, err
	}

	return &Topic{
		topic.ID,
		topic.GoalID,
		topic.ParentTopicID,
		topic.Title,
		topic.Description,
		topic.RequiredMastery,
		topic.Weight,
		topic.OrderIndex,
		topic.CreatedAt,
		topic.UpdatedAt,
	}, nil
}

func (r topicRepository) Get(c context.Context, topicID uuid.UUID) (*Topic, error) {
	topic, err := r.queries.GetTopicByID(c, topicID)
	if err != nil {
		return nil, err
	}

	return &Topic{
		topic.ID,
		topic.GoalID,
		topic.ParentTopicID,
		topic.Title,
		topic.Description,
		topic.RequiredMastery,
		topic.Weight,
		topic.OrderIndex,
		topic.CreatedAt,
		topic.UpdatedAt,
	}, nil
}
