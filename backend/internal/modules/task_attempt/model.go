package task_attempt

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/google/uuid"
)

type Status string

const (
	StatusProcessed Status = "processed"
)

type TaskAttempt struct {
	ID             uuid.UUID       `json:"id"`
	UserID         uuid.UUID       `json:"user_id"`
	TaskID         uuid.UUID       `json:"task_id"`
	Content        json.RawMessage `json:"content"`
	Score          *float64        `json:"score"`
	Status         Status          `json:"status"`
	TaskEvaluation json.RawMessage `json:"task_evaluation"`
	CreatedAt      time.Time       `json:"created_at"`
}

type CreateAttemptInput struct {
	Type     task.TaskType        `json:"type"`
	Response json.RawMessage      `json:"response"`
	Metadata *TaskAttemptMetadata `json:"metadata,omitempty"`
}

type QuizAttemptResponseItem struct {
	QuestionIndex int             `json:"question_index"`
	Answer        json.RawMessage `json:"answer"`
}

type TaskAttemptMetadata struct {
	TimeSpentMs   *int   `json:"time_spent_ms,omitempty"`
	AttemptSource string `json:"attempt_source,omitempty"`
}

type QuizQuestionEvaluation struct {
	QuestionIndex   int             `json:"question_index"`
	CorrectAnswer   int             `json:"correct_answer"`
	SubmittedAnswer json.RawMessage `json:"submitted_answer"`
	Correct         bool            `json:"correct"`
	Explanation     string          `json:"explanation,omitempty"`
}

type QuizEvaluation struct {
	TotalQuestions int                      `json:"total_questions"`
	CorrectAnswers int                      `json:"correct_answers"`
	Items          []QuizQuestionEvaluation `json:"items"`
	ScoringMethod  string                   `json:"scoring_method"`
}

// StepResult e a resposta a correcao de um exercicio.
//
// O front usa esse retorno para o feedback instantaneo: verde/vermelho,
// explicacao, XP ganho e combo atual.
type StepResult struct {
	TaskID        uuid.UUID `json:"task_id"`
	StepIndex     int       `json:"step_index"`
	TotalSteps    int       `json:"total_steps"`
	Correct       bool      `json:"correct"`
	CorrectAnswer int       `json:"correct_answer"`
	Explanation   string    `json:"explanation"`
	Hint          string    `json:"hint,omitempty"`
	Skill         string    `json:"skill,omitempty"`
	XP            int       `json:"xp_awarded"`
	XPTotal       int       `json:"xp_total"`
	Combo         int       `json:"combo"`
	MaxCombo      int       `json:"max_combo"`
	NextStepIndex int       `json:"next_step_index"`
	Streak        int       `json:"streak"`
	DailyXP       int       `json:"daily_xp"`
	DailyGoal     int       `json:"daily_goal"`
}

// SessionResult e o resumo de uma sessao concluida.
type SessionResult struct {
	TaskID           uuid.UUID `json:"task_id"`
	TopicID          uuid.UUID `json:"topic_id"`
	Source           string    `json:"source"`
	Score            float64   `json:"score"`
	CorrectAnswers   int       `json:"correct_answers"`
	TotalQuestions   int       `json:"total_questions"`
	XP               int       `json:"xp_gained"`
	MaxCombo         int       `json:"max_combo"`
	Mastered         bool      `json:"mastered"`
	RequiredMastery  float64   `json:"required_mastery"`
	Perfect          bool      `json:"perfect"`
	Streak           int       `json:"streak"`
	DailyXP          int       `json:"daily_xp"`
	DailyGoal        int       `json:"daily_goal"`
	WrongSteps       []int     `json:"wrong_steps"`
	AttemptID        uuid.UUID `json:"attempt_id"`
}

