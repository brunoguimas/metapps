package jwt

import (
	"context"
	"testing"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/testutil/dbtest"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJWTRepositoryCreateRefreshToken_Success(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	repo := NewJWTRepository(queries)

	id, err := repo.CreateRefreshToken(context.Background(), user.ID, time.Now().Add(time.Hour))

	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, id)
}

func TestJWTRepositoryGetRefreshToken_FailNotFound(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	repo := NewJWTRepository(queries)

	result, err := repo.GetRefreshToken(context.Background(), uuid.New())

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidToken, appErr.Code())
}

func TestJWTRepositoryRevokeRefreshToken_Success(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	repo := NewJWTRepository(queries)
	id, err := repo.CreateRefreshToken(context.Background(), user.ID, time.Now().Add(time.Hour))
	require.NoError(t, err)

	err = repo.RevokeRefreshToken(context.Background(), id)
	require.NoError(t, err)

	token, err := repo.GetRefreshToken(context.Background(), id)
	require.Error(t, err)
	assert.Nil(t, token)
}
