package user

import (
	"context"
	"database/sql"
	"os"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTest(t *testing.T) *sql.DB {
	t.Helper()
	godotenv.Load()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}

	conn, err := sql.Open("postgres", dsn)
	require.NoError(t, err)

	err = conn.Ping()
	if err != nil {
		_ = conn.Close()
		t.Skipf("test database unavailable: %v", err)
	}

	return conn
}

func cleanTables(t *testing.T, db *sql.DB) {
	_, err := db.Exec(`
		TRUNCATE TABLE users RESTART IDENTITY CASCADE;
	`)
	require.NoError(t, err)
}

func TestRepository_Create_Success(t *testing.T) {
	conn := setupTest(t)
	cleanTables(t, conn)
	queries := db.New(conn)
	r := NewRepository(queries)

	user := &User{
		Username:     "bruno",
		Email:        "bruno@test.com",
		PasswordHash: "hashdosixseven",
	}

	result, err := r.Create(context.Background(), user)
	require.NoError(t, err)

	assert.NotNil(t, result)
	assert.Equal(t, result.Email, user.Email)
	assert.NotEqual(t, uuid.Nil, result.ID)
}

func TestRepository_Create_FailUserAlreadyExists(t *testing.T) {
	conn := setupTest(t)
	cleanTables(t, conn)
	queries := db.New(conn)
	r := NewRepository(queries)

	user := &User{
		Username:     "bruno",
		Email:        "bruno@test.com",
		PasswordHash: "hashdosixseven",
	}

	r.Create(context.Background(), user)

	result, err := r.Create(context.Background(), user)
	require.Error(t, err)
	require.Nil(t, result)

	appErr, ok := apperrors.As(err)
	assert.Equal(t, appErr.Code(), apperrors.ErrEmailAlreadyInUse)
	assert.True(t, ok)
}
