package handler

import (
	"net/http"

	"github.com/brunoguimas/metasapp/internal/service"
	"github.com/brunoguimas/metasapp/internal/service/dto"
	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	service *service.UserService
}

func NewUserHandler(s *service.UserService) *UserHandler {
	return &UserHandler{s}
}

func (h *UserHandler) Register(c *gin.Context) {
	var u dto.RegisterInput
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
	var u dto.LoginInput
	if err := c.ShouldBindJSON(&u); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ok, err := h.service.Login(c.Request.Context(), &u)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email or password"})
		return
	}

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Login successful"})
}
