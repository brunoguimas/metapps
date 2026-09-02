package mail

import (
	"context"
	"testing"
	"time"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/brunoguimas/metapps/backend/internal/testutil/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRepositoryUpsertAndGet_Success(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	repo := NewRepository(queries)

	err := repo.UpsertEmailCode(context.Background(), &EmailCode{
		UserID:      user.ID,
		Type:        "email_verification",
		CodeHash:    "hash123",
		Attempts:    0,
		MaxAttempts: 3,
		ExpiresAt:   time.Now().Add(time.Hour),
	})
	require.NoError(t, err)

	result, err := repo.GetEmailCode(context.Background(), user.ID, "email_verification")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, user.ID, result.UserID)
	assert.Equal(t, "hash123", result.CodeHash)
}

func TestRepositoryGet_FailNotFound(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	repo := NewRepository(queries)
	result, err := repo.GetEmailCode(context.Background(), uuid.New(), "email_verification")

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidOrExpiredEmailCode, appErr.Code())
}
