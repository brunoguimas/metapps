package auth

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/modules/auth/dto"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	"github.com/brunoguimas/metapps/backend/internal/platform/security"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
)

type AuthService interface {
	Login(c context.Context, u *dto.LoginRequest) (*user.User, error)
	Register(c context.Context, u *dto.RegisterRequest) (*user.User, error)
}

type authService struct {
	userRepo user.UserRepository
}

func NewAuthService(r user.UserRepository) AuthService {
	return &authService{
		userRepo: r,
	}
}

func (s *authService) Register(c context.Context, u *dto.RegisterRequest) (*user.User, error) {
	hash, err := security.HashPassword(u.Password)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create user", err)
	}

	user := &user.User{
		Username:     u.Username,
		Email:        u.Email,
		PasswordHash: hash,
	}
	_, err = s.userRepo.GetByEmail(c, u.Email)
	if err == nil {
		return nil, apperrors.NewAppError(apperrors.ErrUserAlreadyExists, "user already exists", nil)
	}

	return s.userRepo.Create(c, user)
}

func (s *authService) Login(c context.Context, u *dto.LoginRequest) (*user.User, error) {
	user, err := s.userRepo.GetByEmail(c, u.Email)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			if appErr.Code() == apperrors.ErrUserNotFound {
				return nil, apperrors.NewAppError(apperrors.ErrInvalidCredentials, "invalid email or password", err)
			}
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user", err)
	}

	if err = security.CheckHashPassword(u.Password, user.PasswordHash); err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidCredentials, "invalid email or password", err)
	}

	return user, nil
}
