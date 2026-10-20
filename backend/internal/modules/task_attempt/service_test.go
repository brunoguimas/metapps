package task_attempt

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/modules/daily_activity"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/review"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_step_attempt"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeRepository struct {
	createFn func(context.Context, *TaskAttempt) (*TaskAttempt, error)
	created  []*TaskAttempt
}

func (r *fakeRepository) Create(c context.Context, attempt *TaskAttempt) (*TaskAttempt, error) {
	created, err := r.createFn(c, attempt)
	if err == nil {
		r.created = append(r.created, created)
	}
	return created, err
}

func (r *fakeRepository) GetByID(context.Context, uuid.UUID) (*TaskAttempt, error) {
	return nil, nil
}
func (r *fakeRepository) ListByUser(context.Context, uuid.UUID) ([]*TaskAttempt, error) {
	return r.created, nil
}
func (r *fakeRepository) ListByUserAndTask(context.Context, uuid.UUID, uuid.UUID) ([]*TaskAttempt, error) {
	return r.created, nil
}

type fakeRepositoryAttempt struct {
	getByIDFn  func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error)
	markDoneFn func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error)
}

func (r *fakeRepositoryAttempt) Create(context.Context, *task.Task) (*task.Task, error) {
	return nil, nil
}
func (r *fakeRepositoryAttempt) GetByUserID(context.Context, uuid.UUID) ([]*task.Task, error) {
	return nil, nil
}
func (r *fakeRepositoryAttempt) GetByID(c context.Context, userID, id uuid.UUID) (*task.Task, error) {
	return r.getByIDFn(c, userID, id)
}
func (r *fakeRepositoryAttempt) MarkDone(c context.Context, userID, id uuid.UUID) (*task.Task, error) {
	return r.markDoneFn(c, userID, id)
}
func (r *fakeRepositoryAttempt) GetByUserAndTopicAndStatus(context.Context, uuid.UUID, uuid.UUID, task.Status) (*task.Task, error) {
	return nil, nil
}
func (r *fakeRepositoryAttempt) ListByUserAndTopic(context.Context, uuid.UUID, uuid.UUID) ([]*task.Task, error) {
	return nil, nil
}
func (r *fakeRepositoryAttempt) ListByUserAndSource(context.Context, uuid.UUID, task.Source) ([]*task.Task, error) {
	return nil, nil
}
func (r *fakeRepositoryAttempt) ListStatementsByTopic(context.Context, uuid.UUID, uuid.UUID) ([]string, error) {
	return nil, nil
}
func (r *fakeRepositoryAttempt) UpdateSession(_ context.Context, t *task.Task) (*task.Task, error) {
	return t, nil
}
func (r *fakeRepositoryAttempt) UpdateDone(_ context.Context, t *task.Task) (*task.Task, error) {
	return t, nil
}

type fakeTopicRepositoryAttempt struct {
	getFn           func(context.Context, uuid.UUID) (*topic.Topic, error)
	recordAttemptFn func(context.Context, uuid.UUID, uuid.UUID, float64) (*topic.TopicProgress, error)
}

func (r *fakeTopicRepositoryAttempt) GenerateRoadmap(context.Context, uuid.UUID, *goal.Goal) (*topic.Roadmap, error) {
	return nil, nil
}

func (r *fakeTopicRepositoryAttempt) GetRoadmap(context.Context, uuid.UUID, uuid.UUID) (*topic.Roadmap, error) {
	return nil, nil
}

func (r *fakeTopicRepositoryAttempt) Get(c context.Context, id uuid.UUID) (*topic.Topic, error) {
	if r.getFn != nil {
		return r.getFn(c, id)
	}
	return &topic.Topic{ID: id}, nil
}

func (r *fakeTopicRepositoryAttempt) RecordAttempt(c context.Context, userID, topicID uuid.UUID, score float64) (*topic.TopicProgress, error) {
	if r.recordAttemptFn != nil {
		return r.recordAttemptFn(c, userID, topicID, score)
	}
	return &topic.TopicProgress{UserID: userID, TopicID: topicID, MasteryScore: score}, nil
}

type fakeProfileServiceAttempt struct {
	addXPFn       func(context.Context, uuid.UUID, int) (*profile.Profile, error)
	touchActivity int
}

