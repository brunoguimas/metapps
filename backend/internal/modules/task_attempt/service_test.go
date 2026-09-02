package task_attempt

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeRepository struct {
	createFn func(context.Context, *TaskAttempt) (*TaskAttempt, error)
}

func (r *fakeRepository) Create(c context.Context, attempt *TaskAttempt) (*TaskAttempt, error) {
	return r.createFn(c, attempt)
}

func (r *fakeRepository) GetByID(context.Context, uuid.UUID) (*TaskAttempt, error) {
	return nil, nil
}
func (r *fakeRepository) ListByUser(context.Context, uuid.UUID) ([]*TaskAttempt, error) {
	return nil, nil
}
func (r *fakeRepository) ListByUserAndTask(context.Context, uuid.UUID, uuid.UUID) ([]*TaskAttempt, error) {
	return nil, nil
}

type fakeRepositoryAttempt struct {
	getByIDFn  func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error)
	markDoneFn func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error)
}

func (r *fakeRepositoryAttempt) Create(context.Context, *task.Task) (*task.Task, error) {
	return nil, nil
}
func (r *fakeRepositoryAttempt) GetByUserID(context.Context, uuid.UUID) ([]*task.Task, error) {
	return nil, nil
}
func (r *fakeRepositoryAttempt) GetByID(c context.Context, userID, id uuid.UUID) (*task.Task, error) {
	return r.getByIDFn(c, userID, id)
}
func (r *fakeRepositoryAttempt) MarkDone(c context.Context, userID, id uuid.UUID) (*task.Task, error) {
	return r.markDoneFn(c, userID, id)
}

func TestServiceSubmit_Success(t *testing.T) {
	userID := uuid.New()
	taskID := uuid.New()
	score := 1.0
	var created *TaskAttempt

	service := NewService(
		&fakeRepository{
			createFn: func(_ context.Context, attempt *TaskAttempt) (*TaskAttempt, error) {
				created = attempt
				attempt.ID = uuid.New()
				return attempt, nil
			},
		},
		&fakeRepositoryAttempt{
			getByIDFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{
					ID:      taskID,
					UserID:  userID,
					Type:    task.TaskQuiz,
					Content: json.RawMessage(`{"questions":[{"statement":"2+2","alternatives":["3","4"],"answer":1,"explanation":"4"}]}`),
				}, nil
			},
			markDoneFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{ID: taskID, Done: true}, nil
			},
		},
	)

	result, updatedTask, err := service.Submit(context.Background(), userID, taskID, &CreateAttemptInput{
		Type:     task.TaskQuiz,
		Response: json.RawMessage(`[{"question_index":0,"answer":1}]`),
	})

	require.NoError(t, err)
	require.NotNil(t, created)
	require.NotNil(t, result)
	require.NotNil(t, updatedTask)
	assert.Equal(t, StatusProcessed, created.Status)
	require.NotNil(t, created.Score)
	assert.Equal(t, score, *created.Score)
	assert.True(t, updatedTask.Done)
}

func TestServiceSubmit_Fail(t *testing.T) {
	service := NewService(
		&fakeRepository{
			createFn: func(context.Context, *TaskAttempt) (*TaskAttempt, error) {
				t.Fatal("Create should not be called")
				return nil, nil
			},
		},
		&fakeRepositoryAttempt{
			getByIDFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{Type: task.TaskEssay}, nil
			},
			markDoneFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				t.Fatal("MarkDone should not be called")
				return nil, nil
			},
		},
	)

	result, updatedTask, err := service.Submit(context.Background(), uuid.New(), uuid.New(), &CreateAttemptInput{
		Type:     task.TaskQuiz,
		Response: json.RawMessage(`[{"question_index":0,"answer":1}]`),
	})

	require.Error(t, err)
	require.Nil(t, result)
	require.Nil(t, updatedTask)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrTaskAttemptTypeMismatch, appErr.Code())
}
