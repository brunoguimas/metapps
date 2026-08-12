package task_correction

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Status represents the status of a correction.
type Status string

const (
	StatusPending   Status = "pending"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
)

// TaskCorrection represents the correction of a task attempt.
type TaskCorrection struct {
	ID        uuid.UUID `json:"id"`
	AttemptID uuid.UUID `json:"attempt_id"`
	Feedback  string    `json:"feedback"` // AI-generated constructive feedback
	Score     *float64  `json:"score,omitempty"` // AI-suggested score (for essays) or nil for quizzes
	Status    Status    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Value implements the driver.Valuer interface for JSONB.
func (tc TaskCorrection) Value() (driver.Value, error) {
	return json.Marshal(tc)
}

// Scan implements the sql.Scanner interface for JSONB.
func (tc *TaskCorrection) Scan(value interface{}) error {
	b, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(b, tc)
}

// CreateCorrectionInput represents the input for creating a correction.
type CreateCorrectionInput struct {
	AttemptID uuid.UUID `json:"attempt_id"`
	Feedback  string    `json:"feedback"`
	Score     *float64  `json:"score,omitempty"`
	Status    Status    `json:"status,omitempty"`
}
