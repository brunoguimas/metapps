package profile

import (
	"time"

	"github.com/google/uuid"
)

type Profile struct {
	ID               uuid.UUID `json:"id"`
	UserID           uuid.UUID `json:"user_id"`
	XP               int       `json:"xp"`
	Streak           int       `json:"streak"`
	LastActivityDate time.Time `json:"last_activity_date"`
	AvatarURL        string    `json:"avatar_url"`
	DailyGoalXP      int       `json:"daily_goal_xp"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// Level derives the user's level from their XP.
// Each level requires 100 XP. Level = floor(XP / 100) + 1.
func LevelFromXP(xp int) int {
	return xp/100 + 1
}

// Level returns the current level for the profile.
func (p *Profile) Level() int {
	return LevelFromXP(p.XP)
}

// StreakAtivo indica se o usuario ja estudou hoje.
//
// A streak e a contagem de dias consecutivos com atividade. Quando o
// usuario pula um dia, o valor guardado no banco so e zerado na proxima
// atividade; por isso a leitura tambem precisa verificar a data, senao a
// home mostra uma streak quebrada como se ainda valesse.
func (p *Profile) StreakAtivo(now time.Time) bool {
	today := truncateDay(now)
	last := truncateDay(p.LastActivityDate)
	return !last.Before(today)
}

// StreakExibida devolve a streak que deve ser exibida na home.
//
// Se a ultima atividade foi ante de ontem, a streak foi quebrada: o
// valor exibido e 0, mesmo antes de o usuario voltar a estudar.
func (p *Profile) StreakExibida(now time.Time) int {
	if p.LastActivityDate.IsZero() {
		return 0
	}

	today := truncateDay(now)
	last := truncateDay(p.LastActivityDate)

	if last.Before(today.AddDate(0, 0, -1)) {
		return 0
	}

	return p.Streak
}

func truncateDay(t time.Time) time.Time {
	u := t.UTC()
	return time.Date(u.Year(), u.Month(), u.Day(), 0, 0, 0, 0, time.UTC)
}