func ParseCreateAttemptInput(raw []byte) (*CreateAttemptInput, error) {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("invalid json: %w", err)
	}

	for key := range envelope {
		if key != "type" && key != "response" && key != "metadata" {
			return nil, fmt.Errorf("unexpected field %q", key)
		}
	}

	typeRaw, ok := envelope["type"]
	if !ok {
		return nil, fmt.Errorf("field %q is required", "type")
	}

	responseRaw, ok := envelope["response"]
	if !ok {
		return nil, fmt.Errorf("field %q is required", "response")
	}

	var input CreateAttemptInput
	if err := json.Unmarshal(typeRaw, &input.Type); err != nil {
		return nil, fmt.Errorf("field %q must be a string", "type")
	}

	if input.Type != task.TaskQuiz {
		return nil, fmt.Errorf("field %q must be one of: quiz", "type")
	}

	input.Response = cloneRawMessage(responseRaw)

	if metadataRaw, ok := envelope["metadata"]; ok {
		metadata, err := parseMetadata(metadataRaw)
		if err != nil {
			return nil, err
		}
		input.Metadata = metadata
	}

	if err := input.Validate(); err != nil {
		return nil, err
	}

	return &input, nil
}

func (i *CreateAttemptInput) Validate() error {
	switch i.Type {
	case task.TaskQuiz:
		var rawItems []map[string]json.RawMessage
		if err := json.Unmarshal(i.Response, &rawItems); err != nil {
			return fmt.Errorf("field %q must be an array for quiz tasks", "response")
		}

		for idx, item := range rawItems {
			if _, ok := item["question_index"]; !ok {
				return fmt.Errorf("response[%d].%s is required", idx, "question_index")
			}
			if _, ok := item["answer"]; !ok {
				return fmt.Errorf("response[%d].%s is required", idx, "answer")
			}

			var questionIndex int
			if err := json.Unmarshal(item["question_index"], &questionIndex); err != nil {
				return fmt.Errorf("response[%d].%s must be an integer", idx, "question_index")
			}
			if questionIndex < 0 {
				return fmt.Errorf("response[%d].%s must be >= 0", idx, "question_index")
			}

			if !isValidQuizAnswer(item["answer"]) {
				return fmt.Errorf("response[%d].%s must be an integer or string", idx, "answer")
			}
		}
	default:
		return fmt.Errorf("unsupported task attempt type %q", i.Type)
	}

	if i.Metadata != nil {
		if i.Metadata.TimeSpentMs != nil && *i.Metadata.TimeSpentMs < 0 {
			return fmt.Errorf("metadata.%s must be >= 0", "time_spent_ms")
		}
		if i.Metadata.AttemptSource != "" &&
			i.Metadata.AttemptSource != "web" &&
			i.Metadata.AttemptSource != "mobile" &&
			i.Metadata.AttemptSource != "api" {
			return fmt.Errorf("metadata.%s must be one of: web, mobile, api", "attempt_source")
		}
	}

	return nil
}

func parseMetadata(raw json.RawMessage) (*TaskAttemptMetadata, error) {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("field %q must be an object", "metadata")
	}

	for key := range envelope {
		if key != "time_spent_ms" && key != "attempt_source" {
			return nil, fmt.Errorf("metadata contains unexpected field %q", key)
		}
	}

	metadata := &TaskAttemptMetadata{}
	if value, ok := envelope["time_spent_ms"]; ok {
		var timeSpent int
		if err := json.Unmarshal(value, &timeSpent); err != nil {
			return nil, fmt.Errorf("metadata.%s must be an integer", "time_spent_ms")
		}
		metadata.TimeSpentMs = &timeSpent
	}
	if value, ok := envelope["attempt_source"]; ok {
		var attemptSource string
		if err := json.Unmarshal(value, &attemptSource); err != nil {
			return nil, fmt.Errorf("metadata.%s must be a string", "attempt_source")
		}
		metadata.AttemptSource = attemptSource
	}

	return metadata, nil
}

func isValidQuizAnswer(raw json.RawMessage) bool {
	var answerInt int
	if err := json.Unmarshal(raw, &answerInt); err == nil {
		return true
	}

	var answerString string
	return json.Unmarshal(raw, &answerString) == nil
}