func (f *fakeProfileServiceAttempt) GetProfileByUserID(context.Context, uuid.UUID) (*profile.Profile, error) {
	return &profile.Profile{XP: 100, DailyGoalXP: 50}, nil
}
func (f *fakeProfileServiceAttempt) CreateProfile(context.Context, uuid.UUID) (*profile.Profile, error) {
	return &profile.Profile{}, nil
}
func (f *fakeProfileServiceAttempt) UpdateProfile(context.Context, *profile.Profile) (*profile.Profile, error) {
	return nil, nil
}
func (f *fakeProfileServiceAttempt) AddXP(c context.Context, userID uuid.UUID, xp int) (*profile.Profile, error) {
	if f.addXPFn != nil {
		return f.addXPFn(c, userID, xp)
	}
	return nil, nil
}
func (f *fakeProfileServiceAttempt) TouchActivity(c context.Context, userID uuid.UUID) (*profile.Profile, error) {
	f.touchActivity++
	return &profile.Profile{}, nil
}
func (f *fakeProfileServiceAttempt) UpdateDailyGoal(context.Context, uuid.UUID, int) (*profile.Profile, error) {
	return nil, nil
}
func (f *fakeProfileServiceAttempt) UpdateAvatar(context.Context, uuid.UUID, string) (*profile.Profile, error) {
	return nil, nil
}

// fakeStepsService guarda as respostas por passo em memoria.
type fakeStepsService struct {
	attempts []*task_step_attempt.TaskStepAttempt
}

func (s *fakeStepsService) Record(_ context.Context, userID, taskID uuid.UUID, stepIndex int, answer []byte, correct bool, xp int) (*task_step_attempt.TaskStepAttempt, error) {
	attempt := &task_step_attempt.TaskStepAttempt{
		UserID:    userID,
		TaskID:    taskID,
		StepIndex: stepIndex,
		Answer:    answer,
		Correct:   correct,
		XP:        xp,
	}
	s.attempts = append(s.attempts, attempt)
	return attempt, nil
}

func (s *fakeStepsService) GetByTaskAndStep(_ context.Context, taskID uuid.UUID, stepIndex int) (*task_step_attempt.TaskStepAttempt, error) {
	for _, attempt := range s.attempts {
		if attempt.TaskID == taskID && attempt.StepIndex == stepIndex {
			return attempt, nil
		}
	}
	return nil, nil
}

func (s *fakeStepsService) ListByTask(_ context.Context, taskID uuid.UUID) ([]*task_step_attempt.TaskStepAttempt, error) {
	result := make([]*task_step_attempt.TaskStepAttempt, 0, len(s.attempts))
	for _, attempt := range s.attempts {
		if attempt.TaskID == taskID {
			result = append(result, attempt)
		}
	}
	return result, nil
}

func (s *fakeStepsService) ListByUser(context.Context, uuid.UUID, int) ([]*task_step_attempt.TaskStepAttempt, error) {
	return nil, nil
}
func (s *fakeStepsService) ListIncorrectByUser(context.Context, uuid.UUID, int) ([]*task_step_attempt.TaskStepAttempt, error) {
	return nil, nil
}

type fakeReviewsService struct {
	scheduled int
}

func (s *fakeReviewsService) Schedule(_ context.Context, userID, taskID uuid.UUID, stepIndex int, questionHash string, correct bool) (*review.ReviewItem, error) {
	s.scheduled++
	return &review.ReviewItem{UserID: userID, TaskID: taskID, StepIndex: stepIndex, QuestionHash: questionHash}, nil
}
func (s *fakeReviewsService) Due(context.Context, uuid.UUID, int) ([]*review.ReviewItem, error) {
	return nil, nil
}
func (s *fakeReviewsService) CountDue(context.Context, uuid.UUID) (int, error) { return 0, nil }
func (s *fakeReviewsService) All(context.Context, uuid.UUID, int) ([]*review.ReviewItem, error) {
	return nil, nil
}

type fakeDailyService struct {
	exercises int
	lessons   int
}

