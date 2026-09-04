package task

import (
	"net/http"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	tasks Service
	cfg   *config.Config
}

func NewHandler(s Service, g goal.Service, c *config.Config) *Handler {
	return &Handler{
		tasks: s,
		cfg:   c,
	}
}

type generateRequest struct {
	TopicID uuid.UUID `json:"topic_id" binding:"required"`
}

func (h *Handler) Generate(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req generateRequest
	err = c.ShouldBindJSON(&req)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	task, err := h.tasks.Create(c.Request.Context(), userID, req.TopicID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{
		"message": "task generated",
		"task":    task,
	})
}

func (h *Handler) List(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	tasks, err := h.tasks.GetByUserID(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"tasks": tasks,
	})
}

func (h *Handler) Get(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	topicID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid id")
		return
	}

	task, err := h.tasks.GetByID(c.Request.Context(), userID, topicID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"task": task,
	})
}
