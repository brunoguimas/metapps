package repository

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/database/db"
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
		PasswordHash: u.PasswordHash,
	})
	if err != nil {
		return nil, err
	}

	return &models.User{
		ID:           user.ID,
		Username:     user.Username,
		Email:        user.Email,
		PasswordHash: user.PasswordHash,
		CreatedAt:    user.CreatedAt.Time,
	}, nil
}
func (r *userRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	user, err := r.queries.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	return &models.User{
		ID:           user.ID,
		Username:     user.Username,
		Email:        user.Email,
		PasswordHash: user.PasswordHash,
		CreatedAt:    user.CreatedAt.Time,
	}, nil
}
