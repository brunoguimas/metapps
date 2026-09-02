package task_correction

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusPending   Status = "pending"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
)

type TaskCorrection struct {
	ID        uuid.UUID `json:"id"`
	AttemptID uuid.UUID `json:"attempt_id"`
	Feedback  string    `json:"feedback"`
	Score     *float64  `json:"score,omitempty"`
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

type CreateCorrectionInput struct {
	AttemptID uuid.UUID `json:"attempt_id"`
	Feedback  string    `json:"feedback"`
	Score     *float64  `json:"score,omitempty"`
	Status    Status    `json:"status,omitempty"`
}
