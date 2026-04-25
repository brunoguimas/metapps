package mail

import (
	"context"
	"database/sql"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type EmailRepository interface {
	UpsertEmailCode(c context.Context, code *EmailCode) error
	GetEmailCode(c context.Context, userID uuid.UUID, codeType string) (*EmailCode, error)
	DeleteEmailCode(c context.Context, userID uuid.UUID, codeType string) error
}

type emailRepository struct {
	queries *db.Queries
}

func NewEmailRepository(q *db.Queries) EmailRepository {
	return &emailRepository{
		queries: q,
	}
}

func (r *emailRepository) UpsertEmailCode(c context.Context, code *EmailCode) error {
	_, err := r.queries.UpsertEmailCode(c, db.UpsertEmailCodeParams{
		UserID:      code.UserID,
		Type:        code.Type,
		CodeHash:    code.CodeHash,
		Attempts:    code.Attempts,
		MaxAttempts: code.MaxAttempts,
		ExpiresAt:   code.ExpiresAt,
	})
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't store email code", err)
	}

	return nil
}

func (r *emailRepository) GetEmailCode(c context.Context, userID uuid.UUID, codeType string) (*EmailCode, error) {
	emailCode, err := r.queries.GetEmailCodeByUserIDAndType(c, db.GetEmailCodeByUserIDAndTypeParams{
		UserID: userID,
		Type:   codeType,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrInvalidOrExpiredEmailCode, "invalid or expired code", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get email code", err)
	}

	return mapEmailCode(emailCode), nil
}

func (r *emailRepository) DeleteEmailCode(c context.Context, userID uuid.UUID, codeType string) error {
	err := r.queries.DeleteEmailCodeByUserIDAndType(c, db.DeleteEmailCodeByUserIDAndTypeParams{
		UserID: userID,
		Type:   codeType,
	})
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't delete email code", err)
	}

	return nil
}
