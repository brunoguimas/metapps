package task

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
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
	cfg          *config.Config
}

func NewTaskService(a ai.Client, r TaskRepository, t topic.TopicService, tr topic.TopicRepository, pr topic.TopicProgressRepository, d topic_dependency.TopicDependencyService, c *config.Config) TaskService {
	return &taskService{
		ai:           a,
		repo:         r,
		topics:       t,
		topicRepo:    tr,
		progressRepo: pr,
		deps:         d,
		cfg:          c,
	}
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

	raw, err := s.ai.Generate(c, prompt)
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
