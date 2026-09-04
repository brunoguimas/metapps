package profile

import (
	"context"
	"time"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Service interface {
	GetProfileByUserID(ctx context.Context, userID uuid.UUID) (*Profile, error)
	CreateProfile(ctx context.Context, userID uuid.UUID) (*Profile, error)
	UpdateProfile(ctx context.Context, profile *Profile) (*Profile, error)
	AddXP(ctx context.Context, userID uuid.UUID, xpToAdd int) (*Profile, error)
	UpdateAvatar(ctx context.Context, userID uuid.UUID, avatarURL string) (*Profile, error)
}

type profileService struct {
	repo Repository
}

func NewService(r Repository) Service {
	return &profileService{repo: r}
}

func (s *profileService) GetProfileByUserID(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	return s.repo.GetByUserID(ctx, userID)
}

func (s *profileService) CreateProfile(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	existing, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			if appErr.Code() != apperrors.ErrProfileNotFound {
				return nil, appErr
			}
		} else {
			return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user profile", err)
		}
	}
	if existing != nil {
		return nil, apperrors.NewAppError(apperrors.ErrProfileAlreadyExists, "profile already exists for user", nil)
	}

	profile := &Profile{
		UserID:           userID,
		XP:               0,
		Streak:           0,
		LastActivityDate: time.Now().UTC().Truncate(24 * time.Hour),
		AvatarURL:        "",
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}
	return s.repo.Create(ctx, profile)
}

func (s *profileService) UpdateProfile(ctx context.Context, profile *Profile) (*Profile, error) {
	profile.UpdatedAt = time.Now().UTC()
	return s.repo.Update(ctx, profile)
}

func (s *profileService) AddXP(ctx context.Context, userID uuid.UUID, xpToAdd int) (*Profile, error) {
	profile, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user profile", err)
	}

	profile.XP += xpToAdd

	today := time.Now().UTC().Truncate(24 * time.Hour)
	if profile.LastActivityDate.IsZero() {
		profile.Streak = 1
		profile.LastActivityDate = today
	} else if profile.LastActivityDate.Equal(today.AddDate(0, 0, -1)) {
		profile.Streak++
		profile.LastActivityDate = today
	} else if !profile.LastActivityDate.Equal(today) {
		profile.Streak = 1
		profile.LastActivityDate = today
	}

	return s.repo.Update(ctx, profile)
}

func (s *profileService) UpdateAvatar(ctx context.Context, userID uuid.UUID, avatarURL string) (*Profile, error) {
	profile, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user profile", err)
	}
	profile.AvatarURL = avatarURL
	return s.repo.Update(ctx, profile)
}
