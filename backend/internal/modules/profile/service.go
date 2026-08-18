package profile

import (
	"context"
	"time"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

// ProfileService defines the interface for profile operations.
type ProfileService interface {
	GetProfileByUserID(ctx context.Context, userID uuid.UUID) (*Profile, error)
	CreateProfile(ctx context.Context, userID uuid.UUID) (*Profile, error)
	UpdateProfile(ctx context.Context, profile *Profile) (*Profile, error)
	// AddXP adds XP to the user's profile and updates streak if applicable.
	AddXP(ctx context.Context, userID uuid.UUID, xpToAdd int) (*Profile, error)
	// UpdateAvatar updates the avatar URL for the user's profile.
	UpdateAvatar(ctx context.Context, userID uuid.UUID, avatarURL string) (*Profile, error)
}

// profileService implements ProfileService.
type profileService struct {
	repo ProfileRepository
}

// NewProfileService returns a new ProfileService.
func NewProfileService(repo ProfileRepository) ProfileService {
	return &profileService{repo}
}

// GetProfileByUserID returns the profile for the given user ID.
func (s *profileService) GetProfileByUserID(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	return s.repo.GetByUserID(ctx, userID)
}

// CreateProfile creates a new profile for the given user ID.
func (s *profileService) CreateProfile(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	// Check if profile already exists
	existing, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		// If the error is not that the profile doesn't exist, return the error
		appErr, ok := apperrors.As(err)
		if !ok || appErr.Code() != apperrors.ErrProfileNotFound {
			return nil, err
		}
		// If it's ErrProfileNotFound, we can proceed to create
	}
	if existing != nil {
		return nil, apperrors.NewAppError(apperrors.ErrProfileAlreadyExists, "profile already exists for user", nil)
	}

	// Create new profile with default values
	profile := &Profile{
		UserID:           userID,
		XP:               0,
		Streak:           0,
		LastActivityDate: time.Now().UTC().Truncate(24 * time.Hour), // today at 00:00:00 UTC
		AvatarURL:        "", // empty avatar URL
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}
	return s.repo.Create(ctx, profile)
}

// UpdateProfile updates the given profile.
func (s *profileService) UpdateProfile(ctx context.Context, profile *Profile) (*Profile, error) {
	profile.UpdatedAt = time.Now().UTC()
	return s.repo.Update(ctx, profile)
}

// AddXP adds XP to the user's profile and updates streak if applicable.
// It returns the updated profile.
func (s *profileService) AddXP(ctx context.Context, userID uuid.UUID, xpToAdd int) (*Profile, error) {
	// Get current profile
	profile, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, err
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
			// Consecutive day
			profile.Streak++
			profile.LastActivityDate = today
		} else if profile.LastActivityDate.Equal(today) {
			// Same day, do nothing to streak
		} else {
			// Streak broken
			profile.Streak = 1
			profile.LastActivityDate = today
		}
	}

	// Update the profile
	return s.repo.Update(ctx, profile)
}

// UpdateAvatar updates the avatar URL for the user's profile.
func (s *profileService) UpdateAvatar(ctx context.Context, userID uuid.UUID, avatarURL string) (*Profile, error) {
	profile, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	profile.AvatarURL = avatarURL
	return s.repo.Update(ctx, profile)
}