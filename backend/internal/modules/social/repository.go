package social

import (
	"context"
	"database/sql"

	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Repository interface {
	Add(ctx context.Context, userID, friendID uuid.UUID) error
	Remove(ctx context.Context, userID, friendID uuid.UUID) error
	Exists(ctx context.Context, userID, friendID uuid.UUID) (bool, error)
	Count(ctx context.Context, userID uuid.UUID) (int, error)
	List(ctx context.Context, userID uuid.UUID) ([]*Friend, error)
	FindUser(ctx context.Context, query string) (*db.User, error)
	Search(ctx context.Context, requesterID uuid.UUID, term string) ([]*UserCandidate, error)
}

type socialRepository struct {
	queries *db.Queries
}

func NewRepository(q *db.Queries) Repository {
	return &socialRepository{queries: q}
}

func (r *socialRepository) Add(ctx context.Context, userID, friendID uuid.UUID) error {
	_, err := r.queries.CreateFriendship(ctx, db.CreateFriendshipParams{
		UserID:   userID,
		FriendID: friendID,
	})
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't add friend", err)
	}
	return nil
}

func (r *socialRepository) Remove(ctx context.Context, userID, friendID uuid.UUID) error {
	err := r.queries.DeleteFriendship(ctx, db.DeleteFriendshipParams{
		UserID:   userID,
		FriendID: friendID,
	})
	if err != nil {
		return apperrors.NewAppError(apperrors.ErrInternal, "couldn't remove friend", err)
	}
	return nil
}

func (r *socialRepository) Exists(ctx context.Context, userID, friendID uuid.UUID) (bool, error) {
	_, err := r.queries.GetFriendship(ctx, db.GetFriendshipParams{
		UserID:   userID,
		FriendID: friendID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, apperrors.NewAppError(apperrors.ErrInternal, "couldn't check friendship", err)
	}
	return true, nil
}

func (r *socialRepository) Count(ctx context.Context, userID uuid.UUID) (int, error) {
	count, err := r.queries.CountFriendshipsByUser(ctx, userID)
	if err != nil {
		return 0, apperrors.NewAppError(apperrors.ErrInternal, "couldn't count friends", err)
	}
	return int(count), nil
}

func (r *socialRepository) List(ctx context.Context, userID uuid.UUID) ([]*Friend, error) {
	rows, err := r.queries.ListFriendshipsWithProfile(ctx, userID)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list friends", err)
	}

	friends := make([]*Friend, 0, len(rows))
	for _, row := range rows {
		var lastActivity *string
		if row.LastActivityDate.Valid {
			iso := row.LastActivityDate.Time.Format("2006-01-02")
			lastActivity = &iso
		}

		friends = append(friends, &Friend{
			ID:               row.ID,
			FriendID:         row.FriendID,
			Username:         row.Username,
			AvatarURL:        profile.NormalizeAvatarURL(row.AvatarUrl),
			XP:               int(row.Xp),
			Level:            LevelFromXP(int(row.Xp)),
			Streak:           int(row.Streak),
			LastActivityDate: lastActivity,
			AddedAt:          row.CreatedAt,
			MemberSince:      row.FriendSince,
		})
	}

	return friends, nil
}

// FindUser resolve um e-mail OU username para um usuário. A query do
// banco pode devolver mais de um registro (username não é UNIQUE), então
// o mais antigo vence — é o usuário "original" daquele username.
func (r *socialRepository) FindUser(ctx context.Context, query string) (*db.User, error) {
	rows, err := r.queries.SearchUsersByEmailOrUsername(ctx, db.SearchUsersByEmailOrUsernameParams{
		Email:    query,
		Username: query,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't search user", err)
	}

	if len(rows) == 0 {
		return nil, apperrors.NewAppError(apperrors.ErrUserNotFound, "usuário não encontrado", nil)
	}

	return &rows[0], nil
}

func (r *socialRepository) Search(ctx context.Context, requesterID uuid.UUID, term string) ([]*UserCandidate, error) {
	rows, err := r.queries.SearchUsersForFriends(ctx, db.SearchUsersForFriendsParams{
		RequesterID: requesterID,
		Term:        term,
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't search users", err)
	}

	candidates := make([]*UserCandidate, 0, len(rows))
	for _, row := range rows {
		candidates = append(candidates, &UserCandidate{
			ID:        row.ID,
			Username:  row.Username,
			AvatarURL: profile.NormalizeAvatarURL(row.AvatarUrl),
			XP:        int(row.Xp),
			Level:     LevelFromXP(int(row.Xp)),
			Streak:    int(row.Streak),
			IsFriend:  row.IsFriend,
		})
	}

	return candidates, nil
}
