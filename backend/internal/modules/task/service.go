package task

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic/dto"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type TaskService interface {
	Create(c context.Context, userID, topicID uuid.UUID) (*Task, error)
	GetByUserID(c context.Context, userID uuid.UUID) ([]*Task, error)
	GetByID(c context.Context, userID, topicID uuid.UUID) (*Task, error)
}

type taskService struct {
	ai           ai.Client
	repo         TaskRepository
	topics       topic.TopicService
	topicRepo    topic.TopicRepository
	progressRepo topic.TopicProgressRepository
	deps         topic_dependency.TopicDependencyService
	goals        goal.GoalService
	cfg          *config.Config
}

func NewTaskService(a ai.Client, r TaskRepository, t topic.TopicService, tr topic.TopicRepository, pr topic.TopicProgressRepository, d topic_dependency.TopicDependencyService, g goal.GoalService, c *config.Config) TaskService {
	return &taskService{
		ai:           a,
		repo:         r,
		topics:       t,
		topicRepo:    tr,
		progressRepo: pr,
		deps:         d,
		goals:        g,
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

func (s *taskService) Create(c context.Context, userID, topicID uuid.UUID) (*Task, error) {
	t, err := s.topics.Get(c, topicID)
	if err != nil {
		return nil, err
	}

	// Check if the topic is a parent topic (has children)
	goalID := t.GoalID
	allTopics, err := s.topicRepo.GetByGoalID(c, goalID)
	if err != nil {
		return nil, err
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
		return nil, err
	}
	for _, dep := range deps {
		progress, err := s.progressRepo.GetOrCreate(c, userID, dep.DependsOnTopicID)
		if err != nil {
			return nil, err
		}
		if progress.Status != topic.TopicStatusMastered {
			return nil, apperrors.NewAppError(apperrors.ErrInvalidInput,
				fmt.Sprintf("prerequisite topic %s not mastered", dep.DependsOnTopicID), nil)
		}
	}

	// Get the goal for the topic
	goal, err := s.goals.Get(c, userID, t.GoalID)
	if err != nil {
		return nil, err
	}

	// Get the progress for the topic and user
	progress, err := s.progressRepo.GetOrCreate(c, userID, t.ID)
	if err != nil {
		return nil, err
	}

	quiz, err := ai.FS.ReadFile("schemas/quiz.schema.json")
	if err != nil {
		return nil, err
	}
	essay, err := ai.FS.ReadFile("schemas/essay.schema.json")
	if err != nil {
		return nil, err
	}

	data := struct {
		TopicTitle       string
		TopicDescription string
		TopicRequiredMastery float64
		TopicWeight      float64
		GoalTitle        string
		GoalMotivation   string
		GoalSuccessCriteria string
		GoalLearningStyle string
		Difficulties     string
		PerformanceSummary string
		QuizSchema       string
		EssaySchema      string
	}{
		TopicTitle:       t.Title,
		TopicDescription: t.Description,
		TopicRequiredMastery: t.RequiredMastery,
		TopicWeight:      t.Weight,
		GoalTitle:        goal.Title,
		GoalMotivation:   goal.Settings.Motivation,
		GoalSuccessCriteria: goal.Settings.SuccessCriteria,
		GoalLearningStyle: goal.Settings.LearningStyle,
		Difficulties:     s.computeDifficulties(progress),
		PerformanceSummary: s.computePerformanceSummary(progress),
		QuizSchema:       string(quiz),
		EssaySchema:      string(essay),
	}

	// Try up to 3 times with improving prompts
	var lastError error
	for attempt := 0; attempt < 3; attempt++ {
		prompt, err := ai.RenderPrompt("generate_task.txt", data)
		if err != nil {
			return nil, apperrors.NewAppError(
				apperrors.ErrInternal,
				"couldn't render prompt",
				err,
			)
		}

		// On retry attempts, add feedback about what went wrong
		if attempt > 0 && lastError != nil {
			prompt = enhanceTaskPromptWithFeedback(prompt, lastError)
		}

		raw, err := s.ai.Generate(c, prompt)
		if err != nil {
			lastError = err
			continue // Try again
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
			continue // Try again
		}

		if aiResp.Type != TaskQuiz && aiResp.Type != TaskEssay {
			lastError = apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				"invalid task type returned by AI",
				nil,
			)
			continue // Try again
		}

		if aiResp.Meta.Title == "" || aiResp.Meta.Description == "" || aiResp.Meta.Expectations == "" {
			lastError = apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				"invalid task meta returned by AI",
				nil,
			)
			continue // Try again
		}

		// Success! Create the task
		task := &Task{
			UserID:  userID,
			TopicID: topicID,
			Meta:    aiResp.Meta,
			Type:    aiResp.Type,
			Content: aiResp.Content,
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
			continue // Try again
		}

		return created, nil
	}

	// If we got here, all attempts failed
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

func (s *taskService) GetByID(c context.Context, userID, topicID uuid.UUID) (*Task, error) {
	t, err := s.repo.GetByID(c, userID, topicID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get task", err)
	}

	return t, nil
}
