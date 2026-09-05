package task

import (
	"encoding/json"
	"fmt"
	"time"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type TaskType string

const (
	TaskQuiz TaskType = "quiz"
)

type MaterialType string

const (
	Image MaterialType = "image"
	Text  MaterialType = "text"
)

type Task struct {
	ID        uuid.UUID       `json:"id"`
	Version   int             `json:"version"`
	UserID    uuid.UUID       `json:"user_id"`
	TopicID   uuid.UUID       `json:"topic_id"`
	Meta      TaskMeta        `json:"meta"`
	Content   json.RawMessage `json:"content"`
	Type      TaskType        `json:"type"`
	Done      bool            `json:"done"`
	DoneAt    *time.Time      `json:"done_at"`
	CreatedAt time.Time       `json:"created_at"`
}

type TaskMeta struct {
	Title        string `json:"title"`
	Description  string `json:"description"`
	Expectations string `json:"expectations"`
}

type persistedTaskContent struct {
	Meta    TaskMeta        `json:"meta"`
	Content json.RawMessage `json:"content"`
}

type QuizContent struct {
	Questions []QuizQuestion `json:"questions"`
}

type QuizQuestion struct {
	Statement    string     `json:"statement"`
	Materials    []Material `json:"material"`
	Alternatives []string   `json:"alternatives"`
	Answer       int        `json:"answer"`
	Explanation  string     `json:"explanation"`
}

func (q *QuizQuestion) UnmarshalJSON(data []byte) error {
	type Alias QuizQuestion
	aux := &struct {
		Materials json.RawMessage `json:"material"`
		*Alias
	}{
		Alias: (*Alias)(q),
	}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}

	if len(aux.Materials) == 0 {
		return nil
	}

	// Accept either []Material or a bare string (single text material).
	var materials []Material
	if err := json.Unmarshal(aux.Materials, &materials); err == nil {
		q.Materials = materials
		return nil
	}

	var text string
	if err := json.Unmarshal(aux.Materials, &text); err == nil {
		if text != "" {
			q.Materials = []Material{{Type: Text, Data: text}}
		}
		return nil
	}

	return fmt.Errorf("material field has unsupported shape: %s", string(aux.Materials))
}

type Material struct {
	Type MaterialType `json:"type"`
	Data string       `json:"data"`
}

func (q QuizContent) Validate() error {
	if len(q.Questions) == 0 {
		return apperrors.NewAppError(
			apperrors.ErrQuestionTooShort,
			"quiz must have at least one question",
			nil,
		)
	}

	for i, question := range q.Questions {
		if err := question.Validate(); err != nil {
			return fmt.Errorf("question %d: %w", i, err)
		}
	}

	return nil
}

func (q QuizQuestion) Validate() error {
	if len(q.Alternatives) < 2 {
		return apperrors.NewAppError(apperrors.ErrQuestionTooShort, fmt.Sprint("question too short: expected at least 2 alternatives but received ", len(q.Alternatives)), nil)
	}
	if q.Answer < 0 || q.Answer >= len(q.Alternatives) {
		return apperrors.NewAppError(apperrors.ErrInvalidAnswerIndex, fmt.Sprint(
			"invalid answer index: expected value between 0 and ", len(q.Alternatives), " received ", q.Answer),
			nil)
	}
	return nil
}

func (t *Task) Decode() (any, error) {
	switch t.Type {
	case TaskQuiz:
		var c QuizContent
		err := json.Unmarshal(t.Content, &c)
		return c, err

	default:
		return nil, apperrors.NewAppError(apperrors.ErrUnknownTaskType, fmt.Sprint("unknown task type: ", t.Type), nil)
	}
}
