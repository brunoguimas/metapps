package flashcard

import (
	"net/http"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	cards Service
}

func NewHandler(s Service) *Handler {
	return &Handler{cards: s}
}

type generateRequest struct {
	TopicID uuid.UUID `json:"topic_id" binding:"required"`
}

type createManualRequest struct {
	TopicID uuid.UUID `json:"topic_id" binding:"required"`
	Front   string    `json:"front" binding:"required"`
	Back    string    `json:"back" binding:"required"`
}

func (h *Handler) Generate(c *gin.Context) {
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

	cards, err := h.cards.Generate(c.Request.Context(), userID, req.TopicID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{
		"message":    "flashcards generated",
		"flashcards": cards,
	})
}

func (h *Handler) Create(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req createManualRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	card, err := h.cards.Create(c.Request.Context(), userID, &CreateManualInput{
		TopicID: req.TopicID,
		Front:   req.Front,
		Back:    req.Back,
	})
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{
		"flashcard": card,
	})
}

func (h *Handler) ListByTopic(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	topicID, err := uuid.Parse(c.Query("topic_id"))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid topic_id")
		return
	}

	cards, err := h.cards.ListByTopic(c.Request.Context(), userID, topicID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"flashcards": cards,
	})
}

func (h *Handler) ListDue(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	cards, err := h.cards.ListDue(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"flashcards": cards,
	})
}

func (h *Handler) ListReview(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	cards, err := h.cards.ListReview(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"flashcards": cards,
	})
}

type reviewRequest struct {
	Quality int `json:"quality" binding:"required"`
}

func (h *Handler) Review(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid id")
		return
	}

	var req reviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	card, err := h.cards.Review(c.Request.Context(), userID, id, &ReviewInput{Quality: req.Quality})
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"flashcard": card,
	})
}

func (h *Handler) Delete(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid id")
		return
	}

	if err := h.cards.Delete(c.Request.Context(), userID, id); err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"message": "flashcard deleted",
	})
}
