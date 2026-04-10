package jwt

import (
	"context"
	"database/sql"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type JWTRepository interface {
	CreateRefreshToken(ctx context.Context, userID uuid.UUID, tokenTTL time.Time) (uuid.UUID, error)
	GetRefreshToken(ctx context.Context, tokenID uuid.UUID) (*RefreshToken, error)
	RevokeRefreshToken(ctx context.Context, tokenID uuid.UUID) error
}

type jwtRepository struct {
	queries *db.Queries
}

func NewJWTRepository(q *db.Queries) JWTRepository {
	return &jwtRepository{
		queries: q,
	}
}

func (r *jwtRepository) CreateRefreshToken(ctx context.Context, userID uuid.UUID, tokenTTL time.Time) (uuid.UUID, error) {
	id, err := r.queries.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		UserID:    userID,
		ExpiresAt: tokenTTL,
	})
	if err != nil {
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create refresh token", err)
	}

	return id, nil
}

func (r *jwtRepository) GetRefreshToken(ctx context.Context, tokenID uuid.UUID) (*RefreshToken, error) {
	token, err := r.queries.GetRefreshTokenById(ctx, tokenID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "refresh token not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get refresh token", err)
	}

	return mapRefreshToken(token), nil
}

func (r *jwtRepository) RevokeRefreshToken(ctx context.Context, tokenID uuid.UUID) error {
	err := r.queries.RevokeRefreshTokenById(ctx, tokenID)
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't revoke token", err)
	}

	return nil
}

func mapRefreshToken(t db.RefreshToken) *RefreshToken {
	return &RefreshToken{
		ID:        t.ID,
		UserID:    t.UserID,
		ExpiresAt: t.ExpiresAt,
		Revoked:   t.Revoked,
	}
}
