package handler

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"

	"github.com/brunoguimas/metapps/backend/config"
	"github.com/brunoguimas/metapps/backend/internal/auth"
	apperrors "github.com/brunoguimas/metapps/backend/internal/errors"
	"github.com/brunoguimas/metapps/backend/internal/handler/httpx"
	"github.com/brunoguimas/metapps/backend/internal/security"
	"github.com/brunoguimas/metapps/backend/internal/service"
	"github.com/brunoguimas/metapps/backend/internal/service/dto"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"google.golang.org/api/idtoken"
)

const (
	oauthState     = "oauth_state"
	googleProvider = "google"
)

type UserHandler struct {
	service      service.UserService
	emailService service.EmailService
	oauthService service.OAuthAccountService
	jwtService   auth.JWTService
	config       config.Config
}

func (h *UserHandler) setRefreshCookie(c *gin.Context, refreshToken string) {
	c.SetCookie(
		"refresh_token",
		refreshToken,
		int(h.jwtService.GetRefreshTokenTTL().Seconds()),
		h.config.CookiePath,
		h.config.CookieDomainRefresh,
		h.config.CookieSecure,
		true,
	)
}

func NewUserHandler(userService service.UserService, emailService service.EmailService, o service.OAuthAccountService, j auth.JWTService, c config.Config) *UserHandler {
	return &UserHandler{
		service:      userService,
		emailService: emailService,
		oauthService: o,
		jwtService:   j,
		config:       c,
	}
}

func (h *UserHandler) Register(c *gin.Context) {
	u, err := httpx.BindJSON[dto.RegisterRequest](c)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	user, err := h.service.CreateUser(c.Request.Context(), u)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}
	emailToken, err := h.emailService.CreateEmailToken(c.Request.Context(), user.ID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	err = h.emailService.SendEmail(c.Request.Context(), user.Email, emailToken)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "user registered with success", "user": gin.H{"id": user.ID, "email": user.Email}})
}

func (h *UserHandler) Login(c *gin.Context) {
	u, err := httpx.BindJSON[dto.LoginRequest](c)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	user, err := h.service.Login(c.Request.Context(), u)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}
	if !user.Verified {
		httpx.Error(c, http.StatusUnauthorized, "email not verified")
		return
	}

	accessToken, err := h.jwtService.GenerateAccessToken(uint(user.ID))
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}
	refreshToken, err := h.jwtService.GenerateRefreshToken(c.Request.Context(), uint(user.ID))
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	h.setRefreshCookie(c, refreshToken)

	httpx.OK(c, gin.H{
		"message":      "login successful",
		"access_token": accessToken,
	})
}

func (h *UserHandler) Refresh(c *gin.Context) {
	token, err := c.Cookie("refresh_token")
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidToken, "refresh token not found", err))
		return
	}

	jti, err := h.jwtService.ValidateRefreshToken(c.Request.Context(), token)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	t, err := h.jwtService.GetById(c, jti)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	accessToken, err := h.jwtService.GenerateAccessToken(uint(t.UserID))
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(c.Request.Context(), t.UserID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	err = h.jwtService.RevokeRefreshToken(c.Request.Context(), jti)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	h.setRefreshCookie(c, refreshToken)

	httpx.OK(c, gin.H{
		"message":      "token refreshed",
		"access_token": accessToken,
	})

}

func (h *UserHandler) GoogleLogin(c *gin.Context) {
	state, err := generateState()
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInternal, "state generation failed", err))
		return
	}
	url := h.config.GoogleLogin.AuthCodeURL(state)

	c.SetCookie(
		oauthState,
		state,
		300,
		h.config.CookiePath,
		h.config.CookieDomainOAuthState,
		h.config.CookieSecure,
		true,
	)

	c.Redirect(http.StatusSeeOther, url)
}

func (h *UserHandler) GoogleCallback(c *gin.Context) {
	state := c.Query("state")
	if state == "" {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "missing oauth state", nil))
		return
	}

	cookie, err := c.Cookie(oauthState)
	if err != nil || cookie != state {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid oauth state", err))
		return
	}

	c.SetCookie(
		oauthState,
		"",
		-1,
		h.config.CookiePath,
		h.config.CookieDomainOAuthState,
		h.config.CookieSecure,
		true,
	)

	code := c.Query("code")
	if code == "" {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "missing oauth code", nil))
		return
	}

	token, err := h.config.GoogleLogin.Exchange(c.Request.Context(), code)
	if err != nil {
		httpx.ErrorFrom(c, mapOAuthExchangeError(err))
		return
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidToken, "missing id token", nil))
		return
	}
	payload, err := idtoken.Validate(c.Request.Context(), rawIDToken, h.config.GoogleLogin.ClientID)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidToken, "invalid id token", err))
		return
	}

	account, err := h.oauthService.CreateAccount(c.Request.Context(), payload)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	accessToken, err := h.jwtService.GenerateAccessToken(uint(account.UserID))
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}
	refreshToken, err := h.jwtService.GenerateRefreshToken(c.Request.Context(), uint(account.UserID))
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	h.setRefreshCookie(c, refreshToken)

	httpx.OK(c, gin.H{
		"message":      "login successful",
		"access_token": accessToken,
	})
}

func (h *UserHandler) EmailVerify(c *gin.Context) {
	t := c.Query("token")

	tokenHash := security.HashToken(t)

	token, err := h.emailService.VerifyToken(c.Request.Context(), tokenHash)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	err = h.service.VerifyUser(c.Request.Context(), token.UserID)
}

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
