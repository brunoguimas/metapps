package repository

import (
	"context"
	"database/sql"

	"github.com/brunoguimas/metapps/backend/internal/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/errors"
	"github.com/brunoguimas/metapps/backend/internal/models"
)

type OAuthAccountRepository interface {
	CreateAccount(c context.Context, s *models.OAuthAccount) (*models.OAuthAccount, error)
	GetAccountByProviderID(c context.Context, provider, providerUserID string) (*models.OAuthAccount, error)
}

type oauthAccountRepository struct {
	queries *db.Queries
}

func NewOAuthAccountRepository(q *db.Queries) OAuthAccountRepository {
	return &oauthAccountRepository{
		queries: q,
	}
}

func (r *oauthAccountRepository) CreateAccount(c context.Context, a *models.OAuthAccount) (*models.OAuthAccount, error) {
	account, err := r.queries.CreateOAuthAccount(c, db.CreateOAuthAccountParams{
		a.UserID,
		a.Provider,
		a.ProviderUserID,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create user", err)
	}

	return &models.OAuthAccount{
		ID:             account.ID,
		UserID:         account.UserID,
		Provider:       account.Provider,
		ProviderUserID: account.ProviderUserID,
		CreatedAt:      account.CreatedAt,
	}, nil
}

func (r *oauthAccountRepository) GetAccountByProviderID(c context.Context, provider, providerUserID string) (*models.OAuthAccount, error) {
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

	return &models.OAuthAccount{
		ID:             account.ID,
		UserID:         account.UserID,
		Provider:       account.Provider,
		ProviderUserID: account.ProviderUserID,
		CreatedAt:      account.CreatedAt,
	}, nil
}
