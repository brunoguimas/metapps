package flashcard

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

func TestRepositoryCreate_Success(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	goal := dbtest.CreateGoal(t, queries, user.ID, "ENEM", json.RawMessage(`{}`))
	topicRow := dbtest.CreateTopic(t, queries, goal.ID, "Topic 1", "Desc 1")
	repo := NewRepository(queries)

	result, err := repo.Create(context.Background(), &Flashcard{
		UserID:  uuid.NullUUID{UUID: user.ID, Valid: true},
		TopicID: topicRow.ID,
		Source:  SourceManual,
		Front:   "Pergunta",
		Back:    "Resposta",
	})

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, user.ID, result.UserID.UUID)
	assert.Equal(t, topicRow.ID, result.TopicID)
	assert.Equal(t, SourceManual, result.Source)
	assert.Equal(t, "Pergunta", result.Front)
}

func TestRepositoryCreate_Duplicate(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	goal := dbtest.CreateGoal(t, queries, user.ID, "ENEM", json.RawMessage(`{}`))
	topicRow := dbtest.CreateTopic(t, queries, goal.ID, "Topic 1", "Desc 1")
	repo := NewRepository(queries)

	card := &Flashcard{
		UserID:  uuid.NullUUID{UUID: user.ID, Valid: true},
		TopicID: topicRow.ID,
		Source:  SourceManual,
		Front:   "Pergunta",
		Back:    "Resposta",
	}

	_, err := repo.Create(context.Background(), card)
	require.NoError(t, err)

	_, err = repo.Create(context.Background(), card)
	require.Error(t, err)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrFlashcardDuplicate, appErr.Code())
}

func TestRepositoryListByUserAndTopic(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	goal := dbtest.CreateGoal(t, queries, user.ID, "ENEM", json.RawMessage(`{}`))
	topicRow := dbtest.CreateTopic(t, queries, goal.ID, "Topic 1", "Desc 1")
	repo := NewRepository(queries)

	for i := 0; i < 3; i++ {
		_, err := repo.Create(context.Background(), &Flashcard{
			UserID:  uuid.NullUUID{UUID: user.ID, Valid: true},
			TopicID: topicRow.ID,
			Source:  SourceManual,
			Front:   "Pergunta " + string(rune('A'+i)),
			Back:    "Resposta",
		})
		require.NoError(t, err)
	}

	cards, err := repo.ListByUserAndTopic(context.Background(), user.ID, topicRow.ID)
	require.NoError(t, err)
	require.Len(t, cards, 3)
}

func TestRepositoryUpsertAndGetProgress(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	goal := dbtest.CreateGoal(t, queries, user.ID, "ENEM", json.RawMessage(`{}`))
	topicRow := dbtest.CreateTopic(t, queries, goal.ID, "Topic 1", "Desc 1")
	repo := NewRepository(queries)

	card, err := repo.Create(context.Background(), &Flashcard{
		UserID:  uuid.NullUUID{UUID: user.ID, Valid: true},
		TopicID: topicRow.ID,
		Source:  SourceAI,
		Front:   "Q",
		Back:    "A",
	})
	require.NoError(t, err)

	progress, err := repo.UpsertProgress(context.Background(), &FlashcardProgress{
		UserID:       user.ID,
		FlashcardID:  card.ID,
		EaseFactor:   2.5,
		IntervalDays: 0,
		Repetitions:  0,
	})
	require.NoError(t, err)
	assert.Equal(t, 2.5, progress.EaseFactor)

	progress.EaseFactor = 2.6
	progress.IntervalDays = 3
	progress.Repetitions = 1

	updated, err := repo.UpdateProgress(context.Background(), progress)
	require.NoError(t, err)
	assert.Equal(t, 2.6, updated.EaseFactor)
	assert.Equal(t, int32(3), updated.IntervalDays)
	assert.Equal(t, int32(1), updated.Repetitions)

	got, err := repo.GetProgress(context.Background(), user.ID, card.ID)
	require.NoError(t, err)
	assert.Equal(t, 2.6, got.EaseFactor)
}

func TestRepositoryDelete(t *testing.T) {
	conn, queries := dbtest.Setup(t)
	dbtest.Clean(t, conn)

	user := dbtest.CreateUser(t, queries, "bruno", "bruno@test.com")
	goal := dbtest.CreateGoal(t, queries, user.ID, "ENEM", json.RawMessage(`{}`))
	topicRow := dbtest.CreateTopic(t, queries, goal.ID, "Topic 1", "Desc 1")
	repo := NewRepository(queries)

	created, err := repo.Create(context.Background(), &Flashcard{
		UserID:  uuid.NullUUID{UUID: user.ID, Valid: true},
		TopicID: topicRow.ID,
		Source:  SourceManual,
		Front:   "Q",
		Back:    "A",
	})
	require.NoError(t, err)

	err = repo.Delete(context.Background(), created.ID)
	require.NoError(t, err)

	_, err = repo.GetByID(context.Background(), created.ID)
	require.Error(t, err)
}
