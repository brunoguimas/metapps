package task_correction

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Repository interface {
	Create(c context.Context, correction *TaskCorrection) (*TaskCorrection, error)
	GetByID(c context.Context, id uuid.UUID) (*TaskCorrection, error)
	GetByAttemptID(c context.Context, attemptID uuid.UUID) (*TaskCorrection, error)
	Update(c context.Context, correction *TaskCorrection) (*TaskCorrection, error)
}

type repository struct {
	queries *db.Queries
}

func NewRepository(q *db.Queries) Repository {
	return &repository{queries: q}
}

func (r *repository) Create(c context.Context, correction *TaskCorrection) (*TaskCorrection, error) {
	now := nowFunc()
	correction.CreatedAt = now
	correction.UpdatedAt = now

	row, err := r.queries.CreateTaskCorrection(c, db.CreateTaskCorrectionParams{
		AttemptID: correction.AttemptID,
		Feedback:  correction.Feedback,
		Score:     nullableScore(correction.Score),
		Status:    string(correction.Status),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "failed to create correction", err)
	}

	return mapTaskCorrection(row), nil
}

func (r *repository) GetByID(c context.Context, id uuid.UUID) (*TaskCorrection, error) {
	row, err := r.queries.GetTaskCorrectionByID(c, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskCorrectionNotFound, "correction not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "failed to get correction", err)
	}
	return mapTaskCorrection(row), nil
}

func (r *repository) GetByAttemptID(c context.Context, attemptID uuid.UUID) (*TaskCorrection, error) {
	row, err := r.queries.GetTaskCorrectionByAttemptID(c, attemptID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskCorrectionNotFound, "correction not found for attempt", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "failed to get correction by attempt ID", err)
	}
	return mapTaskCorrection(row), nil
}

func (r *repository) Update(c context.Context, correction *TaskCorrection) (*TaskCorrection, error) {
	correction.UpdatedAt = nowFunc()

	row, err := r.queries.UpdateTaskCorrection(c, db.UpdateTaskCorrectionParams{
		ID:       correction.ID,
		Feedback: correction.Feedback,
		Score:    nullableScore(correction.Score),
		Status:   string(correction.Status),
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrTaskCorrectionNotFound, "correction not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "failed to update correction", err)
	}
	return mapTaskCorrection(row), nil
}

func nullableScore(score *float64) sql.NullString {
	if score == nil {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{Valid: true, String: fmt.Sprintf("%.4f", *score)}
}

func mapTaskCorrection(row db.TaskCorrection) *TaskCorrection {
	var score *float64
	if row.Score.Valid {
		s, err := parseScore(row.Score.String)
		if err != nil {
			s = 0
		}
		score = &s
	}

	var status Status
	if row.Status != "" {
		status = Status(row.Status)
	} else {
		status = StatusPending
	}

	return &TaskCorrection{
		ID:        row.ID,
		AttemptID: row.AttemptID,
		Feedback:  row.Feedback,
		Score:     score,
		Status:    status,
		CreatedAt: row.CreatedAt.Time,
		UpdatedAt: row.UpdatedAt.Time,
	}
}

func parseScore(raw string) (float64, error) {
	var score float64
	_, err := fmt.Sscanf(raw, "%f", &score)
	if err != nil {
		return 0, err
	}
	return score, nil
}

var nowFunc = func() time.Time { return time.Now() }
