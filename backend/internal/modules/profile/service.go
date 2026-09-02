package profile

import (
	"context"
	"time"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type ProfileService interface {
	GetProfileByUserID(ctx context.Context, userID uuid.UUID) (*Profile, error)
	CreateProfile(ctx context.Context, userID uuid.UUID) (*Profile, error)
	UpdateProfile(ctx context.Context, profile *Profile) (*Profile, error)
	// AddXP adds XP to the user's profile and updates streak if applicable.
	AddXP(ctx context.Context, userID uuid.UUID, xpToAdd int) (*Profile, error)
	// UpdateAvatar updates the avatar URL for the user's profile.
	UpdateAvatar(ctx context.Context, userID uuid.UUID, avatarURL string) (*Profile, error)
}

type profileService struct {
	repo ProfileRepository
}

func NewProfileService(repo ProfileRepository) ProfileService {
	return &profileService{repo}
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
		LastActivityDate: time.Now().UTC().Truncate(24 * time.Hour), // today at 00:00:00 UTC
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

	// Add XP
	profile.XP += xpToAdd

	// Update streak and last activity date
	today := time.Now().UTC().Truncate(24 * time.Hour)
	if profile.LastActivityDate.IsZero() {
		// First activity
		profile.Streak = 1
		profile.LastActivityDate = today
	} else {
		yesterday := today.AddDate(0, 0, -1)
		if profile.LastActivityDate.Equal(yesterday) {
			profile.Streak++
			profile.LastActivityDate = today
		} else if profile.LastActivityDate.Equal(today) {
		} else {
			profile.Streak = 1
			profile.LastActivityDate = today
		}
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

