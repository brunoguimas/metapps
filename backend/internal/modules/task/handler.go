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
	// Refresh descarta a sessao em andamento do topico e gera outra.
	Refresh bool `json:"refresh"`
}

// Generate devolve a lesson de um topico.
//
// Se ja existe uma sessao em andamento para o topico, ela e devolvida sem
// chamar a IA: retomar uma aula nao pode custar 30 segundos de espera.
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

	task, err := h.tasks.Create(c.Request.Context(), userID, req.TopicID, req.Refresh)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{
		"message": "task generated",
		"task":    task,
	})
}

// List devolve as sessoes do usuario, opcionalmente filtradas por topico.
func (h *Handler) List(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	topicIDParam := c.Query("topic_id")
	if topicIDParam != "" {
		topicID, err := uuid.Parse(topicIDParam)
		if err != nil {
			httpx.Error(c, http.StatusBadRequest, "invalid topic_id")
			return
		}

		tasks, err := h.tasks.ListByTopic(c.Request.Context(), userID, topicID)
		if err != nil {
			httpx.ErrorFrom(c, err)
			return
		}

		httpx.OK(c, gin.H{
			"tasks": tasks,
		})
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

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid id")
		return
	}

	task, err := h.tasks.GetByID(c.Request.Context(), userID, taskID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"task": task,
	})
}

type practiceRequest struct {
	TopicID *uuid.UUID `json:"topic_id"`
	Count   int        `json:"count"`
}

// Practice monta uma sessao de Treino.
//
// Nao chama a IA: reaproveita os exercicios que o usuario ja errou e os
// que estao vencidos na fila de revisao.
func (h *Handler) Practice(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req practiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	task, err := h.tasks.CreatePractice(c.Request.Context(), userID, req.TopicID, req.Count)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{
		"message": "practice session ready",
		"task":    task,
	})
}

// Retry monta uma sessao apenas com os exercicios errados da sessao
// informada.
func (h *Handler) Retry(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid id")
		return
	}

	task, err := h.tasks.CreateRetry(c.Request.Context(), userID, taskID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{
		"message": "retry session ready",
		"task":    task,
	})
}

type reviewRequest struct {
	Count int `json:"count"`
}

// Review monta uma sessao de Revisao com os exercicios vencidos.
func (h *Handler) Review(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req reviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	task, err := h.tasks.CreateReview(c.Request.Context(), userID, req.Count)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{
		"message": "review session ready",
		"task":    task,
	})
}
