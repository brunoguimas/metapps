package task_correction

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_attempt"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeAIClient struct {
	generateFn func(prompt string) (string, error)
}

func (c *fakeAIClient) Generate(prompt string) (string, error) {
	if c.generateFn != nil {
		return c.generateFn(prompt)
	}
	return `{"feedback":"Excelente redação!","score":90}`, nil
}

type fakeTaskCorrectionRepository struct {
	corrections map[uuid.UUID]*TaskCorrection
}

func newFakeRepo() *fakeTaskCorrectionRepository {
	return &fakeTaskCorrectionRepository{
		corrections: make(map[uuid.UUID]*TaskCorrection),
	}
}

func (r *fakeTaskCorrectionRepository) Create(c context.Context, correction *TaskCorrection) (*TaskCorrection, error) {
	if correction.ID == uuid.Nil {
		correction.ID = uuid.New()
	}
	correction.CreatedAt = time.Now()
	correction.UpdatedAt = time.Now()
	r.corrections[correction.AttemptID] = correction
	return correction, nil
}

func (r *fakeTaskCorrectionRepository) GetByID(c context.Context, id uuid.UUID) (*TaskCorrection, error) {
	for _, corr := range r.corrections {
		if corr.ID == id {
			return corr, nil
		}
	}
	return nil, apperrors.NewAppError(apperrors.ErrTaskCorrectionNotFound, "correction not found", nil)
}

func (r *fakeTaskCorrectionRepository) GetByAttemptID(c context.Context, attemptID uuid.UUID) (*TaskCorrection, error) {
	if corr, ok := r.corrections[attemptID]; ok {
		return corr, nil
	}
	return nil, apperrors.NewAppError(apperrors.ErrTaskCorrectionNotFound, "correction not found for attempt", nil)
}

func (r *fakeTaskCorrectionRepository) Update(c context.Context, correction *TaskCorrection) (*TaskCorrection, error) {
	r.corrections[correction.AttemptID] = correction
	return correction, nil
}

type fakeAttemptRepository struct {
	attempts map[uuid.UUID]*task_attempt.TaskAttempt
}

func (r *fakeAttemptRepository) Create(c context.Context, attempt *task_attempt.TaskAttempt) (*task_attempt.TaskAttempt, error) {
	r.attempts[attempt.ID] = attempt
	return attempt, nil
}

func (r *fakeAttemptRepository) GetByID(c context.Context, id uuid.UUID) (*task_attempt.TaskAttempt, error) {
	if att, ok := r.attempts[id]; ok {
		return att, nil
	}
	return nil, apperrors.NewAppError(apperrors.ErrTaskAttemptNotFound, "task attempt not found", nil)
}

func (r *fakeAttemptRepository) ListByUser(c context.Context, userID uuid.UUID) ([]*task_attempt.TaskAttempt, error) {
	return nil, nil
}

func (r *fakeAttemptRepository) ListByUserAndTask(c context.Context, userID, taskID uuid.UUID) ([]*task_attempt.TaskAttempt, error) {
	return nil, nil
}

type fakeTaskRepository struct {
	tasks map[uuid.UUID]*task.Task
}

func (r *fakeTaskRepository) Create(c context.Context, t *task.Task) (*task.Task, error) {
	return t, nil
}

func (r *fakeTaskRepository) GetByUserID(c context.Context, userID uuid.UUID) ([]*task.Task, error) {
	return nil, nil
}

func (r *fakeTaskRepository) GetByID(c context.Context, userID, id uuid.UUID) (*task.Task, error) {
	if t, ok := r.tasks[id]; ok {
		if t.UserID != userID {
			return nil, apperrors.NewAppError(apperrors.ErrTaskNotFound, "task not found", nil)
		}
		return t, nil
	}
	return nil, apperrors.NewAppError(apperrors.ErrTaskNotFound, "task not found", nil)
}

func (r *fakeTaskRepository) MarkDone(c context.Context, userID, id uuid.UUID) (*task.Task, error) {
	return nil, nil
}

func TestCreateCorrection_Success(t *testing.T) {
	userID := uuid.New()
	attemptID := uuid.New()

	attemptRepo := &fakeAttemptRepository{
		attempts: map[uuid.UUID]*task_attempt.TaskAttempt{
			attemptID: {ID: attemptID, UserID: userID},
		},
	}
	repo := newFakeRepo()
	svc := NewService(repo, attemptRepo, &fakeTaskRepository{}, &fakeAIClient{})

	score := 0.85
	corr, err := svc.CreateCorrection(context.Background(), userID, attemptID, "Bom trabalho", &score)

	require.NoError(t, err)
	require.NotNil(t, corr)
	assert.Equal(t, attemptID, corr.AttemptID)
	assert.Equal(t, "Bom trabalho", corr.Feedback)
	assert.Equal(t, 0.85, *corr.Score)
}

