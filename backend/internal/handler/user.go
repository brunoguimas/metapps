package handler

import (
	"net/http"

	"github.com/brunoguimas/metapps/backend/internal/auth"
	"github.com/brunoguimas/metapps/backend/internal/service"
	"github.com/brunoguimas/metapps/backend/internal/service/dto"
	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	service    service.UserService
	jwtService auth.JWTService
}

func NewUserHandler(s service.UserService, j auth.JWTService) *UserHandler {
	return &UserHandler{
		service:    s,
		jwtService: j,
	}
}

func (h *UserHandler) Register(c *gin.Context) {
	var u dto.RegisterRequest
	if err := c.ShouldBindJSON(&u); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.service.CreateUser(c.Request.Context(), &u)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "User registered with success", "user": gin.H{"id": user.ID, "email": user.Email}})
}

func (h *UserHandler) Login(c *gin.Context) {
	var u dto.LoginRequest
	if err := c.ShouldBindJSON(&u); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.service.Login(c.Request.Context(), &u)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	accessToken, err := h.jwtService.GenerateAccessToken(uint(user.ID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	refreshToken, err := h.jwtService.GenerateRefreshToken(c.Request.Context(), uint(user.ID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// TODO: criar função que facilite isso
	c.SetCookie(
		"refresh_token",
		refreshToken,
		int(h.jwtService.GetRefreshTokenTTL().Seconds()),
		"/auth/refresh",
		"localhost",
		false,
		true,
	)

	c.JSON(http.StatusOK, gin.H{
		"message":      "Login successful",
		"access_token": accessToken,
	})
}

// TODO: fazer essa função parar de fazer olhos sangrarem
func (h *UserHandler) Refresh(c *gin.Context) {
	token, err := c.Cookie("refresh_token")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	jti, err := h.jwtService.ValidateRefreshToken(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid refresh token"})
		return
	}

	t, err := h.jwtService.GetRefreshToken(c, jti)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid refresh token"})
		return
	}

	accessToken, err := h.jwtService.GenerateAccessToken(uint(t.UserID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	err = h.jwtService.RevokeRefreshToken(c.Request.Context(), jti)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(c.Request.Context(), t.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.SetCookie(
		"refresh_token",
		refreshToken,
		int(h.jwtService.GetRefreshTokenTTL().Seconds()),
		"/auth/refresh",
		"localhost",
		false,
		true,
	)

	c.JSON(http.StatusOK, gin.H{
		"message":      "Login successful",
		"access_token": accessToken,
	})

}
