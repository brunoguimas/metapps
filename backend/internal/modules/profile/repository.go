package profile

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/brunoguimas/metapps/backend/internal/shared/gamification"
	"github.com/google/uuid"
)

type Repository interface {
	GetByUserID(ctx context.Context, userID uuid.UUID) (*Profile, error)
	Create(ctx context.Context, profile *Profile) (*Profile, error)
	Update(ctx context.Context, profile *Profile) (*Profile, error)
	AddXP(ctx context.Context, id uuid.UUID, xp int) (*Profile, error)
	UpdateStreak(ctx context.Context, id uuid.UUID, streak int, lastActivity time.Time) (*Profile, error)
	UpdateDailyGoal(ctx context.Context, id uuid.UUID, dailyGoalXP int) (*Profile, error)
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
		if err == sql.ErrNoRows {
			return nil, apperrors.NewAppError(apperrors.ErrProfileNotFound, "profile not found", err)
		}
		return nil, err
	}

	return mapProfile(row), nil
}

func (r *profileRepository) Create(ctx context.Context, profile *Profile) (*Profile, error) {
	dailyGoal := profile.DailyGoalXP
	if dailyGoal <= 0 {
		dailyGoal = gamification.DefaultDailyGoalXP
	}

	row, err := r.queries.CreateProfile(ctx, db.CreateProfileParams{
		ID:               profile.ID,
		UserID:           profile.UserID,
		Xp:               int32(profile.XP),
		Streak:           int32(profile.Streak),
		LastActivityDate: profile.LastActivityDate,
		AvatarUrl:        sql.NullString{String: profile.AvatarURL, Valid: profile.AvatarURL != ""},
		DailyGoalXp:      int32(dailyGoal),
		CreatedAt:        profile.CreatedAt,
		UpdatedAt:        profile.UpdatedAt,
	})
	if err != nil {
		return nil, err
	}

	return mapProfile(row), nil
}

func (r *profileRepository) Update(ctx context.Context, profile *Profile) (*Profile, error) {
	dailyGoal := profile.DailyGoalXP
	if dailyGoal <= 0 {
		dailyGoal = gamification.DefaultDailyGoalXP
	}

	row, err := r.queries.UpdateProfile(ctx, db.UpdateProfileParams{
		ID:               profile.ID,
		Xp:               int32(profile.XP),
		Streak:           int32(profile.Streak),
		LastActivityDate: profile.LastActivityDate,
		AvatarUrl:        sql.NullString{String: profile.AvatarURL, Valid: profile.AvatarURL != ""},
		DailyGoalXp:      int32(dailyGoal),
		UpdatedAt:        profile.UpdatedAt,
	})
	if err != nil {
		return nil, err
	}

	return mapProfile(row), nil
}

// AddXP soma XP ao perfil sem mexer na streak.
//
// A streak e responsabilidade de TouchActivity: assim, estudar sem
// dominar o topico tambem conta como atividade do dia.
func (r *profileRepository) AddXP(ctx context.Context, id uuid.UUID, xp int) (*Profile, error) {
	row, err := r.queries.AddProfileXP(ctx, db.AddProfileXPParams{
		ID: id,
		Xp: int32(xp),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't add xp", err)
	}
	return mapProfile(row), nil
}

func (r *profileRepository) UpdateStreak(ctx context.Context, id uuid.UUID, streak int, lastActivity time.Time) (*Profile, error) {
	row, err := r.queries.UpdateProfileStreak(ctx, db.UpdateProfileStreakParams{
		ID:              id,
		Streak:          int32(streak),
		LastActivityDate: lastActivity,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't update streak", err)
	}
	return mapProfile(row), nil
}

func (r *profileRepository) UpdateDailyGoal(ctx context.Context, id uuid.UUID, dailyGoalXP int) (*Profile, error) {
	row, err := r.queries.UpdateProfileDailyGoal(ctx, db.UpdateProfileDailyGoalParams{
		ID:          id,
		DailyGoalXp: int32(dailyGoalXP),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't update daily goal", err)
	}
	return mapProfile(row), nil
}

func mapProfile(row db.Profile) *Profile {
	avatarURL := ""
	if row.AvatarUrl.Valid {
		avatarURL = row.AvatarUrl.String
	}

	dailyGoal := int(row.DailyGoalXp)
	if dailyGoal <= 0 {
		dailyGoal = gamification.DefaultDailyGoalXP
	}

	return &Profile{
		ID:               row.ID,
		UserID:           row.UserID,
		XP:               int(row.Xp),
		Streak:           int(row.Streak),
		LastActivityDate: row.LastActivityDate,
		AvatarURL:        NormalizeAvatarURL(avatarURL),
		DailyGoalXP:      dailyGoal,
		CreatedAt:        row.CreatedAt,
		UpdatedAt:        row.UpdatedAt,
	}
}

// NormalizeAvatarURL conserta URLs salvas antes da correção do prefixo.
//
// Os uploads antigos gravaram "http://host/uuid.jpg" (sem o /avatars), que
// aponta para uma rota inexistente. Sem isto, quem já tinha foto continuaria
// sem vê-la mesmo depois do handler ser arrumado.
func NormalizeAvatarURL(raw string) string {
	if raw == "" {
		return ""
	}

	// Só normaliza URL absoluta de host que não tem o prefixo.
	// URL relativa (ou já correta) é devolvida como está.
	idx := strings.Index(raw, "://")
	if idx < 0 {
		return raw
	}

	pathStart := idx + 3
	slash := strings.Index(raw[pathStart:], "/")
	if slash < 0 {
		return raw
	}

	host := raw[:pathStart+slash]
	path := raw[pathStart+slash:]

	if strings.HasPrefix(path, AvatarPath+"/") {
		return raw
	}

	return host + AvatarPath + path
}
