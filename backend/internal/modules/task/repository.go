package task

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Repository interface {
	Create(c context.Context, t *Task) (*Task, error)
	GetByUserID(c context.Context, userID uuid.UUID) ([]*Task, error)
	GetByID(c context.Context, userID, id uuid.UUID) (*Task, error)
	GetByUserAndTopicAndStatus(c context.Context, userID, topicID uuid.UUID, status Status) (*Task, error)
	ListByUserAndTopic(c context.Context, userID, topicID uuid.UUID) ([]*Task, error)
	ListByUserAndSource(c context.Context, userID uuid.UUID, source Source) ([]*Task, error)
	ListStatementsByTopic(c context.Context, userID, topicID uuid.UUID) ([]string, error)
	MarkDone(c context.Context, userID, id uuid.UUID) (*Task, error)
	UpdateSession(c context.Context, t *Task) (*Task, error)
	UpdateDone(c context.Context, t *Task) (*Task, error)
}

type taskRepository struct {
	queries *db.Queries
}

func NewRepository(q *db.Queries) Repository {
	return &taskRepository{
		queries: q,
	}
}

func (r *taskRepository) Create(c context.Context, task *Task) (*Task, error) {
	payload, err := json.Marshal(persistedTaskContent{
		Meta:    task.Meta,
		Content: task.Content,
	})
	if err != nil {
		return nil, err
	}

	source := task.Source
	if source == "" {
		source = SourceLesson
	}

	status := task.Status
	if status == "" {
		status = StatusPending
	}

	t, err := r.queries.CreateTask(c, db.CreateTaskParams{
		UserID:  uuid.NullUUID{UUID: task.UserID, Valid: true},
		TopicID: task.TopicID,
		Content: payload,
		Type:    string(task.Type),
		Source:  string(source),
		Version: int32(task.Version),
		Status:  string(status),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create task", err)
	}

	return mapTask(t), nil
}

func (r *taskRepository) GetByUserID(c context.Context, userID uuid.UUID) ([]*Task, error) {
	var tasks []*Task
	ts, err := r.queries.GetTasksByUserID(c, uuid.NullUUID{UUID: userID, Valid: true})
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
	t, err := r.queries.GetTaskByID(c, db.GetTaskByIDParams{ID: id, UserID: uuid.NullUUID{UUID: userID, Valid: true}})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskNotFound, "task not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get task", err)
	}

	return mapTask(t), nil
}

