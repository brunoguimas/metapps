package auth

import (
	"errors"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWTService interface {
	GenerateToken(id uint) (string, error)
	ValidateToken(token string) (*Claims, error)
}

type jwtService struct {
	secretKey string
	issuer    string
	tokenTTL  time.Duration
}

func NewJWTService(secretKey, issuer string, tokenTTL time.Duration) JWTService {
	return &jwtService{
		secretKey: secretKey,
		issuer:    issuer,
		tokenTTL:  tokenTTL,
	}
}

func (s *jwtService) GenerateToken(id uint) (string, error) {
	claims := &Claims{
		ID: strconv.FormatUint(uint64(id), 10),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.issuer,
			Subject:   strconv.FormatUint(uint64(id), 10),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.tokenTTL)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	return t.SignedString([]byte(s.secretKey))
}

func (s *jwtService) ValidateToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(s.secretKey), nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
