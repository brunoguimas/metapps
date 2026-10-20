package task_attempt

import (
	"encoding/json"
	"io"

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

// Submit grava a tentativa inteira de uma vez (rota legada).
//
// O fluxo novo responde um exercicio por vez (POST /:id/answer) e
// encerra a sessao (POST /:id/finish). Esta rota continua existindo para
// compatibilidade e delega para os mesmos servicos.
func (h *Handler) Submit(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	taskID, err := taskIDFromContext(c)
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

	httpx.Created(c, gin.H{
		"message":      "task attempt submitted",
		"task_attempt": attempt,
		"task":         updatedTask,
	})
}

type answerRequest struct {
	// StepIndex começa em 0, então não pode usar `required`: o validator
	// do gin trata o zero como ausente.
	StepIndex int             `json:"step_index" binding:"min=0"`
	Answer    json.RawMessage `json:"answer" binding:"required"`
}

// Answer corrige um unico exercicio e devolve o feedback instantaneo.
//
// Idempotente: responder o mesmo passo de novo devolve o mesmo resultado,
// sem conceder XP outra vez.
func (h *Handler) Answer(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	taskID, err := taskIDFromContext(c)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req answerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	result, err := h.service.AnswerStep(c.Request.Context(), userID, taskID, req.StepIndex, req.Answer)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"result": result,
	})
}

type finishRequest struct {
	Metadata *TaskAttemptMetadata `json:"metadata,omitempty"`
}

// Finish encerra a sessao e devolve o resumo final.
func (h *Handler) Finish(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	taskID, err := taskIDFromContext(c)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req finishRequest
	// O corpo e opcional: uma sessao pode ser encerrada sem metadados.
	if c.Request.Body != nil {
		if err := c.ShouldBindJSON(&req); err != nil && err != io.EOF {
			httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
			return
		}
	}

	result, err := h.service.Finish(c.Request.Context(), userID, taskID, req.Metadata)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"result": result,
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

	taskID, err := taskIDFromContext(c)
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

func taskIDFromContext(c *gin.Context) (uuid.UUID, error) {
	raw := c.Param("id")
	if raw == "" {
		raw = c.Param("taskID")
	}
	if raw == "" {
		raw = c.Param("taskid")
	}

	taskID, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid task id", err)
	}

	return taskID, nil
}