func (s *fakeDailyService) Record(_ context.Context, userID uuid.UUID, xp, exercises, lessons, seconds int) (*daily_activity.DailyActivity, error) {
	s.exercises += exercises
	s.lessons += lessons
	return &daily_activity.DailyActivity{UserID: userID, XP: xp, Exercises: exercises, Lessons: lessons}, nil
}
func (s *fakeDailyService) Today(context.Context, uuid.UUID) (*daily_activity.DailyActivity, error) {
	return &daily_activity.DailyActivity{}, nil
}
func (s *fakeDailyService) Range(context.Context, uuid.UUID, time.Time, time.Time) ([]*daily_activity.DailyActivity, error) {
	return nil, nil
}
func (s *fakeDailyService) Recent(context.Context, uuid.UUID, int) ([]*daily_activity.DailyActivity, error) {
	return nil, nil
}

const lessonContent = `{"version":2,"steps":[
  {"statement":"2+2","alternatives":["3","4"],"answer":1,"explanation":"4"},
  {"statement":"3+3","alternatives":["5","6"],"answer":1,"explanation":"6"},
  {"statement":"4+4","alternatives":["7","8"],"answer":1,"explanation":"8"}
]}`

func newTestService(
	repo Repository,
	taskRepo task.Repository,
	topics topic.Service,
	profiles profile.Service,
	steps task_step_attempt.Service,
	reviews review.Service,
	daily daily_activity.Service,
) Service {
	return NewService(repo, taskRepo, topics, profiles, steps, reviews, daily)
}

func TestServiceSubmit_Success(t *testing.T) {
	userID := uuid.New()
	taskID := uuid.New()
	topicID := uuid.New()
	var created *TaskAttempt
	var xpDeltas []int

	steps := &fakeStepsService{}

	service := newTestService(
		&fakeRepository{
			createFn: func(_ context.Context, attempt *TaskAttempt) (*TaskAttempt, error) {
				created = attempt
				attempt.ID = uuid.New()
				return attempt, nil
			},
		},
		&fakeRepositoryAttempt{
			getByIDFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{
					ID:      taskID,
					UserID:  userID,
					TopicID: topicID,
					Type:    task.TaskQuiz,
					Source:  task.SourceLesson,
					Status:  task.StatusPending,
					Content: json.RawMessage(lessonContent),
				}, nil
			},
			markDoneFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{ID: taskID, Done: true}, nil
			},
		},
		&fakeTopicRepositoryAttempt{
			getFn: func(context.Context, uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: topicID, RequiredMastery: 0.7, Weight: 2.5}, nil
			},
		},
		&fakeProfileServiceAttempt{
			addXPFn: func(_ context.Context, _ uuid.UUID, xp int) (*profile.Profile, error) {
				xpDeltas = append(xpDeltas, xp)
				return &profile.Profile{XP: xp}, nil
			},
		},
		steps,
		&fakeReviewsService{},
		&fakeDailyService{},
	)

	result, updatedTask, err := service.Submit(context.Background(), userID, taskID, &CreateAttemptInput{
		Type:     task.TaskQuiz,
		Response: json.RawMessage(`[{"question_index":0,"answer":1},{"question_index":1,"answer":1},{"question_index":2,"answer":1}]`),
	})

	require.NoError(t, err)
	require.NotNil(t, created)
	require.NotNil(t, result)
	require.NotNil(t, updatedTask)
	assert.Equal(t, StatusProcessed, created.Status)
	require.NotNil(t, created.Score)
	assert.Equal(t, 1.0, *created.Score)
	assert.True(t, updatedTask.Done)

	// XP por passo (combo 1, 2, 3 => 12, 14, 16) + bonus final (perfeito
	// 5 + dominio do topico 25 = 30).
	require.Len(t, xpDeltas, 4)
	assert.Equal(t, 12, xpDeltas[0])
	assert.Equal(t, 14, xpDeltas[1])
	assert.Equal(t, 16, xpDeltas[2])
	assert.Equal(t, 30, xpDeltas[3], "bonus de perfeito + bonus de dominio do topico")
}

