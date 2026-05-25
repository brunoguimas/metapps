package goal

import (
	"time"

	"github.com/google/uuid"
)

type Goal struct {
	ID        uuid.UUID    `json:"id"`
	UserID    uuid.UUID    `json:"user_id"`
	Title     string       `json:"title"`
	Settings  GoalSettings `json:"settings"`
	CreatedAt time.Time    `json:"created_at"`
}

type GoalSettings struct {
	Motivation      string          `json:"motivation"`
	SuccessCriteria string          `json:"success_criteria"`
	Baseline        string          `json:"baseline"`
	Time            TimeConstraints `json:"time_constraints"`
	LearningStyle   string          `json:"learning_style"`
	Priority        string          `json:"priority"`
}

type TimeConstraints struct {
	DailyMinutes   *int           `json:"daily_minutes"`
	WeeklyMinutes  *int           `json:"weekly_minutes"`
	SessionsPerDay *int           `json:"sessions_per_day"`
	Extra          map[string]any `json:"extra"`
}
