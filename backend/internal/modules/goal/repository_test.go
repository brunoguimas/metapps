package goal

import (
	"context"
	"testing"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/brunoguimas/metapps/backend/internal/testutil/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRepositoryCreate_Success(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	repo := NewRepository(queries)

	result, err := repo.Create(context.Background(), &Goal{
		UserID:   user.ID,
		Title:    "ENEM",
		Settings: GoalSettings{Motivation: "passar no ENEM"},
	})

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, user.ID, result.UserID)
	assert.Equal(t, "ENEM", result.Title)
}

func TestRepositoryCreate_FailDuplicate(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	repo := NewRepository(queries)

	_, err := repo.Create(context.Background(), &Goal{
		UserID:   user.ID,
		Title:    "ENEM",
		Settings: GoalSettings{Motivation: "passar no ENEM"},
	})
	require.NoError(t, err)

	result, err := repo.Create(context.Background(), &Goal{
		UserID:   user.ID,
		Title:    "ENEM",
		Settings: GoalSettings{Motivation: "passar no ENEM"},
	})

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrGoalAlreadyExists, appErr.Code())
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
	assert.Equal(t, apperrors.ErrGoalNotFound, appErr.Code())
}
