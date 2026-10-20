package task_step_attempt

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Repository interface {
	Create(c context.Context, a *TaskStepAttempt) (*TaskStepAttempt, error)
	GetByTaskAndStep(c context.Context, taskID uuid.UUID, stepIndex int) (*TaskStepAttempt, error)
	ListByTask(c context.Context, taskID uuid.UUID) ([]*TaskStepAttempt, error)
	ListByUser(c context.Context, userID uuid.UUID, limit int) ([]*TaskStepAttempt, error)
	ListIncorrectByUser(c context.Context, userID uuid.UUID, limit int) ([]*TaskStepAttempt, error)
}

type stepAttemptRepository struct {
	queries *db.Queries
}

func NewRepository(q *db.Queries) Repository {
	return &stepAttemptRepository{queries: q}
}

func (r *stepAttemptRepository) Create(c context.Context, a *TaskStepAttempt) (*TaskStepAttempt, error) {
	row, err := r.queries.CreateTaskStepAttempt(c, db.CreateTaskStepAttemptParams{
		UserID:    a.UserID,
		TaskID:    a.TaskID,
		StepIndex: int32(a.StepIndex),
		Answer:    a.Answer,
		Correct:   a.Correct,
		XpAwarded: int32(a.XP),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create task step attempt", err)
	}
	return mapStepAttempt(row), nil
}

func (r *stepAttemptRepository) GetByTaskAndStep(c context.Context, taskID uuid.UUID, stepIndex int) (*TaskStepAttempt, error) {
	row, err := r.queries.GetTaskStepAttempt(c, db.GetTaskStepAttemptParams{
		TaskID:    taskID,
		StepIndex: int32(stepIndex),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get task step attempt", err)
	}
	return mapStepAttempt(row), nil
}

func (r *stepAttemptRepository) ListByTask(c context.Context, taskID uuid.UUID) ([]*TaskStepAttempt, error) {
	rows, err := r.queries.ListTaskStepAttemptsByTask(c, taskID)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list task step attempts", err)
	}
	attempts := make([]*TaskStepAttempt, 0, len(rows))
	for _, row := range rows {
		attempts = append(attempts, mapStepAttempt(row))
	}
	return attempts, nil
}

func (r *stepAttemptRepository) ListByUser(c context.Context, userID uuid.UUID, limit int) ([]*TaskStepAttempt, error) {
	rows, err := r.queries.ListTaskStepAttemptsByUser(c, db.ListTaskStepAttemptsByUserParams{
		UserID: userID,
		Limit:  int32(limit),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list task step attempts", err)
	}
	attempts := make([]*TaskStepAttempt, 0, len(rows))
	for _, row := range rows {
		attempts = append(attempts, mapStepAttempt(row))
	}
	return attempts, nil
}

func (r *stepAttemptRepository) ListIncorrectByUser(c context.Context, userID uuid.UUID, limit int) ([]*TaskStepAttempt, error) {
	rows, err := r.queries.ListIncorrectTaskStepAttemptsByUser(c, db.ListIncorrectTaskStepAttemptsByUserParams{
		UserID: userID,
		Limit:  int32(limit),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list incorrect step attempts", err)
	}
	attempts := make([]*TaskStepAttempt, 0, len(rows))
	for _, row := range rows {
		attempts = append(attempts, mapStepAttempt(row))
	}
	return attempts, nil
}

func mapStepAttempt(row db.TaskStepAttempt) *TaskStepAttempt {
	return &TaskStepAttempt{
		ID:         row.ID,
		UserID:     row.UserID,
		TaskID:     row.TaskID,
		StepIndex:  int(row.StepIndex),
		Answer:     row.Answer,
		Correct:    row.Correct,
		XP:         int(row.XpAwarded),
		AnsweredAt: row.AnsweredAt,
	}
}
