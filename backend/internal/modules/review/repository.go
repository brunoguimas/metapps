package review

import (
	"context"
	"database/sql"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Repository interface {
	Upsert(c context.Context, item *ReviewItem) (*ReviewItem, error)
	GetByHash(c context.Context, userID uuid.UUID, questionHash string) (*ReviewItem, error)
	ListDue(c context.Context, userID uuid.UUID, limit int) ([]*ReviewItem, error)
	CountDue(c context.Context, userID uuid.UUID) (int, error)
	ListAll(c context.Context, userID uuid.UUID, limit int) ([]*ReviewItem, error)
}

type reviewRepository struct {
	queries *db.Queries
}

func NewRepository(q *db.Queries) Repository {
	return &reviewRepository{queries: q}
}

func (r *reviewRepository) Upsert(c context.Context, item *ReviewItem) (*ReviewItem, error) {
	row, err := r.queries.UpsertReviewItem(c, db.UpsertReviewItemParams{
		UserID:       item.UserID,
		TaskID:       item.TaskID,
		StepIndex:    int32(item.StepIndex),
		QuestionHash: item.QuestionHash,
		Ease:         item.Ease,
		IntervalDays: int32(item.IntervalDays),
		Lapses:       int32(item.Lapses),
		DueAt:        item.DueAt,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't upsert review item", err)
	}
	return mapReviewItem(row), nil
}

func (r *reviewRepository) GetByHash(c context.Context, userID uuid.UUID, questionHash string) (*ReviewItem, error) {
	row, err := r.queries.GetReviewItemByHash(c, db.GetReviewItemByHashParams{
		UserID:       userID,
		QuestionHash: questionHash,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get review item", err)
	}
	return mapReviewItem(row), nil
}

func (r *reviewRepository) ListDue(c context.Context, userID uuid.UUID, limit int) ([]*ReviewItem, error) {
	rows, err := r.queries.ListDueReviewItems(c, db.ListDueReviewItemsParams{
		UserID: userID,
		Limit:  int32(limit),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list due review items", err)
	}
	items := make([]*ReviewItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapReviewItem(row))
	}
	return items, nil
}

func (r *reviewRepository) CountDue(c context.Context, userID uuid.UUID) (int, error) {
	count, err := r.queries.CountDueReviewItems(c, userID)
	if err != nil {
		return 0, apperrors.NewAppError(apperrors.ErrInternal, "couldn't count due review items", err)
	}
	return int(count), nil
}

func (r *reviewRepository) ListAll(c context.Context, userID uuid.UUID, limit int) ([]*ReviewItem, error) {
	rows, err := r.queries.ListReviewItemsByUser(c, db.ListReviewItemsByUserParams{
		UserID: userID,
		Limit:  int32(limit),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list review items", err)
	}
	items := make([]*ReviewItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapReviewItem(row))
	}
	return items, nil
}

func mapReviewItem(row db.ReviewItem) *ReviewItem {
	return &ReviewItem{
		ID:           row.ID,
		UserID:       row.UserID,
		TaskID:       row.TaskID,
		StepIndex:    int(row.StepIndex),
		QuestionHash: row.QuestionHash,
		Ease:         row.Ease,
		IntervalDays: int(row.IntervalDays),
		Lapses:       int(row.Lapses),
		DueAt:        row.DueAt,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}
}
