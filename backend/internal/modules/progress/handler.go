package progress

import (
	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// summaryResponse monta a resposta. As porcentagens derivadas ficam
// achatadas no JSON para o front nao repetir a conta que o servidor ja
// fez.
func summaryResponse(s *Summary) gin.H {
	return gin.H{
		"xp":          s.XP,
		"level":       s.Level,
		"xp_in_level": s.XPInLevel,
		"xp_missing":  s.XPMissing,
		"level_pct":   s.LevelPct,
		"streak":      s.Streak,
		"goals": gin.H{
			"total": s.Goals.Total,
		},
		"tasks": gin.H{
			"total": s.Tasks.Total,
			"done":  s.Tasks.Done,
			"pct":   s.Tasks.Pct(),
		},
		"attempts": gin.H{
			"total":         s.Attempts.Total,
			"scored":        s.Attempts.Scored,
			"average_score": s.Attempts.AverageScore,
			"accuracy_pct":  s.Attempts.AccuracyScore(),
		},
		"topics": gin.H{
			"total":    s.Topics.Total,
			"mastered": s.Topics.Mastered,
			"pct":      s.Topics.MasteryPct(),
		},
		"flashcards": gin.H{
			"due": s.Flashcards.Due,
		},
	}
}

// GetSummary responde GET /protected/profile/progress.
//
// Rota somente leitura. Não existe POST aqui: o XP é creditado pelo
// servidor quando uma tarefa é corrigida, e aceitar o valor na requisição
// permitiria inflar o próprio XP com um curl.
func (h *Handler) GetSummary(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	summary, err := h.service.GetSummary(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{"progress": summaryResponse(summary)})
}
