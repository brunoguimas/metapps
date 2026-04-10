package task

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/ai"
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
	ai   ai.Client
	repo TaskRepository
	cfg  *config.Config
}

func NewTaskService(a ai.Client, r TaskRepository, c *config.Config) TaskService {
	return &taskService{
		ai:   a,
		repo: r,
		cfg:  c,
	}
}
func (s *taskService) Create(c context.Context, userID, goalID uuid.UUID) (*Task, error) {
	created, err := s.repo.Create(c, &Task{
		UserID: userID,
		GoalID: goalID,
	})
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create task", err)
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
