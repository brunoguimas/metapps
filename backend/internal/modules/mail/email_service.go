package mail

import (
	"context"
	"fmt"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/security"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type EmailService interface {
	CreateEmailToken(c context.Context, userID uuid.UUID) (string, error)
	GetToken(c context.Context, userID uuid.UUID) (*EmailToken, error)
	SendEmail(c context.Context, userEmail, token string) error
	VerifyToken(c context.Context, hash string) (*EmailToken, error)
}

type emailService struct {
	repo   EmailTokenRepository
	config *config.Config
	mailer *Mailer
}

func NewEmailService(r EmailTokenRepository, c *config.Config, m *Mailer) EmailService {
	return &emailService{
		repo:   r,
		config: c,
		mailer: m,
	}
}

func (s *emailService) CreateEmailToken(c context.Context, userID uuid.UUID) (string, error) {
	token, err := security.GenerateEmailToken()
	if err != nil {
		return "", apperrors.NewAppError(apperrors.ErrInternal, "couldn't generate email token", err)
	}

	tokenHash := security.HashToken(token)

	_, err = s.repo.CreateEmailToken(c, &EmailToken{
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

func (s *emailService) GetToken(c context.Context, userID uuid.UUID) (*EmailToken, error) {
	token, err := s.repo.GetToken(c, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get email token", err)
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
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't send email", err)
	}

	return nil
}

func (s *emailService) VerifyToken(c context.Context, hash string) (*EmailToken, error) {
	token, err := s.repo.VerifyToken(c, hash)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't verify email token", err)
	}

	return token, nil
}
