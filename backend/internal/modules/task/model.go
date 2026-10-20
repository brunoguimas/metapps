package task

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
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

// Source identifica a origem da sessao. Uma lesson vem da trilha (a IA
// gerou os exercicios), uma practice e uma review reaproveitam exercicios
// ja existentes sem chamar a IA.
type Source string

const (
	SourceLesson  Source = "lesson"
	SourcePractice Source = "practice"
	SourceReview  Source = "review"
)

// Status e o estado de execucao da sessao.
type Status string

const (
	StatusPending    Status = "pending"
	StatusInProgress Status = "in_progress"
	StatusCompleted  Status = "completed"
	StatusFailed     Status = "failed"
)

// Limites dos exercicios. São deliberadamente apertados: o objetivo e
// uma pergunta que leva 15-30 segundos, como no Duolingo.
const (
	MinSteps = 3
	MaxSteps = 5

	MinStatementLen = 8
	MaxStatementLen = 180

	MinAlternatives = 3
	MaxAlternatives = 4
	MaxAlternativeLen = 120

	MinExplanationLen = 5
	MaxExplanationLen = 400

	MaxHintLen = 200

	MaxSkillLen = 60
)

// StepKind identifica o formato do exercicio.
type StepKind string

const (
	StepMultipleChoice StepKind = "multiple_choice"
	StepTrueFalse      StepKind = "true_false"
)

