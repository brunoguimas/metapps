package service

import (
	"context"
	"errors"

	"github.com/brunoguimas/metasapp/internal/models"
	"github.com/brunoguimas/metasapp/internal/repository"
	"github.com/brunoguimas/metasapp/internal/security"
	"github.com/brunoguimas/metasapp/internal/service/dto"
)

type UserService interface {
	CreateUser(c context.Context, u *dto.RegisterRequest) (*models.User, error)
	Login(c context.Context, u *dto.LoginRequest) (*models.User, error)
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
		return nil, err
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
		return nil, errors.New("invalid email or password")
	}

	if err = security.CheckPassword(u.Password, user.PasswordHash); err != nil {
		return nil, errors.New("invalid email or password")
	}

	return user, nil
}
