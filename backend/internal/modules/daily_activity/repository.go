package daily_activity

import (
	"context"
	"database/sql"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Repository interface {
	Upsert(c context.Context, userID uuid.UUID, day time.Time, xp, exercises, lessons, seconds int) (*DailyActivity, error)
	Get(c context.Context, userID uuid.UUID, day time.Time) (*DailyActivity, error)
	ListRange(c context.Context, userID uuid.UUID, from, to time.Time) ([]*DailyActivity, error)
	ListRecent(c context.Context, userID uuid.UUID, limit int) ([]*DailyActivity, error)
}

type dailyActivityRepository struct {
	queries *db.Queries
}

func NewRepository(q *db.Queries) Repository {
	return &dailyActivityRepository{queries: q}
}

func (r *dailyActivityRepository) Upsert(c context.Context, userID uuid.UUID, day time.Time, xp, exercises, lessons, seconds int) (*DailyActivity, error) {
	row, err := r.queries.UpsertDailyActivity(c, db.UpsertDailyActivityParams{
		UserID:       userID,
		ActivityDate: day,
		Xp:           int32(xp),
		Exercises:    int32(exercises),
		Lessons:      int32(lessons),
		Seconds:      int32(seconds),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't upsert daily activity", err)
	}
	return mapDailyActivity(row), nil
}

func (r *dailyActivityRepository) Get(c context.Context, userID uuid.UUID, day time.Time) (*DailyActivity, error) {
	row, err := r.queries.GetDailyActivity(c, db.GetDailyActivityParams{
		UserID:       userID,
		ActivityDate: day,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get daily activity", err)
	}
	return mapDailyActivity(row), nil
}

func (r *dailyActivityRepository) ListRange(c context.Context, userID uuid.UUID, from, to time.Time) ([]*DailyActivity, error) {
	rows, err := r.queries.ListDailyActivityRange(c, db.ListDailyActivityRangeParams{
		UserID:       userID,
		ActivityDate: from,
		ActivityDate_2: to,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list daily activity", err)
	}
	activities := make([]*DailyActivity, 0, len(rows))
	for _, row := range rows {
		activities = append(activities, mapDailyActivity(row))
	}
	return activities, nil
}

func (r *dailyActivityRepository) ListRecent(c context.Context, userID uuid.UUID, limit int) ([]*DailyActivity, error) {
	rows, err := r.queries.ListDailyActivityRecent(c, db.ListDailyActivityRecentParams{
		UserID: userID,
		Limit:  int32(limit),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list daily activity", err)
	}
	activities := make([]*DailyActivity, 0, len(rows))
	for _, row := range rows {
		activities = append(activities, mapDailyActivity(row))
	}
	return activities, nil
}

func mapDailyActivity(row db.DailyActivity) *DailyActivity {
	return &DailyActivity{
		ID:           row.ID,
		UserID:       row.UserID,
		ActivityDate: row.ActivityDate,
		XP:           int(row.Xp),
		Exercises:    int(row.Exercises),
		Lessons:      int(row.Lessons),
		Seconds:      int(row.Seconds),
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}
}
