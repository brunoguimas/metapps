package mail

import (
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/google/uuid"
)

type EmailCode struct {
	ID          uuid.UUID
	UserID      uuid.UUID
	Type        string
	CodeHash    string
	Attempts    int32
	MaxAttempts int32
	ExpiresAt   time.Time
	CreatedAt   time.Time
}

func mapEmailCode(code db.EmailCode) *EmailCode {
	return &EmailCode{
		ID:          code.ID,
		UserID:      code.UserID,
		Type:        code.Type,
		CodeHash:    code.CodeHash,
		Attempts:    code.Attempts,
		MaxAttempts: code.MaxAttempts,
		ExpiresAt:   code.ExpiresAt,
		CreatedAt:   code.CreatedAt,
	}
}
