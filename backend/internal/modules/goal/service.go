package goal

import (
	"context"
	"encoding/json"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type GoalService interface {
	Create(c context.Context, userID uuid.UUID, title string, difficulties json.RawMessage) (*Goal, error)
	List(c context.Context, userID uuid.UUID) ([]*Goal, error)
	Get(c context.Context, userID, goalID uuid.UUID) (*Goal, error)
	Update(c context.Context, userID, goalID uuid.UUID, title string, difficulties json.RawMessage) error
	Delete(c context.Context, userID, goalID uuid.UUID) error
}

type goalService struct {
	repo GoalRepository
}

func NewGoalService(r GoalRepository) GoalService {
	return &goalService{repo: r}
}

func (s *goalService) Create(c context.Context, userID uuid.UUID, title string, difficulties json.RawMessage) (*Goal, error) {
	if title == "" {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "title is required", nil)
	}
	if len(difficulties) > 0 && !json.Valid(difficulties) {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid difficulties json", nil)
	}

	g := &Goal{
		UserID:       userID,
		Title:        title,
		Difficulties: difficulties,
	}

	goal, err := s.repo.Create(c, g)
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

func (s *goalService) Update(c context.Context, userID, goalID uuid.UUID, title string, difficulties json.RawMessage) error {
	if title == "" {
		return apperrors.NewAppError(apperrors.ErrInvalidInput, "title is required", nil)
	}
	if len(difficulties) > 0 && !json.Valid(difficulties) {
		return apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid difficulties json", nil)
	}

	if err := s.repo.Update(c, &Goal{
		ID:           goalID,
		UserID:       userID,
		Title:        title,
		Difficulties: difficulties,
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
