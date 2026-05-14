package auth

import (
	"context"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/modules/auth/dto"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	"github.com/brunoguimas/metapps/backend/internal/platform/security"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type FakeUserRepository struct {
	users map[string]*user.User
}

func NewFakeUserRepository() *FakeUserRepository {
	return &FakeUserRepository{
		users: make(map[string]*user.User),
	}	
}

func (r *FakeUserRepository) Create(ctx context.Context, user *user.User) (*user.User, error) {
	r.users[user.Email] = user

	return user, nil
}
func (r *FakeUserRepository) GetByEmail(ctx context.Context, email string) (*user.User, error) {
	user, ok := r.users[email]
	if !ok {
		return nil, apperrors.NewAppError(apperrors.ErrUserNotFound, "user not found", nil)
	}

	return user, nil
}

func (r *FakeUserRepository) VerifyUser(c context.Context, userID uuid.UUID) error { return nil }
func (r *FakeUserRepository) GetByID(c context.Context, userID uuid.UUID) (*user.User, error) { return nil, nil }
func (r *FakeUserRepository) UpdatePassword(c context.Context, userID uuid.UUID, passwordHash string) error { return nil }

func TestRegister_Success(t *testing.T) {
	r := NewFakeUserRepository()
	s := NewAuthService(r)

	req := &dto.RegisterRequest{
		Username: "brunex",
		Email: "bruno@test.com",
		Password: "12345678",
	}

	result, err := s.Register(context.Background(), req)

	require.Nil(t, err)
	assert.Equal(t, req.Email, result.Email)

	assert.NotEmpty(t, result.PasswordHash)
	assert.NotEqual(t, req.Password, result.PasswordHash)
}

func TestRegister_FailsUserDuplicate(t *testing.T) {
	r := NewFakeUserRepository()
	s := NewAuthService(r)

	const email = "belugaforeverinmyass@test.com"
	r.users[email] = &user.User{
		Email: email,
	}

	req := &dto.RegisterRequest{
		Username: "viadinho",
		Email: email,
		Password: "67426126",
	}
	result, err := s.Register(context.Background(), req)
	require.Error(t, err)
	require.Nil(t, result)

	appErr, ok := apperrors.As(err)

	require.True(t, ok)

	assert.Equal(t, apperrors.ErrEmailAlreadyInUse, appErr.Code())
}

func TestLogin_Success(t *testing.T) {
	r := NewFakeUserRepository()
	s := NewAuthService(r)

	const email = "naochora67@test.com"
	hash, _ := security.HashPassword("bandidonquer67resenha")

	r.users[email] = &user.User{
		Email: email,
		PasswordHash: hash,
	}

	req := &dto.LoginRequest{
		Email: email,
		Password: "bandidonquer67resenha",
	}
	result, err := s.Login(context.Background(), req)

	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, req.Email, result.Email)
}

func TestLogin_FailsUserDontExist(t *testing.T) {
	r := NewFakeUserRepository()
	s := NewAuthService(r)

	req := &dto.LoginRequest{
		Email: "naochorax@test.com",
		Password: "dosentmatter",
	}

	result, err := s.Login(context.Background(), req)
	
	require.Error(t, err)
	require.Nil(t, result)

	appErr, ok := apperrors.As(err)
	assert.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidCredentials, appErr.Code())
}
