package task

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/brunoguimas/metapps/backend/internal/testutil/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRepositoryCreate_Success(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	goal := dbtest.CreateGoal(t, queries, user.ID, "ENEM", json.RawMessage(`{"math":"hard"}`))
	topic := dbtest.CreateTopic(t, queries, goal.ID, "Topic 1", "Desc 1")
	repo := NewRepository(queries)

	result, err := repo.Create(context.Background(), &Task{
		UserID:  user.ID,
		TopicID: topic.ID,
		Type:    TaskEssay,
		Meta: TaskMeta{
			Title:        "Redacao",
			Description:  "Tema",
			Expectations: "Coerencia",
		},
		Content: json.RawMessage(`{"material":[],"instructions":"Escreva","min_words":100,"max_words":200}`),
	})

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, user.ID, result.UserID)
	assert.Equal(t, topic.ID, result.TopicID)
	assert.Equal(t, TaskEssay, result.Type)
	assert.Equal(t, "Redacao", result.Meta.Title)
}

func TestRepositoryGetByID_FailNotFound(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	repo := NewRepository(queries)

	result, err := repo.GetByID(context.Background(), user.ID, uuid.New())

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrTaskNotFound, appErr.Code())
}

func TestRepositoryMarkDone_Success(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	goal := dbtest.CreateGoal(t, queries, user.ID, "ENEM", json.RawMessage(`{"math":"hard"}`))
	topic := dbtest.CreateTopic(t, queries, goal.ID, "Topic 1", "Desc 1")
	created := dbtest.CreateTask(t, queries, user.ID, topic.ID, json.RawMessage(`{"meta":{"title":"Quiz","description":"Tema","expectations":"Acertar"},"content":{"questions":[]}}`), string(TaskQuiz))
	repo := NewRepository(queries)

	result, err := repo.MarkDone(context.Background(), user.ID, created.ID)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.True(t, result.Done)
	require.NotNil(t, result.DoneAt)
}
