package daily_activity

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Service interface {
	Record(c context.Context, userID uuid.UUID, xp, exercises, lessons, seconds int) (*DailyActivity, error)
	Today(c context.Context, userID uuid.UUID) (*DailyActivity, error)
	Range(c context.Context, userID uuid.UUID, from, to time.Time) ([]*DailyActivity, error)
	Recent(c context.Context, userID uuid.UUID, limit int) ([]*DailyActivity, error)
}

type dailyActivityService struct {
	repo Repository
}

func NewService(r Repository) Service {
	return &dailyActivityService{repo: r}
}

// Record soma a atividade do dia.
//
// Todos os valores sao incrementos: o upsert no banco soma ao que ja
// existia, entao chamar duas vezes no mesmo dia acumula corretamente.
func (s *dailyActivityService) Record(c context.Context, userID uuid.UUID, xp, exercises, lessons, seconds int) (*DailyActivity, error) {
	return s.repo.Upsert(c, userID, Today(), xp, exercises, lessons, seconds)
}

func (s *dailyActivityService) Today(c context.Context, userID uuid.UUID) (*DailyActivity, error) {
	activity, err := s.repo.Get(c, userID, Today())
	if err != nil {
		return nil, err
	}
	if activity == nil {
		return &DailyActivity{
			UserID:       userID,
			ActivityDate: Today(),
		}, nil
	}
	return activity, nil
}

func (s *dailyActivityService) Range(c context.Context, userID uuid.UUID, from, to time.Time) ([]*DailyActivity, error) {
	return s.repo.ListRange(c, userID, from, to)
}

func (s *dailyActivityService) Recent(c context.Context, userID uuid.UUID, limit int) ([]*DailyActivity, error) {
	return s.repo.ListRecent(c, userID, limit)
}

// Today devolve a data de hoje (UTC) truncada, no formato aceito pelo
// Postgres para colunas DATE.
func Today() time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}
