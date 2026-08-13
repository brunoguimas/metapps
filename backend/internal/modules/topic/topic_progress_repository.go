package topic

import (
	"context"
	"database/sql"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/google/uuid"
)

// TopicProgressRepository defines the interface for topic progress operations.
type TopicProgressRepository interface {
	// GetOrCreate returns the topic progress for the given user and topic.
	// If it doesn't exist, it creates a new one with default values.
	GetOrCreate(ctx context.Context, userID, topicID uuid.UUID) (*TopicProgress, error)
	// Update saves the given topic progress.
	Update(ctx context.Context, progress *TopicProgress) error
}

type topicProgressRepository struct {
	queries *db.Queries
}

// NewTopicProgressRepository creates a new TopicProgressRepository.
func NewTopicProgressRepository(q *db.Queries) TopicProgressRepository {
	return &topicProgressRepository{
		queries: q,
	}
}

// GetOrCreate retrieves the topic progress for the user and topic.
// If it doesn't exist, it creates a new one with default scores zero,
// attempts count zero, and status LOCKED.
func (r *topicProgressRepository) GetOrCreate(ctx context.Context, userID, topicID uuid.UUID) (*TopicProgress, error) {
	// Try to fetch existing progress.
	row, err := r.queries.GetTopicProgressByUserIDAndTopicID(ctx, db.GetTopicProgressByUserIDAndTopicIDParams{
		UserID: userID,
		TopicID: topicID,
	})
	if err == nil {
		// Map the row to TopicProgress.
		return &TopicProgress{
			ID:              row.ID,
			UserID:          row.UserID,
			TopicID:         row.TopicID,
			MasteryScore:    row.MasteryScore,
			ConfidenceScore: row.ConfidenceScore,
			AttemptsCount:   row.AttemptsCount,
			Status:          TopicStatus(row.Status),
			EvolutionStage:  row.EvolutionStage,
			CreatedAt:       row.CreatedAt,
			UpdatedAt:       row.UpdatedAt,
		}, nil
	}
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// No existing progress; create a new one.
	createdRow, err := r.queries.CreateTopicProgress(ctx, db.CreateTopicProgressParams{
		UserID:         userID,
		TopicID:        topicID,
		MasteryScore:   0,
		ConfidenceScore: 0,
		AttemptsCount:  0,
		Status:         db.TopicStatusLOCKED,
	})
	if err != nil {
		return nil, err
	}
	return &TopicProgress{
		ID:           createdRow.ID,
		UserID:       createdRow.UserID,
		TopicID:      createdRow.TopicID,
		MasteryScore: createdRow.MasteryScore,
		ConfidenceScore: createdRow.ConfidenceScore,
		AttemptsCount: createdRow.AttemptsCount,
		Status:       TopicStatus(createdRow.Status),
		EvolutionStage: createdRow.EvolutionStage,
		CreatedAt:    createdRow.CreatedAt,
		UpdatedAt:    createdRow.UpdatedAt,
	}, nil
}

// Update saves the given topic progress.
func (r *topicProgressRepository) Update(ctx context.Context, progress *TopicProgress) error {
	_, err := r.queries.UpdateTopicProgress(ctx, db.UpdateTopicProgressParams{
		ID:             progress.ID,
		MasteryScore:   progress.MasteryScore,
		ConfidenceScore: progress.ConfidenceScore,
		AttemptsCount:  progress.AttemptsCount,
		Status:         db.TopicStatus(progress.Status),
	})
	return err
}