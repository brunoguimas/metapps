package task_correction

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_attempt"
	topic "github.com/brunoguimas/metapps/backend/internal/modules/topic"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Service interface {
	CreateCorrection(ctx context.Context, userID, attemptID uuid.UUID, feedback string, score *float64) (*TaskCorrection, error)
	GetCorrectionByAttemptID(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error)
	UpdateCorrection(ctx context.Context, correction *TaskCorrection) (*TaskCorrection, error)
	GenerateEssayCorrection(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error)
	GenerateQuizCorrection(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error)
}

type service struct {
	repo        Repository
	attemptRepo task_attempt.Repository
	taskRepo    task.TaskRepository
	topicRepo   topic.TopicRepository
	progressRepo topic.TopicProgressRepository
	client      ai.Client
}

func NewService(r Repository, attemptRepo task_attempt.Repository, taskRepo task.TaskRepository, topicRepo topic.TopicRepository, progressRepo topic.TopicProgressRepository, client ai.Client) Service {
	return &service{
		repo:        r,
		attemptRepo: attemptRepo,
		taskRepo:    taskRepo,
		topicRepo:   topicRepo,
		progressRepo: progressRepo,
		client:      client,
	}
}

func (s *service) CreateCorrection(ctx context.Context, userID, attemptID uuid.UUID, feedback string, score *float64) (*TaskCorrection, error) {
	// Verify the attempt exists and belongs to the user
	attempt, err := s.attemptRepo.GetByID(ctx, attemptID)
	if err != nil {
		return nil, err
	}

	if attempt.UserID != userID {
		return nil, apperrors.NewAppError(apperrors.ErrForbidden, "unauthorized to correct this attempt", nil)
	}

	if score != nil && (*score < 0 || *score > 1) {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "score must be between 0 and 1", nil)
	}

	correction := &TaskCorrection{
		AttemptID: attemptID,
		Feedback:  feedback,
		Score:     score,
		Status:    StatusCompleted,
	}

	createdCorrection, err := s.repo.Create(ctx, correction)
	if err != nil {
		return nil, err
	}
	if score != nil {
		s.updateProgress(ctx, userID, attemptID, *score)
	}
	return createdCorrection, nil
}

func (s *service) GetCorrectionByAttemptID(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error) {
	// Verify the attempt exists and belongs to the user
	attempt, err := s.attemptRepo.GetByID(ctx, attemptID)
	if err != nil {
		return nil, err
	}

	if attempt.UserID != userID {
		return nil, apperrors.NewAppError(apperrors.ErrForbidden, "unauthorized to access this correction", nil)
	}

	return s.repo.GetByAttemptID(ctx, attemptID)
}

func (s *service) UpdateCorrection(ctx context.Context, correction *TaskCorrection) (*TaskCorrection, error) {
	return s.repo.Update(ctx, correction)
}

// updateProgress updates the topic progress for the user based on the attempt and correction score.
func (s *service) updateProgress(ctx context.Context, userID, attemptID uuid.UUID, score float64) {
	// Get the attempt to get the task ID.
	attempt, err := s.attemptRepo.GetByID(ctx, attemptID)
	if err != nil {
		slog.Error("failed to get attempt for progress update", "attempt_id", attemptID, "error", err)
		return
	}

	// Get the task to get the topic ID and task details.
	taskObj, err := s.taskRepo.GetByID(ctx, userID, attempt.TaskID)
	if err != nil {
		slog.Error("failed to get task for progress update", "task_id", attempt.TaskID, "error", err)
		return
	}

	// Get the topic to get the required mastery.
	topicObj, err := s.topicRepo.Get(ctx, taskObj.TopicID)
	if err != nil {
		slog.Error("failed to get topic for progress update", "topic_id", taskObj.TopicID, "error", err)
		return
	}

	// Get or create the topic progress for the user and topic.
	progress, err := s.progressRepo.GetOrCreate(ctx, userID, taskObj.TopicID)
	if err != nil {
		slog.Error("failed to get or create topic progress", "user_id", userID, "topic_id", taskObj.TopicID, "error", err)
		return
	}

	// Calculate new mastery and confidence scores as a running average.
	// We'll update both mastery and confidence to the same value for simplicity.
	newAttempts := progress.AttemptsCount + 1
	newMastery := (progress.MasteryScore*float64(progress.AttemptsCount) + score) / float64(newAttempts)
	newConfidence := newMastery // For now, set confidence to the same as mastery.

	// Determine the new status based on the new mastery and the topic's required mastery.
	var newStatus topic.TopicStatus
	if newMastery >= topicObj.RequiredMastery {
		newStatus = topic.TopicStatusMastered
	} else if newMastery > 0 {
		newStatus = topic.TopicStatusInProgress
	} else {
		newStatus = topic.TopicStatusLocked
	}

	// Determine the evolution stage based on the new mastery score.
	var evolutionStage string
	switch {
	case newMastery < 0.2:
		evolutionStage = "Ovo"
	case newMastery < 0.4:
		evolutionStage = "Larva"
	case newMastery < 0.6:
		evolutionStage = "Pupa"
	case newMastery < 0.8:
		evolutionStage = "Juvenil"
	default:
		evolutionStage = "Adulto"
	}

	// Update the progress.
	progress.MasteryScore = newMastery
	progress.ConfidenceScore = newConfidence
	progress.AttemptsCount = int32(newAttempts)
	progress.Status = newStatus
	progress.EvolutionStage = evolutionStage

	// Save the updated progress.
	if err := s.progressRepo.Update(ctx, progress); err != nil {
		slog.Error("failed to update topic progress", "user_id", userID, "topic_id", taskObj.TopicID, "error", err)
		return
	}
}

