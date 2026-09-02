package task_correction

import (
	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service Service
	jwt     jwt.Service
}

func NewHandler(s Service, jwt jwt.Service) *Handler {
	return &Handler{
		service: s,
		jwt:     jwt,
	}
}

func (h *Handler) CreateCorrection(c *gin.Context) {
	ctx := c.Request.Context()
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var input struct {
		AttemptID string   `json:"attempt_id" binding:"required,uuid"`
		Feedback  string   `json:"feedback" binding:"required"`
		Score     *float64 `json:"score,omitempty"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	attemptID, err := uuid.Parse(input.AttemptID)
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid attempt ID", err))
		return
	}

	correction, err := h.service.CreateCorrection(ctx, userID, attemptID, input.Feedback, input.Score)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{
		"correction": correction,
	})
}

func (h *Handler) GetCorrectionByAttemptID(c *gin.Context) {
	ctx := c.Request.Context()
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	attemptID, err := uuid.Parse(c.Param("attemptID"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid attempt ID", err))
		return
	}

	correction, err := h.service.GetCorrectionByAttemptID(ctx, userID, attemptID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"correction": correction,
	})
}

func (h *Handler) GenerateEssayCorrection(c *gin.Context) {
	ctx := c.Request.Context()
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	attemptID, err := uuid.Parse(c.Param("attemptID"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid attempt ID", err))
		return
	}

	correction, err := h.service.GenerateEssayCorrection(ctx, userID, attemptID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{
		"correction": correction,
	})
}

func (h *Handler) GenerateQuizCorrection(c *gin.Context) {
	ctx := c.Request.Context()
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	attemptID, err := uuid.Parse(c.Param("attemptID"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid attempt ID", err))
		return
	}

	correction, err := h.service.GenerateQuizCorrection(ctx, userID, attemptID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{
		"correction": correction,
	})
}
