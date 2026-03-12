package handler

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"

	"github.com/brunoguimas/metapps/backend/config"
	"github.com/brunoguimas/metapps/backend/internal/auth"
	"github.com/brunoguimas/metapps/backend/internal/handler/httpx"
	"github.com/brunoguimas/metapps/backend/internal/service"
	"github.com/brunoguimas/metapps/backend/internal/service/dto"
	"github.com/gin-gonic/gin"
	"google.golang.org/api/idtoken"
)

const (
	oauthState     = "oauth_state"
	googleProvider = "google"
)

type UserHandler struct {
	service      service.UserService
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

func NewUserHandler(s service.UserService, o service.OAuthAccountService, j auth.JWTService, c config.Config) *UserHandler {
	return &UserHandler{
		service:      s,
		oauthService: o,
		jwtService:   j,
		config:       c,
	}
}

func (h *UserHandler) Register(c *gin.Context) {
	u, err := httpx.BindJSON[dto.RegisterRequest](c)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid credentials")
		return
	}

	user, err := h.service.CreateUser(c.Request.Context(), u)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "couldn't create user")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "user registered with success", "user": gin.H{"id": user.ID, "email": user.Email}})
}

func (h *UserHandler) Login(c *gin.Context) {
	u, err := httpx.BindJSON[dto.LoginRequest](c)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid credentials")
		return
	}

	user, err := h.service.Login(c.Request.Context(), u)
	if err != nil {
		httpx.Error(c, http.StatusUnauthorized, "invalid email or password")
		return
	}

	accessToken, err := h.jwtService.GenerateAccessToken(uint(user.ID))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	refreshToken, err := h.jwtService.GenerateRefreshToken(c.Request.Context(), uint(user.ID))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
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
		httpx.Error(c, http.StatusBadRequest, "refresh token not found")
		return
	}

	jti, err := h.jwtService.ValidateRefreshToken(c.Request.Context(), token)
	if err != nil {
		httpx.Error(c, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	t, err := h.jwtService.GetById(c, jti)
	if err != nil {
		httpx.Error(c, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	accessToken, err := h.jwtService.GenerateAccessToken(uint(t.UserID))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(c.Request.Context(), t.UserID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	err = h.jwtService.RevokeRefreshToken(c.Request.Context(), jti)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
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
		httpx.Error(c, http.StatusInternalServerError, "state generation failed")
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

	cookie, err := c.Cookie(oauthState)
	if err != nil || cookie != state {
		httpx.Error(c, http.StatusBadRequest, "invalid oauth state")
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

	token, err := h.config.GoogleLogin.Exchange(c.Request.Context(), code)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "code-Token exchange failed")
		return
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		httpx.Error(c, http.StatusUnauthorized, "missing id token")
		return
	}
	payload, err := idtoken.Validate(c.Request.Context(), rawIDToken, h.config.GoogleLogin.ClientID)
	if err != nil {
		httpx.Error(c, http.StatusUnauthorized, "invalid id token")
		return
	}

	account, err := h.oauthService.CreateAccount(c.Request.Context(), payload)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	accessToken, err := h.jwtService.GenerateAccessToken(uint(account.UserID))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	refreshToken, err := h.jwtService.GenerateRefreshToken(c.Request.Context(), uint(account.UserID))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.setRefreshCookie(c, refreshToken)

	httpx.OK(c, gin.H{
		"message":      "login successful",
		"access_token": accessToken,
	})
}

func generateState() (string, error) {
	b := make([]byte, 32)

	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}

	return base64.URLEncoding.EncodeToString(b), nil
}
