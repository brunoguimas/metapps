package service

import (
	"context"

	apperrors "github.com/brunoguimas/metapps/backend/internal/errors"
	"github.com/brunoguimas/metapps/backend/internal/models"
	"github.com/brunoguimas/metapps/backend/internal/repository"
	"github.com/brunoguimas/metapps/backend/internal/security"
	"github.com/brunoguimas/metapps/backend/internal/service/dto"
)

type UserService interface {
	CreateUser(c context.Context, u *dto.RegisterRequest) (*models.User, error)
	Login(c context.Context, u *dto.LoginRequest) (*models.User, error)
	CheckUserExists(c context.Context, email string) error
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
		return nil, apperrors.NewAppError(apperrors.ErrInvalidCredentials, "invalid password", err)
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
		return nil, apperrors.NewAppError(apperrors.ErrUserNotFound, "user not found", err)
	}

	if err = security.CheckPassword(u.Password, user.PasswordHash); err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidCredentials, "invalid password", err)
	}

	return user, nil
}

func (s *userService) CheckUserExists(c context.Context, email string) error {
	_, err := s.repo.GetByEmail(c, email)
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrUserNotFound, "user not found", nil)
	}

	return nil
}
