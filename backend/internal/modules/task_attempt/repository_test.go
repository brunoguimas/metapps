package task_attempt

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/testutil/dbtest"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTaskAttemptRepositoryCreate_Success(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	goal := dbtest.CreateGoal(t, queries, user.ID, "ENEM", json.RawMessage(`{"math":"hard"}`))
	taskRow := dbtest.CreateTask(t, queries, user.ID, goal.ID, json.RawMessage(`{"meta":{"title":"Quiz","description":"Tema","expectations":"Acertar"},"content":{"questions":[]}}`), string(task.TaskQuiz))
	repo := NewRepository(queries)
	score := 0.75

	result, err := repo.Create(context.Background(), &TaskAttempt{
		UserID:         user.ID,
		TaskID:         taskRow.ID,
		Content:        json.RawMessage(`{"type":"quiz","response":[{"question_index":0,"answer":1}]}`),
		Score:          &score,
		Status:         StatusProcessed,
		TaskEvaluation: json.RawMessage(`{"total_questions":1,"correct_answers":1}`),
	})

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, user.ID, result.UserID)
	assert.Equal(t, taskRow.ID, result.TaskID)
	require.NotNil(t, result.Score)
	assert.Equal(t, score, *result.Score)
}

func TestTaskAttemptRepositoryCreate_FailInvalidContent(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	goal := dbtest.CreateGoal(t, queries, user.ID, "ENEM", json.RawMessage(`{"math":"hard"}`))
	taskRow := dbtest.CreateTask(t, queries, user.ID, goal.ID, json.RawMessage(`{"meta":{"title":"Quiz","description":"Tema","expectations":"Acertar"},"content":{"questions":[]}}`), string(task.TaskQuiz))
	repo := NewRepository(queries)

	result, err := repo.Create(context.Background(), &TaskAttempt{
		UserID:         user.ID,
		TaskID:         taskRow.ID,
		Content:        json.RawMessage(`{`),
		Status:         StatusProcessed,
		TaskEvaluation: json.RawMessage(`{"total_questions":1}`),
	})

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidInput, appErr.Code())
}

func TestTaskAttemptRepositoryGetByID_FailNotFound(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	repo := NewRepository(queries)
	result, err := repo.GetByID(context.Background(), uuid.New())

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrTaskAttemptNotFound, appErr.Code())
}
