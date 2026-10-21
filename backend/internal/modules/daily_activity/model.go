package daily_activity

import (
	"time"

	"github.com/google/uuid"
)

// DailyActivity e o resumo de um dia de estudo do usuario.
//
// Alimenta a meta diaria (anel de XP), o heatmap de atividade e o
// historico semanal exibido na home.
type DailyActivity struct {
	ID            uuid.UUID `json:"id"`
	UserID        uuid.UUID `json:"user_id"`
	ActivityDate  time.Time `json:"activity_date"`
	XP            int       `json:"xp"`
	Exercises     int       `json:"exercises"`
	Lessons       int       `json:"lessons"`
	Seconds       int       `json:"seconds"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Day devolve a data (sem hora) da atividade.
func (d *DailyActivity) Day() time.Time {
	return time.Date(d.ActivityDate.Year(), d.ActivityDate.Month(), d.ActivityDate.Day(), 0, 0, 0, 0, time.UTC)
}
