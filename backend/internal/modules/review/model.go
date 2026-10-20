package review

import (
	"time"

	"github.com/google/uuid"
)

// ReviewItem e um exercicio que o usuario errou (ou que ainda precisa ser
// revisitado) e a data em que ele volta a aparecer.
//
// O agendamento e um SM-2 simplificado: intervalo cresce em 1 -> 3 -> 7
// -> 21 dias e reinicia quando o usuario erra de novo.
type ReviewItem struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	TaskID       uuid.UUID `json:"task_id"`
	StepIndex    int       `json:"step_index"`
	QuestionHash string    `json:"question_hash"`
	Ease         float64   `json:"ease"`
	IntervalDays int       `json:"interval_days"`
	Lapses       int       `json:"lapses"`
	DueAt        time.Time `json:"due_at"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

const (
	// Intervalo minimo (em dias) entre duas revisoes do mesmo exercicio.
	MinIntervalDays = 1
	// Intervalo maximo: depois disso o exercicio ja esta bem consolidado.
	MaxIntervalDays = 180
	// Ease inicial de um item novo.
	DefaultEase = 2.5
)
