package user

import (
	"context"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type UserService interface {
	GetUserByEmail(c context.Context, email string) (*User, error)
	CheckUserExists(c context.Context, email string) error
	VerifyUser(c context.Context, userID uuid.UUID) error
	GetUserByID(c context.Context, userID uuid.UUID) (*User, error)
}

type userService struct {
	repo UserRepository
}

func NewUserService(repo UserRepository) UserService {
	return &userService{repo}
}

func (s *userService) CheckUserExists(c context.Context, email string) error {
	_, err := s.repo.GetByEmail(c, email)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return appErr
		}
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't check user", err)
	}

	return nil
}

func (s *userService) VerifyUser(c context.Context, userID uuid.UUID) error {
	err := s.repo.VerifyUser(c, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return appErr
		}
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't verify user", err)
	}

	return nil
}

func (s *userService) GetUserByID(c context.Context, userID uuid.UUID) (*User, error) {
	user, err := s.repo.GetByID(c, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user", err)
	}

	return user, nil
}
func (s *userService) GetUserByEmail(c context.Context, email string) (*User, error) {
	user, err := s.repo.GetByEmail(c, email)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user", err)
	}

	return user, nil
}
