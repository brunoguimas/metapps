package daily_activity

import (
	"time"

	"github.com/brunoguimas/metapps/backend/internal/httpx"
	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/review"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	daily   Service
	profile profile.Service
	reviews review.Service
}

func NewHandler(d Service, p profile.Service, r review.Service) *Handler {
	return &Handler{daily: d, profile: p, reviews: r}
}

// Today devolve o resumo do dia: XP, meta, streak e o que ha para revisar.
//
// E o que alimenta a home "Hoje": o anel da meta diaria, a chama da
// streak e os atalhos de Treino e Revisao.
func (h *Handler) Today(c *gin.Context) {
	userID, err := httpx.GetFromContext(c, "user_id")
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	activity, err := h.daily.Today(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	userProfile, err := h.profile.GetProfileByUserID(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	now := time.Now().UTC()
	today := Today()
	weekStart := today.AddDate(0, 0, -6)

	weekActivities, err := h.daily.Range(c.Request.Context(), userID, weekStart, today)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	byDay := make(map[string]*DailyActivity, len(weekActivities))
	for _, item := range weekActivities {
		byDay[item.Day().Format("2006-01-02")] = item
	}

	week := make([]gin.H, 0, 7)
	for i := 0; i < 7; i++ {
		day := weekStart.AddDate(0, 0, i)
		key := day.Format("2006-01-02")
		item, ok := byDay[key]
		if !ok {
			week = append(week, gin.H{
				"date":      key,
				"xp":        0,
				"exercises": 0,
				"lessons":   0,
			})
			continue
		}
		week = append(week, gin.H{
			"date":      key,
			"xp":        item.XP,
			"exercises": item.Exercises,
			"lessons":   item.Lessons,
		})
	}

	reviewDue, err := h.reviews.CountDue(c.Request.Context(), userID)
	if err != nil {
		httpx.ErrorFrom(c, err)
		return
	}

	httpx.OK(c, gin.H{
		"daily": gin.H{
			"date":              today.Format("2006-01-02"),
			"xp":                activity.XP,
			"goal_xp":           userProfile.DailyGoalXP,
			"goal_reached":      activity.XP >= userProfile.DailyGoalXP,
			"exercises":         activity.Exercises,
			"lessons":           activity.Lessons,
			"seconds":           activity.Seconds,
			"streak":            userProfile.StreakExibida(now),
			"streak_active_today": userProfile.StreakAtivo(now),
			"level":             userProfile.Level(),
			"total_xp":          userProfile.XP,
			"review_due":        reviewDue,
			"week":              week,
		},
	})
}
