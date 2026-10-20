package profile

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeRepository struct {
	profile *Profile
	xp      int
}

func (r *fakeRepository) GetByUserID(context.Context, uuid.UUID) (*Profile, error) {
	return r.profile, nil
}

func (r *fakeRepository) Create(_ context.Context, p *Profile) (*Profile, error) {
	r.profile = p
	return p, nil
}

func (r *fakeRepository) Update(_ context.Context, p *Profile) (*Profile, error) {
	r.profile = p
	return p, nil
}

func (r *fakeRepository) AddXP(_ context.Context, _ uuid.UUID, xp int) (*Profile, error) {
	r.xp = r.profile.XP + xp
	r.profile.XP = r.xp
	return r.profile, nil
}

func (r *fakeRepository) UpdateStreak(_ context.Context, _ uuid.UUID, streak int, lastActivity time.Time) (*Profile, error) {
	r.profile.Streak = streak
	r.profile.LastActivityDate = lastActivity
	return r.profile, nil
}

func (r *fakeRepository) UpdateDailyGoal(_ context.Context, _ uuid.UUID, dailyGoalXP int) (*Profile, error) {
	r.profile.DailyGoalXP = dailyGoalXP
	return r.profile, nil
}

func day(offset int) time.Time {
	now := time.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	return today.AddDate(0, 0, offset)
}

func TestTouchActivity_StartsStreakOnFirstActivity(t *testing.T) {
	repo := &fakeRepository{profile: &Profile{UserID: uuid.New(), Streak: 0, LastActivityDate: day(-5)}}
	svc := NewService(repo)

	updated, err := svc.TouchActivity(context.Background(), repo.profile.UserID)
	require.NoError(t, err)
	assert.Equal(t, 1, updated.Streak)
}

// Um perfil recem-criado ja nasce com a data de hoje. O primeiro
// estudo do dia precisa iniciar a streak em 1.
func TestTouchActivity_NewProfileStartsStreakToday(t *testing.T) {
	repo := &fakeRepository{profile: &Profile{UserID: uuid.New(), Streak: 0, LastActivityDate: day(0)}}
	svc := NewService(repo)

	updated, err := svc.TouchActivity(context.Background(), repo.profile.UserID)
	require.NoError(t, err)
	assert.Equal(t, 1, updated.Streak)
}

func TestTouchActivity_KeepsStreakOnSameDay(t *testing.T) {
	repo := &fakeRepository{profile: &Profile{UserID: uuid.New(), Streak: 7, LastActivityDate: day(0)}}
	svc := NewService(repo)

	updated, err := svc.TouchActivity(context.Background(), repo.profile.UserID)
	require.NoError(t, err)
	assert.Equal(t, 7, updated.Streak, "estudar duas vezes no mesmo dia nao muda a streak")
}

func TestTouchActivity_IncrementsOnConsecutiveDay(t *testing.T) {
	repo := &fakeRepository{profile: &Profile{UserID: uuid.New(), Streak: 7, LastActivityDate: day(-1)}}
	svc := NewService(repo)

	updated, err := svc.TouchActivity(context.Background(), repo.profile.UserID)
	require.NoError(t, err)
	assert.Equal(t, 8, updated.Streak)
}

func TestTouchActivity_RestartsAfterGap(t *testing.T) {
	repo := &fakeRepository{profile: &Profile{UserID: uuid.New(), Streak: 9, LastActivityDate: day(-3)}}
	svc := NewService(repo)

	updated, err := svc.TouchActivity(context.Background(), repo.profile.UserID)
	require.NoError(t, err)
	assert.Equal(t, 1, updated.Streak, "pular dias quebra a streak")
}

func TestAddXP_DoesNotTouchStreak(t *testing.T) {
	repo := &fakeRepository{profile: &Profile{UserID: uuid.New(), Streak: 3, LastActivityDate: day(-2)}}
	svc := NewService(repo)

	updated, err := svc.AddXP(context.Background(), repo.profile.UserID, 20)
	require.NoError(t, err)
	assert.Equal(t, 20, updated.XP)
	assert.Equal(t, 3, updated.Streak, "AddXP nao mexe na streak")
}

func TestProfileStreakExibida_ZeroWhenDayWasMissed(t *testing.T) {
	p := &Profile{Streak: 12, LastActivityDate: day(-2)}
	assert.Equal(t, 0, p.StreakExibida(time.Now()), "streak quebrada aparece zerada")

	p.LastActivityDate = day(-1)
	assert.Equal(t, 12, p.StreakExibida(time.Now()), "ontem ainda vale")

	p.LastActivityDate = day(0)
	assert.Equal(t, 12, p.StreakExibida(time.Now()))
}

func TestProfileStreakAtivo(t *testing.T) {
	p := &Profile{LastActivityDate: day(0)}
	assert.True(t, p.StreakAtivo(time.Now()))

	p.LastActivityDate = day(-2)
	assert.False(t, p.StreakAtivo(time.Now()))
}
