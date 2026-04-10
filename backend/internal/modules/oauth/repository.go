package oauth

import (
	"context"
	"database/sql"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
)

type OAuthAccountRepository interface {
	CreateAccount(c context.Context, s *OAuthAccount) (*OAuthAccount, error)
	GetAccountByProviderID(c context.Context, provider, providerUserID string) (*OAuthAccount, error)
}

type oauthAccountRepository struct {
	queries *db.Queries
}

func NewOAuthAccountRepository(q *db.Queries) OAuthAccountRepository {
	return &oauthAccountRepository{
		queries: q,
	}
}

func (r *oauthAccountRepository) CreateAccount(c context.Context, a *OAuthAccount) (*OAuthAccount, error) {
	account, err := r.queries.CreateOAuthAccount(c, db.CreateOAuthAccountParams{
		a.UserID,
		a.Provider,
		a.ProviderUserID,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create user", err)
	}

	return mapOAuthAccount(account), nil
}

func (r *oauthAccountRepository) GetAccountByProviderID(c context.Context, provider, providerUserID string) (*OAuthAccount, error) {
	account, err := r.queries.GetOAuthAccountByProviderID(c, db.GetOAuthAccountByProviderIDParams{
		Provider:       provider,
		ProviderUserID: providerUserID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get oauth account", err)
	}

	return mapOAuthAccount(account), nil
}

func mapOAuthAccount(a db.OauthAccount) *OAuthAccount {
	return &OAuthAccount{
		ID:             a.ID,
		UserID:         a.UserID,
		Provider:       a.Provider,
		ProviderUserID: a.ProviderUserID,
		CreatedAt:      a.CreatedAt,
	}
}
