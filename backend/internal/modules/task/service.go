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
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Service interface {
	Create(c context.Context, userID, topicID uuid.UUID) (*Task, error)
	GetByUserID(c context.Context, userID uuid.UUID) ([]*Task, error)
	GetByID(c context.Context, userID, topicID uuid.UUID) (*Task, error)
}

type taskService struct {
	ai           ai.Client
	repo         Repository
	topics       topic.Service
	topicRepo    topic.Repository
	progressRepo topic.ProgressRepository
	deps         topic_dependency.Service
	goals        goal.Service
	cfg          *config.Config
}

func NewService(a ai.Client, r Repository, t topic.Service, tr topic.Repository, pr topic.ProgressRepository, d topic_dependency.Service, g goal.Service, c *config.Config) Service {
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
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get topic", err)
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

	quiz, err := ai.FS.ReadFile("schemas/quiz.schema.json")
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't read quiz schema", err)
	}

	data := struct {
		TopicTitle           string
		TopicDescription     string
		TopicRequiredMastery float64
		TopicWeight          float64
		GoalTitle            string
		GoalMotivation       string
		GoalSuccessCriteria  string
		GoalLearningStyle    string
		Difficulties         string
		PerformanceSummary   string
		QuizSchema           string
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
		QuizSchema:           string(quiz),
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

		if attempt > 0 && lastError != nil {
			prompt = enhanceTaskPromptWithFeedback(prompt, lastError)
		}

		raw, err := s.ai.Generate(c, prompt)
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
