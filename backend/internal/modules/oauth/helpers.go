package oauth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"golang.org/x/oauth2"
)

func mapOAuthExchangeError(err error) error {
	var retrieveErr *oauth2.RetrieveError
	if errors.As(err, &retrieveErr) {
		if retrieveErr.Response != nil && retrieveErr.Response.StatusCode >= 400 && retrieveErr.Response.StatusCode < 500 {
			return apperrors.NewAppError(apperrors.ErrInvalidToken, "invalid oauth code", err)
		}
	}

	return apperrors.NewAppError(apperrors.ErrInternal, "oauth exchange failed", err)
}

func generateState() (string, error) {
	b := make([]byte, 32)

	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}

	return base64.URLEncoding.EncodeToString(b), nil
}
