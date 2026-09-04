package goal

import (
	"encoding/json"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	goals Service
}

func NewHandler(s Service) *Handler {
	return &Handler{goals: s}
}

type Request struct {
	Title       string       `json:"title" binding:"required"`
	Settings    GoalSettings `json:"settings"`
	hasSettings bool
}

func (r *Request) UnmarshalJSON(data []byte) error {
	type payload struct {
		Title        string        `json:"title"`
		Settings     *GoalSettings `json:"settings"`
		GoalSettings *GoalSettings `json:"goal_settings"`
	}

	var p payload
	if err := json.Unmarshal(data, &p); err != nil {
		return err
	}

	r.Title = p.Title
	switch {
	case p.Settings != nil:
		r.Settings = *p.Settings
		r.hasSettings = true
	case p.GoalSettings != nil:
		r.Settings = *p.GoalSettings
		r.hasSettings = true
	default:
		r.Settings = GoalSettings{}
		r.hasSettings = false
	}

	return nil
}

func (h *Handler) Create(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req Request
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}
	if !req.hasSettings {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "settings is required", nil))
		return
	}

	goal, err := h.goals.Create(c.Request.Context(), userID, &req)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{"goal": goal})
}

func (h *Handler) List(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
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

func (h *Handler) Get(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
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

func (h *Handler) Update(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid goal id", err))
		return
	}

	var req Request
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}
	if !req.hasSettings {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "settings is required", nil))
		return
	}

	if err := h.goals.Update(c.Request.Context(), userID, goalID, &req); err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"message": "goal updated"})
}

func (h *Handler) Delete(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
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
