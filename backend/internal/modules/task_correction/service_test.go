package task_correction

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_attempt"
	topic "github.com/brunoguimas/metapps/backend/internal/modules/topic"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeAIClient struct {
	generateFn func(context.Context, string) (string, error)
}

func (c *fakeAIClient) Generate(ctx context.Context, prompt string) (string, error) {
	if c.generateFn != nil {
		return c.generateFn(ctx, prompt)
	}
	return `{"feedback":"Excelente redação!","score":90}`, nil
}

type fakeRepository struct {
	corrections map[uuid.UUID]*TaskCorrection
}

func newFakeRepo() *fakeRepository {
	return &fakeRepository{
		corrections: make(map[uuid.UUID]*TaskCorrection),
	}
}

func (r *fakeRepository) Create(c context.Context, correction *TaskCorrection) (*TaskCorrection, error) {
	if correction.ID == uuid.Nil {
		correction.ID = uuid.New()
	}
	correction.CreatedAt = time.Now()
	correction.UpdatedAt = time.Now()
	r.corrections[correction.AttemptID] = correction
	return correction, nil
}

func (r *fakeRepository) GetByID(c context.Context, id uuid.UUID) (*TaskCorrection, error) {
	for _, corr := range r.corrections {
		if corr.ID == id {
			return corr, nil
		}
	}
	return nil, apperrors.NewAppError(apperrors.ErrTaskCorrectionNotFound, "correction not found", nil)
}

func (r *fakeRepository) GetByAttemptID(c context.Context, attemptID uuid.UUID) (*TaskCorrection, error) {
	if corr, ok := r.corrections[attemptID]; ok {
		return corr, nil
	}
	return nil, apperrors.NewAppError(apperrors.ErrTaskCorrectionNotFound, "correction not found for attempt", nil)
}

func (r *fakeRepository) Update(c context.Context, correction *TaskCorrection) (*TaskCorrection, error) {
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

type fakeTopicRepository struct {
}

func (r *fakeTopicRepository) Get(c context.Context, topicID uuid.UUID) (*topic.Topic, error) {
	return &topic.Topic{ID: topicID}, nil
}

func (r *fakeTopicRepository) GetByGoalID(c context.Context, goalID uuid.UUID) ([]*topic.Topic, error) {
	return []*topic.Topic{{ID: goalID}}, nil
}

func (r *fakeTopicRepository) Create(c context.Context, t *topic.Topic) (*topic.Topic, error) {
	t.ID = uuid.New()
	return t, nil
}

func (r *fakeTopicRepository) DeleteByGoalID(c context.Context, goalID uuid.UUID) error {
	return nil
}

type fakeTopicProgressRepository struct {
}

func (r *fakeTopicProgressRepository) GetOrCreate(c context.Context, userID, topicID uuid.UUID) (*topic.TopicProgress, error) {
	return &topic.TopicProgress{
		ID:              uuid.New(),
		UserID:          userID,
		TopicID:         topicID,
		MasteryScore:    0,
		ConfidenceScore: 0,
		AttemptsCount:   0,
		Status:          topic.TopicStatusLocked,
	}, nil
}

func (r *fakeTopicProgressRepository) Update(c context.Context, progress *topic.TopicProgress) error {
	return nil
}

func TestCreateCorrection_Success(t *testing.T) {
	userID := uuid.New()
	attemptID := uuid.New()
	taskID := uuid.New()

	attemptRepo := &fakeAttemptRepository{
		attempts: map[uuid.UUID]*task_attempt.TaskAttempt{
			attemptID: {ID: attemptID, UserID: userID, TaskID: taskID},
		},
	}
	taskRepo := &fakeTaskRepository{
		tasks: map[uuid.UUID]*task.Task{
			taskID: {
				ID:      taskID,
				UserID:  userID,
				Type:    task.TaskEssay,
				Content: json.RawMessage(`{"instructions":"Escreva sobre algo"}`),
				Meta: task.TaskMeta{
					Title:        "Tarefa de Teste",
					Description:  "Descrição da tarefa",
					Expectations: "Escrever algo coerente",
				},
			},
		},
	}
	topicRepo := &fakeTopicRepository{}
	progressRepo := &fakeTopicProgressRepository{}
	repo := newFakeRepo()
	svc := NewService(repo, attemptRepo, taskRepo, topicRepo, progressRepo, &fakeAIClient{})

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
	taskRepo := &fakeTaskRepository{}
	topicRepo := &fakeTopicRepository{}
	progressRepo := &fakeTopicProgressRepository{}
	svc := NewService(newFakeRepo(), attemptRepo, taskRepo, topicRepo, progressRepo, &fakeAIClient{})

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
	taskRepo := &fakeTaskRepository{}
	topicRepo := &fakeTopicRepository{}
	progressRepo := &fakeTopicProgressRepository{}
	svc := NewService(newFakeRepo(), attemptRepo, taskRepo, topicRepo, progressRepo, &fakeAIClient{})

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
	taskRepo := &fakeTaskRepository{}
	topicRepo := &fakeTopicRepository{}
	progressRepo := &fakeTopicProgressRepository{}
	svc := NewService(repo, attemptRepo, taskRepo, topicRepo, progressRepo, &fakeAIClient{})

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
		generateFn: func(ctx context.Context, prompt string) (string, error) {
			return "```json\n{\"feedback\":\"Texto muito bem escrito!\",\"score\":85.0}\n```", nil
		},
	}

	topicRepo := &fakeTopicRepository{}
	progressRepo := &fakeTopicProgressRepository{}
	svc := NewService(newFakeRepo(), attemptRepo, taskRepo, topicRepo, progressRepo, aiClient)

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

	topicRepo := &fakeTopicRepository{}
	progressRepo := &fakeTopicProgressRepository{}
	svc := NewService(newFakeRepo(), attemptRepo, taskRepo, topicRepo, progressRepo, &fakeAIClient{})

	corr, err := svc.GenerateEssayCorrection(context.Background(), userID, attemptID)

	require.Error(t, err)
	require.Nil(t, corr)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrTaskAttemptTypeMismatch, appErr.Code())
}

