package review

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeReviewRepository struct {
	items map[string]*ReviewItem
}

func (r *fakeReviewRepository) Upsert(_ context.Context, item *ReviewItem) (*ReviewItem, error) {
	if r.items == nil {
		r.items = map[string]*ReviewItem{}
	}
	r.items[item.QuestionHash] = item
	return item, nil
}

func (r *fakeReviewRepository) GetByHash(_ context.Context, _ uuid.UUID, hash string) (*ReviewItem, error) {
	return r.items[hash], nil
}

func (r *fakeReviewRepository) ListDue(context.Context, uuid.UUID, int) ([]*ReviewItem, error) {
	return nil, nil
}

func (r *fakeReviewRepository) CountDue(context.Context, uuid.UUID) (int, error) {
	return 0, nil
}

func (r *fakeReviewRepository) ListAll(context.Context, uuid.UUID, int) ([]*ReviewItem, error) {
	return nil, nil
}

func TestNextInterval_GrowsOverTime(t *testing.T) {
	assert.Equal(t, 3, nextInterval(1, 2.5))
	assert.Equal(t, 7, nextInterval(3, 2.5))
	assert.Equal(t, 18, nextInterval(7, 2.5))
}

func TestNextInterval_IsCapped(t *testing.T) {
	assert.Equal(t, MaxIntervalDays, nextInterval(MaxIntervalDays, 2.5))
	assert.Equal(t, 3, nextInterval(0, 2.5), "um intervalo de 1 dia avanca para 3")
}

func TestSchedule_NewWrongItemComesBackTomorrow(t *testing.T) {
	repo := &fakeReviewRepository{}
	svc := NewService(repo)
	userID := uuid.New()
	taskID := uuid.New()

	item, err := svc.Schedule(context.Background(), userID, taskID, 0, "hash-1", false)
	require.NoError(t, err)
	assert.Equal(t, MinIntervalDays, item.IntervalDays)
	assert.Equal(t, 0, item.Lapses)
	assert.WithinDuration(t, time.Now().UTC().AddDate(0, 0, 1), item.DueAt, time.Hour)
}

func TestSchedule_WrongAnswerResetsInterval(t *testing.T) {
	repo := &fakeReviewRepository{}
	svc := NewService(repo)
	userID := uuid.New()
	taskID := uuid.New()

	_, err := svc.Schedule(context.Background(), userID, taskID, 0, "hash-1", true)
	require.NoError(t, err)

	item, err := svc.Schedule(context.Background(), userID, taskID, 0, "hash-1", false)
	require.NoError(t, err)
	assert.Equal(t, MinIntervalDays, item.IntervalDays)
	assert.Equal(t, 1, item.Lapses)
	assert.Less(t, item.Ease, DefaultEase)
}

func TestSchedule_CorrectAnswerGrowsInterval(t *testing.T) {
	repo := &fakeReviewRepository{}
	svc := NewService(repo)
	userID := uuid.New()
	taskID := uuid.New()

	item, err := svc.Schedule(context.Background(), userID, taskID, 0, "hash-1", true)
	require.NoError(t, err)
	assert.Equal(t, 3, item.IntervalDays)

	item, err = svc.Schedule(context.Background(), userID, taskID, 0, "hash-1", true)
	require.NoError(t, err)
	assert.Equal(t, 7, item.IntervalDays)
}
