package security

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
)

func GenerateEmailToken() (string, error) {
	b := make([]byte, 32)

	_, err := rand.Read(b)
	if err != nil {
		return "", apperrors.NewAppError(apperrors.ErrInternal, "couldn't generate email token", err)
	}

	return base64.URLEncoding.EncodeToString(b), nil
}

func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
