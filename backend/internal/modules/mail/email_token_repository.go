package mail

import (
	"context"
	"database/sql"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type EmailTokenRepository interface {
	CreateEmailToken(c context.Context, t *EmailToken) (*EmailToken, error)
	GetToken(c context.Context, userID uuid.UUID) (*EmailToken, error)
	VerifyToken(c context.Context, hash string) (*EmailToken, error)
}

type emailTokenRepository struct {
	queries *db.Queries
}

func NewEmailTokenRepository(q *db.Queries) EmailTokenRepository {
	return &emailTokenRepository{
		queries: q,
	}
}

func (r *emailTokenRepository) CreateEmailToken(c context.Context, t *EmailToken) (*EmailToken, error) {
	token, err := r.queries.CreateEmailToken(c, db.CreateEmailTokenParams{
		UserID:    t.UserID,
		TokenHash: t.TokenHash,
		ExpiresAt: t.ExpiresAt,
	})

	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create email token", err)
	}

	return mapEmailToken(token), nil
}

func (r *emailTokenRepository) GetToken(c context.Context, userID uuid.UUID) (*EmailToken, error) {
	token, err := r.queries.GetLatestTokenByUserID(c, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrInvalidOrExpiredEmailToken, "invalid or expired token", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't find email token", err)
	}

	return mapEmailToken(token), nil
}

func (r *emailTokenRepository) VerifyToken(c context.Context, hash string) (*EmailToken, error) {
	token, err := r.queries.VerifyTokenByHash(c, hash)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidOrExpiredEmailToken, "invalid or expired token", err)
	}

	return mapEmailToken(token), nil
}

func mapEmailToken(t db.EmailToken) *EmailToken {
	verifiedAt := func() *time.Time {
		if !t.VerifiedAt.Valid {
			return nil
		}
		return &t.VerifiedAt.Time
	}()

	return &EmailToken{
		ID:         t.ID,
		UserID:     t.UserID,
		TokenHash:  t.TokenHash,
		ExpiresAt:  t.ExpiresAt,
		VerifiedAt: verifiedAt,
		CreatedAt:  t.CreatedAt,
	}
}
