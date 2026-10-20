package task

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/review"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_step_attempt"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

// Limites das sessoes de pratica e revisao.
const (
	// MaxSessionSteps e quantos exercicios uma sessao de Treino/Revisao
	// pode ter. O minimo e 1: uma sessao com um unico exercicio ainda
	// vale a pena (e e exatamente o que acontece quando o usuario errou
	// um unico item).
	MaxSessionSteps = 20
)

type Service interface {
	// Create devolve a lesson de um topico.
	//
	// Se ja existe uma lesson em andamento para o topico, ela e devolvida
	// sem chamar a IA: retomar uma aula nao pode custar 30 segundos de
	// espera. Com `refresh`, uma nova lesson e gerada mesmo assim.
	Create(c context.Context, userID, topicID uuid.UUID, refresh bool) (*Task, error)
	GetByUserID(c context.Context, userID uuid.UUID) ([]*Task, error)
	GetByID(c context.Context, userID, taskID uuid.UUID) (*Task, error)
	ListByTopic(c context.Context, userID, topicID uuid.UUID) ([]*Task, error)

	// CreatePractice monta uma sessao de Treino reaproveitando exercicios
	// ja existentes, sem chamar a IA.
	CreatePractice(c context.Context, userID uuid.UUID, topicID *uuid.UUID, count int) (*Task, error)

	// CreateReview monta uma sessao de Revisao com os exercicios que ja
	// venceram o intervalo de repeticao espacada.
	CreateReview(c context.Context, userID uuid.UUID, count int) (*Task, error)

	// CreateRetry monta uma sessao apenas com os exercicios errados de
	// outra sessao.
	CreateRetry(c context.Context, userID, taskID uuid.UUID) (*Task, error)
}

type taskService struct {
	ai           ai.Client
	repo         Repository
	topics       topic.Service
	topicRepo    topic.Repository
	progressRepo topic.ProgressRepository
	deps         topic_dependency.Service
	goals        goal.Service
	steps        task_step_attempt.Service
	reviews      review.Service
	cfg          *config.Config
}

func NewService(
	a ai.Client,
	r Repository,
	t topic.Service,
	tr topic.Repository,
	pr topic.ProgressRepository,
	d topic_dependency.Service,
	g goal.Service,
	st task_step_attempt.Service,
	rv review.Service,
	c *config.Config,
) Service {
	return &taskService{
		ai:           a,
		repo:         r,
		topics:       t,
		topicRepo:    tr,
		progressRepo: pr,
		deps:         d,
		goals:        g,
		steps:        st,
		reviews:      rv,
		cfg:          c,
	}
}

func (s *taskService) computeDifficulties(p *topic.TopicProgress) string {
	if p.MasteryScore < 0.5 {
		return "Baixa maestria no tópico"
	} else if p.MasteryScore < 0.8 {
		return "Mediana maestria"
	} else {
		return "Alta maestria"
	}
}

func (s *taskService) computePerformanceSummary(p *topic.TopicProgress) string {
	return fmt.Sprintf("Tentativas: %d, Mestria: %.0f%%, Confiança: %.0f%%", p.AttemptsCount, p.MasteryScore*100, p.ConfidenceScore*100)
}

