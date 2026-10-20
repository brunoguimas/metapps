package review

import (
	"context"
	"math"
	"time"

	"github.com/google/uuid"
)

type Service interface {
	// Schedule registra (ou reagenda) um exercicio na fila de revisao.
	//
	// `correct` diz como o usuario foi na ultima vez: errou => volta
	// amanha; acertou => o intervalo cresce.
	Schedule(c context.Context, userID, taskID uuid.UUID, stepIndex int, questionHash string, correct bool) (*ReviewItem, error)
	Due(c context.Context, userID uuid.UUID, limit int) ([]*ReviewItem, error)
	CountDue(c context.Context, userID uuid.UUID) (int, error)
	All(c context.Context, userID uuid.UUID, limit int) ([]*ReviewItem, error)
}

type reviewService struct {
	repo Repository
}

func NewService(r Repository) Service {
	return &reviewService{repo: r}
}

func (s *reviewService) Schedule(c context.Context, userID, taskID uuid.UUID, stepIndex int, questionHash string, correct bool) (*ReviewItem, error) {
	existing, err := s.repo.GetByHash(c, userID, questionHash)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()

	if existing == nil {
		// Item novo. Um exercicio errado entra na fila amanha; um acertado
		// ja entra com um intervalo curto, para ser consolidado.
		interval := MinIntervalDays
		if correct {
			interval = 3
		}
		return s.repo.Upsert(c, &ReviewItem{
			UserID:       userID,
			TaskID:       taskID,
			StepIndex:    stepIndex,
			QuestionHash: questionHash,
			Ease:         DefaultEase,
			IntervalDays: interval,
			Lapses:       0,
			DueAt:        now.AddDate(0, 0, interval),
		})
	}

	item := existing
	item.TaskID = taskID
	item.StepIndex = stepIndex

	if correct {
		item.IntervalDays = nextInterval(item.IntervalDays, item.Ease)
		item.Lapses = 0
	} else {
		item.IntervalDays = MinIntervalDays
		item.Lapses++
		item.Ease = math.Max(1.3, item.Ease-0.2)
	}

	item.DueAt = now.AddDate(0, 0, item.IntervalDays)

	return s.repo.Upsert(c, item)
}

func (s *reviewService) Due(c context.Context, userID uuid.UUID, limit int) ([]*ReviewItem, error) {
	return s.repo.ListDue(c, userID, limit)
}

func (s *reviewService) CountDue(c context.Context, userID uuid.UUID) (int, error) {
	return s.repo.CountDue(c, userID)
}

func (s *reviewService) All(c context.Context, userID uuid.UUID, limit int) ([]*ReviewItem, error) {
	return s.repo.ListAll(c, userID, limit)
}

// nextInterval calcula o proximo intervalo de revisao.
//
// A sequencia 1 -> 3 -> 7 -> 21 dias mantem o exercicio em rotacao sem
// deixar o usuario preso no mesmo material.
func nextInterval(interval int, ease float64) int {
	var next int
	switch {
	case interval <= 1:
		next = 3
	case interval < 7:
		next = 7
	default:
		next = int(math.Round(float64(interval) * ease))
	}

	if next < MinIntervalDays {
		next = MinIntervalDays
	}
	if next > MaxIntervalDays {
		next = MaxIntervalDays
	}
	return next
}