func TestGenerateQuizCorrection_Success(t *testing.T) {
	userID := uuid.New()
	taskID := uuid.New()
	attemptID := uuid.New()

	quizContent := task.QuizContent{
		Questions: []task.QuizQuestion{
			{
				Statement:    "Qual é a capital do Brasil?",
				Alternatives: []string{"São Paulo", "Rio de Janeiro", "Brasília", "Salvador"},
				Answer:       2, // Brasília
				Explanation:  "Brasília é a capital do Brasil desde 1960.",
			},
			{
				Statement:    "Quanto é 2 + 2?",
				Alternatives: []string{"3", "4", "5", "6"},
				Answer:       1, // 4
				Explanation:  "2 + 2 igual a 4.",
			},
		},
	}
	quizContentJSON, _ := json.Marshal(quizContent)
	attemptContentJSON, _ := json.Marshal(map[string]interface{}{
		"response": []map[string]interface{}{
			{"question_index": 0, "answer": 2}, // Correto
			{"question_index": 1, "answer": 1}, // Correto
		},
	})

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
				Type:    task.TaskQuiz,
				Content: quizContentJSON,
				Meta: task.TaskMeta{
					Title:        "Quiz de Geografia e Matemática",
					Description:  "Teste de conhecimentos básicos",
					Expectations: "Responder corretamente todas as questões",
				},
			},
		},
	}

	aiClient := &fakeAIClient{
		generateFn: func(ctx context.Context, prompt string) (string, error) {
			return " ótimo trabalho! Você acertou todas as questões. " +
				"Continue estudando para manter esse desempenho.", nil
		},
	}

	topicRepo := &fakeTopicRepository{}
	progressRepo := &fakeTopicProgressRepository{}
	svc := NewService(newFakeRepo(), attemptRepo, taskRepo, topicRepo, progressRepo, aiClient)

	corr, err := svc.GenerateQuizCorrection(context.Background(), userID, attemptID)

	require.NoError(t, err)
	require.NotNil(t, corr)
	assert.Equal(t, attemptID, corr.AttemptID)
	assert.Contains(t, corr.Feedback, "ótimo trabalho")
	assert.NotNil(t, corr.Score)
	assert.Equal(t, 1.0, *corr.Score) // Todas as questões corretas
}

func TestGenerateQuizCorrection_NotQuiz(t *testing.T) {
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
				Type:   task.TaskEssay, // Not a quiz
			},
		},
	}

	topicRepo := &fakeTopicRepository{}
	progressRepo := &fakeTopicProgressRepository{}
	svc := NewService(newFakeRepo(), attemptRepo, taskRepo, topicRepo, progressRepo, &fakeAIClient{})

	corr, err := svc.GenerateQuizCorrection(context.Background(), userID, attemptID)

	require.Error(t, err)
	require.Nil(t, corr)
	appErr, ok := apperrors.As(err)
	require.True(t, ok)
	assert.Equal(t, apperrors.ErrTaskAttemptTypeMismatch, appErr.Code())
}
