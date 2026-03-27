package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Goal struct {
	ID           uuid.UUID       `json:"id"`
	UserID       uuid.UUID       `json:"user_id"`
	Title        string          `json:"title"`
	Difficulties json.RawMessage `json:"difficulties"`
	CreatedAt    time.Time       `json:"created_at"`
}
