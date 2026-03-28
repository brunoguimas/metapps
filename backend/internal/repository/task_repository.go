package repository

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/brunoguimas/metapps/backend/internal/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"github.com/brunoguimas/metapps/backend/internal/models"
	"github.com/google/uuid"
)

type TaskRepository interface {
	Create(c context.Context, t *models.Task) (*models.TaskReturn, error)
	GetByUserID(c context.Context, userID uuid.UUID) ([]*models.TaskReturn, error)
	GetByID(c context.Context, userID, id uuid.UUID) (*models.TaskReturn, error)
}

type taskRepository struct {
	queries *db.Queries
}

func NewTaskRepository(q *db.Queries) TaskRepository {
	return &taskRepository{
		queries: q,
	}
}

func (r *taskRepository) Create(c context.Context, t *models.Task) (*models.TaskReturn, error) {
	content, err := json.Marshal(t.Content)
	if err != nil {
		return nil, err
	}

	task, err := r.queries.CreateTask(c, db.CreateTaskParams{
		UserID:  t.UserID,
		GoalID:  t.GoalID,
		Content: content,
		Type:    string(t.Type),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create task", err)
	}

	return &models.TaskReturn{
		ID:        task.ID,
		UserID:    task.UserID,
		GoalID:    task.GoalID,
		Content:   task.Content,
		Type:      models.TaskType(task.Type),
		Done:      task.Done,
		DoneAt:    nil,
		CreatedAt: task.CreatedAt.Time,
	}, nil
}
func (r *taskRepository) GetByUserID(c context.Context, userID uuid.UUID) ([]*models.TaskReturn, error) {
	var tasks []*models.TaskReturn
	ts, err := r.queries.GetTasksByUserID(c, userID)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list tasks", err)
	}

	for _, t := range ts {
		task := &models.TaskReturn{
			ID:        t.ID,
			UserID:    t.UserID,
			GoalID:    t.GoalID,
			Content:   t.Content,
			Type:      models.TaskType(t.Type),
			Done:      t.Done,
			DoneAt:    nil,
			CreatedAt: t.CreatedAt.Time,
		}

		tasks = append(tasks, task)
	}

	return tasks, nil
}

func (r *taskRepository) GetByID(c context.Context, userID, id uuid.UUID) (*models.TaskReturn, error) {
	task, err := r.queries.GetTaskByID(c, db.GetTaskByIDParams{ID: id, UserID: userID})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskNotFound, "task not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get task", err)
	}

	return &models.TaskReturn{
		ID:        task.ID,
		UserID:    task.UserID,
		GoalID:    task.GoalID,
		Content:   task.Content,
		Type:      models.TaskType(task.Type),
		Done:      task.Done,
		DoneAt:    nil,
		CreatedAt: task.CreatedAt.Time,
	}, nil
}
