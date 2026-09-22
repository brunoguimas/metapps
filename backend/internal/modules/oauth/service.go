package oauth

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"google.golang.org/api/idtoken"
)

type OAuthAccountService interface {
	CreateAccount(c context.Context, p *idtoken.Payload) (*OAuthAccount, error)
}

type oauthAccountService struct {
	accountRepo    OAuthAccountRepository
	userRepo       user.UserRepository
	profileService profile.ProfileService
}

func NewOAuthService(accountRepo OAuthAccountRepository, userRepo user.UserRepository, profileService profile.ProfileService) OAuthAccountService {
	return &oauthAccountService{
		accountRepo:    accountRepo,
		userRepo:       userRepo,
		profileService: profileService,
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

	name, _ := p.Claims["name"].(string)
	u, err := s.findOrCreateUser(c, email, name)
	if err != nil {
		return nil, err
	}

	if err := s.ensureProfile(c, u.ID); err != nil {
		return nil, err
	}

	created, err := s.accountRepo.CreateAccount(c, &OAuthAccount{
		UserID:         u.ID,
		Provider:       "google",
		ProviderUserID: p.Subject,
	})
	if err != nil {
		if existing, getErr := s.accountRepo.GetAccountByProviderID(c, "google", p.Subject); getErr == nil && existing != nil {
			return existing, nil
		}
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create oauth account", err)
	}
	return created, nil
}

func (s *oauthAccountService) findOrCreateUser(c context.Context, email, name string) (*user.User, error) {
	u, err := s.userRepo.GetByEmail(c, email)
	if err == nil {
		if !u.Verified {
			if err := s.userRepo.VerifyUser(c, u.ID); err != nil {
				if appErr, ok := apperrors.As(err); ok {
					return nil, appErr
				}
				return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't verify user", err)
			}
		}
		return u, nil
	}

	appErr, ok := apperrors.As(err)
	if !ok || appErr.Code() != apperrors.ErrUserNotFound {
		return nil, err
	}

	u, err = s.userRepo.Create(c, &user.User{
		Username: name,
		Email:    email,
		Verified: true,
	})
	if err != nil {
		if appErr, ok := apperrors.As(err); ok && appErr.Code() == apperrors.ErrEmailAlreadyInUse {
			if existing, getErr := s.userRepo.GetByEmail(c, email); getErr == nil {
				return existing, nil
			}
			return nil, appErr
		}
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create user", err)
	}
	return u, nil
}

func (s *oauthAccountService) ensureProfile(c context.Context, userID uuid.UUID) error {
	prof, err := s.profileService.GetProfileByUserID(c, userID)
	if err != nil {
		appErr, ok := apperrors.As(err)
		if !ok || appErr.Code() != apperrors.ErrProfileNotFound {
			return err
		}
	} else if prof != nil {
		return nil
	}

	if _, err := s.profileService.CreateProfile(c, userID); err != nil {
		if appErr, ok := apperrors.As(err); ok && appErr.Code() == apperrors.ErrProfileAlreadyExists {
			return nil
		}
		return err
	}
	return nil
}