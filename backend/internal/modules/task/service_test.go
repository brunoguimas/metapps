package task

import (
	"context"
	"errors"
	"testing"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic_dependency"
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeAIClient struct {
	generateFn func(context.Context, string) (string, error)
}

func (c *fakeAIClient) Generate(ctx context.Context, prompt string) (string, error) {
	return c.generateFn(ctx, prompt)
}

type fakeRepository struct {
	T        *testing.T
	createFn func(context.Context, *Task) (*Task, error)
	getFn    func(context.Context, uuid.UUID, uuid.UUID) (*Task, error)
	markFn   func(context.Context, uuid.UUID, uuid.UUID) (*Task, error)
}

func (r *fakeRepository) Create(context context.Context, t *Task) (*Task, error) {
	return r.createFn(context, t)
}
func (r *fakeRepository) GetByUserID(context.Context, uuid.UUID) ([]*Task, error) {
	return nil, nil
}
func (r *fakeRepository) GetByID(c context.Context, userID, id uuid.UUID) (*Task, error) {
	if r.getFn != nil {
		return r.getFn(c, userID, id)
	}
	return nil, nil
}
func (r *fakeRepository) MarkDone(c context.Context, userID, id uuid.UUID) (*Task, error) {
	if r.markFn != nil {
		return r.markFn(c, userID, id)
	}
	return nil, nil
}

type fakeTopicService struct {
	getFn func(context.Context, uuid.UUID) (*topic.Topic, error)
}

func (s *fakeTopicService) GenerateRoadmap(context.Context, *goal.Goal) (*topic.Roadmap, error) {
	return nil, nil
}

func (s *fakeTopicService) GetRoadmap(context.Context, uuid.UUID) (*topic.Roadmap, error) {
	return nil, nil
}

func (s *fakeTopicService) Get(c context.Context, topicID uuid.UUID) (*topic.Topic, error) {
	return s.getFn(c, topicID)
}

type fakeTopicRepository struct {
	createFn         func(context.Context, *topic.Topic) (*topic.Topic, error)
	getFn            func(context.Context, uuid.UUID) (*topic.Topic, error)
	getByGoalIDFn    func(context.Context, uuid.UUID) ([]*topic.Topic, error)
	deleteByGoalIDFn func(context.Context, uuid.UUID) error
}

func (r *fakeTopicRepository) Create(c context.Context, t *topic.Topic) (*topic.Topic, error) {
	return r.createFn(c, t)
}
func (r *fakeTopicRepository) Get(c context.Context, topicID uuid.UUID) (*topic.Topic, error) {
	return r.getFn(c, topicID)
}
func (r *fakeTopicRepository) GetByGoalID(c context.Context, goalID uuid.UUID) ([]*topic.Topic, error) {
	return r.getByGoalIDFn(c, goalID)
}
func (r *fakeTopicRepository) DeleteByGoalID(c context.Context, goalID uuid.UUID) error {
	if r.deleteByGoalIDFn != nil {
		return r.deleteByGoalIDFn(c, goalID)
	}
	return nil
}

type fakeTopicProgressRepository struct {
	getOrCreateFn func(context.Context, uuid.UUID, uuid.UUID) (*topic.TopicProgress, error)
	updateFn      func(context.Context, *topic.TopicProgress) error
}

func (r *fakeTopicProgressRepository) GetOrCreate(c context.Context, userID, topicID uuid.UUID) (*topic.TopicProgress, error) {
	return r.getOrCreateFn(c, userID, topicID)
}
func (r *fakeTopicProgressRepository) Update(c context.Context, progress *topic.TopicProgress) error {
	return r.updateFn(c, progress)
}

type fakeDependencyRepository struct {
	createFn        func(context.Context, *topic_dependency.TopicDependency) (*topic_dependency.TopicDependency, error)
	getByTopicIDsFn func(context.Context, []uuid.UUID) ([]*topic_dependency.TopicDependency, error)
}

func (r *fakeDependencyRepository) Create(c context.Context, d *topic_dependency.TopicDependency) (*topic_dependency.TopicDependency, error) {
	return r.createFn(c, d)
}
func (r *fakeDependencyRepository) GetByTopicIDs(c context.Context, topicIDs []uuid.UUID) ([]*topic_dependency.TopicDependency, error) {
	return r.getByTopicIDsFn(c, topicIDs)
}

type fakeGoalService struct {
	createFn func(context.Context, uuid.UUID, *goal.Request) (*goal.Goal, error)
	listFn   func(context.Context, uuid.UUID) ([]*goal.Goal, error)
	getFn    func(context.Context, uuid.UUID, uuid.UUID) (*goal.Goal, error)
	updateFn func(context.Context, uuid.UUID, uuid.UUID, *goal.Request) error
	deleteFn func(context.Context, uuid.UUID, uuid.UUID) error
}

func (s *fakeGoalService) Create(c context.Context, userID uuid.UUID, g *goal.Request) (*goal.Goal, error) {
	if s.createFn != nil {
		return s.createFn(c, userID, g)
	}
	return nil, nil
}
func (s *fakeGoalService) List(c context.Context, userID uuid.UUID) ([]*goal.Goal, error) {
	if s.listFn != nil {
		return s.listFn(c, userID)
	}
	return nil, nil
}
func (s *fakeGoalService) Get(c context.Context, userID, goalID uuid.UUID) (*goal.Goal, error) {
	if s.getFn != nil {
		return s.getFn(c, userID, goalID)
	}
	return nil, nil
}
func (s *fakeGoalService) Update(c context.Context, userID, goalID uuid.UUID, g *goal.Request) error {
	if s.updateFn != nil {
		return s.updateFn(c, userID, goalID, g)
	}
	return nil
}
func (s *fakeGoalService) Delete(c context.Context, userID, goalID uuid.UUID) error {
	if s.deleteFn != nil {
		return s.deleteFn(c, userID, goalID)
	}
	return nil
}

func TestServiceCreate_Success(t *testing.T) {
	userID := uuid.New()
	topicID := uuid.New()
	var createdTask *Task

	fakeTaskRepo := &fakeRepository{T: t}
	fakeTaskRepo.createFn = func(_ context.Context, taskT *Task) (*Task, error) {
		createdTask = taskT
		taskT.ID = uuid.New()
		return taskT, nil
	}

	tdRepo := &fakeDependencyRepository{
		createFn: func(_ context.Context, _ *topic_dependency.TopicDependency) (*topic_dependency.TopicDependency, error) {
			return nil, nil
		},
		getByTopicIDsFn: func(_ context.Context, _ []uuid.UUID) ([]*topic_dependency.TopicDependency, error) {
			return []*topic_dependency.TopicDependency{}, nil
		},
	}
	tdService := topic_dependency.NewService(tdRepo)

	fakeTopicService := &fakeTopicService{
		getFn: func(_ context.Context, tID uuid.UUID) (*topic.Topic, error) {
			return &topic.Topic{ID: tID, Title: "Topico 1", Description: "Desc 1"}, nil
		},
	}

	fakeTopicRepo := &fakeTopicRepository{
		createFn: func(_ context.Context, _ *topic.Topic) (*topic.Topic, error) { return nil, nil },
		getFn:    func(_ context.Context, _ uuid.UUID) (*topic.Topic, error) { return nil, nil },
		getByGoalIDFn: func(_ context.Context, _ uuid.UUID) ([]*topic.Topic, error) {
			return []*topic.Topic{}, nil
		},
	}

	fakeTopicProgressRepo := &fakeTopicProgressRepository{
		getOrCreateFn: func(_ context.Context, _, _ uuid.UUID) (*topic.TopicProgress, error) {
			return &topic.TopicProgress{Status: topic.TopicStatusMastered}, nil
		},
		updateFn: func(_ context.Context, _ *topic.TopicProgress) error { return nil },
	}

	fakeGoalService := &fakeGoalService{
		createFn: func(_ context.Context, _ uuid.UUID, _ *goal.Request) (*goal.Goal, error) {
			return &goal.Goal{ID: uuid.New(), UserID: userID, Title: "Meta Teste"}, nil
		},
		getFn: func(_ context.Context, _ uuid.UUID, goalID uuid.UUID) (*goal.Goal, error) {
			return &goal.Goal{ID: goalID, UserID: userID, Title: "Meta Teste"}, nil
		},
	}

	service := NewService(
		&fakeAIClient{
			generateFn: func(ctx context.Context, prompt string) (string, error) {
				assert.Contains(t, prompt, "ESTRUTURA DO JSON")
				assert.Contains(t, prompt, "Objetivo principal:")
				assert.Contains(t, prompt, "Meta Teste")
				assert.Contains(t, prompt, "Motivação:")
				assert.Contains(t, prompt, "Critério de sucesso:")
				assert.Contains(t, prompt, "Estilo de aprendizagem:")
				assert.Contains(t, prompt, "Tópico de estudo:")
				assert.Contains(t, prompt, "Topico 1")
				assert.Contains(t, prompt, "Desc 1")
				assert.Contains(t, prompt, "Nível de domínio necessário:")
				assert.Contains(t, prompt, "Peso do tópico no objetivo:")
				assert.Contains(t, prompt, "Dificuldades identificadas:")
				assert.Contains(t, prompt, "Baixa maestria no tópico")
				assert.Contains(t, prompt, "Desempenho recente:")
				assert.Contains(t, prompt, "Tentativas: 0, Mestria: 0%, Confiança: 0%")
				return `{"type":"essay","meta":{"title":"Redacao","description":"Tema","expectations":"Coerencia"},"content":{"material":[],"instructions":"Escreva","min_words":100,"max_words":200}}`, nil
			},
		},
		fakeTaskRepo,
		fakeTopicService,
		fakeTopicRepo,
		fakeTopicProgressRepo,
		tdService,
		fakeGoalService,
		&config.Config{},
	)

	result, err := service.Create(context.Background(), userID, topicID)

	require.NoError(t, err)
	require.NotNil(t, createdTask)
	assert.Equal(t, TaskEssay, createdTask.Type)
	assert.Equal(t, "Redacao", createdTask.Meta.Title)
	assert.Equal(t, createdTask.ID, result.ID)
}

func TestServiceCreate_Fail(t *testing.T) {
	userID := uuid.New()
	fakeTaskRepo := &fakeRepository{T: t}
	fakeTaskRepo.createFn = func(_ context.Context, taskT *Task) (*Task, error) {
		fakeTaskRepo.T.Fatal("Create should not be called on invalid AI response")
		return nil, nil
	}

	tdRepo := &fakeDependencyRepository{
		createFn: func(_ context.Context, _ *topic_dependency.TopicDependency) (*topic_dependency.TopicDependency, error) {
			return nil, nil
		},
		getByTopicIDsFn: func(_ context.Context, _ []uuid.UUID) ([]*topic_dependency.TopicDependency, error) {
			return []*topic_dependency.TopicDependency{}, nil
		},
	}
	tdService := topic_dependency.NewService(tdRepo)

	fakeTopicService := &fakeTopicService{
		getFn: func(_ context.Context, tID uuid.UUID) (*topic.Topic, error) {
			return &topic.Topic{ID: tID, Title: "Topico 1"}, nil
		},
	}

	fakeTopicRepo := &fakeTopicRepository{
		createFn: func(_ context.Context, _ *topic.Topic) (*topic.Topic, error) { return nil, nil },
		getFn:    func(_ context.Context, _ uuid.UUID) (*topic.Topic, error) { return nil, nil },
		getByGoalIDFn: func(_ context.Context, _ uuid.UUID) ([]*topic.Topic, error) {
			return []*topic.Topic{}, nil
		},
	}

	fakeTopicProgressRepo := &fakeTopicProgressRepository{
		getOrCreateFn: func(_ context.Context, _, _ uuid.UUID) (*topic.TopicProgress, error) {
			return &topic.TopicProgress{Status: topic.TopicStatusMastered}, nil
		},
		updateFn: func(_ context.Context, _ *topic.TopicProgress) error { return nil },
	}

	fakeGoalService := &fakeGoalService{
		createFn: func(_ context.Context, _ uuid.UUID, _ *goal.Request) (*goal.Goal, error) {
			return &goal.Goal{ID: uuid.New(), UserID: userID, Title: "Meta Teste"}, nil
		},
		getFn: func(_ context.Context, _ uuid.UUID, goalID uuid.UUID) (*goal.Goal, error) {
			return &goal.Goal{ID: goalID, UserID: userID, Title: "Meta Teste"}, nil
		},
	}

	service := NewService(
		&fakeAIClient{
			generateFn: func(ctx context.Context, prompt string) (string, error) {
				return `{"type":"invalid","meta":{"title":"x","description":"y","expectations":"z"},"content":{}}`, nil
			},
		},
		fakeTaskRepo,
		fakeTopicService,
		fakeTopicRepo,
		fakeTopicProgressRepo,
		tdService,
		fakeGoalService,
		&config.Config{},
	)

	result, err := service.Create(context.Background(), userID, uuid.New())

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidAIResponse, appErr.Code())
}

var _ ai.Client = (*fakeAIClient)(nil)
var _ error = errors.New("")
