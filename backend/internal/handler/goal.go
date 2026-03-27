package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"github.com/brunoguimas/metapps/backend/internal/handler/httpx"
	"github.com/brunoguimas/metapps/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type GoalHandler struct {
	goals service.GoalService
}

func NewGoalHandler(s service.GoalService) *GoalHandler {
	return &GoalHandler{goals: s}
}

type goalRequest struct {
	Title        string          `json:"title"`
	Difficulties json.RawMessage `json:"difficulties"`
}

func (h *GoalHandler) Create(c *gin.Context) {
	userID, err := userIDFromContext(c)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req goalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	goal, err := h.goals.Create(c.Request.Context(), userID, req.Title, req.Difficulties)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"goal": goal})
}

func (h *GoalHandler) List(c *gin.Context) {
	userID, err := userIDFromContext(c)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	goals, err := h.goals.List(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"goals": goals})
}

func (h *GoalHandler) Get(c *gin.Context) {
	userID, err := userIDFromContext(c)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid goal id", err))
		return
	}

	goal, err := h.goals.Get(c.Request.Context(), userID, goalID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"goal": goal})
}

func (h *GoalHandler) Update(c *gin.Context) {
	userID, err := userIDFromContext(c)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid goal id", err))
		return
	}

	var req goalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	if err := h.goals.Update(c.Request.Context(), userID, goalID, req.Title, req.Difficulties); err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"message": "goal updated"})
}

func (h *GoalHandler) Delete(c *gin.Context) {
	userID, err := userIDFromContext(c)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid goal id", err))
		return
	}

	if err := h.goals.Delete(c.Request.Context(), userID, goalID); err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"message": "goal deleted"})
}

func userIDFromContext(c *gin.Context) (uuid.UUID, error) {
	v, ok := c.Get("user_id")
	if !ok {
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "missing user id", errors.New("missing user id"))
	}

	s, ok := v.(string)
	if !ok {
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "invalid user id", errors.New("invalid user id"))
	}

	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInvalidToken, "invalid user id", err)
	}

	return id, nil
}
