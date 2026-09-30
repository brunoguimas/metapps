package flashcard

import (
	"time"

	"github.com/google/uuid"
)

type Source string

const (
	SourceAI     Source = "ai"
	SourceManual Source = "manual"
)

type Flashcard struct {
	ID        uuid.UUID     `json:"id"`
	UserID    uuid.NullUUID `json:"user_id,omitempty"`
	TopicID   uuid.UUID     `json:"topic_id"`
	Source    Source        `json:"source"`
	Front     string        `json:"front"`
	Back      string        `json:"back"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

type FlashcardProgress struct {
	ID             uuid.UUID  `json:"id"`
	UserID         uuid.UUID  `json:"user_id"`
	FlashcardID    uuid.UUID  `json:"flashcard_id"`
	EaseFactor     float64    `json:"ease_factor"`
	IntervalDays   int32      `json:"interval_days"`
	Repetitions    int32      `json:"repetitions"`
	NextReviewAt   time.Time  `json:"next_review_at"`
	LastReviewedAt *time.Time `json:"last_reviewed_at,omitempty"`
}

// DeckCard represents a flashcard (content) joined with the viewing user's SRS
// progress. Progress may be nil if the user has never studied the card.
type DeckCard struct {
	FlashcardID uuid.UUID         `json:"id"`
	TopicID     uuid.UUID         `json:"topic_id"`
	Source      Source            `json:"source"`
	Front       string            `json:"front"`
	Back        string            `json:"back"`
	Progress    *FlashcardProgress `json:"progress,omitempty"`
}

type CreateManualInput struct {
	TopicID uuid.UUID `json:"topic_id"`
	Front   string    `json:"front"`
	Back    string    `json:"back"`
}

type ReviewInput struct {
	Quality int `json:"quality"`
}

type generatedCard struct {
	Front string `json:"front"`
	Back  string `json:"back"`
}
