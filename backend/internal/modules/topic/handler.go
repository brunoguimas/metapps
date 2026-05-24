package topic

import (
	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TopicHandler struct {
	goals goal.GoalService
	topics TopicService
}

func NewTopicHandler(t TopicService, g goal.GoalService) *TopicHandler {
	return &TopicHandler{
		goals: g,
		topics: t,
	}
}

type roadmapRequest struct {
	GoalID string `json:"goal_id"`
}
func (h *TopicHandler) GenerateRoadmap (c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var request roadmapRequest
	err = c.BindJSON(&request)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	goalID, _ := uuid.Parse(request.GoalID)
	goal, err := h.goals.Get(c.Request.Context(), userID, goalID)
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
