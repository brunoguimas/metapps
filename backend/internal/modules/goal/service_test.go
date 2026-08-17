package goal

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeGoalRepository struct {
	createFn func(context.Context, *Goal) (*Goal, error)
}

func (r *fakeGoalRepository) Create(c context.Context, g *Goal) (*Goal, error) {
	return r.createFn(c, g)
}

func (r *fakeGoalRepository) ListByUserID(context.Context, uuid.UUID) ([]*Goal, error) {
	return nil, nil
}
func (r *fakeGoalRepository) GetByID(context.Context, uuid.UUID, uuid.UUID) (*Goal, error) {
	return nil, nil
}
func (r *fakeGoalRepository) Update(context.Context, *Goal) error                { return nil }
func (r *fakeGoalRepository) Delete(context.Context, uuid.UUID, uuid.UUID) error { return nil }

func TestGoalServiceCreate_Success(t *testing.T) {
	userID := uuid.New()
	settings := GoalSettings{Motivation: "passar no vestibular"}
	var received *Goal

	service := NewGoalService(&fakeGoalRepository{
		createFn: func(_ context.Context, g *Goal) (*Goal, error) {
			received = g
			return &Goal{
				ID:       uuid.New(),
				UserID:   g.UserID,
				Title:    g.Title,
				Settings: g.Settings,
			}, nil
		},
	})

	result, err := service.Create(context.Background(), userID, &goalRequest{
		Title:       "Vestibular",
		Settings:    settings,
		hasSettings: true,
	})

	require.NoError(t, err)
	require.NotNil(t, received)
	assert.Equal(t, userID, received.UserID)
	assert.Equal(t, "Vestibular", received.Title)
	assert.Equal(t, settings, received.Settings)
	assert.Equal(t, "Vestibular", result.Title)
}
