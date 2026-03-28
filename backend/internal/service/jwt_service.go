package service

import (
	"context"
	"errors"
	"time"

	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"github.com/brunoguimas/metapps/backend/internal/models"
	"github.com/brunoguimas/metapps/backend/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type JWTService interface {
	GenerateAccessToken(userID uuid.UUID) (string, error)
	GenerateRefreshToken(c context.Context, userID uuid.UUID) (string, error)
	ValidateAccessToken(tokenStr string) (*claims, error)
	ValidateRefreshToken(c context.Context, tokenStr string) (uuid.UUID, error)
	RevokeRefreshToken(c context.Context, tokenID uuid.UUID) error
	GetById(c context.Context, tokenID uuid.UUID) (*models.RefreshToken, error)
	GetRefreshTokenTTL() time.Duration
}

type jwtService struct {
	repo            repository.JWTRepository
	secretKey       string
	issuer          string
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
}

func NewJWTService(repo repository.JWTRepository, secretKey, issuer string, accessTokenTTL, refreshTokenTTL time.Duration) JWTService {
	return &jwtService{
		repo:            repo,
		secretKey:       secretKey,
		issuer:          issuer,
		accessTokenTTL:  accessTokenTTL,
		refreshTokenTTL: refreshTokenTTL,
	}
}

type claims struct {
	jwt.RegisteredClaims
}

func (s *jwtService) GenerateAccessToken(userID uuid.UUID) (string, error) {
	claims := &claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.issuer,
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.accessTokenTTL)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	return t.SignedString([]byte(s.secretKey))
}

func (s *jwtService) ValidateAccessToken(tokenStr string) (*claims, error) {
	claims := &claims{}

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

func (s *jwtService) GenerateRefreshToken(c context.Context, userID uuid.UUID) (string, error) {
	tokenTTL := time.Now().Add(s.refreshTokenTTL)

	tokenId, err := s.repo.CreateRefreshToken(c, userID, tokenTTL)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return "", appErr
		}
		return "", apperrors.NewAppError(apperrors.ErrInternal, "couldn't create refresh token", err)
	}

	claims := &claims{
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenId.String(),
			Issuer:    s.issuer,
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(tokenTTL),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	return t.SignedString([]byte(s.secretKey))
}

func (s *jwtService) ValidateRefreshToken(c context.Context, tokenStr string) (uuid.UUID, error) {
	claims := &claims{}

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
		if appErr, ok := apperrors.As(err); ok {
			return uuid.Nil, appErr
		}
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get refresh token", err)
	}
	if t.ExpiresAt.Before(time.Now()) || t.Revoked {
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "invalid token", errors.New("token expired or revoked"))
	}

	return jti, nil
}

func (s *jwtService) RevokeRefreshToken(c context.Context, tokenID uuid.UUID) error {
	if err := s.repo.RevokeRefreshToken(c, tokenID); err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return appErr
		}
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't revoke refresh token", err)
	}
	return nil
}

func (s *jwtService) GetById(c context.Context, tokenID uuid.UUID) (*models.RefreshToken, error) {
	t, err := s.repo.GetRefreshToken(c, tokenID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get refresh token", err)
	}
	return t, nil
}

func (s *jwtService) GetRefreshTokenTTL() time.Duration {
	return s.refreshTokenTTL
}