func TestCreateCorrection_Forbidden(t *testing.T) {
	userID := uuid.New()
	otherUserID := uuid.New()
	attemptID := uuid.New()

	attemptRepo := &fakeAttemptRepository{
		attempts: map[uuid.UUID]*task_attempt.TaskAttempt{
			attemptID: {ID: attemptID, UserID: otherUserID},
		},
	}
	svc := NewService(newFakeRepo(), attemptRepo, &fakeTaskRepository{}, &fakeAIClient{})

	score := 0.5
	corr, err := svc.CreateCorrection(context.Background(), userID, attemptID, "Feedback", &score)

	require.Error(t, err)
	require.Nil(t, corr)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrForbidden, appErr.Code())
}

func TestCreateCorrection_InvalidScore(t *testing.T) {
	userID := uuid.New()
	attemptID := uuid.New()

	attemptRepo := &fakeAttemptRepository{
		attempts: map[uuid.UUID]*task_attempt.TaskAttempt{
			attemptID: {ID: attemptID, UserID: userID},
		},
	}
	svc := NewService(newFakeRepo(), attemptRepo, &fakeTaskRepository{}, &fakeAIClient{})

	invalidScore := 1.5
	corr, err := svc.CreateCorrection(context.Background(), userID, attemptID, "Feedback", &invalidScore)

	require.Error(t, err)
	require.Nil(t, corr)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrInvalidInput, appErr.Code())
}

func TestGetCorrectionByAttemptID_Success(t *testing.T) {
	userID := uuid.New()
	attemptID := uuid.New()

	repo := newFakeRepo()
	score := 0.9
	_, _ = repo.Create(context.Background(), &TaskCorrection{AttemptID: attemptID, Feedback: "Ótimo", Score: &score, Status: StatusCompleted})

	attemptRepo := &fakeAttemptRepository{
		attempts: map[uuid.UUID]*task_attempt.TaskAttempt{
			attemptID: {ID: attemptID, UserID: userID},
		},
	}
	svc := NewService(repo, attemptRepo, &fakeTaskRepository{}, &fakeAIClient{})

	corr, err := svc.GetCorrectionByAttemptID(context.Background(), userID, attemptID)

	require.NoError(t, err)
	require.NotNil(t, corr)
	assert.Equal(t, "Ótimo", corr.Feedback)
}

func TestGenerateEssayCorrection_Success(t *testing.T) {
	userID := uuid.New()
	taskID := uuid.New()
	attemptID := uuid.New()

	essayContent := task.EssayContent{
		Instructions: "Escreva sobre tecnologia",
		MinWords:     50,
		MaxWords:     200,
	}
	essayContentJSON, _ := json.Marshal(essayContent)
	attemptContentJSON, _ := json.Marshal("Esta é uma redação sobre tecnologia na sociedade moderna.")

	attemptRepo := &fakeAttemptRepository{
		attempts: map[uuid.UUID]*task_attempt.TaskAttempt{
			attemptID: {
				ID:      attemptID,
				UserID:  userID,
				TaskID:  taskID,
				Content: attemptContentJSON,
			},
		},
	}

	taskRepo := &fakeTaskRepository{
		tasks: map[uuid.UUID]*task.Task{
			taskID: {
				ID:      taskID,
				UserID:  userID,
				Type:    task.TaskEssay,
				Content: essayContentJSON,
				Meta: task.TaskMeta{
					Title:        "Redação de IA",
					Description:  "Escrever texto",
					Expectations: "Clareza",
				},
			},
		},
	}

	aiClient := &fakeAIClient{
		generateFn: func(prompt string) (string, error) {
			return "```json\n{\"feedback\":\"Texto muito bem escrito!\",\"score\":85.0}\n```", nil
		},
	}

	svc := NewService(newFakeRepo(), attemptRepo, taskRepo, aiClient)

	corr, err := svc.GenerateEssayCorrection(context.Background(), userID, attemptID)

	require.NoError(t, err)
	require.NotNil(t, corr)
	assert.Equal(t, attemptID, corr.AttemptID)
	assert.Equal(t, "Texto muito bem escrito!", corr.Feedback)
	assert.Equal(t, 0.85, *corr.Score)
}

func TestGenerateEssayCorrection_NotEssay(t *testing.T) {
	userID := uuid.New()
	taskID := uuid.New()
	attemptID := uuid.New()

	attemptRepo := &fakeAttemptRepository{
		attempts: map[uuid.UUID]*task_attempt.TaskAttempt{
			attemptID: {
				ID:      attemptID,
				UserID:  userID,
				TaskID:  taskID,
				Content: json.RawMessage(`"resposta"`),
			},
		},
	}

	taskRepo := &fakeTaskRepository{
		tasks: map[uuid.UUID]*task.Task{
			taskID: {
				ID:     taskID,
				UserID: userID,
				Type:   task.TaskQuiz,
			},
		},
	}

	svc := NewService(newFakeRepo(), attemptRepo, taskRepo, &fakeAIClient{})

	corr, err := svc.GenerateEssayCorrection(context.Background(), userID, attemptID)

	require.Error(t, err)
	require.Nil(t, corr)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrTaskAttemptTypeMismatch, appErr.Code())
}
