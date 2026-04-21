package taskattempt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

type Service interface {
	Submit(c context.Context, userID, taskID uuid.UUID, input *CreateAttemptInput) (*TaskAttempt, *task.Task, error)
	ListByUser(c context.Context, userID uuid.UUID) ([]*TaskAttempt, error)
	ListByUserAndTask(c context.Context, userID, taskID uuid.UUID) ([]*TaskAttempt, error)
}

type service struct {
	repo     Repository
	taskRepo task.TaskRepository
}

func NewService(r Repository, taskRepo task.TaskRepository) Service {
	return &service{repo: r, taskRepo: taskRepo}
}

func (s *service) Submit(c context.Context, userID, taskID uuid.UUID, input *CreateAttemptInput) (*TaskAttempt, *task.Task, error) {
	currentTask, err := s.taskRepo.GetByID(c, userID, taskID)
	if err != nil {
		return nil, nil, err
	}

	if input.Type != currentTask.Type {
		return nil, nil, apperrors.NewAppError(apperrors.ErrTaskAttemptTypeMismatch, "task attempt type does not match task type", nil)
	}

	content, score, evaluation, err := s.evaluateAttempt(currentTask, input)
	if err != nil {
		return nil, nil, err
	}

	attempt := &TaskAttempt{
		UserID:         userID,
		TaskID:         taskID,
		Content:        content,
		Score:          score,
		Status:         StatusProcessed,
		TaskEvaluation: evaluation,
	}

	created, err := s.repo.Create(c, attempt)
	if err != nil {
		return nil, nil, err
	}

	updatedTask, err := s.taskRepo.MarkDone(c, userID, taskID)
	if err != nil {
		return nil, nil, err
	}

	return created, updatedTask, nil
}

func (s *service) ListByUser(c context.Context, userID uuid.UUID) ([]*TaskAttempt, error) {
	return s.repo.ListByUser(c, userID)
}

func (s *service) ListByUserAndTask(c context.Context, userID, taskID uuid.UUID) ([]*TaskAttempt, error) {
	return s.repo.ListByUserAndTask(c, userID, taskID)
}

func (s *service) evaluateAttempt(currentTask *task.Task, input *CreateAttemptInput) (json.RawMessage, *float64, json.RawMessage, error) {
	content, err := json.Marshal(input)
	if err != nil {
		return nil, nil, nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "invalid task attempt payload", err)
	}

	switch currentTask.Type {
	case task.TaskEssay:
		var response string
		if err := json.Unmarshal(input.Response, &response); err != nil {
			return nil, nil, nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "essay response must be a string", err)
		}
		if strings.TrimSpace(response) == "" {
			return nil, nil, nil, apperrors.NewAppError(apperrors.ErrEmptyEssayResponse, "essay response cannot be empty", nil)
		}
		return content, nil, nil, nil
	case task.TaskQuiz:
		score, evaluation, err := evaluateQuiz(currentTask, input.Response)
		if err != nil {
			return nil, nil, nil, err
		}
		return content, &score, evaluation, nil
	default:
		return nil, nil, nil, apperrors.NewAppError(apperrors.ErrUnknownTaskType, fmt.Sprintf("unknown task type: %s", currentTask.Type), nil)
	}
}

func evaluateQuiz(currentTask *task.Task, rawResponse json.RawMessage) (float64, json.RawMessage, error) {
	decoded, err := currentTask.Decode()
	if err != nil {
		return 0, nil, err
	}

	quiz, ok := decoded.(task.QuizContent)
	if !ok {
		return 0, nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "task content is not a quiz", nil)
	}

	var responseItems []QuizAttemptResponseItem
	if err := json.Unmarshal(rawResponse, &responseItems); err != nil {
		return 0, nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "quiz response must be an array", err)
	}

	answersByIndex := make(map[int]json.RawMessage, len(responseItems))
	for _, item := range responseItems {
		if item.QuestionIndex < 0 || item.QuestionIndex >= len(quiz.Questions) {
			return 0, nil, apperrors.NewAppError(apperrors.ErrInvalidQuestionIndex, "invalid question index", nil)
		}
		if _, exists := answersByIndex[item.QuestionIndex]; exists {
			return 0, nil, apperrors.NewAppError(apperrors.ErrDuplicateQuestionAnswer, "duplicate answer for question", nil)
		}
		answersByIndex[item.QuestionIndex] = item.Answer
	}

	evaluation := QuizEvaluation{
		TotalQuestions: len(quiz.Questions),
		Items:          make([]QuizQuestionEvaluation, 0, len(quiz.Questions)),
		ScoringMethod:  "correct_answers/total_questions",
	}

	for idx, question := range quiz.Questions {
		submittedAnswer := answersByIndex[idx]
		submittedIndex, hasAnswer := parseAnswerIndex(submittedAnswer)
		correct := hasAnswer && submittedIndex == question.Answer
		if correct {
			evaluation.CorrectAnswers++
		}

		evaluation.Items = append(evaluation.Items, QuizQuestionEvaluation{
			QuestionIndex:   idx,
			CorrectAnswer:   question.Answer,
			SubmittedAnswer: cloneRawMessage(submittedAnswer),
			Correct:         correct,
			Explanation:     question.Explanation,
		})
	}

	score := float64(evaluation.CorrectAnswers) / float64(evaluation.TotalQuestions)
	payload, err := json.Marshal(evaluation)
	if err != nil {
		return 0, nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't marshal quiz evaluation", err)
	}

	return score, payload, nil
}

func parseAnswerIndex(raw json.RawMessage) (int, bool) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return 0, false
	}

	var numeric int
	if err := json.Unmarshal(raw, &numeric); err == nil {
		return numeric, true
	}

	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		trimmed := strings.TrimSpace(text)
		if trimmed == "" {
			return 0, false
		}
		value, err := strconv.Atoi(trimmed)
		if err != nil {
			return 0, false
		}
		return value, true
	}

	return 0, false
}

func cloneRawMessage(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return nil
	}
	cloned := make([]byte, len(raw))
	copy(cloned, raw)
	return cloned
}
