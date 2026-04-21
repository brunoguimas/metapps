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
	TaskQuiz  TaskType = "quiz"
	TaskEssay TaskType = "essay"
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
	GoalID    uuid.UUID       `json:"goal_id"`
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

type EssayContent struct {
	Materials    []Material `json:"material"`
	Instructions string     `json:"instructions"`
	MinWords     int        `json:"min_words"`
	MaxWords     int        `json:"max_words"`
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

func (e EssayContent) Validate() error {
	if e.MinWords <= 0 || e.MaxWords <= 0 {
		return fmt.Errorf("invalid word limits")
	}
	if e.MinWords > e.MaxWords {
		return fmt.Errorf("min_words cannot be greater than max_words")
	}
	if e.Instructions == "" {
		return fmt.Errorf("instructions cannot be empty")
	}
	return nil
}

func (q QuizQuestion) Validate() error {
	if len(q.Alternatives) < 2 {
		return apperrors.NewAppError(apperrors.ErrQuestionTooShort, fmt.Sprint("question too short: expected at least 3 alternatives but received ", len(q.Alternatives)), nil)
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
	case TaskEssay:
		var c EssayContent
		err := json.Unmarshal(t.Content, &c)
		return c, err

	case TaskQuiz:
		var c QuizContent
		err := json.Unmarshal(t.Content, &c)
		return c, err

	default:
		return nil, apperrors.NewAppError(apperrors.ErrUnknownTaskType, fmt.Sprint("unknown task type: ", t.Type), nil)
	}
}
