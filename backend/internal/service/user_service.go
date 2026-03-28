package service

import (
	"context"

	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"github.com/brunoguimas/metapps/backend/internal/models"
	"github.com/brunoguimas/metapps/backend/internal/repository"
	"github.com/brunoguimas/metapps/backend/internal/security"
	"github.com/brunoguimas/metapps/backend/internal/service/dto"
	"github.com/google/uuid"
)

type UserService interface {
	CreateUser(c context.Context, u *dto.RegisterRequest) (*models.User, error)
	Login(c context.Context, u *dto.LoginRequest) (*models.User, error)
	GetUserByEmail(c context.Context, email string) (*models.User, error)
	CheckUserExists(c context.Context, email string) error
	VerifyUser(c context.Context, userID uuid.UUID) error
	GetUserByID(c context.Context, userID uuid.UUID) (*models.User, error)
}

type userService struct {
	repo repository.UserRepository
}

func NewUserService(repo repository.UserRepository) UserService {
	return &userService{repo}
}

func (s *userService) CreateUser(c context.Context, u *dto.RegisterRequest) (*models.User, error) {
	hash, err := security.HashPassword(u.Password)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create user", err)
	}

	user := &models.User{
		Username:     u.Username,
		Email:        u.Email,
		PasswordHash: hash,
	}
	return s.repo.Create(c, user)
}

func (s *userService) Login(c context.Context, u *dto.LoginRequest) (*models.User, error) {
	user, err := s.repo.GetByEmail(c, u.Email)
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

func (s *userService) GetUserByID(c context.Context, userID uuid.UUID) (*models.User, error) {
	user, err := s.repo.GetByID(c, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user", err)
	}

	return user, nil
}
func (s *userService) GetUserByEmail(c context.Context, email string) (*models.User, error) {
	user, err := s.repo.GetByEmail(c, email)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user", err)
	}

	return user, nil
}
