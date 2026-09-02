package profile

import (
	"context"
	"database/sql"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	"github.com/google/uuid"
)

type Repository interface {
	GetByUserID(ctx context.Context, userID uuid.UUID) (*Profile, error)
	Create(ctx context.Context, profile *Profile) (*Profile, error)
	Update(ctx context.Context, profile *Profile) (*Profile, error)
}

type profileRepository struct {
	queries *db.Queries
}

func NewRepository(q *db.Queries) Repository {
	return &profileRepository{
		queries: q,
	}
}

func (r *profileRepository) GetByUserID(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	row, err := r.queries.GetProfileByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return mapProfile(row), nil
}

func (r *profileRepository) Create(ctx context.Context, profile *Profile) (*Profile, error) {
	row, err := r.queries.CreateProfile(ctx, db.CreateProfileParams{
		ID:               profile.ID,
		UserID:           profile.UserID,
		Xp:               int32(profile.XP),
		Streak:           int32(profile.Streak),
		LastActivityDate: profile.LastActivityDate,
		AvatarUrl:        sql.NullString{String: profile.AvatarURL, Valid: profile.AvatarURL != ""},
		CreatedAt:        profile.CreatedAt,
		UpdatedAt:        profile.UpdatedAt,
	})
	if err != nil {
		return nil, err
	}

	return mapProfile(row), nil
}

func (r *profileRepository) Update(ctx context.Context, profile *Profile) (*Profile, error) {
	row, err := r.queries.UpdateProfile(ctx, db.UpdateProfileParams{
		ID:               profile.ID,
		Xp:               int32(profile.XP),
		Streak:           int32(profile.Streak),
		LastActivityDate: profile.LastActivityDate,
		AvatarUrl:        sql.NullString{String: profile.AvatarURL, Valid: profile.AvatarURL != ""},
		UpdatedAt:        profile.UpdatedAt,
	})
	if err != nil {
		return nil, err
	}

	return mapProfile(row), nil
}

func mapProfile(row db.Profile) *Profile {
	avatarURL := ""
	if row.AvatarUrl.Valid {
		avatarURL = row.AvatarUrl.String
	}

	return &Profile{
		ID:               row.ID,
		UserID:           row.UserID,
		XP:               int(row.Xp),
		Streak:           int(row.Streak),
		LastActivityDate: row.LastActivityDate,
		AvatarURL:        avatarURL,
		CreatedAt:        row.CreatedAt,
		UpdatedAt:        row.UpdatedAt,
	}
}