// GenerateEssayCorrection generates an AI-powered correction for an essay attempt using correct_essay.txt template
func (s *service) GenerateEssayCorrection(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error) {
	attempt, err := s.attemptRepo.GetByID(ctx, attemptID)
	if err != nil {
		return nil, err
	}

	if attempt.UserID != userID {
		return nil, apperrors.NewAppError(apperrors.ErrForbidden, "unauthorized to correct this attempt", nil)
	}

	taskObj, err := s.taskRepo.GetByID(ctx, userID, attempt.TaskID)
	if err != nil {
		return nil, err
	}

	if taskObj.Type != task.TaskEssay {
		return nil, apperrors.NewAppError(apperrors.ErrTaskAttemptTypeMismatch, "task is not an essay type", nil)
	}

	var response string
	if err := json.Unmarshal(attempt.Content, &response); err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid attempt content", err)
	}
	if strings.TrimSpace(response) == "" {
		return nil, apperrors.NewAppError(apperrors.ErrEmptyEssayResponse, "essay response cannot be empty", nil)
	}

	var essayContent task.EssayContent
	if err := json.Unmarshal(taskObj.Content, &essayContent); err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid task content", err)
	}

	data := struct {
		Response     string
		Instructions string
		Expectations string
	}{
		Response:     response,
		Instructions: essayContent.Instructions,
		Expectations: taskObj.Meta.Expectations,
	}

	prompt, err := ai.RenderPrompt("correct_essay.txt", data)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "failed to render essay correction prompt", err)
	}

	aiResponse, err := s.client.Generate(ctx, prompt)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "failed to generate AI correction", err)
	}

	cleanedResponse := strings.TrimSpace(aiResponse)
	cleanedResponse = strings.TrimPrefix(cleanedResponse, "```json")
	cleanedResponse = strings.TrimPrefix(cleanedResponse, "```")
	cleanedResponse = strings.TrimSuffix(cleanedResponse, "```")
	cleanedResponse = strings.TrimSpace(cleanedResponse)

	var result struct {
		Feedback string  `json:"feedback"`
		Score    float64 `json:"score"`
	}

	if err := json.Unmarshal([]byte(cleanedResponse), &result); err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "failed to parse AI response", err)
	}

	if result.Score < 0 || result.Score > 100 {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidAIResponse, "invalid score from AI", nil)
	}

	normalizedScore := result.Score
	if normalizedScore > 1.0 {
		normalizedScore = normalizedScore / 100.0
	}

	correction := &TaskCorrection{
		AttemptID: attemptID,
		Feedback:  result.Feedback,
		Score:     &normalizedScore,
		Status:    StatusCompleted,
	}

	createdCorrection, err := s.repo.Create(ctx, correction)
	if err != nil {
		return nil, err
	}
	s.updateProgress(ctx, userID, attemptID, normalizedScore)
	return createdCorrection, nil
}