func TestTaskAttemptServiceSubmit_NoXPBelowMastery(t *testing.T) {
	userID := uuid.New()
	taskID := uuid.New()
	topicID := uuid.New()
	var xpDeltas []int

	service := newTestService(
		&fakeRepository{
			createFn: func(_ context.Context, attempt *TaskAttempt) (*TaskAttempt, error) {
				attempt.ID = uuid.New()
				return attempt, nil
			},
		},
		&fakeRepositoryAttempt{
			getByIDFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{
					ID:      taskID,
					UserID:  userID,
					TopicID: topicID,
					Type:    task.TaskQuiz,
					Source:  task.SourceLesson,
					Status:  task.StatusPending,
					Content: json.RawMessage(lessonContent),
				}, nil
			},
			markDoneFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{ID: taskID, Done: true}, nil
			},
		},
		&fakeTopicRepositoryAttempt{
			getFn: func(context.Context, uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: topicID, RequiredMastery: 0.7, Weight: 2.5}, nil
			},
		},
		&fakeProfileServiceAttempt{
			addXPFn: func(_ context.Context, _ uuid.UUID, xp int) (*profile.Profile, error) {
				xpDeltas = append(xpDeltas, xp)
				return &profile.Profile{XP: xp}, nil
			},
		},
		&fakeStepsService{},
		&fakeReviewsService{},
		&fakeDailyService{},
	)

	// Resposta errada no primeiro passo: combo zerado, -5 XP.
	_, _, err := service.Submit(context.Background(), userID, taskID, &CreateAttemptInput{
		Type:     task.TaskQuiz,
		Response: json.RawMessage(`[{"question_index":0,"answer":0},{"question_index":1,"answer":1},{"question_index":2,"answer":1}]`),
	})

	require.NoError(t, err)
	require.NotEmpty(t, xpDeltas)
	assert.Equal(t, -5, xpDeltas[0], "erro custa XP")
	// 1/3 = 0.33, abaixo da maestria exigida (0.7): sem bonus de dominio.
	for _, delta := range xpDeltas {
		assert.NotEqual(t, 25, delta, "não deve conceder bonus de domínio abaixo da maestria")
	}
}

func TestServiceSubmit_Fail(t *testing.T) {
	service := newTestService(
		&fakeRepository{
			createFn: func(context.Context, *TaskAttempt) (*TaskAttempt, error) {
				t.Fatal("Create should not be called")
				return nil, nil
			},
		},
		&fakeRepositoryAttempt{
			getByIDFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{Type: task.TaskType("unknown")}, nil
			},
			markDoneFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				t.Fatal("MarkDone should not be called")
				return nil, nil
			},
		},
		&fakeTopicRepositoryAttempt{},
		&fakeProfileServiceAttempt{},
		&fakeStepsService{},
		&fakeReviewsService{},
		&fakeDailyService{},
	)

	result, updatedTask, err := service.Submit(context.Background(), uuid.New(), uuid.New(), &CreateAttemptInput{
		Type:     task.TaskQuiz,
		Response: json.RawMessage(`[{"question_index":0,"answer":1}]`),
	})

	require.Error(t, err)
	require.Nil(t, result)
	require.Nil(t, updatedTask)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrTaskAttemptTypeMismatch, appErr.Code())
}

func TestServiceAnswerStep_CorrectAndIdempotent(t *testing.T) {
	userID := uuid.New()
	taskID := uuid.New()
	topicID := uuid.New()
	var xpDeltas []int

	steps := &fakeStepsService{}
	reviews := &fakeReviewsService{}
	profileSvc := &fakeProfileServiceAttempt{
		addXPFn: func(_ context.Context, _ uuid.UUID, xp int) (*profile.Profile, error) {
			xpDeltas = append(xpDeltas, xp)
			return &profile.Profile{XP: xp}, nil
		},
	}

	service := newTestService(
		&fakeRepository{
			createFn: func(_ context.Context, attempt *TaskAttempt) (*TaskAttempt, error) {
				attempt.ID = uuid.New()
				return attempt, nil
			},
		},
		&fakeRepositoryAttempt{
			getByIDFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{
					ID:      taskID,
					UserID:  userID,
					TopicID: topicID,
					Type:    task.TaskQuiz,
					Source:  task.SourceLesson,
					Status:  task.StatusInProgress,
					Content: json.RawMessage(lessonContent),
				}, nil
			},
			markDoneFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{ID: taskID, Done: true}, nil
			},
		},
		&fakeTopicRepositoryAttempt{
			getFn: func(context.Context, uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: topicID, RequiredMastery: 0.7, Weight: 1}, nil
			},
		},
		profileSvc,
		steps,
		reviews,
		&fakeDailyService{},
	)

	result, err := service.AnswerStep(context.Background(), userID, taskID, 0, json.RawMessage(`1`))
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.True(t, result.Correct)
	assert.Equal(t, 1, result.CorrectAnswer)
	assert.Equal(t, 3, result.TotalSteps)
	assert.Equal(t, 1, result.Combo)
	assert.Equal(t, 1, result.NextStepIndex, "apos responder o passo 0 vem o passo 1")
	require.Len(t, xpDeltas, 1)
	assert.Equal(t, 12, xpDeltas[0])
	assert.Equal(t, 1, profileSvc.touchActivity, "toda resposta conta como atividade do dia")
	assert.Equal(t, 1, reviews.scheduled, "o exercicio entra na fila de revisao")

	// Repetir o mesmo passo nao pode conceder XP de novo.
	repeat, err := service.AnswerStep(context.Background(), userID, taskID, 0, json.RawMessage(`1`))
	require.NoError(t, err)
	assert.True(t, repeat.Correct)
	assert.Len(t, xpDeltas, 1, "responder o mesmo passo de novo nao pode duplicar XP")
}

