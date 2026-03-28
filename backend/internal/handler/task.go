package handler

import (
	"net/http"

	"github.com/brunoguimas/metapps/backend/internal/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"github.com/brunoguimas/metapps/backend/internal/handler/httpx"
	"github.com/brunoguimas/metapps/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TaskHandler struct {
	tasks service.TaskService
	goals service.GoalService
	cfg   *config.Config
}

func NewTaskHandler(s service.TaskService, g service.GoalService, c *config.Config) *TaskHandler {
	return &TaskHandler{
		tasks: s,
		goals: g,
		cfg:   c,
	}
}

type generateRequest struct {
	GoalID uuid.UUID `json:"goal_id" binding:"required"`
}

func (h *TaskHandler) Generate(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req generateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	task, err := h.tasks.Create(c.Request.Context(), userID, req.GoalID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "task generated",
		"task":    task,
	})
}

func (h *TaskHandler) List(c *gin.Context) {
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

	c.JSON(http.StatusOK, gin.H{
		"tasks": tasks,
	})
}

func (h *TaskHandler) Get(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid id")
		return
	}

	task, err := h.tasks.GetByID(c.Request.Context(), userID, goalID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task": task,
	})
}
