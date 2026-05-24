package topic

import (
	"time"

	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	"github.com/google/uuid"
)

type Topic struct {
	ID              uuid.UUID     `json:"id"`
	GoalID          uuid.UUID     `json:"goal_id"`
	ParentTopicID   uuid.NullUUID `json:"parent_topic_id"`
	Title           string        `json:"title"`
	Description     string        `json:"description"`
	RequiredMastery float64       `json:"required_mastery"`
	Weight          float64       `json:"weight"`
	OrderIndex      int32         `json:"order_index"`
	CreatedAT       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

type Roadmap struct {
	Topics       []*Topic                            `json:"topics"`
	Dependencies []*topic_dependency.TopicDependency `json:"dependencies"`
}
