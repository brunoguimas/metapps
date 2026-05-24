package topic_dependency

import (
	"time"

	"github.com/google/uuid"
)

type TopicDependency struct {
	ID               uuid.UUID `json:"id"`
	TopicID          uuid.UUID `json:"topic_id"`
	DependsOnTopicID uuid.UUID `json:"depends_on"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
