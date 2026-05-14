package user

import (
	"context"
	"testing"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeUserRepositoryService struct {
	getByEmailFn func(context.Context, string) (*User, error)
}

func (r *fakeUserRepositoryService) Create(context.Context, *User) (*User, error) { return nil, nil }
func (r *fakeUserRepositoryService) GetByEmail(c context.Context, email string) (*User, error) {
	return r.getByEmailFn(c, email)
}
func (r *fakeUserRepositoryService) VerifyUser(context.Context, uuid.UUID) error { return nil }
func (r *fakeUserRepositoryService) GetByID(context.Context, uuid.UUID) (*User, error) {
	return nil, nil
}
func (r *fakeUserRepositoryService) UpdatePassword(context.Context, uuid.UUID, string) error { return nil }

func TestUserServiceGetUserByEmail_Success(t *testing.T) {
	service := NewUserService(&fakeUserRepositoryService{
		getByEmailFn: func(_ context.Context, email string) (*User, error) {
			return &User{Email: email}, nil
		},
	})

	result, err := service.GetUserByEmail(context.Background(), "bruno@test.com")

	require.NoError(t, err)
	assert.Equal(t, "bruno@test.com", result.Email)
}

func TestUserServiceGetUserByEmail_Fail(t *testing.T) {
	service := NewUserService(&fakeUserRepositoryService{
		getByEmailFn: func(context.Context, string) (*User, error) {
			return nil, apperrors.NewAppError(apperrors.ErrUserNotFound, "user not found", nil)
		},
	})

	result, err := service.GetUserByEmail(context.Background(), "missing@test.com")

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrUserNotFound, appErr.Code())
}
