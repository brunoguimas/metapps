package task

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type TaskRepository interface {
	Create(c context.Context, t *Task) (*Task, error)
	GetByUserID(c context.Context, userID uuid.UUID) ([]*Task, error)
	GetByID(c context.Context, userID, id uuid.UUID) (*Task, error)
}

type taskRepository struct {
	queries *db.Queries
}

func NewTaskRepository(q *db.Queries) TaskRepository {
	return &taskRepository{
		queries: q,
	}
}

func (r *taskRepository) Create(c context.Context, task *Task) (*Task, error) {
	content, err := json.Marshal(task.Content)
	if err != nil {
		return nil, err
	}

	t, err := r.queries.CreateTask(c, db.CreateTaskParams{
		UserID:  task.UserID,
		GoalID:  task.GoalID,
		Content: content,
		Type:    string(task.Type),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create task", err)
	}

	return mapTask(t), nil
}
func (r *taskRepository) GetByUserID(c context.Context, userID uuid.UUID) ([]*Task, error) {
	var tasks []*Task
	ts, err := r.queries.GetTasksByUserID(c, userID)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list tasks", err)
	}

	for _, t := range ts {
		task := mapTask(t)
		tasks = append(tasks, task)
	}

	return tasks, nil
}

func (r *taskRepository) GetByID(c context.Context, userID, id uuid.UUID) (*Task, error) {
	t, err := r.queries.GetTaskByID(c, db.GetTaskByIDParams{ID: id, UserID: userID})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskNotFound, "task not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get task", err)
	}

	return mapTask(t), nil
}

func mapTask(t db.Task) *Task {
	doneAt := func() *time.Time {
		if !t.DoneAt.Valid {
			return nil
		}
		return &t.DoneAt.Time
	}()

	return &Task{
		ID:        t.ID,
		UserID:    t.UserID,
		GoalID:    t.GoalID,
		Content:   t.Content,
		Type:      TaskType(t.Type),
		Done:      t.Done,
		DoneAt:    doneAt,
		CreatedAt: t.CreatedAt.Time,
	}
}
