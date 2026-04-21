package task

import (
	"context"
	"encoding/json"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type TaskService interface {
	Create(c context.Context, userID, goalID uuid.UUID) (*Task, error)
	GetByUserID(c context.Context, userID uuid.UUID) ([]*Task, error)
	GetByID(c context.Context, userID, goalID uuid.UUID) (*Task, error)
}

type taskService struct {
	ai       ai.Client
	repo     TaskRepository
	goalRepo goal.GoalRepository
	cfg      *config.Config
}

func NewTaskService(a ai.Client, r TaskRepository, g goal.GoalRepository, c *config.Config) TaskService {
	return &taskService{
		ai:       a,
		repo:     r,
		goalRepo: g,
		cfg:      c,
	}
}

func (s *taskService) Create(c context.Context, userID, goalID uuid.UUID) (*Task, error) {
	goal, err := s.goalRepo.GetByID(c, userID, goalID)
	if err != nil {
		return nil, err
	}

	data := struct {
		GoalTitle          string
		Difficulties       string
		PerformanceSummary string
	}{
		GoalTitle:          goal.Title,
		Difficulties:       string(goal.Difficulties),
		PerformanceSummary: "performance ruim em todos os assuntos apresentados", // TODO: melhorar isso depois
	}

	prompt, err := ai.RenderPrompt("generate_task.txt", data)
	if err != nil {
		return nil, apperrors.NewAppError(
			apperrors.ErrInternal,
			"couldn't render prompt",
			err,
		)
	}

	raw, err := s.ai.Generate(prompt)
	if err != nil {
		return nil, err
	}

	var aiResp struct {
		Type    TaskType        `json:"type"`
		Meta    TaskMeta        `json:"meta"`
		Content json.RawMessage `json:"content"`
	}

	if err := json.Unmarshal([]byte(raw), &aiResp); err != nil {
		return nil, apperrors.NewAppError(
			apperrors.ErrInvalidAIResponse,
			"invalid AI response format",
			err,
		)
	}

	if aiResp.Type != TaskQuiz && aiResp.Type != TaskEssay {
		return nil, apperrors.NewAppError(
			apperrors.ErrInvalidAIResponse,
			"invalid task type returned by AI",
			nil,
		)
	}

	if aiResp.Meta.Title == "" || aiResp.Meta.Description == "" || aiResp.Meta.Expectations == "" {
		return nil, apperrors.NewAppError(
			apperrors.ErrInvalidAIResponse,
			"invalid task meta returned by AI",
			nil,
		)
	}

	switch aiResp.Type {
	case TaskQuiz:
		var quiz QuizContent
		if err := json.Unmarshal(aiResp.Content, &quiz); err != nil {
			return nil, apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				"invalid quiz content",
				err,
			)
		}

		for _, q := range quiz.Questions {
			if err := q.Validate(); err != nil {
				return nil, err
			}
		}

	case TaskEssay:
		var essay EssayContent
		if err := json.Unmarshal(aiResp.Content, &essay); err != nil {
			return nil, apperrors.NewAppError(
				apperrors.ErrInvalidAIResponse,
				"invalid essay content",
				err,
			)
		}
	}

	task := &Task{
		UserID:  userID,
		GoalID:  goalID,
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
		return nil, apperrors.NewAppError(
			apperrors.ErrInternal,
			"couldn't create task",
			err,
		)
	}

	return created, nil
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

func (s *taskService) GetByID(c context.Context, userID, goalID uuid.UUID) (*Task, error) {
	t, err := s.repo.GetByID(c, userID, goalID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get task", err)
	}

	return t, nil
}
