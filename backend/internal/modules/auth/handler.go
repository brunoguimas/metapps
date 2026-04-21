package auth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/brunoguimas/metapps/backend/internal/modules/auth/dto"
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/modules/mail"
	"github.com/brunoguimas/metapps/backend/internal/modules/user"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/security"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
)

type AuthHandler struct {
	auth   AuthService
	users  user.UserService
	jwt    jwt.JWTService
	emails mail.EmailService
	cfg    config.Config
}

func NewAuthHandler(a AuthService, u user.UserService, j jwt.JWTService, e mail.EmailService, c config.Config) *AuthHandler {
	return &AuthHandler{
		auth:   a,
		users:  u,
		jwt:    j,
		emails: e,
		cfg:    c,
	}
}

func (h *AuthHandler) Register(c *gin.Context) {
	u, err := httpx.BindJSON[dto.RegisterRequest](c)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	err = security.ValidatePassword(u.Password)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	user, err := h.auth.Register(c.Request.Context(), u)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}
	emailToken, err := h.emails.CreateEmailToken(c.Request.Context(), user.ID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	err = h.emails.SendEmail(c.Request.Context(), user.Email, emailToken)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "user registered with success", "user": gin.H{"id": user.ID, "email": user.Email}})
}

func (h *AuthHandler) Login(c *gin.Context) {
	u, err := httpx.BindJSON[dto.LoginRequest](c)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	user, err := h.auth.Login(c.Request.Context(), u)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}
	if !user.Verified && h.cfg.RequireEmailVerification {
		_, err := h.emails.GetToken(c.Request.Context(), user.ID)
		if err != nil {
			if appErr, _ := apperrors.As(err); appErr.Code() == apperrors.ErrInvalidOrExpiredEmailToken {
				c.Redirect(http.StatusFound, "/email-verified")
				return
			}
			httpx.ErrorFrom(c, err)
			return
		}
		httpx.Error(c, http.StatusUnauthorized, "email not verified")
		return
	}

	accessToken, err := h.jwt.GenerateAccessToken(user.ID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}
	refreshToken, err := h.jwt.GenerateRefreshToken(c.Request.Context(), user.ID)
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

func (h *AuthHandler) Refresh(c *gin.Context) {
	token, err := c.Cookie("refresh_token")
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidToken, "refresh token not found", err))
		return
	}

	jti, err := h.jwt.ValidateRefreshToken(c.Request.Context(), token)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	t, err := h.jwt.GetById(c, jti)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	accessToken, err := h.jwt.GenerateAccessToken(t.UserID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	refreshToken, err := h.jwt.GenerateRefreshToken(c.Request.Context(), t.UserID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	err = h.jwt.RevokeRefreshToken(c.Request.Context(), jti)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	security.SetRefreshTokenCookie(c, refreshToken, h.cfg)

	httpx.OK(c, gin.H{
		"message":      "token refreshed",
		"access_token": accessToken,
	})

}

func (h *AuthHandler) EmailVerify(c *gin.Context) {
	t := c.Query("token")

	tokenHash := security.HashToken(t)

	token, err := h.emails.VerifyToken(c.Request.Context(), tokenHash)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	err = h.users.VerifyUser(c.Request.Context(), token.UserID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"message": "email verified with success"})
}

type emailResendRequest struct {
	Email string `json:"email" binding:"required"`
}

func (h *AuthHandler) ResendEmailVerification(c *gin.Context) {
	var req emailResendRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	user, err := h.users.GetUserByEmail(c, req.Email)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	if user.Verified {
		httpx.OK(c, gin.H{"message": "if account exists a email will be sent"})
		return
	}

	emailToken, err := h.emails.CreateEmailToken(c.Request.Context(), user.ID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	err = h.emails.SendEmail(c.Request.Context(), user.Email, emailToken)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"message": "if account exists a email will be sent"})
}

func (h *AuthHandler) Me(c *gin.Context) {
	t := c.GetHeader("Authorization")

	parts := strings.SplitN(t, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" || parts[1] == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid authorization header"})
		return
	}

	claims, err := h.jwt.ValidateAccessToken(parts[1])
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			c.AbortWithStatusJSON(appErr.Status(), gin.H{
				"error": appErr.Error(),
				"code":  appErr.Code(),
			})
			return
		}
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
		return
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "couldn't parse user id")
		return
	}
	u, err := h.users.GetUserByID(c, userID)
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "user not found")
		return
	}

	httpx.OK(c, gin.H{
		"user": struct {
			ID        uuid.UUID `json:"id"`
			Email     string    `json:"email"`
			CreatedAt time.Time `json:"created_at"`
		}{
			u.ID,
			u.Email,
			u.CreatedAt,
		},
	})
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
