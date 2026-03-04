package repository

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/models"
)

type UserRepository interface {
	Create(ctx context.Context, user *models.User) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
}
