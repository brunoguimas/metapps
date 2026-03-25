package repository

import (
	"context"
	"database/sql"

	"github.com/brunoguimas/metapps/backend/internal/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"github.com/brunoguimas/metapps/backend/internal/models"
)

type EmailTokenRepository interface {
	CreateEmailToken(c context.Context, t *models.EmailToken) (*models.EmailToken, error)
	GetToken(c context.Context, userID int64) (*models.EmailToken, error)
	VerifyToken(c context.Context, hash string) (*models.EmailToken, error)
}

type emailTokenRepository struct {
	queries *db.Queries
}

func NewEmailTokenRepository(q *db.Queries) EmailTokenRepository {
	return &emailTokenRepository{
		queries: q,
	}
}

func (r *emailTokenRepository) CreateEmailToken(c context.Context, t *models.EmailToken) (*models.EmailToken, error) {
	token, err := r.queries.CreateEmailToken(c, db.CreateEmailTokenParams{
		UserID:    t.UserID,
		TokenHash: t.TokenHash,
		ExpiresAt: t.ExpiresAt,
	})

	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create email token", err)
	}

	return &models.EmailToken{
		ID:         token.ID,
		UserID:     token.UserID,
		TokenHash:  token.TokenHash,
		ExpiresAt:  token.ExpiresAt,
		VerifiedAt: nil,
		CreatedAt:  token.CreatedAt,
	}, nil
}

func (r *emailTokenRepository) GetToken(c context.Context, userID int64) (*models.EmailToken, error) {
	token, err := r.queries.GetLatestTokenByUserID(c, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrInvalidOrExpiredEmailToken, "invalid or expired token", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't find email token", err)
	}

	return &models.EmailToken{
		ID:         token.ID,
		UserID:     token.UserID,
		TokenHash:  token.TokenHash,
		ExpiresAt:  token.ExpiresAt,
		VerifiedAt: nil,
		CreatedAt:  token.CreatedAt,
	}, nil
}

func (r *emailTokenRepository) VerifyToken(c context.Context, hash string) (*models.EmailToken, error) {
	token, err := r.queries.VerifyTokenByHash(c, hash)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidOrExpiredEmailToken, "invalid or expired token", err)
	}

	return &models.EmailToken{
		ID:         token.ID,
		UserID:     token.UserID,
		TokenHash:  token.TokenHash,
		ExpiresAt:  token.ExpiresAt,
		VerifiedAt: nil,
		CreatedAt:  token.CreatedAt,
	}, nil
}
