package service

import (
	"context"

	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"github.com/brunoguimas/metapps/backend/internal/models"
	"github.com/brunoguimas/metapps/backend/internal/repository"
	"google.golang.org/api/idtoken"
)

type OAuthAccountService interface {
	CreateAccount(c context.Context, p *idtoken.Payload) (*models.OAuthAccount, error)
}

type oauthAccountService struct {
	accountRepo repository.OAuthAccountRepository
	userRepo    repository.UserRepository
}

func NewOAuthService(accountRepo repository.OAuthAccountRepository, userRepo repository.UserRepository) OAuthAccountService {
	return &oauthAccountService{
		accountRepo: accountRepo,
		userRepo:    userRepo,
	}
}
func (s *oauthAccountService) CreateAccount(c context.Context, p *idtoken.Payload) (*models.OAuthAccount, error) {

	if p.Subject == "" {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "subject missing", nil)
	}

	email, ok := p.Claims["email"].(string)
	if !ok || email == "" {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "email missing", nil)
	}

	emailVerified, ok := p.Claims["email_verified"].(bool)
	if !ok || !emailVerified {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "email not verified", nil)
	}

	name, _ := p.Claims["name"].(string)
	account, err := s.accountRepo.GetAccountByProviderID(c, "google", p.Subject)
	if err != nil {
		return nil, err
	}
	if account != nil {
		return account, nil
	}

	user, err := s.userRepo.GetByEmail(c, email)
	if err != nil {
		if appErr, ok := apperrors.As(err); !ok || appErr.Code() != apperrors.ErrUserNotFound {
			return nil, err
		}

		user = &models.User{
			Username: name,
			Email:    email,
		}

		user, err = s.userRepo.Create(c, user)
		if err != nil {
			return nil, err
		}
	}

	account = &models.OAuthAccount{
		UserID:         user.ID,
		Provider:       "google",
		ProviderUserID: p.Subject,
	}

	return s.accountRepo.CreateAccount(c, account)
}