type Task struct {
	ID          uuid.UUID       `json:"id"`
	Version     int             `json:"version"`
	UserID      uuid.UUID       `json:"user_id"`
	TopicID     uuid.UUID       `json:"topic_id"`
	Meta        TaskMeta        `json:"meta"`
	Content     json.RawMessage `json:"content"`
	Type        TaskType        `json:"type"`
	Source      Source          `json:"source"`
	Status      Status          `json:"status"`
	StepCursor  int             `json:"step_cursor"`
	MaxCombo    int             `json:"max_combo"`
	Score       *float64        `json:"score"`
	XPGained    int             `json:"xp_gained"`
	Done        bool            `json:"done"`
	DoneAt      *time.Time      `json:"done_at"`
	LastStepAt  *time.Time      `json:"last_step_at"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
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

// LessonContent e o conteudo v2: uma sequencia de exercicios curtos.
type LessonContent struct {
	Version int    `json:"version"`
	Steps   []Step `json:"steps"`
}

// Step e um exercicio individual da lesson.
type Step struct {
	Index        int        `json:"index"`
	Kind         StepKind   `json:"kind,omitempty"`
	Statement    string     `json:"statement"`
	Skill        string     `json:"skill,omitempty"`
	Difficulty   int        `json:"difficulty,omitempty"`
	Materials    []Material `json:"material,omitempty"`
	Alternatives []string   `json:"alternatives"`
	Answer       int        `json:"answer"`
	Explanation  string     `json:"explanation"`
	Hint         string     `json:"hint,omitempty"`
}

// QuizContent e o formato legado (v1), kept para leitura de tasks
// antigas. A normalizacao para LessonContent acontece em Decode.
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

// Validate confere as restricoes do formato legado (v1), usado para ler
// tasks antigas. O caminho ativo usa LessonContent.Validate, que valida
// cada step ja normalizado.
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

// Validate confere os limites minimos de uma questao do formato legado.
func (q QuizQuestion) Validate() error {
	if len(q.Alternatives) < 2 {
		return apperrors.NewAppError(apperrors.ErrQuestionTooShort, fmt.Sprint("question too short: expected at least 2 alternatives but received ", len(q.Alternatives)), nil)
	}
	if q.Answer < 0 || q.Answer >= len(q.Alternatives) {
		return apperrors.NewAppError(apperrors.ErrInvalidAnswerIndex, fmt.Sprint(
			"invalid answer index: expected value between 0 and ", len(q.Alternatives)-1, " received ", q.Answer),
			nil)
	}
	return nil
}

// Decode devolve o conteudo normalizado da task.
//
// Tasks antigas (formato v1, com `questions`) sao convertidas na leitura
// para `steps`, de modo que o resto do sistema работа sempre com o
// formato novo sem depender de migration de dados.
func (t *Task) Decode() (*LessonContent, error) {
	switch t.Type {
	case TaskQuiz, TaskType("lesson"), TaskType("practice"), TaskType("review"):
	default:
		return nil, apperrors.NewAppError(apperrors.ErrUnknownTaskType, fmt.Sprint("unknown task type: ", t.Type), nil)
	}

	lesson, err := decodeLessonContent(t.Content)
	if err != nil {
		return nil, err
	}
	return lesson, nil
}

func decodeLessonContent(raw json.RawMessage) (*LessonContent, error) {
	if len(raw) == 0 {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "task has no content", nil)
	}

	// Formato novo: { "version": 2, "steps": [...] }
	var lesson LessonContent
	if err := json.Unmarshal(raw, &lesson); err == nil && len(lesson.Steps) > 0 {
		return &lesson, nil
	}

	// Formato legado: { "questions": [...] }
	var legacy QuizContent
	if err := json.Unmarshal(raw, &legacy); err == nil && len(legacy.Questions) > 0 {
		return legacyToLesson(legacy), nil
	}

	return nil, apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "task content has no exercises", nil)
}

// legacyToLesson converte o formato v1 (questions) para v2 (steps).
func legacyToLesson(legacy QuizContent) *LessonContent {
	steps := make([]Step, 0, len(legacy.Questions))
	for i, q := range legacy.Questions {
		steps = append(steps, Step{
			Index:        i,
			Kind:         StepMultipleChoice,
			Statement:    q.Statement,
			Materials:    q.Materials,
			Alternatives: q.Alternatives,
			Answer:       q.Answer,
			Explanation:  q.Explanation,
		})
	}
	return &LessonContent{Version: 2, Steps: steps}
}

// Normalize preenche os campos derivados e garante que os indices dos
// steps sejam sequenciais. Usado tanto na leitura quanto na criacao.
func (l *LessonContent) Normalize() {
	for i := range l.Steps {
		l.Steps[i].Index = i
		if l.Steps[i].Kind == "" {
			l.Steps[i].Kind = StepMultipleChoice
		}
		l.Steps[i].Statement = strings.TrimSpace(l.Steps[i].Statement)
		l.Steps[i].Explanation = strings.TrimSpace(l.Steps[i].Explanation)
		l.Steps[i].Hint = strings.TrimSpace(l.Steps[i].Hint)
		l.Steps[i].Skill = strings.TrimSpace(l.Steps[i].Skill)
	}
}

// Validate aplica os limites dos exercicios.
//
// A validacao fica no Go (e nao so no prompt) porque a IA erra: um
// enunciado de 400 caracteres ou uma lesson com 1 questao quebram a
// experiencia. O erro devolvido volta para a IA no retry, com o motivo
// exato.
func (l *LessonContent) Validate() error {
	return l.ValidateWithMinSteps(MinSteps)
}

// ValidateWithMinSteps valida os exercicios com um minimo customizado.
//
// Sessoes montadas a partir de material existente (Treino e Revisao) nao
// passam pela IA: elas podem ter 1 ou 2 exercicios e ainda assim fazem
// sentido. Ja as lessons geradas pela IA exigem pelo menos MinSteps.
func (l *LessonContent) ValidateWithMinSteps(minSteps int) error {
	if len(l.Steps) < minSteps {
		return apperrors.NewAppError(
			apperrors.ErrQuestionTooShort,
			fmt.Sprintf("lesson must have at least %d exercises but received %d", minSteps, len(l.Steps)),
			nil,
		)
	}
	if len(l.Steps) > MaxSteps {
		return apperrors.NewAppError(
			apperrors.ErrInvalidAIResponse,
			fmt.Sprintf("lesson must have at most %d exercises but received %d", MaxSteps, len(l.Steps)),
			nil,
		)
	}

	for i, step := range l.Steps {
		if err := step.Validate(); err != nil {
			return fmt.Errorf("step %d: %w", i, err)
		}
	}

	return nil
}

func (s Step) Validate() error {
	if len(s.Statement) < MinStatementLen {
		return apperrors.NewAppError(
			apperrors.ErrQuestionTooShort,
			fmt.Sprintf("statement too short: expected at least %d characters but received %d", MinStatementLen, len(s.Statement)),
			nil,
		)
	}
	if len(s.Statement) > MaxStatementLen {
		return apperrors.NewAppError(
			apperrors.ErrInvalidAIResponse,
			fmt.Sprintf("statement too long: expected at most %d characters but received %d", MaxStatementLen, len(s.Statement)),
			nil,
		)
	}

	if len(s.Alternatives) < MinAlternatives || len(s.Alternatives) > MaxAlternatives {
		return apperrors.NewAppError(
			apperrors.ErrQuestionTooShort,
			fmt.Sprintf("exercise must have between %d and %d alternatives but received %d", MinAlternatives, MaxAlternatives, len(s.Alternatives)),
			nil,
		)
	}

	seen := make(map[string]struct{}, len(s.Alternatives))
	for i, alt := range s.Alternatives {
		trimmed := strings.TrimSpace(alt)
		if trimmed == "" {
			return apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				fmt.Sprintf("alternative %d is empty", i),
				nil,
			)
		}
		if len(trimmed) > MaxAlternativeLen {
			return apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				fmt.Sprintf("alternative %d is too long: expected at most %d characters but received %d", i, MaxAlternativeLen, len(trimmed)),
				nil,
			)
		}
		key := strings.ToLower(trimmed)
		if _, exists := seen[key]; exists {
			return apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				fmt.Sprintf("alternative %d is duplicated", i),
				nil,
			)
		}
		seen[key] = struct{}{}
	}

	if s.Answer < 0 || s.Answer >= len(s.Alternatives) {
		return apperrors.NewAppError(
			apperrors.ErrInvalidAnswerIndex,
			fmt.Sprintf("invalid answer index: expected value between 0 and %d but received %d", len(s.Alternatives)-1, s.Answer),
			nil,
		)
	}

	if len(s.Explanation) < MinExplanationLen {
		return apperrors.NewAppError(
			apperrors.ErrQuestionTooShort,
			fmt.Sprintf("explanation too short: expected at least %d characters but received %d", MinExplanationLen, len(s.Explanation)),
			nil,
		)
	}
	if len(s.Explanation) > MaxExplanationLen {
		return apperrors.NewAppError(
			apperrors.ErrInvalidAIResponse,
			fmt.Sprintf("explanation too long: expected at most %d characters but received %d", MaxExplanationLen, len(s.Explanation)),
			nil,
		)
	}

	if len(s.Hint) > MaxHintLen {
		return apperrors.NewAppError(
			apperrors.ErrInvalidAIResponse,
			fmt.Sprintf("hint too long: expected at most %d characters but received %d", MaxHintLen, len(s.Hint)),
			nil,
		)
	}

	return nil
}

// QuestionHash identifica univocamente um exercicio, independentemente da
// task em que ele aparece. E a chave de deduplicacao da fila de revisao.
func (s Step) QuestionHash() string {
	parts := []string{strings.ToLower(strings.TrimSpace(s.Statement))}
	for _, alt := range s.Alternatives {
		parts = append(parts, strings.ToLower(strings.TrimSpace(alt)))
	}
	sum := sha1.Sum([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(sum[:])
}

// HashSteps devolve o hash de cada step de uma lesson.
func HashSteps(steps []Step) []string {
	hashes := make([]string, 0, len(steps))
	for _, step := range steps {
		hashes = append(hashes, step.QuestionHash())
	}
	return hashes
}
