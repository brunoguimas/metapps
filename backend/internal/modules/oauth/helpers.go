package oauth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"golang.org/x/oauth2"
)

func exchangeErrorCode(err error) apperrors.Code {
	var retrieveErr *oauth2.RetrieveError
	if errors.As(err, &retrieveErr) {
		if retrieveErr.Response != nil && retrieveErr.Response.StatusCode >= 400 && retrieveErr.Response.StatusCode < 500 {
			return apperrors.ErrInvalidToken
		}
	}

	return apperrors.ErrInternal
}

func generateState() (string, error) {
	b := make([]byte, 32)

	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(b), nil
}
