package security

import (
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
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

func CheckHashPassword(password string, hash string) error {
	return bcrypt.CompareHashAndPassword(
		[]byte(hash),
		[]byte(password),
	)
}

var commonPasswds = map[string]struct{}{
	"123456":   {},
	"password": {},
	"qwerty":   {},
	"admin":    {},
}

func ValidatePassword(p string) error {
	if len(p) < 8 {
		return apperrors.NewAppError(apperrors.ErrPasswordTooShort, "password too short", nil)
	}

	_, found := commonPasswds[p]
	if found {
		return apperrors.NewAppError(apperrors.ErrPasswordTooCommon, "password too common", nil)
	}

	return nil
}
