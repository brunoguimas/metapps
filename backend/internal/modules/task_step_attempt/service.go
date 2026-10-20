package task_step_attempt

import (
	"context"

	"github.com/google/uuid"
)

type Service interface {
	Record(c context.Context, userID, taskID uuid.UUID, stepIndex int, answer []byte, correct bool, xp int) (*TaskStepAttempt, error)
	GetByTaskAndStep(c context.Context, taskID uuid.UUID, stepIndex int) (*TaskStepAttempt, error)
	ListByTask(c context.Context, taskID uuid.UUID) ([]*TaskStepAttempt, error)
	ListByUser(c context.Context, userID uuid.UUID, limit int) ([]*TaskStepAttempt, error)
	ListIncorrectByUser(c context.Context, userID uuid.UUID, limit int) ([]*TaskStepAttempt, error)
}

type stepAttemptService struct {
	repo Repository
}

func NewService(r Repository) Service {
	return &stepAttemptService{repo: r}
}

func (s *stepAttemptService) Record(c context.Context, userID, taskID uuid.UUID, stepIndex int, answer []byte, correct bool, xp int) (*TaskStepAttempt, error) {
	return s.repo.Create(c, &TaskStepAttempt{
		UserID:    userID,
		TaskID:    taskID,
		StepIndex: stepIndex,
		Answer:    answer,
		Correct:   correct,
		XP:        xp,
	})
}

func (s *stepAttemptService) GetByTaskAndStep(c context.Context, taskID uuid.UUID, stepIndex int) (*TaskStepAttempt, error) {
	return s.repo.GetByTaskAndStep(c, taskID, stepIndex)
}

func (s *stepAttemptService) ListByTask(c context.Context, taskID uuid.UUID) ([]*TaskStepAttempt, error) {
	return s.repo.ListByTask(c, taskID)
}

func (s *stepAttemptService) ListByUser(c context.Context, userID uuid.UUID, limit int) ([]*TaskStepAttempt, error) {
	return s.repo.ListByUser(c, userID, limit)
}

func (s *stepAttemptService) ListIncorrectByUser(c context.Context, userID uuid.UUID, limit int) ([]*TaskStepAttempt, error) {
	return s.repo.ListIncorrectByUser(c, userID, limit)
}
