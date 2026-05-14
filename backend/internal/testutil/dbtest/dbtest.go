package dbtest

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func Setup(t *testing.T) (*sql.DB, *db.Queries) {
	t.Helper()
	godotenv.Load()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}

	conn, err := sql.Open("postgres", dsn)
	require.NoError(t, err)

	if err := conn.Ping(); err != nil {
		_ = conn.Close()
		t.Skipf("test database unavailable: %v", err)
	}

	t.Cleanup(func() {
		_ = conn.Close()
	})

	return conn, db.New(conn)
}

func Clean(t *testing.T, conn *sql.DB) {
	t.Helper()
	_, err := conn.Exec(`
		TRUNCATE TABLE
			task_attempts,
			tasks,
			email_codes,
			oauth_accounts,
			refresh_tokens,
			goals,
			users
		RESTART IDENTITY CASCADE;
	`)
	require.NoError(t, err)
}

func CreateUser(t *testing.T, queries *db.Queries, username, email string) db.User {
	t.Helper()
	u, err := queries.CreateOneUser(context.Background(), db.CreateOneUserParams{
		Username: username,
		Email:    email,
		PasswordHash: sql.NullString{
			String: "test-hash",
			Valid:  true,
		},
	})
	require.NoError(t, err)
	return u
}

func CreateGoal(t *testing.T, queries *db.Queries, userID uuid.UUID, title string, difficulties json.RawMessage) db.Goal {
	t.Helper()
	g, err := queries.CreateOneGoal(context.Background(), db.CreateOneGoalParams{
		UserID:       userID,
		Title:        title,
		Difficulties: difficulties,
	})
	require.NoError(t, err)
	return g
}

func CreateTask(t *testing.T, queries *db.Queries, userID, goalID uuid.UUID, content json.RawMessage, taskType string) db.Task {
	t.Helper()
	task, err := queries.CreateTask(context.Background(), db.CreateTaskParams{
		UserID:  userID,
		GoalID:  goalID,
		Content: content,
		Type:    taskType,
	})
	require.NoError(t, err)
	return task
}
