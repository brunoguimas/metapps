package task_correction

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_attempt"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Service interface {
	CreateCorrection(ctx context.Context, userID, attemptID uuid.UUID, feedback string, score *float64) (*TaskCorrection, error)
	GetCorrectionByAttemptID(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error)
	UpdateCorrection(ctx context.Context, correction *TaskCorrection) (*TaskCorrection, error)
	GenerateQuizCorrection(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error)
}

type taskCorrectionService struct {
	repo        Repository
	attemptRepo task_attempt.Repository
	taskRepo    task.Repository
	client      ai.Client
}

func NewService(r Repository, attemptRepo task_attempt.Repository, taskRepo task.Repository, client ai.Client) Service {
	return &taskCorrectionService{
		repo:        r,
		attemptRepo: attemptRepo,
		taskRepo:    taskRepo,
		client:      client,
	}
}

func (s *taskCorrectionService) CreateCorrection(ctx context.Context, userID, attemptID uuid.UUID, feedback string, score *float64) (*TaskCorrection, error) {
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
	// O progresso do topico NAO e atualizado aqui.
	//
	// A maestria e registrada em um unico lugar (task_attempt.Finish ->
	// topic.RecordAttempt). Antes, esta funcao recalculava a media das
	// tentativas por conta propria e rodava duas vezes (CreateCorrection e
	// GenerateQuizCorrection), sobrescrevendo o valor gravado pelo modulo
	// de tentativas.
	return createdCorrection, nil
}

func (s *taskCorrectionService) GetCorrectionByAttemptID(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error) {
	attempt, err := s.attemptRepo.GetByID(ctx, attemptID)
	if err != nil {
		return nil, err
	}

	if attempt.UserID != userID {
		return nil, apperrors.NewAppError(apperrors.ErrForbidden, "unauthorized to access this correction", nil)
	}

	return s.repo.GetByAttemptID(ctx, attemptID)
}

func (s *taskCorrectionService) UpdateCorrection(ctx context.Context, correction *TaskCorrection) (*TaskCorrection, error) {
	return s.repo.Update(ctx, correction)
}

// GenerateQuizCorrection gera o comentario final da IA sobre a sessao.
//
// O progresso do topico NAO e gravado aqui: a escrita autoritativa
// acontece em task_attempt.Finish (que ja chama topic.RecordAttempt).
// Antes esta funcao gravava a mesma tentativa de novo, o que contava o
// contador de tentativas do topico dobrado e distorcia a media de
// confianca.
func (s *taskCorrectionService) GenerateQuizCorrection(ctx context.Context, userID, attemptID uuid.UUID) (*TaskCorrection, error) {
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

	// O conteudo da task e normalizado para steps: assim a correcao da IA
	// funciona tanto para tasks novas (v2) quanto para as antigas (v1,
	// com `questions`).
	lesson, err := taskObj.Decode()
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid task content", err)
	}

	if len(lesson.Steps) == 0 {
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

	totalQuestions := len(lesson.Steps)
	correctCount := 0

	var detailsBuilder strings.Builder
	for i, q := range lesson.Steps {
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

	aiResponse, err := s.client.Generate(ctx, ai.Request{
		Prompt: prompt,
		Format: ai.OutputFormatText,
	})
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
	return createdCorrection, nil
}
