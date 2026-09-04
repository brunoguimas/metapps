package flashcard

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type Repository interface {
	Create(ctx context.Context, f *Flashcard) (*Flashcard, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Flashcard, error)
	ListByTopic(ctx context.Context, topicID uuid.UUID) ([]*Flashcard, error)
	Update(ctx context.Context, f *Flashcard) (*Flashcard, error)
	Delete(ctx context.Context, id uuid.UUID) error

	UpsertProgress(ctx context.Context, p *FlashcardProgress) (*FlashcardProgress, error)
	GetProgress(ctx context.Context, userID, flashcardID uuid.UUID) (*FlashcardProgress, error)
	UpdateProgress(ctx context.Context, p *FlashcardProgress) (*FlashcardProgress, error)

	ListByUserAndTopic(ctx context.Context, userID, topicID uuid.UUID) ([]*DeckCard, error)
	ListDueByUser(ctx context.Context, userID uuid.UUID, limit int32) ([]*DeckCard, error)
	ListDueByTopicIDs(ctx context.Context, userID uuid.UUID, topicIDs []uuid.UUID, limit int32) ([]*DeckCard, error)
}

type flashcardRepository struct {
	queries *db.Queries
}

func NewRepository(q *db.Queries) Repository {
	return &flashcardRepository{queries: q}
}

func (r *flashcardRepository) Create(ctx context.Context, f *Flashcard) (*Flashcard, error) {
	row, err := r.queries.CreateFlashcard(ctx, db.CreateFlashcardParams{
		UserID:  f.UserID,
		TopicID: f.TopicID,
		Source:  db.FlashcardSource(f.Source),
		Front:   f.Front,
		Back:    f.Back,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperrors.NewAppError(apperrors.ErrFlashcardDuplicate, "flashcard with this front already exists for this topic", err)
		}
		return nil, err
	}
	return mapFlashcard(row), nil
}

func (r *flashcardRepository) GetByID(ctx context.Context, id uuid.UUID) (*Flashcard, error) {
	row, err := r.queries.GetFlashcardByID(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrFlashcardNotFound, "flashcard not found", err)
		}
		return nil, err
	}
	return mapFlashcard(row), nil
}

func (r *flashcardRepository) ListByTopic(ctx context.Context, topicID uuid.UUID) ([]*Flashcard, error) {
	rows, err := r.queries.ListFlashcardsByTopic(ctx, topicID)
	if err != nil {
		return nil, err
	}
	cards := make([]*Flashcard, 0, len(rows))
	for _, row := range rows {
		cards = append(cards, mapFlashcard(row))
	}
	return cards, nil
}

func (r *flashcardRepository) Update(ctx context.Context, f *Flashcard) (*Flashcard, error) {
	row, err := r.queries.UpdateFlashcard(ctx, db.UpdateFlashcardParams{
		ID:    f.ID,
		Front: f.Front,
		Back:  f.Back,
	})
	if err != nil {
		return nil, err
	}
	return mapFlashcard(row), nil
}

func (r *flashcardRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteFlashcard(ctx, id)
}

func (r *flashcardRepository) UpsertProgress(ctx context.Context, p *FlashcardProgress) (*FlashcardProgress, error) {
	row, err := r.queries.CreateFlashcardProgress(ctx, db.CreateFlashcardProgressParams{
		UserID:       p.UserID,
		FlashcardID:  p.FlashcardID,
		EaseFactor:   p.EaseFactor,
		IntervalDays: p.IntervalDays,
		Repetitions:  p.Repetitions,
		NextReviewAt: p.NextReviewAt,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return r.GetProgress(ctx, p.UserID, p.FlashcardID)
		}
		return nil, err
	}
	return mapProgress(row), nil
}

func (r *flashcardRepository) GetProgress(ctx context.Context, userID, flashcardID uuid.UUID) (*FlashcardProgress, error) {
	row, err := r.queries.GetFlashcardProgressByUserAndCard(ctx, db.GetFlashcardProgressByUserAndCardParams{
		UserID:      userID,
		FlashcardID: flashcardID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrFlashcardNotFound, "no progress for this flashcard", err)
		}
		return nil, err
	}
	return mapProgress(row), nil
}

func (r *flashcardRepository) UpdateProgress(ctx context.Context, p *FlashcardProgress) (*FlashcardProgress, error) {
	row, err := r.queries.UpdateFlashcardProgress(ctx, db.UpdateFlashcardProgressParams{
		ID:           p.ID,
		EaseFactor:   p.EaseFactor,
		IntervalDays: p.IntervalDays,
		Repetitions:  p.Repetitions,
		NextReviewAt: p.NextReviewAt,
	})
	if err != nil {
		return nil, err
	}
	return mapProgress(row), nil
}

