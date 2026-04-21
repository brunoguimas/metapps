package taskattempt

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Repository interface {
	Create(c context.Context, attempt *TaskAttempt) (*TaskAttempt, error)
	GetByID(c context.Context, id uuid.UUID) (*TaskAttempt, error)
	ListByUser(c context.Context, userID uuid.UUID) ([]*TaskAttempt, error)
	ListByUserAndTask(c context.Context, userID, taskID uuid.UUID) ([]*TaskAttempt, error)
}

type repository struct {
	queries *db.Queries
}

func NewRepository(q *db.Queries) Repository {
	return &repository{queries: q}
}

func (r *repository) Create(c context.Context, attempt *TaskAttempt) (*TaskAttempt, error) {
	content, err := normalizeJSON(attempt.Content, false)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid task attempt content", err)
	}

	taskEvaluation, err := normalizeJSON(attempt.TaskEvaluation, true)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid task attempt evaluation", err)
	}

	var score sql.NullString
	if attempt.Score != nil {
		score.String = formatScore(*attempt.Score)
		score.Valid = true
	}

	row, err := r.queries.CreateTaskAttempt(c, db.CreateTaskAttemptParams{
		UserID:         attempt.UserID,
		TaskID:         attempt.TaskID,
		Content:        content,
		Score:          score,
		Status:         sql.NullString{String: string(attempt.Status), Valid: attempt.Status != ""},
		TaskEvaluation: taskEvaluation,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create task attempt", err)
	}

	return mapTaskAttempt(row), nil
}

func (r *repository) GetByID(c context.Context, id uuid.UUID) (*TaskAttempt, error) {
	row, err := r.queries.GetTaskAttemptByID(c, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskAttemptNotFound, "task attempt not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get task attempt", err)
	}

	return mapTaskAttempt(row), nil
}

func (r *repository) ListByUser(c context.Context, userID uuid.UUID) ([]*TaskAttempt, error) {
	rows, err := r.queries.ListTaskAttemptsByUser(c, userID)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list task attempts", err)
	}

	items := make([]*TaskAttempt, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapTaskAttempt(row))
	}
	return items, nil
}

func (r *repository) ListByUserAndTask(c context.Context, userID, taskID uuid.UUID) ([]*TaskAttempt, error) {
	rows, err := r.queries.ListTaskAttemptsByUserAndTask(c, db.ListTaskAttemptsByUserAndTaskParams{
		UserID: userID,
		TaskID: taskID,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list task attempts", err)
	}

	items := make([]*TaskAttempt, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapTaskAttempt(row))
	}
	return items, nil
}

func mapTaskAttempt(row db.TaskAttempt) *TaskAttempt {
	var score *float64
	if row.Score.Valid {
		parsed := parseScore(row.Score.String)
		score = &parsed
	}

	createdAt := time.Time{}
	if row.CreatedAt.Valid {
		createdAt = row.CreatedAt.Time
	}

	return &TaskAttempt{
		ID:             row.ID,
		UserID:         row.UserID,
		TaskID:         row.TaskID,
		Content:        row.Content,
		Score:          score,
		Status:         Status(row.Status.String),
		TaskEvaluation: row.TaskEvaluation,
		CreatedAt:      createdAt,
	}
}

func formatScore(score float64) string {
	return fmt.Sprintf("%.4f", score)
}

func parseScore(raw string) float64 {
	score, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0
	}
	return score
}

func normalizeJSON(raw json.RawMessage, allowNull bool) (json.RawMessage, error) {
	if len(raw) == 0 {
		if allowNull {
			return json.RawMessage("null"), nil
		}
		return nil, fmt.Errorf("json payload is empty")
	}

	if !json.Valid(raw) {
		return nil, fmt.Errorf("json payload is invalid")
	}

	normalized := make([]byte, len(raw))
	copy(normalized, raw)
	return normalized, nil
}
