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

type fakeTaskRepository struct {
	T      *testing.T
	createFn func(context.Context, *Task) (*Task, error)
	getFn    func(context.Context, uuid.UUID, uuid.UUID) (*Task, error)
	markFn   func(context.Context, uuid.UUID, uuid.UUID) (*Task, error)
}

func (r *fakeTaskRepository) Create(context context.Context, t *Task) (*Task, error) {
	return r.createFn(context, t)
}
func (r *fakeTaskRepository) GetByUserID(context.Context, uuid.UUID) ([]*Task, error) {
	return nil, nil
}
func (r *fakeTaskRepository) GetByID(c context.Context, userID, id uuid.UUID) (*Task, error) {
	if r.getFn != nil {
		return r.getFn(c, userID, id)
	}
	return nil, nil
}
func (r *fakeTaskRepository) MarkDone(c context.Context, userID, id uuid.UUID) (*Task, error) {
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

type fakeGoalRepositoryTask struct{}

func (r *fakeGoalRepositoryTask) Create(context.Context, *goal.Goal) (*goal.Goal, error) { return nil, nil }
func (r *fakeGoalRepositoryTask) ListByUserID(context.Context, uuid.UUID) ([]*goal.Goal, error) {
	return nil, nil
}
func (r *fakeGoalRepositoryTask) GetByID(context.Context, uuid.UUID, uuid.UUID) (*goal.Goal, error) {
	return nil, nil
}
func (r *fakeGoalRepositoryTask) Update(context.Context, *goal.Goal) error { return nil }
func (r *fakeGoalRepositoryTask) Delete(context.Context, uuid.UUID, uuid.UUID) error { return nil }

// Added missing fake implementations
type fakeTopicRepository struct {
	createFn      func(context.Context, *topic.Topic) (*topic.Topic, error)
	getFn         func(context.Context, uuid.UUID) (*topic.Topic, error)
	getByGoalIDFn func(context.Context, uuid.UUID) ([]*topic.Topic, error)
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

type fakeTopicDependencyRepository struct {
	createFn func(context.Context, *topic_dependency.TopicDependency) (*topic_dependency.TopicDependency, error)
	getByTopicIDsFn func(context.Context, []uuid.UUID) ([]*topic_dependency.TopicDependency, error)
}

func (r *fakeTopicDependencyRepository) Create(c context.Context, d *topic_dependency.TopicDependency) (*topic_dependency.TopicDependency, error) {
	return r.createFn(c, d)
}
func (r *fakeTopicDependencyRepository) GetByTopicIDs(c context.Context, topicIDs []uuid.UUID) ([]*topic_dependency.TopicDependency, error) {
	return r.getByTopicIDsFn(c, topicIDs)
}

func TestTaskServiceCreate_Success(t *testing.T) {
	userID := uuid.New()
	topicID := uuid.New()
	var createdTask *Task

	fakeTaskRepo := &fakeTaskRepository{T: t}
	fakeTaskRepo.createFn = func(_ context.Context, taskT *Task) (*Task, error) {
		createdTask = taskT
		taskT.ID = uuid.New()
		return taskT, nil
	}

	tdRepo := &fakeTopicDependencyRepository{
		createFn: func(_ context.Context, _ *topic_dependency.TopicDependency) (*topic_dependency.TopicDependency, error) { return nil, nil },
		getByTopicIDsFn: func(_ context.Context, _ []uuid.UUID) ([]*topic_dependency.TopicDependency, error) {
			return []*topic_dependency.TopicDependency{}, nil
		},
	}
	tdService := topic_dependency.NewTopicDependencyService(tdRepo)

	service := NewTaskService(
		&fakeAIClient{
			generateFn: func(ctx context.Context, prompt string) (string, error) {
				assert.Contains(t, prompt, "FORMATO RAIZ")
				return `{"type":"essay","meta":{"title":"Redacao","description":"Tema","expectations":"Coerencia"},"content":{"material":[],"instructions":"Escreva","min_words":100,"max_words":200}}`, nil
			},
		},
		fakeTaskRepo,
		&fakeTopicService{
			getFn: func(_ context.Context, tID uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: tID, Title: "Topico 1", Description: "Desc 1"}, nil
			},
		},
		&fakeTopicRepository{
			createFn:      func(_ context.Context, _ *topic.Topic) (*topic.Topic, error) { return nil, nil },
			getFn:         func(_ context.Context, _ uuid.UUID) (*topic.Topic, error) { return nil, nil },
			getByGoalIDFn: func(_ context.Context, _ uuid.UUID) ([]*topic.Topic, error) {
				return []*topic.Topic{}, nil
			},
		},
		&fakeTopicProgressRepository{
			getOrCreateFn: func(_ context.Context, _, _ uuid.UUID) (*topic.TopicProgress, error) {
				return &topic.TopicProgress{Status: topic.TopicStatusMastered}, nil
			},
			updateFn:      func(_ context.Context, _ *topic.TopicProgress) error { return nil },
		},
		tdService,
		&config.Config{},
	)

	result, err := service.Create(context.Background(), userID, topicID)

	require.NoError(t, err)
	require.NotNil(t, createdTask)
	assert.Equal(t, TaskEssay, createdTask.Type)
	assert.Equal(t, "Redacao", createdTask.Meta.Title)
	assert.Equal(t, createdTask.ID, result.ID)
}

func TestTaskServiceCreate_Fail(t *testing.T) {
	fakeTaskRepo := &fakeTaskRepository{T: t}
	fakeTaskRepo.createFn = func(_ context.Context, taskT *Task) (*Task, error) {
		fakeTaskRepo.T.Fatal("Create should not be called on invalid AI response")
		return nil, nil
	}

	tdRepo := &fakeTopicDependencyRepository{
		createFn: func(_ context.Context, _ *topic_dependency.TopicDependency) (*topic_dependency.TopicDependency, error) { return nil, nil },
		getByTopicIDsFn: func(_ context.Context, _ []uuid.UUID) ([]*topic_dependency.TopicDependency, error) {
			return []*topic_dependency.TopicDependency{}, nil
		},
	}
	tdService := topic_dependency.NewTopicDependencyService(tdRepo)

	service := NewTaskService(
		&fakeAIClient{
			generateFn: func(ctx context.Context, prompt string) (string, error) {
				return `{"type":"invalid","meta":{"title":"x","description":"y","expectations":"z"},"content":{}}`, nil
			},
		},
		fakeTaskRepo,
		&fakeTopicService{
			getFn: func(_ context.Context, tID uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: tID, Title: "Topico 1"}, nil
			},
		},
		&fakeTopicRepository{
			createFn:      func(_ context.Context, _ *topic.Topic) (*topic.Topic, error) { return nil, nil },
			getFn:         func(_ context.Context, _ uuid.UUID) (*topic.Topic, error) { return nil, nil },
			getByGoalIDFn: func(_ context.Context, _ uuid.UUID) ([]*topic.Topic, error) {
				return []*topic.Topic{}, nil
			},
		},
		&fakeTopicProgressRepository{
			getOrCreateFn: func(_ context.Context, _, _ uuid.UUID) (*topic.TopicProgress, error) {
				return &topic.TopicProgress{Status: topic.TopicStatusMastered}, nil
			},
			updateFn:      func(_ context.Context, _ *topic.TopicProgress) error { return nil },
		},
		tdService,
		&config.Config{},
	)

	result, err := service.Create(context.Background(), uuid.New(), uuid.New())

	require.Error(t, err)
	require.Nil(t, result)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidAIResponse, appErr.Code())
}

var _ ai.Client = (*fakeAIClient)(nil)
var _ error = errors.New("")