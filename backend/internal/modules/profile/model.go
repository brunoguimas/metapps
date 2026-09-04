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

// Level derives the user's level from their XP.
// Each level requires 100 XP. Level = floor(XP / 100) + 1.
func LevelFromXP(xp int) int {
	return xp/100 + 1
}

// Level returns the current level for the profile.
func (p *Profile) Level() int {
	return LevelFromXP(p.XP)
}
