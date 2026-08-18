package goal

import (
	"context"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type GoalService interface {
	Create(c context.Context, userID uuid.UUID, g *GoalRequest) (*Goal, error)
	List(c context.Context, userID uuid.UUID) ([]*Goal, error)
	Get(c context.Context, userID, goalID uuid.UUID) (*Goal, error)
	Update(c context.Context, userID, goalID uuid.UUID, g *GoalRequest) error
	Delete(c context.Context, userID, goalID uuid.UUID) error
}

type goalService struct {
	repo GoalRepository
}

func NewGoalService(r GoalRepository) GoalService {
	return &goalService{repo: r}
}

func (s *goalService) Create(c context.Context, userID uuid.UUID, g *GoalRequest) (*Goal, error) {
	goal := &Goal{
		UserID:   userID,
		Title:    g.Title,
		Settings: g.Settings,
	}

	goal, err := s.repo.Create(c, goal)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}

		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't create goal", err)
	}
	return goal, nil
}

func (s *goalService) List(c context.Context, userID uuid.UUID) ([]*Goal, error) {
	goals, err := s.repo.ListByUserID(c, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list goals", err)
	}
	return goals, nil
}

func (s *goalService) Get(c context.Context, userID, goalID uuid.UUID) (*Goal, error) {
	goal, err := s.repo.GetByID(c, userID, goalID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get goal", err)
	}
	return goal, nil
}

func (s *goalService) Update(c context.Context, userID, goalID uuid.UUID, g *GoalRequest) error {
	if err := s.repo.Update(c, &Goal{
		ID:       goalID,
		UserID:   userID,
		Title:    g.Title,
		Settings: g.Settings,
	}); err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return appErr
		}
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't update goal", err)
	}

	return nil
}

func (s *goalService) Delete(c context.Context, userID, goalID uuid.UUID) error {
	if err := s.repo.Delete(c, userID, goalID); err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return appErr
		}
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't delete goal", err)
	}
	return nil
}