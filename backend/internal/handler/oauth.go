package handler

import (
	"net/http"

	"github.com/brunoguimas/metapps/backend/config"
	"github.com/brunoguimas/metapps/backend/internal/auth"
	apperrors "github.com/brunoguimas/metapps/backend/internal/errors"
	"github.com/brunoguimas/metapps/backend/internal/handler/httpx"
	"github.com/brunoguimas/metapps/backend/internal/service"
	"github.com/gin-gonic/gin"
	"google.golang.org/api/idtoken"
)

type OAuthHandler struct {
	oauth service.OAuthAccountService
	jwt   auth.JWTService
	cfg   config.Config
}

func NewOAuthHandler(s service.OAuthAccountService, j auth.JWTService, c config.Config) *OAuthHandler {
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

	SetOAuthStateCookie(c, state, h.cfg)

	c.Redirect(http.StatusSeeOther, url)
}

func (h *OAuthHandler) GoogleCallback(c *gin.Context) {
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

	RemoveAuthStateCookie(c, h.cfg)

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

	accessToken, err := h.jwt.GenerateAccessToken(uint(account.UserID))
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}
	refreshToken, err := h.jwt.GenerateRefreshToken(c.Request.Context(), uint(account.UserID))
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	SetRefreshTokenCookie(c, refreshToken, h.cfg)

	httpx.OK(c, gin.H{
		"message":      "login successful",
		"access_token": accessToken,
	})
}