// Create devolve a lesson de um topico, gerando com a IA apenas quando
// nao existe uma sessao em andamento para reaproveitar.
func (s *taskService) Create(c context.Context, userID, topicID uuid.UUID, refresh bool) (*Task, error) {
	t, err := s.topics.Get(c, topicID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get topic", err)
	}

	// Retomar uma lesson em andamento: sem custo de IA e sem perder o
	// progresso ja feito.
	if !refresh {
		if existing, err := s.repo.GetByUserAndTopicAndStatus(c, userID, topicID, StatusInProgress); err == nil && existing != nil {
			return existing, nil
		}
		if existing, err := s.repo.GetByUserAndTopicAndStatus(c, userID, topicID, StatusPending); err == nil && existing != nil {
			return existing, nil
		}
	}

	goalID := t.GoalID
	allTopics, err := s.topicRepo.GetByGoalID(c, goalID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get topics by goal", err)
	}
	var children []*topic.Topic
	for _, topic := range allTopics {
		if topic.ParentTopicID.Valid && topic.ParentTopicID.UUID == t.ID {
			children = append(children, topic)
		}
	}
	if len(children) > 0 {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "cannot generate tasks for parent topics", nil)
	}

	// Check dependencies: all prerequisite topics must be mastered
	deps, err := s.deps.GetByTopicIDs(c, []uuid.UUID{t.ID})
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get topic dependencies", err)
	}
	for _, dep := range deps {
		progress, err := s.progressRepo.GetOrCreate(c, userID, dep.DependsOnTopicID)
		if err != nil {
			if appErr, ok := apperrors.As(err); ok {
				return nil, appErr
			}
			return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get topic progress", err)
		}
		if progress.Status != topic.TopicStatusMastered {
			return nil, apperrors.NewAppError(apperrors.ErrInvalidInput,
				fmt.Sprintf("prerequisite topic %s not mastered", dep.DependsOnTopicID), nil)
		}
	}

	goal, err := s.goals.Get(c, userID, t.GoalID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get goal", err)
	}

	progress, err := s.progressRepo.GetOrCreate(c, userID, t.ID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get topic progress", err)
	}

	lessonSchema, err := ai.FS.ReadFile("schemas/lesson.schema.json")
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't read lesson schema", err)
	}

	// Enunciados ja usados no topico: e o que torna a regra "nao repita"
	// verificavel em vez de so um pedido ao modelo.
	previousStatements, err := s.repo.ListStatementsByTopic(c, userID, topicID)
	if err != nil {
		previousStatements = nil
	}

	data := struct {
		TopicTitle            string
		TopicDescription      string
		TopicRequiredMastery  float64
		TopicWeight           float64
		GoalTitle             string
		GoalMotivation        string
		GoalSuccessCriteria   string
		GoalLearningStyle     string
		Difficulties          string
		PerformanceSummary    string
		LessonSchema          string
		PreviousStatements    []string
	}{
		TopicTitle:           t.Title,
		TopicDescription:     t.Description,
		TopicRequiredMastery: t.RequiredMastery,
		TopicWeight:          t.Weight,
		GoalTitle:            goal.Title,
		GoalMotivation:       goal.Settings.Motivation,
		GoalSuccessCriteria:  goal.Settings.SuccessCriteria,
		GoalLearningStyle:    goal.Settings.LearningStyle,
		Difficulties:         s.computeDifficulties(progress),
		PerformanceSummary:   s.computePerformanceSummary(progress),
		LessonSchema:         string(lessonSchema),
		PreviousStatements:   previousStatements,
	}

	// Try up to 3 times with improving prompts
	var lastError error
	for attempt := 0; attempt < 3; attempt++ {
		prompt, err := ai.RenderPrompt("generate_lesson.txt", data)
		if err != nil {
			return nil, apperrors.NewAppError(
				apperrors.ErrInternal,
				"couldn't render prompt",
				err,
			)
		}

		if attempt > 0 && lastError != nil {
			prompt = enhanceTaskPromptWithFeedback(prompt, lastError)
		}

		raw, err := s.ai.Generate(c, ai.Request{
			Prompt: prompt,
			Format: ai.OutputFormatJSON,
		})
		if err != nil {
			lastError = err
			continue
		}

		var aiResp struct {
			Type    TaskType        `json:"type"`
			Meta    TaskMeta        `json:"meta"`
			Content json.RawMessage `json:"content"`
		}

		if err := json.Unmarshal([]byte(raw), &aiResp); err != nil {
			lastError = apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				"invalid AI response format",
				err,
			)
			continue
		}

		if aiResp.Type != TaskQuiz {
			lastError = apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				"invalid task type returned by AI",
				nil,
			)
			continue
		}

		if aiResp.Meta.Title == "" || aiResp.Meta.Description == "" || aiResp.Meta.Expectations == "" {
			lastError = apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				"invalid task meta returned by AI",
				nil,
			)
			continue
		}

		lesson, err := decodeLessonContent(aiResp.Content)
		if err != nil {
			lastError = err
			continue
		}
		lesson.Normalize()

		if err := lesson.Validate(); err != nil {
			lastError = err
			continue
		}

		content, err := json.Marshal(lesson)
		if err != nil {
			lastError = apperrors.NewAppError(apperrors.ErrInternal, "couldn't marshal lesson content", err)
			continue
		}

		task := &Task{
			UserID:  userID,
			TopicID: topicID,
			Meta:    aiResp.Meta,
			Type:    aiResp.Type,
			Content: content,
			Version: 2,
			Source:  SourceLesson,
			Status:  StatusPending,
			Done:    false,
		}

		created, err := s.repo.Create(c, task)
		if err != nil {
			if appErr, ok := apperrors.As(err); ok {
				return nil, appErr
			}
			lastError = apperrors.NewAppError(
				apperrors.ErrInternal,
				"couldn't create task",
				err,
			)
			continue
		}

		return created, nil
	}

	return nil, lastError
}

