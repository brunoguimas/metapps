package profile

import (
	"context"
	"time"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/brunoguimas/metapps/backend/internal/shared/gamification"
	"github.com/google/uuid"
)

type Service interface {
	GetProfileByUserID(ctx context.Context, userID uuid.UUID) (*Profile, error)
	CreateProfile(ctx context.Context, userID uuid.UUID) (*Profile, error)
	UpdateProfile(ctx context.Context, profile *Profile) (*Profile, error)
	AddXP(ctx context.Context, userID uuid.UUID, xpToAdd int) (*Profile, error)
	TouchActivity(ctx context.Context, userID uuid.UUID) (*Profile, error)
	UpdateDailyGoal(ctx context.Context, userID uuid.UUID, dailyGoalXP int) (*Profile, error)
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
		ID:               uuid.New(),
		UserID:           userID,
		XP:               0,
		Streak:           0,
		LastActivityDate: time.Now().UTC().Truncate(24 * time.Hour),
		AvatarURL:        "",
		DailyGoalXP:      gamification.DefaultDailyGoalXP,
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}
	return s.repo.Create(ctx, profile)
}

func (s *profileService) UpdateProfile(ctx context.Context, profile *Profile) (*Profile, error) {
	profile.UpdatedAt = time.Now().UTC()
	return s.repo.Update(ctx, profile)
}

// AddXP soma XP ao perfil.
//
// A streak NAO e atualizada aqui: ela vive em TouchActivity, para que
// qualquer atividade de estudo conte como dia ativo, mesmo quando o
// usuario ainda nao domina o topico.
func (s *profileService) AddXP(ctx context.Context, userID uuid.UUID, xpToAdd int) (*Profile, error) {
	current, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user profile", err)
	}

	updated, err := s.repo.AddXP(ctx, current.ID, xpToAdd)
	if err != nil {
		return nil, err
	}

	return updated, nil
}

// TouchActivity registra que o usuario estudou hoje e atualiza a streak.
//
// Regras:
//   - ja estudou hoje: nada muda;
//   - a ultima atividade foi ontem: a streak continua;
//   - a ultima atividade foi antes de ontem: a streak foi quebrada e
//     recomeca em 1.
func (s *profileService) TouchActivity(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	current, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user profile", err)
	}

	today := truncateDay(time.Now().UTC())
	last := truncateDay(current.LastActivityDate)

	streak := current.Streak
	switch {
	case last.Equal(today):
		// Ja estudou hoje: nada a fazer.
		//
		// Excecao: um perfil recem-criado ja nasce com a data de hoje
		// (sem nenhuma atividade). O primeiro estudo do dia precisa
		// iniciar a streak em 1, senao o usuario novo nunca ve a chama
		// acesa.
		if streak != 0 {
			return current, nil
		}
		streak = 1
	case last.Equal(today.AddDate(0, 0, -1)):
		streak++
	default:
		streak = 1
	}

	if streak < 1 {
		streak = 1
	}

	updated, err := s.repo.UpdateStreak(ctx, current.ID, streak, today)
	if err != nil {
		return nil, err
	}

	return updated, nil
}

func (s *profileService) UpdateDailyGoal(ctx context.Context, userID uuid.UUID, dailyGoalXP int) (*Profile, error) {
	if dailyGoalXP < 10 || dailyGoalXP > 1000 {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "daily goal must be between 10 and 1000 xp", nil)
	}

	current, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user profile", err)
	}

	return s.repo.UpdateDailyGoal(ctx, current.ID, dailyGoalXP)
}

func (s *profileService) UpdateAvatar(ctx context.Context, userID uuid.UUID, avatarURL string) (*Profile, error) {
	current, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user profile", err)
	}

	current.AvatarURL = avatarURL
	return s.repo.Update(ctx, current)
}
