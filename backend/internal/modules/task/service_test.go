package task

import (
	"context"
	"errors"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeAIClient struct {
	generateFn func(string) (string, error)
}

func (c *fakeAIClient) Generate(prompt string) (string, error) {
	return c.generateFn(prompt)
}

type fakeTaskRepository struct {
	createFn func(context.Context, *Task) (*Task, error)
	getFn    func(context.Context, uuid.UUID, uuid.UUID) (*Task, error)
	markFn   func(context.Context, uuid.UUID, uuid.UUID) (*Task, error)
}

func (r *fakeTaskRepository) Create(c context.Context, t *Task) (*Task, error) { return r.createFn(c, t) }
func (r *fakeTaskRepository) GetByUserID(context.Context, uuid.UUID) ([]*Task, error) {
	return nil, nil
}
func (r *fakeTaskRepository) GetByID(c context.Context, userID, id uuid.UUID) (*Task, error) {
	if r.getFn != nil {
		return r.getFn(c, userID, id)
	}
	return nil, nil
}
func (r *fakeTaskRepository) MarkDone(c context.Context, userID, id uuid.UUID) (*Task, error) {
	if r.markFn != nil {
		return r.markFn(c, userID, id)
	}
	return nil, nil
}

type fakeGoalRepositoryTask struct {
	getByIDFn func(context.Context, uuid.UUID, uuid.UUID) (*goal.Goal, error)
}

func (r *fakeGoalRepositoryTask) Create(context.Context, *goal.Goal) (*goal.Goal, error) { return nil, nil }
func (r *fakeGoalRepositoryTask) ListByUserID(context.Context, uuid.UUID) ([]*goal.Goal, error) {
	return nil, nil
}
func (r *fakeGoalRepositoryTask) GetByID(c context.Context, userID, goalID uuid.UUID) (*goal.Goal, error) {
	return r.getByIDFn(c, userID, goalID)
}
func (r *fakeGoalRepositoryTask) Update(context.Context, *goal.Goal) error { return nil }
func (r *fakeGoalRepositoryTask) Delete(context.Context, uuid.UUID, uuid.UUID) error { return nil }

func TestTaskServiceCreate_Success(t *testing.T) {
	userID := uuid.New()
	goalID := uuid.New()
	var createdTask *Task

	service := NewTaskService(
		&fakeAIClient{
			generateFn: func(prompt string) (string, error) {
				assert.Contains(t, prompt, "ENEM")
				return `{"type":"essay","meta":{"title":"Redacao","description":"Tema","expectations":"Coerencia"},"content":{"material":[],"instructions":"Escreva","min_words":100,"max_words":200}}`, nil
			},
		},
		&fakeTaskRepository{
			createFn: func(_ context.Context, t *Task) (*Task, error) {
				createdTask = t
				t.ID = uuid.New()
				return t, nil
			},
		},
		&fakeGoalRepositoryTask{
			getByIDFn: func(context.Context, uuid.UUID, uuid.UUID) (*goal.Goal, error) {
				return &goal.Goal{ID: goalID, UserID: userID, Title: "ENEM", Difficulties: []byte(`{"history":"medium"}`)}, nil
			},
		},
		&config.Config{},
	)

	result, err := service.Create(context.Background(), userID, goalID)

	require.NoError(t, err)
	require.NotNil(t, createdTask)
	assert.Equal(t, TaskEssay, createdTask.Type)
	assert.Equal(t, "Redacao", createdTask.Meta.Title)
	assert.Equal(t, createdTask.ID, result.ID)
}

func TestTaskServiceCreate_Fail(t *testing.T) {
	service := NewTaskService(
		&fakeAIClient{
			generateFn: func(string) (string, error) {
				return `{"type":"invalid","meta":{"title":"x","description":"y","expectations":"z"},"content":{}}`, nil
			},
		},
		&fakeTaskRepository{
			createFn: func(context.Context, *Task) (*Task, error) {
				t.Fatal("Create should not be called on invalid AI response")
				return nil, nil
			},
		},
		&fakeGoalRepositoryTask{
			getByIDFn: func(context.Context, uuid.UUID, uuid.UUID) (*goal.Goal, error) {
				return &goal.Goal{Title: "ENEM"}, nil
			},
		},
		&config.Config{},
	)

	result, err := service.Create(context.Background(), uuid.New(), uuid.New())

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidAIResponse, appErr.Code())
}

var _ ai.Client = (*fakeAIClient)(nil)
var _ error = errors.New("")
