package service

import (
	"context"
	"fmt"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"github.com/brunoguimas/metapps/backend/internal/mail"
	"github.com/brunoguimas/metapps/backend/internal/models"
	"github.com/brunoguimas/metapps/backend/internal/repository"
	"github.com/brunoguimas/metapps/backend/internal/security"
	"github.com/google/uuid"
)

type EmailService interface {
	CreateEmailToken(c context.Context, userID uuid.UUID) (string, error)
	GetToken(c context.Context, userID uuid.UUID) (*models.EmailToken, error)
	SendEmail(c context.Context, userEmail, token string) error
	VerifyToken(c context.Context, hash string) (*models.EmailToken, error)
}

type emailService struct {
	repo   repository.EmailTokenRepository
	config *config.Config
	mailer *mail.Mailer
}

func NewEmailService(r repository.EmailTokenRepository, c *config.Config, m *mail.Mailer) EmailService {
	return &emailService{
		repo:   r,
		config: c,
		mailer: m,
	}
}

func (s *emailService) CreateEmailToken(c context.Context, userID uuid.UUID) (string, error) {
	token, err := security.GenerateEmailToken()
	if err != nil {
		return "", err
	}

	tokenHash := security.HashToken(token)

	_, err = s.repo.CreateEmailToken(c, &models.EmailToken{
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(s.config.EmailVerificationTTL),
	})
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return "", appErr
		}
		return "", apperrors.NewAppError(apperrors.ErrInternal, "couldn't create token", err)
	}

	return token, nil
}

func (s *emailService) GetToken(c context.Context, userID uuid.UUID) (*models.EmailToken, error) {
	token, err := s.repo.GetToken(c, userID)
	if err != nil {
		return nil, err
	}

	return token, nil
}

func (s *emailService) SendEmail(c context.Context, userEmail, token string) error {
	verifyURL := fmt.Sprintf(
		"%s/auth/email/verify?token=%s",
		s.config.FrontendOrigin,
		token,
	)

	err := s.mailer.SendVerifyEmail(userEmail, verifyURL)
	if err != nil {
		return err
	}

	return nil
}

func (s *emailService) VerifyToken(c context.Context, hash string) (*models.EmailToken, error) {
	token, err := s.repo.VerifyToken(c, hash)
	if err != nil {
		return nil, err
	}

	return token, nil
}