// enhanceTaskPromptWithFeedback adds specific guidance based on the previous error
func enhanceTaskPromptWithFeedback(originalPrompt string, prevErr error) string {
	feedback := "\n\n## FEEDBACK DA TENTATIVA ANTERIOR\n"
	feedback += "Na tentativa anterior, seu response foi inválido pelo seguinte motivo:\n"
	feedback += "- " + strings.ReplaceAll(prevErr.Error(), "\n", "\n- ") + "\n"
	feedback += "\nPor favor, corrija estes problemas específicos e tente novamente, seguindo TODAS as regras do prompt original."
	feedback += "\nLembre-se: RETORNE APENAS JSON VÁLIDO, nenhum texto adicional."

	return originalPrompt + feedback
}

func (s *taskService) GetByUserID(c context.Context, userID uuid.UUID) ([]*Task, error) {
	tasks, err := s.repo.GetByUserID(c, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list tasks", err)
	}

	return tasks, nil
}

func (s *taskService) GetByID(c context.Context, userID, taskID uuid.UUID) (*Task, error) {
	t, err := s.repo.GetByID(c, userID, taskID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get task", err)
	}

	return t, nil
}

func (s *taskService) ListByTopic(c context.Context, userID, topicID uuid.UUID) ([]*Task, error) {
	tasks, err := s.repo.ListByUserAndTopic(c, userID, topicID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list tasks", err)
	}

	return tasks, nil
}

// stepRef identifica um exercicio dentro de uma task existente.
type stepRef struct {
	taskID    uuid.UUID
	stepIndex int
}

// CreatePractice monta uma sessao de Treino.
//
// A materia-prima sao os exercicios que o usuario errou e os que estao
// vencidos na fila de revisao. Nao ha chamada de IA: o treino acontece
// instantaneamente.
func (s *taskService) CreatePractice(c context.Context, userID uuid.UUID, topicID *uuid.UUID, count int) (*Task, error) {
	if count <= 0 {
		count = 10
	}
	if count > MaxSessionSteps {
		count = MaxSessionSteps
	}

	refs := make([]stepRef, 0, count)

	// 1. Itens de revisao vencidos (prioridade maxima).
	due, err := s.reviews.Due(c, userID, count)
	if err != nil {
		return nil, err
	}
	for _, item := range due {
		refs = append(refs, stepRef{taskID: item.TaskID, stepIndex: item.StepIndex})
	}

	// 2. Exercicios errados recentemente.
	incorrect, err := s.steps.ListIncorrectByUser(c, userID, count)
	if err != nil {
		return nil, err
	}
	for _, attempt := range incorrect {
		refs = append(refs, stepRef{taskID: attempt.TaskID, stepIndex: attempt.StepIndex})
	}

	steps, taskID, err := s.collectSteps(c, userID, refs, topicID, count)
	if err != nil {
		return nil, err
	}
	if len(steps) < 1 {
		return nil, apperrors.NewAppError(
			apperrors.ErrInvalidInput,
			"not enough exercises for a practice session yet — complete a few lessons first",
			nil,
		)
	}

	title := "Treino"
	description := "Exercícios mistos com os seus erros recentes."
	expectations := "Reforçar as habilidades com maior reincidência de erro."

	if topicID != nil {
		t, err := s.topics.Get(c, *topicID)
		if err == nil && t != nil {
			title = "Treino — " + t.Title
			description = "Exercícios sobre " + t.Title + "."
		}
	}

	return s.persistSession(c, userID, taskID, title, description, expectations, SourcePractice, steps)
}

// CreateReview monta uma sessao de Revisao com os exercicios vencidos.
func (s *taskService) CreateReview(c context.Context, userID uuid.UUID, count int) (*Task, error) {
	if count <= 0 {
		count = 10
	}
	if count > MaxSessionSteps {
		count = MaxSessionSteps
	}

	due, err := s.reviews.Due(c, userID, count)
	if err != nil {
		return nil, err
	}
	if len(due) == 0 {
		return nil, apperrors.NewAppError(
			apperrors.ErrInvalidInput,
			"no exercises due for review right now",
			nil,
		)
	}

	refs := make([]stepRef, 0, len(due))
	for _, item := range due {
		refs = append(refs, stepRef{taskID: item.TaskID, stepIndex: item.StepIndex})
	}

	steps, taskID, err := s.collectSteps(c, userID, refs, nil, count)
	if err != nil {
		return nil, err
	}
	if len(steps) < 1 {
		return nil, apperrors.NewAppError(
			apperrors.ErrInvalidInput,
			"no exercises due for review right now",
			nil,
		)
	}

	return s.persistSession(
		c, userID, taskID,
		"Revisão",
		"Exercícios que você errou e que já estão prontos para voltar.",
		"Consolidar as habilidades esquecidas.",
		SourceReview, steps,
	)
}

