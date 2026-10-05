package topic

import (
	"context"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── dublês ──────────────────────────────────────────────────────────────────

type stubAI struct {
	// respostas é consumido na ordem: um item por chamada de Generate.
	respostas []stubResposta
	chamadas   int
	prompts    []string
}

type stubResposta struct {
	conteudo string
	err      error
}

func (s *stubAI) Generate(_ context.Context, prompt string) (string, error) {
	s.prompts = append(s.prompts, prompt)
	i := s.chamadas
	s.chamadas++

	if i >= len(s.respostas) {
		i = len(s.respostas) - 1
	}
	return s.respostas[i].conteudo, s.respostas[i].err
}

type stubRepo struct {
	criados []*Topic
}

func (s *stubRepo) Create(_ context.Context, t *Topic) (*Topic, error) {
	t.ID = uuid.New()
	s.criados = append(s.criados, t)
	return t, nil
}

func (s *stubRepo) Get(_ context.Context, id uuid.UUID) (*Topic, error) {
	return &Topic{ID: id}, nil
}

func (s *stubRepo) GetByGoalID(_ context.Context, _ uuid.UUID) ([]*Topic, error) {
	return nil, nil
}

func (s *stubRepo) DeleteByGoalID(_ context.Context, _ uuid.UUID) error { return nil }

type stubProgressRepo struct{}

func (stubProgressRepo) GetOrCreate(_ context.Context, _ uuid.UUID, topicID uuid.UUID) (*TopicProgress, error) {
	return &TopicProgress{TopicID: topicID}, nil
}
func (stubProgressRepo) Update(_ context.Context, _ *TopicProgress) error { return nil }
func (stubProgressRepo) ListByUserAndGoal(_ context.Context, _ uuid.UUID, _ uuid.UUID) ([]*TopicProgress, error) {
	return nil, nil
}

type stubDeps struct{}

func (stubDeps) Create(_ context.Context, d *topic_dependency.TopicDependency) (*topic_dependency.TopicDependency, error) {
	return d, nil
}
func (stubDeps) GetByTopicIDs(_ context.Context, _ []uuid.UUID) ([]*topic_dependency.TopicDependency, error) {
	return nil, nil
}

// ── helpers ────────────────────────────────────────────────────────────────

func novoServico(cl aiClient, repo Repository) Service {
	return NewService(repo, stubDeps{}, cl, nil, stubProgressRepo{})
}

// aiClient é o mesmo contrato de ai.Client, declarado localmente para os
// testes não dependerem do pacote concreto.
type aiClient interface {
	Generate(ctx context.Context, prompt string) (string, error)
}

func upstreamErro() error {
	return apperrors.NewAppError(
		apperrors.ErrUpstreamUnavailable,
		"ai provider is temporarily unavailable, please try again",
		nil,
	)
}

// ── testes ─────────────────────────────────────────────────────────────────

// Uma resposta inválida não pode envenenar as tentativas seguintes: o erro
// de validação precisa ser zerado quando a resposta seguinte é parseável,
// senão toda nova tentativa cai no continue sem nunca validar.
func TestGenerateRoadmap_RecuperaDepoisDeRespostaInvalida(t *testing.T) {
	valido := loadTestJSON(t, "valid_roadmap")

	cl := &stubAI{respostas: []stubResposta{
		{conteudo: "{ isso nao e json"},
		{conteudo: valido},
	}}

	repo := &stubRepo{}
	svc := novoServico(cl, repo)

	roadmap, err := svc.GenerateRoadmap(context.Background(), uuid.New(), &goal.Goal{
		ID:    uuid.New(),
		Title: "Backend",
	})

	require.NoError(t, err)
	require.NotNil(t, roadmap)
	assert.NotEmpty(t, roadmap.Topics)
	assert.Equal(t, 2, cl.chamadas)
}

// Falha de provedor é transitória: deve chegar ao cliente como UPSTREAM_UNAVAILABLE
// (503), e não como INTERNAL_ERROR (500).
func TestGenerateRoadmap_ProvedorForaDoArRetorna503(t *testing.T) {
	cl := &stubAI{respostas: []stubResposta{{err: upstreamErro()}}}

	svc := novoServico(cl, &stubRepo{})

	_, err := svc.GenerateRoadmap(context.Background(), uuid.New(), &goal.Goal{
		ID:    uuid.New(),
		Title: "Backend",
	})

	require.Error(t, err)

	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrUpstreamUnavailable, appErr.Code())
	assert.Equal(t, 503, appErr.Status())
}

// O prompt de feedback só pode carregar erro de resposta. Um 503 não é um
// defeito do modelo, então não deve aparecer no prompt da tentativa seguinte.
func TestGenerateRoadmap_NaoReescrevePromptComErroDeProvedor(t *testing.T) {
	cl := &stubAI{respostas: []stubResposta{
		{err: upstreamErro()},
		{conteudo: loadTestJSON(t, "valid_roadmap")},
	}}

	svc := novoServico(cl, &stubRepo{})

	_, err := svc.GenerateRoadmap(context.Background(), uuid.New(), &goal.Goal{
		ID:    uuid.New(),
		Title: "Backend",
	})

	require.NoError(t, err)
	require.Len(t, cl.prompts, 2)
	assert.NotContains(t, cl.prompts[1], "FEEDBACK DA TENTATIVA ANTERIOR")
}

// Erro de resposta, ao contrário, deve gerar feedback no prompt seguinte.
func TestGenerateRoadmap_ReescrevePromptComErroDeResposta(t *testing.T) {
	cl := &stubAI{respostas: []stubResposta{
		{conteudo: "{ isso nao e json"},
		{conteudo: loadTestJSON(t, "valid_roadmap")},
	}}

	svc := novoServico(cl, &stubRepo{})

	_, err := svc.GenerateRoadmap(context.Background(), uuid.New(), &goal.Goal{
		ID:    uuid.New(),
		Title: "Backend",
	})

	require.NoError(t, err)
	require.Len(t, cl.prompts, 2)
	assert.Contains(t, cl.prompts[1], "FEEDBACK DA TENTATIVA ANTERIOR")
}

// Contexto cancelado durante o backoff deve abortar na hora em vez de insistir.
func TestGenerateRoadmap_CanceladoDuranteBackoff(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	cl := &stubAI{respostas: []stubResposta{{err: upstreamErro()}}}
	svc := novoServico(cl, &stubRepo{})

	_, err := svc.GenerateRoadmap(ctx, uuid.New(), &goal.Goal{ID: uuid.New(), Title: "Backend"})

	require.Error(t, err)
	assert.Equal(t, 1, cl.chamadas)
}
// Um erro de validação (dependência órfã) precisa chegar ao cliente.
// Sem lastErr, o serviço terminava o loop devolvendo (nil, nil) — roadmap
// vazio sem erro, que o handler respondia com 201.
func TestGenerateRoadmap_ErroDeValidacaoNaoViraNilNil(t *testing.T) {
	invalido := `{"nodes":[{"id":"a","parent_id":null,"title":"A","description":"d","required_mastery":0.8,"weight":0.5,"order_index":0}],"edges":[{"from":"a","to":"fantasma"}]}`

	cl := &stubAI{respostas: []stubResposta{{conteudo: invalido}}}
	svc := novoServico(cl, &stubRepo{})

	roadmap, err := svc.GenerateRoadmap(context.Background(), uuid.New(), &goal.Goal{
		ID:    uuid.New(),
		Title: "Backend",
	})

	require.Error(t, err, "validação reprovada não pode devolver erro nil")
	assert.Nil(t, roadmap)

	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidAIResponse, appErr.Code())
}
