package oauth

import (
	"net/http"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/security"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"google.golang.org/api/idtoken"
)

type OAuthHandler struct {
	oauth OAuthAccountService
	jwt   jwt.JWTService
	cfg   config.Config
}

func NewOAuthHandler(s OAuthAccountService, j jwt.JWTService, c config.Config) *OAuthHandler {
	return &OAuthHandler{
		oauth: s,
		jwt:   j,
		cfg:   c,
	}
}

func (h *OAuthHandler) GoogleLogin(c *gin.Context) {
	state, err := generateState()
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInternal, "state generation failed", err))
		return
	}
	url := h.cfg.GoogleLogin.AuthCodeURL(state)

	security.SetOAuthStateCookie(c, state, h.cfg)

	c.Redirect(http.StatusSeeOther, url)
}

func (h *OAuthHandler) GoogleCallback(c *gin.Context) {
	state := c.Query("state")
	if state == "" {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "missing oauth state", nil))
		return
	}

	cookie, err := c.Cookie("oauth_state")
	if err != nil || cookie != state {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid oauth state", err))
		return
	}

	security.RemoveAuthStateCookie(c, h.cfg)

	code := c.Query("code")
	if code == "" {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "missing oauth code", nil))
		return
	}

	token, err := h.cfg.GoogleLogin.Exchange(c.Request.Context(), code)
	if err != nil {
		httpx.ErrorFrom(c, mapOAuthExchangeError(err))
		return
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidToken, "missing id token", nil))
		return
	}
	payload, err := idtoken.Validate(c.Request.Context(), rawIDToken, h.cfg.GoogleLogin.ClientID)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidToken, "invalid id token", err))
		return
	}

	account, err := h.oauth.CreateAccount(c.Request.Context(), payload)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	accessToken, err := h.jwt.GenerateAccessToken(account.UserID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}
	refreshToken, err := h.jwt.GenerateRefreshToken(c.Request.Context(), account.UserID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	security.SetRefreshTokenCookie(c, refreshToken, h.cfg)

	httpx.OK(c, gin.H{
		"message":      "login successful",
		"access_token": accessToken,
	})
}
