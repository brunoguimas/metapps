package repository

import (
	"context"
	"database/sql"

	"github.com/brunoguimas/metapps/backend/internal/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/errors"
	"github.com/brunoguimas/metapps/backend/internal/models"
)

type UserRepository interface {
	Create(ctx context.Context, user *models.User) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
}

type userRepository struct {
	queries *db.Queries
}

func NewUserRepository(q *db.Queries) UserRepository {
	return &userRepository{
		queries: q,
	}
}

func (r *userRepository) Create(c context.Context, u *models.User) (*models.User, error) {
	user, err := r.queries.CreateOneUser(c, db.CreateOneUserParams{
		Username:     u.Username,
		Email:        u.Email,
		PasswordHash: sql.NullString{String: u.PasswordHash, Valid: true},
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create user", err)
	}

	return &models.User{
		ID:           user.ID,
		Username:     user.Username,
		Email:        user.Email,
		PasswordHash: user.PasswordHash.String,
		CreatedAt:    user.CreatedAt.Time,
	}, nil
}
func (r *userRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	user, err := r.queries.GetUserByEmail(ctx, email)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrUserNotFound, "user not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user", err)
	}

	return &models.User{
		ID:           user.ID,
		Username:     user.Username,
		Email:        user.Email,
		PasswordHash: user.PasswordHash.String,
		CreatedAt:    user.CreatedAt.Time,
	}, nil
}
