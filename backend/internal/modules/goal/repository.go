package goal

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type GoalRepository interface {
	Create(c context.Context, g *Goal) (*Goal, error)
	ListByUserID(c context.Context, userID uuid.UUID) ([]*Goal, error)
	GetByID(c context.Context, userID, goalID uuid.UUID) (*Goal, error)
	Update(c context.Context, g *Goal) error
	Delete(c context.Context, userID, goalID uuid.UUID) error
}

type goalRepository struct {
	queries *db.Queries
}

func NewGoalRepository(q *db.Queries) GoalRepository {
	return &goalRepository{queries: q}
}

func (r *goalRepository) Create(c context.Context, g *Goal) (*Goal, error) {
	s, err := settingsToRawMessage(g.Settings)
	if err != nil {
		return nil, err
	}

	goal, err := r.queries.CreateOneGoal(c, db.CreateOneGoalParams{
		UserID:   g.UserID,
		Title:    g.Title,
		Settings: s,
	})
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, apperrors.NewAppError(apperrors.ErrGoalAlreadyExists, "goal title already exists", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create goal", err)
	}

	return mapGoal(goal)
}

func (r *goalRepository) ListByUserID(c context.Context, userID uuid.UUID) ([]*Goal, error) {
	goals, err := r.queries.GetGoalsByUserID(c, userID)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list goals", err)
	}

	items := make([]*Goal, 0, len(goals))
	for _, g := range goals {
		mapped, err := mapGoal(g)
		if err != nil {
			return nil, err
		}
		items = append(items, mapped)
	}
	return items, nil
}

func (r *goalRepository) GetByID(c context.Context, userID, goalID uuid.UUID) (*Goal, error) {
	g, err := r.queries.GetGoalByID(c, db.GetGoalByIDParams{ID: goalID, UserID: userID})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrGoalNotFound, "goal not found", err)
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get goal", err)
	}

	return mapGoal(g)
}

func (r *goalRepository) Update(c context.Context, g *Goal) error {
	s, err := settingsToRawMessage(g.Settings)
	if err != nil {
		return err
	}

	_, err = r.queries.UpdateGoalByID(c, db.UpdateGoalByIDParams{
		Title:    g.Title,
		Settings: s,
		ID:       g.ID,
		UserID:   g.UserID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return apperrors.NewAppError(apperrors.ErrGoalNotFound, "goal not found", err)
		}
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't update goal", err)
	}

	return nil
}

func (r *goalRepository) Delete(c context.Context, userID, goalID uuid.UUID) error {
	_, err := r.queries.DeleteGoalByID(c, db.DeleteGoalByIDParams{ID: goalID, UserID: userID})
	if err != nil {
		if err == sql.ErrNoRows {
			return apperrors.NewAppError(apperrors.ErrGoalNotFound, "goal not found", err)
		}
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't delete goal", err)
	}

	return nil
}

func mapGoal(g db.Goal) (*Goal, error) {
	var settings GoalSettings
	if err := json.Unmarshal(g.Settings, &settings); err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "failed to unmarshal goal settings", err)
	}
	return &Goal{
		ID:        g.ID,
		UserID:    g.UserID,
		Title:     g.Title,
		Settings:  settings,
		CreatedAt: g.CreatedAt,
	}, nil
}

func settingsToRawMessage(s GoalSettings) (json.RawMessage, error) {
	settings, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}

	return json.RawMessage(settings), nil
}
