package topic

import (
	"time"

	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	"github.com/google/uuid"
)

type TopicStatus string

const (
	TopicStatusLocked     TopicStatus = "LOCKED"
	TopicStatusAvailable  TopicStatus = "AVAILABLE"
	TopicStatusInProgress TopicStatus = "IN_PROGRESS"
	TopicStatusMastered   TopicStatus = "MASTERED"
)

type TopicProgress struct {
	ID              uuid.UUID   `json:"id"`
	UserID          uuid.UUID   `json:"user_id"`
	TopicID         uuid.UUID   `json:"topic_id"`
	MasteryScore    float64     `json:"mastery_score"`
	ConfidenceScore float64     `json:"confidence_score"`
	AttemptsCount   int32       `json:"attempts_count"`
	Status          TopicStatus `json:"status"`
	EvolutionStage  string      `json:"evolution_stage"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

type Topic struct {
	ID              uuid.UUID     `json:"id"`
	GoalID          uuid.UUID     `json:"goal_id"`
	ParentTopicID   uuid.NullUUID `json:"parent_topic_id"`
	Title           string        `json:"title"`
	Description     string        `json:"description"`
	RequiredMastery float64       `json:"required_mastery"`
	Weight          float64       `json:"weight"`
	OrderIndex      int32         `json:"order_index"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

type Roadmap struct {
	Topics       []*Topic                            `json:"topics"`
	Dependencies []*topic_dependency.TopicDependency `json:"dependencies"`
}