// GetByUserAndTopicAndStatus devolve a sessao em andamento de um topico.
//
// E o que permite retomar uma lesson sem chamar a IA de novo: o clique em
// "Comecar" deixa de custar 10-30 segundos quando ja existe conteudo
// pronto.
func (r *taskRepository) GetByUserAndTopicAndStatus(c context.Context, userID, topicID uuid.UUID, status Status) (*Task, error) {
	t, err := r.queries.GetTaskByUserAndTopicAndStatus(c, db.GetTaskByUserAndTopicAndStatusParams{
		UserID:  userID,
		TopicID: topicID,
		Status:  string(status),
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get task by topic and status", err)
	}

	return mapTask(t), nil
}

func (r *taskRepository) ListByUserAndTopic(c context.Context, userID, topicID uuid.UUID) ([]*Task, error) {
	rows, err := r.queries.ListTasksByUserAndTopic(c, db.ListTasksByUserAndTopicParams{
		UserID:  userID,
		TopicID: topicID,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list tasks by topic", err)
	}

	tasks := make([]*Task, 0, len(rows))
	for _, row := range rows {
		tasks = append(tasks, mapTask(row))
	}
	return tasks, nil
}

func (r *taskRepository) ListByUserAndSource(c context.Context, userID uuid.UUID, source Source) ([]*Task, error) {
	rows, err := r.queries.ListTasksByUserAndSource(c, db.ListTasksByUserAndSourceParams{
		UserID: userID,
		Source: string(source),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list tasks by source", err)
	}

	tasks := make([]*Task, 0, len(rows))
	for _, row := range rows {
		tasks = append(tasks, mapTask(row))
	}
	return tasks, nil
}

// ListStatementsByTopic devolve os enunciados ja usados no topico.
//
// Sao alimentados no prompt para a IA nao repetir conteudo -- a regra
// "nao repita" so funciona se o modelo consegue ver o que ja foi usado.
func (r *taskRepository) ListStatementsByTopic(c context.Context, userID, topicID uuid.UUID) ([]string, error) {
	rows, err := r.queries.ListTaskStatementsByTopic(c, db.ListTaskStatementsByTopicParams{
		UserID:  userID,
		TopicID: topicID,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list task statements", err)
	}

	statements := make([]string, 0, len(rows))
	for _, row := range rows {
		if row != "" {
			statements = append(statements, row)
		}
	}
	return statements, nil
}

func (r *taskRepository) MarkDone(c context.Context, userID, id uuid.UUID) (*Task, error) {
	t, err := r.queries.MarkTaskDone(c, db.MarkTaskDoneParams{
		ID:     id,
		UserID: uuid.NullUUID{UUID: userID, Valid: true},
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskNotFound, "task not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't mark task as done", err)
	}

	return mapTask(t), nil
}

// UpdateSession grava o estado de execucao da sessao (cursor, combo,
// score).
func (r *taskRepository) UpdateSession(c context.Context, task *Task) (*Task, error) {
	t, err := r.queries.UpdateTaskSession(c, db.UpdateTaskSessionParams{
		ID:        task.ID,
		Status:    string(task.Status),
		StepCursor: int32(task.StepCursor),
		MaxCombo:  int32(task.MaxCombo),
		Score:     nullableFloat(task.Score),
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskNotFound, "task not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't update task session", err)
	}

	return mapTask(t), nil
}

// UpdateDone grava a conclusao da sessao.
func (r *taskRepository) UpdateDone(c context.Context, task *Task) (*Task, error) {
	t, err := r.queries.UpdateTaskDone(c, db.UpdateTaskDoneParams{
		ID:        task.ID,
		Done:      task.Done,
		Status:    string(task.Status),
		Score:     nullableFloat(task.Score),
		XpGained:  int32(task.XPGained),
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskNotFound, "task not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't update task done", err)
	}

	return mapTask(t), nil
}

func nullableFloat(v *float64) sql.NullString {
	if v == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: formatFloat(*v), Valid: true}
}

func formatFloat(v float64) string {
	return strconv.FormatFloat(v, 'f', -1, 64)
}

func parseFloat(v string) (float64, error) {
	return strconv.ParseFloat(v, 64)
}

func mapTask(t db.Task) *Task {
	doneAt := func() *time.Time {
		if !t.DoneAt.Valid {
			return nil
		}
		return &t.DoneAt.Time
	}()

	lastStepAt := func() *time.Time {
		if !t.LastStepAt.Valid {
			return nil
		}
		return &t.LastStepAt.Time
	}()

	var score *float64
	if t.Score.Valid {
		if parsed, err := parseFloat(t.Score.String); err == nil {
			score = &parsed
		}
	}

	source := Source(t.Source)
	if source == "" {
		source = SourceLesson
	}

	status := Status(t.Status)
	if status == "" {
		status = StatusPending
	}

	return &Task{
		ID:         t.ID,
		UserID:     t.UserID,
		TopicID:    t.TopicID,
		Version:    int(t.Version),
		Meta:       extractTaskMeta(t.Content),
		Content:    extractTaskInnerContent(t.Content),
		Type:       TaskType(t.Type),
		Source:     source,
		Status:     status,
		StepCursor: int(t.StepCursor),
		MaxCombo:   int(t.MaxCombo),
		Score:      score,
		XPGained:   int(t.XpGained),
		Done:       t.Done,
		DoneAt:     doneAt,
		LastStepAt: lastStepAt,
		CreatedAt:  t.CreatedAt.Time,
		UpdatedAt:  t.UpdatedAt,
	}
}

func extractTaskMeta(raw json.RawMessage) TaskMeta {
	if len(raw) == 0 {
		return TaskMeta{}
	}

	var payload persistedTaskContent
	if err := json.Unmarshal(raw, &payload); err != nil {
		return TaskMeta{}
	}

	return payload.Meta
}

func extractTaskInnerContent(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return nil
	}

	var payload persistedTaskContent
	if err := json.Unmarshal(raw, &payload); err == nil && len(payload.Content) > 0 {
		return payload.Content
	}

	cloned := make([]byte, len(raw))
	copy(cloned, raw)
	return cloned
}
