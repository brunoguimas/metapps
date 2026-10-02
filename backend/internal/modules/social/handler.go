package social

import (
	"github.com/brunoguimas/metapps/backend/internal/httpx"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc Service
}

func NewHandler(s Service) *Handler {
	return &Handler{svc: s}
}

// List responde GET /protected/social/friends
func (h *Handler) List(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	friends, err := h.svc.ListFriends(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"friends": friends})
}

// Summary responde GET /protected/social/summary — só a contagem, para o
// perfil mostrar "N amigos" sem baixar a lista inteira.
func (h *Handler) Summary(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	summary, err := h.svc.Summary(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"summary": summary})
}

// Search responde GET /protected/social/search?q=
func (h *Handler) Search(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	candidates, err := h.svc.Search(c.Request.Context(), userID, c.Query("q"))
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"candidates": candidates})
}

// Add responde POST /protected/social/friends — body { "query": "..." }
func (h *Handler) Add(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	var req AddFriendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid payload", err))
		return
	}

	friend, err := h.svc.AddFriend(c.Request.Context(), userID, req.Query)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.Created(c, gin.H{"friend": friend})
}

// Remove responde DELETE /protected/social/friends/:friendID
func (h *Handler) Remove(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	friendID, err := uuid.Parse(c.Param("friendID"))
	if err != nil {
		httpx.ErrorFrom(c, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid friend id", err))
		return
	}

	if err := h.svc.RemoveFriend(c.Request.Context(), userID, friendID); err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"message": "amigo removido"})
}
