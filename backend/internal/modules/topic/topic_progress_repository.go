package topic

import (
	"context"
	"database/sql"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/google/uuid"
)

type ProgressRepository interface {
	GetOrCreate(ctx context.Context, userID, topicID uuid.UUID) (*TopicProgress, error)
	Update(ctx context.Context, progress *TopicProgress) error
}

type topicProgressRepository struct {
	queries *db.Queries
}

func NewProgressRepository(q *db.Queries) ProgressRepository {
	return &topicProgressRepository{
		queries: q,
	}
}

func (r *topicProgressRepository) GetOrCreate(ctx context.Context, userID, topicID uuid.UUID) (*TopicProgress, error) {
	row, err := r.queries.GetTopicProgressByUserIDAndTopicID(ctx, db.GetTopicProgressByUserIDAndTopicIDParams{
		UserID:  userID,
		TopicID: topicID,
	})
	if err == nil {
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
	if err != sql.ErrNoRows {
		return nil, err
	}

	createdRow, err := r.queries.CreateTopicProgress(ctx, db.CreateTopicProgressParams{
		UserID:          userID,
		TopicID:         topicID,
		MasteryScore:    0,
		ConfidenceScore: 0,
		AttemptsCount:   0,
		Status:          db.TopicStatusLOCKED,
	})
	if err != nil {
		return nil, err
	}
	return &TopicProgress{
		ID:              createdRow.ID,
		UserID:          createdRow.UserID,
		TopicID:         createdRow.TopicID,
		MasteryScore:    createdRow.MasteryScore,
		ConfidenceScore: createdRow.ConfidenceScore,
		AttemptsCount:   createdRow.AttemptsCount,
		Status:          TopicStatus(createdRow.Status),
		EvolutionStage:  createdRow.EvolutionStage,
		CreatedAt:       createdRow.CreatedAt,
		UpdatedAt:       createdRow.UpdatedAt,
	}, nil
}

func (r *topicProgressRepository) Update(ctx context.Context, progress *TopicProgress) error {
	_, err := r.queries.UpdateTopicProgress(ctx, db.UpdateTopicProgressParams{
		ID:              progress.ID,
		MasteryScore:    progress.MasteryScore,
		ConfidenceScore: progress.ConfidenceScore,
		AttemptsCount:   progress.AttemptsCount,
		Status:          db.TopicStatus(progress.Status),
	})
	return err
}
