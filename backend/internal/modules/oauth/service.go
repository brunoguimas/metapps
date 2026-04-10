package oauth

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"google.golang.org/api/idtoken"
)

type OAuthAccountService interface {
	CreateAccount(c context.Context, p *idtoken.Payload) (*OAuthAccount, error)
}

type oauthAccountService struct {
	accountRepo OAuthAccountRepository
	userRepo    user.UserRepository
}

func NewOAuthService(accountRepo OAuthAccountRepository, userRepo user.UserRepository) OAuthAccountService {
	return &oauthAccountService{
		accountRepo: accountRepo,
		userRepo:    userRepo,
	}
}
func (s *oauthAccountService) CreateAccount(c context.Context, p *idtoken.Payload) (*OAuthAccount, error) {

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
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get oauth account", err)
	}
	if account != nil {
		return account, nil
	}

	u, err := s.userRepo.GetByEmail(c, email)
	if err != nil {
		if appErr, ok := apperrors.As(err); !ok || appErr.Code() != apperrors.ErrUserNotFound {
			if appErr, ok := apperrors.As(err); ok {
				return nil, appErr
			}
			return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user", err)
		}

		u = &user.User{
			Username: name,
			Email:    email,
		}

		u, err = s.userRepo.Create(c, u)
		if err != nil {
			if appErr, ok := apperrors.As(err); ok {
				return nil, appErr
			}
			return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create user", err)
		}
	}

	account = &OAuthAccount{
		UserID:         u.ID,
		Provider:       "google",
		ProviderUserID: p.Subject,
	}

	created, err := s.accountRepo.CreateAccount(c, account)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create oauth account", err)
	}
	return created, nil
}
