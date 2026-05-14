package goal

import (
	"context"
	"encoding/json"
	"testing"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
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

func (r *fakeGoalRepository) ListByUserID(context.Context, uuid.UUID) ([]*Goal, error) { return nil, nil }
func (r *fakeGoalRepository) GetByID(context.Context, uuid.UUID, uuid.UUID) (*Goal, error) {
	return nil, nil
}
func (r *fakeGoalRepository) Update(context.Context, *Goal) error { return nil }
func (r *fakeGoalRepository) Delete(context.Context, uuid.UUID, uuid.UUID) error { return nil }

func TestGoalServiceCreate_Success(t *testing.T) {
	userID := uuid.New()
	difficulties := json.RawMessage(`{"math":"hard"}`)
	var received *Goal

	service := NewGoalService(&fakeGoalRepository{
		createFn: func(_ context.Context, g *Goal) (*Goal, error) {
			received = g
			return &Goal{
				ID:           uuid.New(),
				UserID:       g.UserID,
				Title:        g.Title,
				Difficulties: g.Difficulties,
			}, nil
		},
	})

	result, err := service.Create(context.Background(), userID, "Vestibular", difficulties)

	require.NoError(t, err)
	require.NotNil(t, received)
	assert.Equal(t, userID, received.UserID)
	assert.Equal(t, "Vestibular", received.Title)
	assert.JSONEq(t, string(difficulties), string(received.Difficulties))
	assert.Equal(t, "Vestibular", result.Title)
}

func TestGoalServiceCreate_Fail(t *testing.T) {
	service := NewGoalService(&fakeGoalRepository{
		createFn: func(context.Context, *Goal) (*Goal, error) {
			t.Fatal("Create should not be called")
			return nil, nil
		},
	})

	result, err := service.Create(context.Background(), uuid.New(), "", json.RawMessage(`{"math":"hard"}`))

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidInput, appErr.Code())
}
