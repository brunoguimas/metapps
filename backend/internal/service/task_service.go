package service

import (
	"context"
	"math/rand"

	"github.com/brunoguimas/metapps/backend/internal/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"github.com/brunoguimas/metapps/backend/internal/models"
	"github.com/brunoguimas/metapps/backend/internal/repository"
	"github.com/google/uuid"
)

type TaskService interface {
	Create(c context.Context, userID, goalID uuid.UUID) (*models.TaskReturn, error)
	GetByUserID(c context.Context, userID uuid.UUID) ([]*models.TaskReturn, error)
	GetByID(c context.Context, userID, goalID uuid.UUID) (*models.TaskReturn, error)
}

type taskService struct {
	repo repository.TaskRepository
	cfg  *config.Config
}

func NewTaskService(r repository.TaskRepository, c *config.Config) TaskService {
	return &taskService{
		repo: r,
		cfg:  c,
	}
}
func (s *taskService) Create(c context.Context, userID, goalID uuid.UUID) (*models.TaskReturn, error) {
	tasks := models.FakeTaxi(userID, goalID)
	n := rand.Intn(len(tasks))

	created, err := s.repo.Create(c, &tasks[n])
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create task", err)
	}

	return created, nil
}

func (s *taskService) GetByUserID(c context.Context, userID uuid.UUID) ([]*models.TaskReturn, error) {
	tasks, err := s.repo.GetByUserID(c, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list tasks", err)
	}

	return tasks, nil
}

func (s *taskService) GetByID(c context.Context, userID, goalID uuid.UUID) (*models.TaskReturn, error) {
	t, err := s.repo.GetByID(c, userID, goalID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get task", err)
	}

	return t, nil
}
