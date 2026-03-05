package auth

import (
	"context"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/database/db"
	"github.com/brunoguimas/metapps/backend/internal/models"
	"github.com/google/uuid"
)

type JWTRepository interface {
	CreateRefreshToken(ctx context.Context, tokenID uuid.UUID, userID uint, tokenTTL time.Time) error
	GetRefreshToken(ctx context.Context, tokenID uuid.UUID) (*models.RefreshToken, error)
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

func (r *jwtRepository) CreateRefreshToken(ctx context.Context, tokenID uuid.UUID, userID uint, tokenTTL time.Time) error {
	err := r.queries.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		ID:        tokenID,
		UserID:    int64(userID),
		ExpiresAt: tokenTTL,
	})
	if err != nil {
		return err
	}

	return nil
}

func (r *jwtRepository) GetRefreshToken(ctx context.Context, tokenID uuid.UUID) (*models.RefreshToken, error) {
	token, err := r.queries.GetRefreshTokenById(ctx, tokenID)
	if err != nil {
		return nil, err
	}

	return &models.RefreshToken{
		ID:        token.ID,
		UserID:    uint(token.UserID),
		ExpiresAt: token.ExpiresAt,
		Revoked:   token.Revoked,
	}, nil
}

func (r *jwtRepository) RevokeRefreshToken(ctx context.Context, tokenID uuid.UUID) error {
	err := r.queries.RevokeRefreshTokenById(ctx, tokenID)
	if err != nil {
		return err
	}

	return nil
}
