package profile

import (
	"time"

	"github.com/google/uuid"
)

type Profile struct {
	ID               uuid.UUID `json:"id"`
	UserID           uuid.UUID `json:"user_id"`
	XP               int       `json:"xp"`
	Streak           int       `json:"streak"`
	LastActivityDate time.Time `json:"last_activity_date"`
	AvatarURL        string    `json:"avatar_url"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
