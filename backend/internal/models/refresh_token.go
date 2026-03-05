package models

import (
	"time"

	"github.com/google/uuid"
)

type RefreshToken struct {
	ID        uuid.UUID
	UserID    uint
	ExpiresAt time.Time
	Revoked   bool
}
