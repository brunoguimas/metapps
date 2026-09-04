package topic

import (
	"context"
	"database/sql"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Repository interface {
	Create(c context.Context, t *Topic) (*Topic, error)
	Get(c context.Context, topicID uuid.UUID) (*Topic, error)
	GetByGoalID(c context.Context, goalID uuid.UUID) ([]*Topic, error)
	DeleteByGoalID(c context.Context, goalID uuid.UUID) error
}

type topicRepository struct {
	queries *db.Queries
}

func NewRepository(q *db.Queries) Repository {
	return &topicRepository{
		queries: q,
	}
}

func (r *topicRepository) Create(c context.Context, t *Topic) (*Topic, error) {
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
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create topic", err)
	}

	return mapTopic(topic), nil
}

func (r *topicRepository) Get(c context.Context, topicID uuid.UUID) (*Topic, error) {
	topic, err := r.queries.GetTopicByID(c, topicID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskNotFound, "topic not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get topic", err)
	}

	return mapTopic(topic), nil
}

func (r *topicRepository) GetByGoalID(c context.Context, goalID uuid.UUID) ([]*Topic, error) {
	dbTopics, err := r.queries.GetTopicByGoalID(c, goalID)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get topics by goal", err)
	}

	topics := make([]*Topic, 0, len(dbTopics))
	for _, dbTopic := range dbTopics {
		topics = append(topics, mapTopic(dbTopic))
	}

	return topics, nil
}

func (r *topicRepository) DeleteByGoalID(c context.Context, goalID uuid.UUID) error {
	err := r.queries.DeleteTopicsByGoalID(c, goalID)
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't delete topics by goal", err)
	}
	return nil
}

func mapTopic(t db.Topic) *Topic {
	return &Topic{
		ID:              t.ID,
		GoalID:          t.GoalID,
		ParentTopicID:   t.ParentTopicID,
		Title:           t.Title,
		Description:     t.Description,
		RequiredMastery: t.RequiredMastery,
		Weight:          t.Weight,
		OrderIndex:      t.OrderIndex,
		CreatedAt:       t.CreatedAt,
		UpdatedAt:       t.UpdatedAt,
	}
}
