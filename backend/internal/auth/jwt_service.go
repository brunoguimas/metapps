package auth

import (
	"context"
	"errors"
	"strconv"
	"time"

	apperrors "github.com/brunoguimas/metapps/backend/internal/errors"
	"github.com/brunoguimas/metapps/backend/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type JWTService interface {
	GenerateAccessToken(userID uint) (string, error)
	GenerateRefreshToken(c context.Context, userID uint) (string, error)
	ValidateAccessToken(tokenStr string) (*Claims, error)
	ValidateRefreshToken(c context.Context, tokenStr string) (uuid.UUID, error)
	RevokeRefreshToken(c context.Context, tokenID uuid.UUID) error
	GetById(c context.Context, tokenID uuid.UUID) (*models.RefreshToken, error)
	GetRefreshTokenTTL() time.Duration
}

type jwtService struct {
	repo            JWTRepository
	secretKey       string
	issuer          string
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
}

func NewJWTService(repo JWTRepository, secretKey, issuer string, accessTokenTTL, refreshTokenTTL time.Duration) JWTService {
	return &jwtService{
		repo:            repo,
		secretKey:       secretKey,
		issuer:          issuer,
		accessTokenTTL:  accessTokenTTL,
		refreshTokenTTL: refreshTokenTTL,
	}
}

func (s *jwtService) GenerateAccessToken(userID uint) (string, error) {
	claims := &Claims{
		ID: strconv.FormatUint(uint64(userID), 10),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.issuer,
			Subject:   strconv.FormatUint(uint64(userID), 10),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.accessTokenTTL)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	return t.SignedString([]byte(s.secretKey))
}

func (s *jwtService) ValidateAccessToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(s.secretKey), nil
	})

	if err != nil || !token.Valid {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "invalid token", err)
	}

	return claims, nil
}

func (s *jwtService) GenerateRefreshToken(c context.Context, userID uint) (string, error) {
	tokenId := uuid.New()
	tokenTTL := time.Now().Add(s.refreshTokenTTL)

	claims := &Claims{
		ID: strconv.FormatUint(uint64(userID), 10),
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenId.String(),
			Issuer:    s.issuer,
			Subject:   strconv.FormatUint(uint64(userID), 10),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(tokenTTL),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	err := s.repo.CreateRefreshToken(c, tokenId, userID, tokenTTL)
	if err != nil {
		return "", err
	}

	return t.SignedString([]byte(s.secretKey))
}

func (s *jwtService) ValidateRefreshToken(c context.Context, tokenStr string) (uuid.UUID, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(s.secretKey), nil
	})

	if err != nil || !token.Valid {
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "invalid token", err)
	}

	jtiStr := claims.RegisteredClaims.ID
	jti, err := uuid.Parse(jtiStr)
	if err != nil {
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't parse jti", err)
	}

	t, err := s.repo.GetRefreshToken(c, jti)
	if err != nil {
		return uuid.Nil, err
	}
	if t.ExpiresAt.Before(time.Now()) || t.Revoked {
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "invalid token", errors.New("token expired or revoked"))
	}

	return jti, nil
}

func (s *jwtService) RevokeRefreshToken(c context.Context, tokenID uuid.UUID) error {
	return s.repo.RevokeRefreshToken(c, tokenID)
}

func (s *jwtService) GetById(c context.Context, tokenID uuid.UUID) (*models.RefreshToken, error) {
	return s.repo.GetRefreshToken(c, tokenID)
}

func (s *jwtService) GetRefreshTokenTTL() time.Duration {
	return s.refreshTokenTTL
}
