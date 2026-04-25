package user

import (
	"context"
	"database/sql"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type UserRepository interface {
	Create(ctx context.Context, user *User) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	VerifyUser(c context.Context, userID uuid.UUID) error
	GetByID(c context.Context, userID uuid.UUID) (*User, error)
	UpdatePassword(c context.Context, userID uuid.UUID, passwordHash string) error
}

type userRepository struct {
	queries *db.Queries
}

func NewUserRepository(q *db.Queries) UserRepository {
	return &userRepository{
		queries: q,
	}
}

func (r *userRepository) Create(c context.Context, user *User) (*User, error) {
	u, err := r.queries.CreateOneUser(c, db.CreateOneUserParams{
		Username:     user.Username,
		Email:        user.Email,
		PasswordHash: sql.NullString{String: user.PasswordHash, Valid: true},
	})
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, apperrors.NewAppError(apperrors.ErrEmailAlreadyInUse, "email already in use", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create user", err)
	}

	return mapUser(u), nil
}
func (r *userRepository) GetByEmail(ctx context.Context, email string) (*User, error) {
	u, err := r.queries.GetUserByEmail(ctx, email)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrUserNotFound, "user not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user", err)
	}

	return mapUser(u), nil
}

func (r *userRepository) VerifyUser(c context.Context, userID uuid.UUID) error {
	err := r.queries.VerifyUserByID(c, userID)
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't verify user", err)
	}

	return nil
}

func (r *userRepository) GetByID(c context.Context, userID uuid.UUID) (*User, error) {
	u, err := r.queries.GetUserByID(c, userID)
	if err != nil {
		return nil, err
	}

	return mapUser(u), nil
}

func (r *userRepository) UpdatePassword(c context.Context, userID uuid.UUID, passwordHash string) error {
	err := r.queries.UpdateUserPasswordByID(c, db.UpdateUserPasswordByIDParams{
		ID:           userID,
		PasswordHash: sql.NullString{String: passwordHash, Valid: true},
	})
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't update password", err)
	}

	return nil
}

func mapUser(u db.User) *User {
	return &User{
		ID:           u.ID,
		Username:     u.Username,
		Email:        u.Email,
		PasswordHash: u.PasswordHash.String,
		Verified:     u.Verified,
		CreatedAt:    u.CreatedAt,
	}
}
