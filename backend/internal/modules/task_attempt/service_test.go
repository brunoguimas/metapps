package task_attempt

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeTopicRepositoryAttempt struct {
	getFn func(context.Context, uuid.UUID) (*topic.Topic, error)
}

func (r *fakeTopicRepositoryAttempt) Create(context.Context, *topic.Topic) (*topic.Topic, error) { return nil, nil }
func (r *fakeTopicRepositoryAttempt) Get(c context.Context, id uuid.UUID) (*topic.Topic, error) {
	if r.getFn != nil {
		return r.getFn(c, id)
	}
	return nil, nil
}
func (r *fakeTopicRepositoryAttempt) GetByGoalID(context.Context, uuid.UUID) ([]*topic.Topic, error) { return nil, nil }

type fakeProfileServiceAttempt struct {
	addXPFn func(context.Context, uuid.UUID, int) (*profile.Profile, error)
}

func (f *fakeProfileServiceAttempt) GetProfileByUserID(context.Context, uuid.UUID) (*profile.Profile, error) { return nil, nil }
func (f *fakeProfileServiceAttempt) CreateProfile(context.Context, uuid.UUID) (*profile.Profile, error) { return nil, nil }
func (f *fakeProfileServiceAttempt) UpdateProfile(context.Context, *profile.Profile) (*profile.Profile, error) { return nil, nil }
func (f *fakeProfileServiceAttempt) AddXP(c context.Context, userID uuid.UUID, xp int) (*profile.Profile, error) {
	if f.addXPFn != nil {
		return f.addXPFn(c, userID, xp)
	}
	return nil, nil
}
func (f *fakeProfileServiceAttempt) UpdateAvatar(context.Context, uuid.UUID, string) (*profile.Profile, error) { return nil, nil }

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
	topicID := uuid.New()
	score := 1.0
	var created *TaskAttempt
	addXPCount := 0

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
					TopicID: topicID,
					Type:    task.TaskQuiz,
					Content: json.RawMessage(`{"questions":[{"statement":"2+2","alternatives":["3","4"],"answer":1,"explanation":"4"}]}`),
				}, nil
			},
			markDoneFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{ID: taskID, Done: true}, nil
			},
		},
		&fakeTopicRepositoryAttempt{
			getFn: func(context.Context, uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: topicID, RequiredMastery: 0.7, Weight: 2.5}, nil
			},
		},
		&fakeProfileServiceAttempt{
			addXPFn: func(_ context.Context, _ uuid.UUID, xp int) (*profile.Profile, error) {
				addXPCount++
				return &profile.Profile{XP: xp}, nil
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
	assert.Equal(t, 1, addXPCount, "XP deve ser concedido ao dominar o tópico")
}

func TestTaskAttemptServiceSubmit_NoXPBelowMastery(t *testing.T) {
	userID := uuid.New()
	taskID := uuid.New()
	topicID := uuid.New()
	addXPCount := 0

	service := NewService(
		&fakeTaskAttemptRepository{
			createFn: func(_ context.Context, attempt *TaskAttempt) (*TaskAttempt, error) {
				attempt.ID = uuid.New()
				return attempt, nil
			},
		},
		&fakeTaskRepositoryAttempt{
			getByIDFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{
					ID:      taskID,
					UserID:  userID,
					TopicID: topicID,
					Type:    task.TaskQuiz,
					Content: json.RawMessage(`{"questions":[{"statement":"2+2","alternatives":["3","4"],"answer":1,"explanation":"4"}]}`),
				}, nil
			},
			markDoneFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{ID: taskID, Done: true}, nil
			},
		},
		&fakeTopicRepositoryAttempt{
			getFn: func(context.Context, uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: topicID, RequiredMastery: 0.7, Weight: 2.5}, nil
			},
		},
		&fakeProfileServiceAttempt{
			addXPFn: func(_ context.Context, _ uuid.UUID, xp int) (*profile.Profile, error) {
				addXPCount++
				return &profile.Profile{XP: xp}, nil
			},
		},
	)

	// Resposta errada -> acerto 0/2, abaixo da mastery.
	_, _, err := service.Submit(context.Background(), userID, taskID, &CreateAttemptInput{
		Type:     task.TaskQuiz,
		Response: json.RawMessage(`[{"question_index":0,"answer":0}]`),
	})

	require.NoError(t, err)
	assert.Equal(t, 0, addXPCount, "XP NÃO deve ser concedido abaixo da mastery")
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
		&fakeTopicRepositoryAttempt{},
		&fakeProfileServiceAttempt{},
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
