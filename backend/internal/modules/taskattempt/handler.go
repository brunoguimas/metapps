package taskattempt

import (
	"io"
	"net/http"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Submit(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	req, err := ParseCreateAttemptInput(rawBody)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	attempt, updatedTask, err := h.service.Submit(c.Request.Context(), userID, taskID, req)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "task attempt submitted",
		"task_attempt": attempt,
		"task":         updatedTask,
	})
}

func (h *Handler) ListByUser(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	attempts, err := h.service.ListByUser(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"task_attempts": attempts})
}

func (h *Handler) ListByTask(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	attempts, err := h.service.ListByUserAndTask(c.Request.Context(), userID, taskID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"task_attempts": attempts})
}
