package service

import (
	"context"

	"github.com/brunoguimas/metasapp/internal/models"
	"github.com/brunoguimas/metasapp/internal/repository"
	"github.com/brunoguimas/metasapp/internal/security"
	"github.com/brunoguimas/metasapp/internal/service/dto"
)

type UserService struct {
	repo repository.UserRepository
}

func NewUserService(repo repository.UserRepository) *UserService {
	return &UserService{repo}
}

func (s *UserService) CreateUser(c context.Context, u *dto.RegisterInput) (*models.User, error) {
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

func (s *UserService) Login(c context.Context, u *dto.LoginInput) (bool, error) {
	user, err := s.repo.GetByEmail(c, u.Email)
	if err != nil {
		return false, err
	}

	if err = security.CheckPassword(u.Password, user.PasswordHash); err != nil {
		return false, nil
	}

	return true, nil
}
