package models

import "time"

type EmailToken struct {
	ID         int64
	UserID     int64
	TokenHash  string
	ExpiresAt  time.Time
	VerifiedAt *time.Time
	CreatedAt  time.Time
}
