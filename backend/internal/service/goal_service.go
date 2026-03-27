package service

import (
	"context"
	"encoding/json"

	apperrors "github.com/brunoguimas/metapps/backend/internal/error"
	"github.com/brunoguimas/metapps/backend/internal/models"
	"github.com/brunoguimas/metapps/backend/internal/repository"
	"github.com/google/uuid"
)

type GoalService interface {
	Create(c context.Context, userID uuid.UUID, title string, difficulties json.RawMessage) (*models.Goal, error)
	List(c context.Context, userID uuid.UUID) ([]*models.Goal, error)
	Get(c context.Context, userID, goalID uuid.UUID) (*models.Goal, error)
	Update(c context.Context, userID, goalID uuid.UUID, title string, difficulties json.RawMessage) error
	Delete(c context.Context, userID, goalID uuid.UUID) error
}

type goalService struct {
	repo repository.GoalRepository
}

func NewGoalService(r repository.GoalRepository) GoalService {
	return &goalService{repo: r}
}

func (s *goalService) Create(c context.Context, userID uuid.UUID, title string, difficulties json.RawMessage) (*models.Goal, error) {
	if title == "" {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "title is required", nil)
	}
	if len(difficulties) > 0 && !json.Valid(difficulties) {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid difficulties json", nil)
	}

	g := &models.Goal{
		UserID:       userID,
		Title:        title,
		Difficulties: difficulties,
	}

	return s.repo.Create(c, g)
}

func (s *goalService) List(c context.Context, userID uuid.UUID) ([]*models.Goal, error) {
	return s.repo.ListByUserID(c, userID)
}

func (s *goalService) Get(c context.Context, userID, goalID uuid.UUID) (*models.Goal, error) {
	return s.repo.GetByID(c, userID, goalID)
}

func (s *goalService) Update(c context.Context, userID, goalID uuid.UUID, title string, difficulties json.RawMessage) error {
	if title == "" {
		return apperrors.NewAppError(apperrors.ErrInvalidInput, "title is required", nil)
	}
	if len(difficulties) > 0 && !json.Valid(difficulties) {
		return apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid difficulties json", nil)
	}

	return s.repo.Update(c, &models.Goal{
		ID:           goalID,
		UserID:       userID,
		Title:        title,
		Difficulties: difficulties,
	})
}

func (s *goalService) Delete(c context.Context, userID, goalID uuid.UUID) error {
	return s.repo.Delete(c, userID, goalID)
}
