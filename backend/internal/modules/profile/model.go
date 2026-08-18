package profile

import (
	"time"

	"github.com/google/uuid"
)

// Profile represents the user's profile with XP, streak, and avatar.
type Profile struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"` // foreign key to user
	XP           int       `json:"xp"`                  // experience points
	Streak       int       `json:"streak"`              // current streak of days with at least one task completed
	LastActivityDate time.Time `json:"last_activity_date"` // date of last task activity (time set to 00:00:00 UTC)
	AvatarURL    string    `json:"avatar_url"`          // relative path or URL to avatar image
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}