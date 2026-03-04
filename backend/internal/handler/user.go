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

	token, err := h.jwtService.GenerateToken(uint(user.ID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token":   token,
	})
}
