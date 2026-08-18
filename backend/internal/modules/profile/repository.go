package profile

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/google/uuid"
	"database/sql"
)

// ProfileRepository defines the interface for profile storage.
type ProfileRepository interface {
	GetByUserID(ctx context.Context, userID uuid.UUID) (*Profile, error)
	Create(ctx context.Context, profile *Profile) (*Profile, error)
	Update(ctx context.Context, profile *Profile) (*Profile, error)
}

// profileRepository implements ProfileRepository using database queries.
type profileRepository struct {
	queries *db.Queries
}

// NewProfileRepository creates a new ProfileRepository.
func NewProfileRepository(queries *db.Queries) ProfileRepository {
	return &profileRepository{
		queries: queries,
	}
}

// GetByUserID returns the profile for the given user ID.
func (r *profileRepository) GetByUserID(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	dbProfile, err := r.queries.GetProfileByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	return dbProfileToModel(&dbProfile), nil
}

// Create creates a new profile.
func (r *profileRepository) Create(ctx context.Context, profile *Profile) (*Profile, error) {
	dbProfile := modelToCreateParams(profile)
	createdDBProfile, err := r.queries.CreateProfile(ctx, dbProfile)
	if err != nil {
		return nil, err
	}
	return dbProfileToModel(&createdDBProfile), nil
}

// Update updates an existing profile.
func (r *profileRepository) Update(ctx context.Context, profile *Profile) (*Profile, error) {
	dbProfile := modelToUpdateParams(profile)
	updatedDBProfile, err := r.queries.UpdateProfile(ctx, dbProfile)
	if err != nil {
		return nil, err
	}
	return dbProfileToModel(&updatedDBProfile), nil
}

// dbProfileToModel converts a db.Profile to a module Profile.
func dbProfileToModel(db *db.Profile) *Profile {
	if db == nil {
		return nil
	}
	avatarURL := ""
	if db.AvatarUrl.Valid {
		avatarURL = db.AvatarUrl.String
	}
	return &Profile{
		ID:             db.ID,
		UserID:         db.UserID,
		XP:             int(db.Xp),
		Streak:         int(db.Streak),
		LastActivityDate: db.LastActivityDate,
		AvatarURL:      avatarURL,
		CreatedAt:      db.CreatedAt,
		UpdatedAt:      db.UpdatedAt,
	}
}

// modelToCreateParams converts a module Profile to db.CreateProfileParams.
func modelToCreateParams(p *Profile) db.CreateProfileParams {
	return db.CreateProfileParams{
		ID:                p.ID,
		UserID:            p.UserID,
		Xp:                int32(p.XP),
		Streak:            int32(p.Streak),
		LastActivityDate:  p.LastActivityDate,
		AvatarUrl:         sql.NullString{String: p.AvatarURL, Valid: p.AvatarURL != ""},
		CreatedAt:         p.CreatedAt,
		UpdatedAt:         p.UpdatedAt,
	}
}

// modelToUpdateParams converts a module Profile to db.UpdateProfileParams.
// Note: UpdateProfileParams does not include UserID or CreatedAt.
func modelToUpdateParams(p *Profile) db.UpdateProfileParams {
	return db.UpdateProfileParams{
		ID:                p.ID,
		Xp:                int32(p.XP),
		Streak:            int32(p.Streak),
		LastActivityDate:  p.LastActivityDate,
		AvatarUrl:         sql.NullString{String: p.AvatarURL, Valid: p.AvatarURL != ""},
		UpdatedAt:         p.UpdatedAt,
	}
}