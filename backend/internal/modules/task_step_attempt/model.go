package task_step_attempt

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// TaskStepAttempt e a resposta do usuario a um passo de uma sessao.
//
// A tabela tem UNIQUE (task_id, step_index): e isso que garante a
// idempotencia da correcao (repetir o POST nao devolve XP duas vezes).
type TaskStepAttempt struct {
	ID         uuid.UUID       `json:"id"`
	UserID     uuid.UUID       `json:"user_id"`
	TaskID     uuid.UUID       `json:"task_id"`
	StepIndex  int             `json:"step_index"`
	Answer     json.RawMessage `json:"answer"`
	Correct    bool            `json:"correct"`
	XP         int             `json:"xp_awarded"`
	AnsweredAt time.Time       `json:"answered_at"`
}