func (r *flashcardRepository) ListByUserAndTopic(ctx context.Context, userID, topicID uuid.UUID) ([]*DeckCard, error) {
	rows, err := r.queries.ListCardProgressByUserAndTopic(ctx, db.ListCardProgressByUserAndTopicParams{
		UserID:  userID,
		TopicID: topicID,
	})
	if err != nil {
		return nil, err
	}
	cards := make([]*DeckCard, 0, len(rows))
	for _, row := range rows {
		cards = append(cards, mapDeckCardFromRow(row))
	}
	return cards, nil
}

func (r *flashcardRepository) ListDueByUser(ctx context.Context, userID uuid.UUID, limit int32) ([]*DeckCard, error) {
	rows, err := r.queries.ListDueFlashcardProgressByUser(ctx, db.ListDueFlashcardProgressByUserParams{
		UserID: userID,
		Limit:  limit,
	})
	if err != nil {
		return nil, err
	}
	cards := make([]*DeckCard, 0, len(rows))
	for _, row := range rows {
		cards = append(cards, mapDueCard(row.FlashcardID, row.TopicID, Source(row.Source), row.Front, row.Back, progressFromDue(row.ID, row.UserID, row.FlashcardID, row.EaseFactor, row.IntervalDays, row.Repetitions, row.NextReviewAt, row.LastReviewedAt)))
	}
	return cards, nil
}

func (r *flashcardRepository) ListDueByTopicIDs(ctx context.Context, userID uuid.UUID, topicIDs []uuid.UUID, limit int32) ([]*DeckCard, error) {
	rows, err := r.queries.ListDueFlashcardProgressByTopicIDs(ctx, db.ListDueFlashcardProgressByTopicIDsParams{
		UserID:  userID,
		Column2: topicIDs,
		Limit:   limit,
	})
	if err != nil {
		return nil, err
	}
	cards := make([]*DeckCard, 0, len(rows))
	for _, row := range rows {
		cards = append(cards, mapDueCard(row.FlashcardID, row.TopicID, Source(row.Source), row.Front, row.Back, progressFromDue(row.ID, row.UserID, row.FlashcardID, row.EaseFactor, row.IntervalDays, row.Repetitions, row.NextReviewAt, row.LastReviewedAt)))
	}
	return cards, nil
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}

func mapFlashcard(u db.Flashcard) *Flashcard {
	return &Flashcard{
		ID:        u.ID,
		UserID:    u.UserID,
		TopicID:   u.TopicID,
		Source:    Source(u.Source),
		Front:     u.Front,
		Back:      u.Back,
		CreatedAt: u.CreatedAt,
		UpdatedAt: u.UpdatedAt,
	}
}

func mapProgress(p db.FlashcardProgress) *FlashcardProgress {
	return &FlashcardProgress{
		ID:             p.ID,
		UserID:         p.UserID,
		FlashcardID:    p.FlashcardID,
		EaseFactor:     p.EaseFactor,
		IntervalDays:   p.IntervalDays,
		Repetitions:    p.Repetitions,
		NextReviewAt:   p.NextReviewAt,
		LastReviewedAt: nullTimePtr(p.LastReviewedAt),
	}
}

func mapDeckCardFromRow(row db.ListCardProgressByUserAndTopicRow) *DeckCard {
	card := &DeckCard{
		FlashcardID: row.FlashcardID,
		TopicID:     row.TopicID,
		Source:      Source(row.Source),
		Front:       row.Front,
		Back:        row.Back,
	}
	if row.ProgressID.Valid {
		card.Progress = &FlashcardProgress{
			ID:             row.ProgressID.UUID,
			FlashcardID:    row.FlashcardID,
			EaseFactor:     sqlStrToFloat(row.EaseFactor),
			IntervalDays:   row.IntervalDays.Int32,
			Repetitions:    row.Repetitions.Int32,
			NextReviewAt:   row.NextReviewAt.Time,
			LastReviewedAt: nullTimePtr(row.LastReviewedAt),
		}
	}
	return card
}

func mapDueCard(flashcardID, topicID uuid.UUID, source Source, front, back string, prog *FlashcardProgress) *DeckCard {
	card := &DeckCard{
		FlashcardID: flashcardID,
		TopicID:     topicID,
		Source:      source,
		Front:       front,
		Back:        back,
		Progress:    prog,
	}
	return card
}

func progressFromDue(id, userID, flashcardID uuid.UUID, ease float64, interval, reps int32, next time.Time, last sql.NullTime) *FlashcardProgress {
	return &FlashcardProgress{
		ID:             id,
		UserID:         userID,
		FlashcardID:    flashcardID,
		EaseFactor:     ease,
		IntervalDays:   interval,
		Repetitions:    reps,
		NextReviewAt:   next,
		LastReviewedAt: nullTimePtr(last),
	}
}

func sqlStrToFloat(s sql.NullString) float64 {
	if !s.Valid {
		return 0
	}
	f, _ := strconv.ParseFloat(s.String, 64)
	return f
}

func nullTimePtr(t sql.NullTime) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time
	return &v
}