// GenerateQuizCorrection evaluates a quiz attempt deterministically and generates AI text feedback using correct_quiz.txt template
func (s *service) GenerateQuizCorrection(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error) {
	attempt, err := s.attemptRepo.GetByID(ctx, attemptID)
	if err != nil {
		return nil, err
	}

	if attempt.UserID != userID {
		return nil, apperrors.NewAppError(apperrors.ErrForbidden, "unauthorized to correct this attempt", nil)
	}

	taskObj, err := s.taskRepo.GetByID(ctx, userID, attempt.TaskID)
	if err != nil {
		return nil, err
	}

	if taskObj.Type != task.TaskQuiz {
		return nil, apperrors.NewAppError(apperrors.ErrTaskAttemptTypeMismatch, "task is not a quiz type", nil)
	}

	var quizContent task.QuizContent
	if err := json.Unmarshal(taskObj.Content, &quizContent); err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid task content", err)
	}

	if len(quizContent.Questions) == 0 {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "quiz has no questions", nil)
	}

	var attemptInput struct {
		Response []struct {
			QuestionIndex int             `json:"question_index"`
			Answer        json.RawMessage `json:"answer"`
		} `json:"response"`
	}

	if err := json.Unmarshal(attempt.Content, &attemptInput); err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid attempt content format", err)
	}

	answersByIndex := make(map[int]int, len(attemptInput.Response))
	for _, item := range attemptInput.Response {
		var idx int
		if err := json.Unmarshal(item.Answer, &idx); err == nil {
			answersByIndex[item.QuestionIndex] = idx
		}
	}

	totalQuestions := len(quizContent.Questions)
	correctCount := 0

	var detailsBuilder strings.Builder
	for i, q := range quizContent.Questions {
		submittedIdx, hasAnswer := answersByIndex[i]
		isCorrect := hasAnswer && submittedIdx == q.Answer
		if isCorrect {
			correctCount++
		}

		statusStr := "Incorreta"
		if isCorrect {
			statusStr = "Correta"
		}

		submittedText := "Não respondida"
		if hasAnswer && submittedIdx >= 0 && submittedIdx < len(q.Alternatives) {
			submittedText = q.Alternatives[submittedIdx]
		}

		correctText := "Opção inválida"
		if q.Answer >= 0 && q.Answer < len(q.Alternatives) {
			correctText = q.Alternatives[q.Answer]
		}

		detailsBuilder.WriteString(fmt.Sprintf("Questão %d: %s\n- Enunciado: %s\n- Resposta do aluno: %s\n- Resposta correta: %s\n- Status: %s\n- Explicação: %s\n\n",
			i+1, statusStr, q.Statement, submittedText, correctText, statusStr, q.Explanation))
	}

	deterministicScore := float64(correctCount) / float64(totalQuestions)
	if attempt.Score != nil {
		deterministicScore = *attempt.Score
	}

	scorePercent := fmt.Sprintf("%.1f", deterministicScore*100)

	promptData := struct {
		TaskTitle       string
		ScorePercent    string
		CorrectAnswers  int
		TotalQuestions  int
		QuestionDetails string
	}{
		TaskTitle:       taskObj.Meta.Title,
		ScorePercent:    scorePercent,
		CorrectAnswers:  correctCount,
		TotalQuestions:  totalQuestions,
		QuestionDetails: detailsBuilder.String(),
	}

	prompt, err := ai.RenderPrompt("correct_quiz.txt", promptData)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "failed to render quiz correction prompt", err)
	}

	aiResponse, err := s.client.Generate(ctx, prompt)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "failed to generate AI quiz correction", err)
	}

	feedbackText := strings.TrimSpace(aiResponse)
	feedbackText = strings.TrimPrefix(feedbackText, "```")
	feedbackText = strings.TrimSuffix(feedbackText, "```")
	feedbackText = strings.TrimSpace(feedbackText)

	correction := &TaskCorrection{
		AttemptID: attemptID,
		Feedback:  feedbackText,
		Score:     &deterministicScore,
		Status:    StatusCompleted,
	}

	createdCorrection, err := s.repo.Create(ctx, correction)
	if err != nil {
		return nil, err
	}
	s.updateProgress(ctx, userID, attemptID, deterministicScore)
	return createdCorrection, nil
}
