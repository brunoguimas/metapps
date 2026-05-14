package goal

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/testutil/dbtest"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGoalRepositoryCreate_Success(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	repo := NewGoalRepository(queries)

	result, err := repo.Create(context.Background(), &Goal{
		UserID:       user.ID,
		Title:        "ENEM",
		Difficulties: json.RawMessage(`{"math":"hard"}`),
	})

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, user.ID, result.UserID)
	assert.Equal(t, "ENEM", result.Title)
}

func TestGoalRepositoryCreate_FailDuplicate(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	repo := NewGoalRepository(queries)

	_, err := repo.Create(context.Background(), &Goal{
		UserID:       user.ID,
		Title:        "ENEM",
		Difficulties: json.RawMessage(`{"math":"hard"}`),
	})
	require.NoError(t, err)

	result, err := repo.Create(context.Background(), &Goal{
		UserID:       user.ID,
		Title:        "ENEM",
		Difficulties: json.RawMessage(`{"math":"hard"}`),
	})

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrGoalAlreadyExists, appErr.Code())
}

func TestGoalRepositoryGetByID_FailNotFound(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	repo := NewGoalRepository(queries)

	result, err := repo.GetByID(context.Background(), user.ID, uuid.New())

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrGoalNotFound, appErr.Code())
}
