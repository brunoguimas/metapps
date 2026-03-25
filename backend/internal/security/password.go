package security

import (
	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword(
		[]byte(password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return "", apperrors.NewAppError(apperrors.ErrInternal, "couldn't hash password", err)
	}
	return string(bytes), nil
}

func CheckPassword(password string, hash string) error {
	return bcrypt.CompareHashAndPassword(
		[]byte(hash),
		[]byte(password),
	)
}
