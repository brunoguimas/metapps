package handler

import (
	"net/http"

	"github.com/brunoguimas/metapps/backend/config"
	"github.com/brunoguimas/metapps/backend/internal/auth"
	"github.com/brunoguimas/metapps/backend/internal/handler/httpx"
	"github.com/brunoguimas/metapps/backend/internal/service"
	"github.com/brunoguimas/metapps/backend/internal/service/dto"
	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	service    service.UserService
	jwtService auth.JWTService
	config     config.Config
}

func NewUserHandler(s service.UserService, j auth.JWTService) *UserHandler {
	return &UserHandler{
		service:    s,
		jwtService: j,
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

	c.JSON(http.StatusCreated, gin.H{"message": "User registered with success", "user": gin.H{"id": user.ID, "email": user.Email}})
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

	// 67
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

	c.SetCookie(
		"refresh_token",
		refreshToken,
		int(h.jwtService.GetRefreshTokenTTL().Seconds()),
		"/auth/refresh",
		"localhost",
		false,
		true,
	)

	httpx.OK(c, gin.H{
		"message":      "Login successfull",
		"access_token": accessToken,
	})

}
