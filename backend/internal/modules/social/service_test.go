package social

import (
	"context"
	"errors"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type fakeRepo struct {
	added      []uuid.UUID
	removed    []uuid.UUID
	exists     bool
	existsErr  error
	findResult *db.User
	findErr    error
	list       []*Friend
	candidates []*UserCandidate
}

func (f *fakeRepo) Add(ctx context.Context, userID, friendID uuid.UUID) error {
	f.added = append(f.added, friendID)
	return nil
}

func (f *fakeRepo) Remove(ctx context.Context, userID, friendID uuid.UUID) error {
	f.removed = append(f.removed, friendID)
	return nil
}

func (f *fakeRepo) Exists(ctx context.Context, userID, friendID uuid.UUID) (bool, error) {
	return f.exists, f.existsErr
}

func (f *fakeRepo) Count(ctx context.Context, userID uuid.UUID) (int, error) {
	return len(f.list), nil
}

func (f *fakeRepo) List(ctx context.Context, userID uuid.UUID) ([]*Friend, error) {
	return f.list, nil
}

func (f *fakeRepo) FindUser(ctx context.Context, query string) (*db.User, error) {
	return f.findResult, f.findErr
}

func (f *fakeRepo) Search(ctx context.Context, requesterID uuid.UUID, term string) ([]*UserCandidate, error) {
	return f.candidates, nil
}

func found(username string) *db.User {
	return &db.User{ID: uuid.New(), Username: username, Email: "a@b.com"}
}

func TestAddFriendAddsTheFoundUser(t *testing.T) {
	target := found("amigo")
	repo := &fakeRepo{findResult: target}
	svc := NewService(repo)

	friend, err := svc.AddFriend(context.Background(), uuid.New(), "amigo@metapps.com")
	if err != nil {
		t.Fatalf("AddFriend: %v", err)
	}
	if friend.FriendID != target.ID {
		t.Fatalf("FriendID = %v, quer %v", friend.FriendID, target.ID)
	}
	if len(repo.added) != 1 || repo.added[0] != target.ID {
		t.Fatalf("esperava gravar o alvo uma vez, gravou %v", repo.added)
	}
}

func TestAddFriendRejectsSelf(t *testing.T) {
	me := uuid.New()
	repo := &fakeRepo{findResult: &db.User{ID: me, Username: "eu"}}
	svc := NewService(repo)

	if _, err := svc.AddFriend(context.Background(), me, "eu"); err == nil {
		t.Fatal("adicionar a si mesmo deveria falhar")
	}
	if len(repo.added) != 0 {
		t.Fatal("não deveria gravar nada quando o alvo é você mesmo")
	}
}

func TestAddFriendRejectsEmptyQuery(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)

	if _, err := svc.AddFriend(context.Background(), uuid.New(), "   "); err == nil {
		t.Fatal("query vazia deveria falhar")
	}
	if repo.findResult != nil && len(repo.added) > 0 {
		t.Fatal("não deveria gravar com query vazia")
	}
}

func TestAddFriendRejectsDuplicate(t *testing.T) {
	repo := &fakeRepo{findResult: found("amigo"), exists: true}
	svc := NewService(repo)

	_, err := svc.AddFriend(context.Background(), uuid.New(), "amigo")
	if err == nil {
		t.Fatal("amigo repetido deveria falhar")
	}
	var appErr apperrors.AppError
	if !errors.As(err, &appErr) || appErr.Code() != apperrors.ErrAlreadyFriend {
		t.Fatalf("esperava ErrAlreadyFriend, veio %v", err)
	}
	if len(repo.added) != 0 {
		t.Fatal("não deveria gravar duplicata")
	}
}

func TestAddFriendPropagatesLookupError(t *testing.T) {
	repo := &fakeRepo{findErr: apperrors.NewAppError(apperrors.ErrUserNotFound, "usuário não encontrado", nil)}
	svc := NewService(repo)

	if _, err := svc.AddFriend(context.Background(), uuid.New(), "ninguem@metapps.com"); err == nil {
		t.Fatal("usuário inexistente deveria falhar")
	}
	if len(repo.added) != 0 {
		t.Fatal("não deveria gravar quando o usuário não existe")
	}
}

func TestRemoveFriendNotInList(t *testing.T) {
	repo := &fakeRepo{exists: false}
	svc := NewService(repo)

	err := svc.RemoveFriend(context.Background(), uuid.New(), uuid.New())
	if err == nil {
		t.Fatal("remover quem não é amigo deveria falhar")
	}
	if len(repo.removed) != 0 {
		t.Fatal("não deveria chamar Remove quando não é amigo")
	}
	var appErr apperrors.AppError
	if !errors.As(err, &appErr) || appErr.Code() != apperrors.ErrNotFriend {
		t.Fatalf("esperava ErrNotFriend, veio %v", err)
	}
}

func TestRemoveFriendDeletes(t *testing.T) {
	repo := &fakeRepo{exists: true}
	svc := NewService(repo)

	target := uuid.New()
	if err := svc.RemoveFriend(context.Background(), uuid.New(), target); err != nil {
		t.Fatalf("RemoveFriend: %v", err)
	}
	if len(repo.removed) != 1 || repo.removed[0] != target {
		t.Fatalf("esperava remover %v, removeu %v", target, repo.removed)
	}
}

func TestSummaryCountsFriends(t *testing.T) {
	repo := &fakeRepo{list: []*Friend{{}, {}, {}}}
	svc := NewService(repo)

	s, err := svc.Summary(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("Summary: %v", err)
	}
	if s.Friends != 3 {
		t.Fatalf("Summary().Friends = %d, quer 3", s.Friends)
	}
}

func TestSearchIgnoresShortTerms(t *testing.T) {
	repo := &fakeRepo{candidates: []*UserCandidate{{ID: uuid.New(), Username: "alguem"}}}
	svc := NewService(repo)

	// Com 1 caractere a busca viraria um dump de usuários: não pode ir
	// ao banco.
	got, err := svc.Search(context.Background(), uuid.New(), "a")
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("termo curto deveria devolver lista vazia, veio %d", len(got))
	}
}

func TestSearchPassesTerm(t *testing.T) {
	repo := &fakeRepo{candidates: []*UserCandidate{{ID: uuid.New(), Username: "alguem"}}}
	svc := NewService(repo)

	got, err := svc.Search(context.Background(), uuid.New(), "alguem")
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("esperava 1 candidato, veio %d", len(got))
	}
}

func TestLevelFromXPMatchesProfile(t *testing.T) {
	if LevelFromXP(0) != 1 {
		t.Errorf("0 XP deveria ser nível 1")
	}
	if LevelFromXP(100) != 2 {
		t.Errorf("100 XP deveria ser nível 2")
	}
	if LevelFromXP(550) != 6 {
		t.Errorf("550 XP deveria ser nível 6")
	}
}
