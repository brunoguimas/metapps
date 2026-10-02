package social

import (
	"context"
	"strings"
	"time"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Service interface {
	ListFriends(ctx context.Context, userID uuid.UUID) ([]*Friend, error)
	Summary(ctx context.Context, userID uuid.UUID) (*SocialSummary, error)
	AddFriend(ctx context.Context, userID uuid.UUID, query string) (*Friend, error)
	RemoveFriend(ctx context.Context, userID, friendID uuid.UUID) error
	Search(ctx context.Context, userID uuid.UUID, term string) ([]*UserCandidate, error)
}

type socialService struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &socialService{repo: repo}
}

func nowUTC() time.Time {
	return time.Now().UTC()
}

func (s *socialService) ListFriends(ctx context.Context, userID uuid.UUID) ([]*Friend, error) {
	friends, err := s.repo.List(ctx, userID)
	if err != nil {
		return nil, err
	}
	return friends, nil
}

func (s *socialService) Summary(ctx context.Context, userID uuid.UUID) (*SocialSummary, error) {
	count, err := s.repo.Count(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &SocialSummary{Friends: count}, nil
}

func (s *socialService) AddFriend(ctx context.Context, userID uuid.UUID, query string) (*Friend, error) {
	term := strings.TrimSpace(query)
	if term == "" {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "informe o e-mail ou nome de usuário", nil)
	}

	target, err := s.repo.FindUser(ctx, term)
	if err != nil {
		return nil, err
	}

	if target.ID == userID {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "você não pode adicionar a si mesmo", nil)
	}

	already, err := s.repo.Exists(ctx, userID, target.ID)
	if err != nil {
		return nil, err
	}
	if already {
		return nil, apperrors.NewAppError(apperrors.ErrAlreadyFriend, "esse usuário já está na sua lista", nil)
	}

	if err := s.repo.Add(ctx, userID, target.ID); err != nil {
		return nil, err
	}

	// Devolve o amigo já no formato da listagem para o front não precisar
	// recarregar a lista inteira.
	return &Friend{
		FriendID: target.ID,
		Username: target.Username,
		AddedAt:  nowUTC(),
	}, nil
}

func (s *socialService) RemoveFriend(ctx context.Context, userID, friendID uuid.UUID) error {
	exists, err := s.repo.Exists(ctx, userID, friendID)
	if err != nil {
		return err
	}
	if !exists {
		return apperrors.NewAppError(apperrors.ErrNotFriend, "esse usuário não está na sua lista", nil)
	}

	return s.repo.Remove(ctx, userID, friendID)
}

func (s *socialService) Search(ctx context.Context, userID uuid.UUID, term string) ([]*UserCandidate, error) {
	term = strings.TrimSpace(term)
	if len(term) < 2 {
		// Com menos de 2 caracteres a busca vira um dump de usuários
		// qualquer; o front pede suggestions só a partir do 3º caractere.
		return []*UserCandidate{}, nil
	}

	candidates, err := s.repo.Search(ctx, userID, term)
	if err != nil {
		return nil, err
	}
	return candidates, nil
}