// CreateRetry monta uma sessao apenas com os exercicios errados.
//
// E o "tentar de novo" do Duolingo: em vez de repetir a aula inteira, o
// usuario refaz so o que errou. Como o exercicio e o mesmo, a sessao
// mantem o tipo da original (lesson), ou seja, continua contando para o
// progresso do topico.
func (s *taskService) CreateRetry(c context.Context, userID, taskID uuid.UUID) (*Task, error) {
	original, err := s.repo.GetByID(c, userID, taskID)
	if err != nil {
		return nil, err
	}

	lesson, err := original.Decode()
	if err != nil {
		return nil, err
	}

	attempts, err := s.steps.ListByTask(c, taskID)
	if err != nil {
		return nil, err
	}

	correctByIndex := make(map[int]bool, len(attempts))
	for _, attempt := range attempts {
		correctByIndex[attempt.StepIndex] = attempt.Correct
	}

	wrong := make([]Step, 0, len(lesson.Steps))
	for i, step := range lesson.Steps {
		if !correctByIndex[i] {
			wrong = append(wrong, step)
		}
	}

	if len(wrong) == 0 {
		return nil, apperrors.NewAppError(
			apperrors.ErrInvalidInput,
			"there are no wrong exercises to retry",
			nil,
		)
	}

	return s.persistSession(
		c, userID, original.TopicID,
		"Refazer os errados",
		"Apenas os exercícios que você errou nesta sessão.",
		"Consolidar os pontos que ainda faltam.",
		original.Source,
		wrong,
	)
}

// collectSteps carrega os exercicios referenciados, removendo duplicatas
// (o mesmo enunciado pode ter sido respondido em tasks diferentes).
func (s *taskService) collectSteps(c context.Context, userID uuid.UUID, refs []stepRef, topicFilter *uuid.UUID, limit int) ([]Step, uuid.UUID, error) {
	steps := make([]Step, 0, limit)
	seen := make(map[string]struct{}, limit)
	primaryTaskID := uuid.Nil

	for _, ref := range refs {
		if len(steps) >= limit {
			break
		}

		task, err := s.repo.GetByID(c, userID, ref.taskID)
		if err != nil {
			// A task de origem pode ter sido removida: segue para a
			// proxima referencia.
			continue
		}
		if topicFilter != nil && task.TopicID != *topicFilter {
			continue
		}

		lesson, err := task.Decode()
		if err != nil {
			continue
		}
		if ref.stepIndex < 0 || ref.stepIndex >= len(lesson.Steps) {
			continue
		}

		step := lesson.Steps[ref.stepIndex]
		hash := step.QuestionHash()
		if _, exists := seen[hash]; exists {
			continue
		}
		seen[hash] = struct{}{}

		if primaryTaskID == uuid.Nil {
			primaryTaskID = task.TopicID
		}

		steps = append(steps, step)
	}

	return steps, primaryTaskID, nil
}

// persistSession grava uma sessao montada a partir de exercicios
// existentes (pratica ou revisao).
func (s *taskService) persistSession(
	c context.Context,
	userID, topicID uuid.UUID,
	title, description, expectations string,
	source Source,
	steps []Step,
) (*Task, error) {
	if topicID == uuid.Nil {
		return nil, apperrors.NewAppError(
			apperrors.ErrInvalidInput,
			"couldn't determine the topic of the session",
			nil,
		)
	}

	lesson := &LessonContent{Version: 2, Steps: steps}
	lesson.Normalize()

	// Sessoes montadas (Treino/Revisao) aceitam qualquer quantidade de
	// exercicios: elas nao passam pela IA.
	if err := lesson.ValidateWithMinSteps(1); err != nil {
		return nil, err
	}

	content, err := json.Marshal(lesson)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't marshal session content", err)
	}

	created, err := s.repo.Create(c, &Task{
		UserID:  userID,
		TopicID: topicID,
		Meta: TaskMeta{
			Title:        title,
			Description:  description,
			Expectations: expectations,
		},
		Type:    TaskQuiz,
		Content: content,
		Version: 2,
		Source:  source,
		Status:  StatusPending,
		Done:    false,
	})
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create session", err)
	}

	return created, nil
}
