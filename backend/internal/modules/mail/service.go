package mail

import (
	"context"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/security"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

const emailVerificationCodeType = "email_verification"
const passwordResetCodeType = "password_reset"

type EmailService interface {
	CreateEmailCode(c context.Context, userID uuid.UUID) (string, error)
	VerifyEmailCode(c context.Context, userID uuid.UUID, code string) error
	CreatePasswordResetCode(c context.Context, userID uuid.UUID) (string, error)
	VerifyPasswordResetCode(c context.Context, userID uuid.UUID, code string) error
	SendVerificationCode(c context.Context, userEmail, username, code string) error
	SendPasswordResetCode(c context.Context, userEmail, username, code string) error
}

type emailService struct {
	repo   EmailRepository
	config *config.Config
	mailer *Mailer
}

func NewEmailService(r EmailRepository, c *config.Config, m *Mailer) EmailService {
	return &emailService{
		repo:   r,
		config: c,
		mailer: m,
	}
}

func (s *emailService) CreateEmailCode(c context.Context, userID uuid.UUID) (string, error) {
	return s.createCode(c, userID, emailVerificationCodeType)
}

func (s *emailService) VerifyEmailCode(c context.Context, userID uuid.UUID, code string) error {
	return s.verifyCode(c, userID, emailVerificationCodeType, code)
}

func (s *emailService) CreatePasswordResetCode(c context.Context, userID uuid.UUID) (string, error) {
	return s.createCode(c, userID, passwordResetCodeType)
}

func (s *emailService) VerifyPasswordResetCode(c context.Context, userID uuid.UUID, code string) error {
	return s.verifyCode(c, userID, passwordResetCodeType, code)
}

func (s *emailService) createCode(c context.Context, userID uuid.UUID, codeType string) (string, error) {
	code, err := security.GenerateOTP()
	if err != nil {
		return "", apperrors.NewAppError(apperrors.ErrInternal, "couldn't generate email code", err)
	}

	err = s.repo.UpsertEmailCode(c, &EmailCode{
		UserID:      userID,
		Type:        codeType,
		CodeHash:    security.HashValue(code),
		Attempts:    0,
		MaxAttempts: 0,
		ExpiresAt:   time.Now().Add(s.config.EmailVerificationTTL),
	})
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return "", appErr
		}
		return "", apperrors.NewAppError(apperrors.ErrInternal, "couldn't create email code", err)
	}

	return code, nil
}

func (s *emailService) verifyCode(c context.Context, userID uuid.UUID, codeType, code string) error {
	emailCode, err := s.repo.GetEmailCode(c, userID, codeType)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return appErr
		}
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't get email code", err)
	}

	if time.Now().After(emailCode.ExpiresAt) {
		_ = s.repo.DeleteEmailCode(c, userID, codeType)
		return apperrors.NewAppError(apperrors.ErrInvalidOrExpiredEmailCode, "invalid or expired code", nil)
	}

	if emailCode.CodeHash != security.HashValue(code) {
		return apperrors.NewAppError(apperrors.ErrInvalidOrExpiredEmailCode, "invalid or expired code", nil)
	}

	if err := s.repo.DeleteEmailCode(c, userID, codeType); err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return appErr
		}
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't delete email code", err)
	}

	return nil
}

func (s *emailService) SendVerificationCode(c context.Context, userEmail, username, code string) error {
	if err := s.mailer.SendVerifyEmail(userEmail, username, code); err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't send email", err)
	}

	return nil
}

func (s *emailService) SendPasswordResetCode(c context.Context, userEmail, username, code string) error {
	if err := s.mailer.SendPasswordResetEmail(userEmail, username, code); err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't send email", err)
	}

	return nil
}
