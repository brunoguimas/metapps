package topic

import (
	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TopicHandler struct {
	goals  goal.GoalService
	topics TopicService
}

func NewTopicHandler(t TopicService, g goal.GoalService) *TopicHandler {
	return &TopicHandler{
		goals:  g,
		topics: t,
	}
}

type roadmapRequest struct {
	GoalID string `json:"goal_id" binding:"required"`
}

func (h *TopicHandler) GenerateRoadmap(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var request roadmapRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	goalID, err := uuid.Parse(request.GoalID)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid goal id", err))
		return
	}

	goal, err := h.goals.Get(c.Request.Context(), userID, goalID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	roadmap, err := h.topics.GenerateRoadmap(c.Request.Context(), goal)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{
		"message": "roadmap created with success",
		"roadmap": roadmap,
	})
}

func (h *TopicHandler) GetRoadmap(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	goalID, err := uuid.Parse(c.Param("goalID"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid goal id", err))
		return
	}

	// Verify the goal belongs to the user
	_, err = h.goals.Get(c.Request.Context(), userID, goalID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	roadmap, err := h.topics.GetRoadmap(c.Request.Context(), goalID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"roadmap": roadmap,
	})
}
