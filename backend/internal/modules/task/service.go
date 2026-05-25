package task

import (
	"context"
	"encoding/json"
	"os"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
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
	ai     ai.Client
	repo   TaskRepository
	topics topic.TopicService
	cfg    *config.Config
}

func NewTaskService(a ai.Client, r TaskRepository, t topic.TopicService, g goal.GoalRepository, c *config.Config) TaskService {
	return &taskService{
		ai:     a,
		repo:   r,
		topics: t,
		cfg:    c,
	}
}

func (s *taskService) Create(c context.Context, userID, topicID uuid.UUID) (*Task, error) {
	t, err := s.topics.Get(c, topicID)
	if err != nil {
		return nil, err
	}

	os.WriteFile("string", []byte("oioiio"), os.ModeAppend)
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
		QuizSchema       string
		EssaySchema      string
	}{
		TopicTitle:       t.Title,
		TopicDescription: t.Description,
		QuizSchema:       string(quiz),
		EssaySchema:      string(essay),
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