func TestServiceAnswerStep_InvalidIndex(t *testing.T) {
	service := newTestService(
		&fakeRepository{},
		&fakeRepositoryAttempt{
			getByIDFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{
					ID:     uuid.New(),
					Type:   task.TaskQuiz,
					Status: task.StatusInProgress,
					Content: json.RawMessage(lessonContent),
				}, nil
			},
		},
		&fakeTopicRepositoryAttempt{},
		&fakeProfileServiceAttempt{},
		&fakeStepsService{},
		&fakeReviewsService{},
		&fakeDailyService{},
	)

	_, err := service.AnswerStep(context.Background(), uuid.New(), uuid.New(), 9, json.RawMessage(`0`))
	require.Error(t, err)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidQuestionIndex, appErr.Code())
}

// O progresso do topico e gravado uma unica vez por sessao.
//
// A correcao da IA (POST /corrections/quiz/:id) rodava depois do finish
// e gravava a mesma tentativa de novo: o contador de tentativas do topico
// subia dobrado e a media de confianca ficava distorcida. O finish e a
// unica escrita autoritativa.
func TestServiceFinish_RecordsTopicProgressOnce(t *testing.T) {
	userID := uuid.New()
	taskID := uuid.New()
	topicID := uuid.New()

	recordCalls := 0
	recordedScore := 0.0

	steps := &fakeStepsService{}

	service := newTestService(
		&fakeRepository{
			createFn: func(_ context.Context, attempt *TaskAttempt) (*TaskAttempt, error) {
				attempt.ID = uuid.New()
				return attempt, nil
			},
		},
		&fakeRepositoryAttempt{
			getByIDFn: func(context.Context, uuid.UUID, uuid.UUID) (*task.Task, error) {
				return &task.Task{
					ID:      taskID,
					UserID:  userID,
					TopicID: topicID,
					Type:    task.TaskQuiz,
					Source:  task.SourceLesson,
					Status:  task.StatusInProgress,
					Content: json.RawMessage(lessonContent),
				}, nil
			},
		},
		&fakeTopicRepositoryAttempt{
			getFn: func(context.Context, uuid.UUID) (*topic.Topic, error) {
				return &topic.Topic{ID: topicID, RequiredMastery: 0.7, Weight: 1}, nil
			},
			recordAttemptFn: func(_ context.Context, _ uuid.UUID, _ uuid.UUID, score float64) (*topic.TopicProgress, error) {
				recordCalls++
				recordedScore = score
				return &topic.TopicProgress{UserID: userID, TopicID: topicID, MasteryScore: score}, nil
			},
		},
		&fakeProfileServiceAttempt{},
		steps,
		&fakeReviewsService{},
		&fakeDailyService{},
	)

	// responde os tres exercicios
	for i := 0; i < 3; i++ {
		_, err := service.AnswerStep(context.Background(), userID, taskID, i, json.RawMessage(`1`))
		require.NoError(t, err)
	}

	assert.Equal(t, 0, recordCalls, "responder um passo nao grava o progresso do topico")

	result, err := service.Finish(context.Background(), userID, taskID, nil)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, 1.0, result.Score)

	assert.Equal(t, 1, recordCalls, "o finish grava o progresso do topico uma unica vez")
	assert.Equal(t, 1.0, recordedScore)
}
