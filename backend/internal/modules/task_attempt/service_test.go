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

type fakeTaskAttemptRepository struct {
	createFn func(context.Context, *TaskAttempt) (*TaskAttempt, error)
}

func (r *fakeTaskAttemptRepository) Create(c context.Context, attempt *TaskAttempt) (*TaskAttempt, error) {
	return r.createFn(c, attempt)
}

func (r *fakeTaskAttemptRepository) GetByID(context.Context, uuid.UUID) (*TaskAttempt, error) { return nil, nil }
func (r *fakeTaskAttemptRepository) ListByUser(context.Context, uuid.UUID) ([]*TaskAttempt, error) {
	return nil, nil
}
func (r *fakeTaskAttemptRepository) ListByUserAndTask(context.Context, uuid.UUID, uuid.UUID) ([]*TaskAttempt, error) {
	return nil, nil
}

type fakeTaskRepositoryAttempt struct {
	getByIDFn  func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error)
	markDoneFn func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error)
}

func (r *fakeTaskRepositoryAttempt) Create(context.Context, *task.Task) (*task.Task, error) { return nil, nil }
func (r *fakeTaskRepositoryAttempt) GetByUserID(context.Context, uuid.UUID) ([]*task.Task, error) {
	return nil, nil
}
func (r *fakeTaskRepositoryAttempt) GetByID(c context.Context, userID, id uuid.UUID) (*task.Task, error) {
	return r.getByIDFn(c, userID, id)
}
func (r *fakeTaskRepositoryAttempt) MarkDone(c context.Context, userID, id uuid.UUID) (*task.Task, error) {
	return r.markDoneFn(c, userID, id)
}

func TestTaskAttemptServiceSubmit_Success(t *testing.T) {
	userID := uuid.New()
	taskID := uuid.New()
	score := 1.0
	var created *TaskAttempt

	service := NewService(
		&fakeTaskAttemptRepository{
			createFn: func(_ context.Context, attempt *TaskAttempt) (*TaskAttempt, error) {
				created = attempt
				attempt.ID = uuid.New()
				return attempt, nil
			},
		},
		&fakeTaskRepositoryAttempt{
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

func TestTaskAttemptServiceSubmit_Fail(t *testing.T) {
	service := NewService(
		&fakeTaskAttemptRepository{
			createFn: func(context.Context, *TaskAttempt) (*TaskAttempt, error) {
				t.Fatal("Create should not be called")
				return nil, nil
			},
		},
		&fakeTaskRepositoryAttempt{
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
