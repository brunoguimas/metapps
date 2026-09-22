package oauth

import (
	"net/http"
	"net/url"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/logger"
	"github.com/brunoguimas/metapps/backend/internal/platform/security"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
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
	url := h.cfg.GoogleLogin.AuthCodeURL(state, oauth2.SetAuthURLParam("prompt", "select_account"))

	security.SetOAuthStateCookie(c, state, h.cfg)

	c.Redirect(http.StatusSeeOther, url)
}

func (h *OAuthHandler) GoogleCallback(c *gin.Context) {
	state := c.Query("state")
	if state == "" {
		h.redirectWithError(c, apperrors.ErrInvalidInput, nil)
		return
	}

	cookie, err := c.Cookie("oauth_state")
	if err != nil || cookie != state {
		h.redirectWithError(c, apperrors.ErrInvalidInput, err)
		return
	}

	security.RemoveAuthStateCookie(c, h.cfg)

	code := c.Query("code")
	if code == "" {
		h.redirectWithError(c, apperrors.ErrInvalidInput, nil)
		return
	}

	token, err := h.cfg.GoogleLogin.Exchange(c.Request.Context(), code)
	if err != nil {
		h.redirectWithError(c, exchangeErrorCode(err), err)
		return
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		h.redirectWithError(c, apperrors.ErrInvalidToken, nil)
		return
	}
	payload, err := idtoken.Validate(c.Request.Context(), rawIDToken, h.cfg.GoogleLogin.ClientID)
	if err != nil {
		h.redirectWithError(c, apperrors.ErrInvalidToken, err)
		return
	}

	account, err := h.oauth.CreateAccount(c.Request.Context(), payload)
	if err != nil {
		h.redirectWithError(c, errorCode(err), err)
		return
	}

	accessToken, err := h.jwt.GenerateAccessToken(account.UserID)
	if err != nil {
		h.redirectWithError(c, errorCode(err), err)
		return
	}
	refreshToken, err := h.jwt.GenerateRefreshToken(c.Request.Context(), account.UserID)
	if err != nil {
		h.redirectWithError(c, errorCode(err), err)
		return
	}

	security.SetRefreshTokenCookie(c, refreshToken, h.cfg)

	h.redirectWithToken(c, accessToken)
}

func (h *OAuthHandler) redirectWithToken(c *gin.Context, token string) {
	q := h.frontendCallbackQuery()
	q.Set("token", token)
	h.redirect(c, q)
}

func (h *OAuthHandler) redirectWithError(c *gin.Context, code apperrors.Code, err error) {
	status := apperrors.StatusFromCode(code)
	if err == nil {
		logger.LogResponse(c, string(code), status)
	} else if logFn := logger.SeverityForStatus(status); logFn != nil {
		logFn(c, apperrors.NewAppError(code, string(code), err), string(code), status)
	} else {
		logger.LogResponse(c, string(code), status)
	}
	q := h.frontendCallbackQuery()
	q.Set("error", string(code))
	h.redirect(c, q)
}

func (h *OAuthHandler) frontendCallbackQuery() url.Values {
	if u, err := url.Parse(h.cfg.FrontendOrigin + "/auth/google/callback"); err == nil {
		return u.Query()
	}
	return url.Values{}
}

func (h *OAuthHandler) redirect(c *gin.Context, q url.Values) {
	target, err := url.Parse(h.cfg.FrontendOrigin + "/auth/google/callback")
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInternal, "invalid frontend origin", err))
		return
	}
	target.RawQuery = q.Encode()
	c.Redirect(http.StatusTemporaryRedirect, target.String())
}

func errorCode(err error) apperrors.Code {
	if appErr, ok := apperrors.As(err); ok {
		return appErr.Code()
	}
	return apperrors.ErrInternal
}