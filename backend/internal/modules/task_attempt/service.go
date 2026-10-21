package task_attempt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/modules/daily_activity"
	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/review"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_step_attempt"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/brunoguimas/metapps/backend/internal/shared/gamification"
	"github.com/google/uuid"
)

type Service interface {
	// Submit grava a tentativa inteira de uma vez (rota legada).
	Submit(c context.Context, userID, taskID uuid.UUID, input *CreateAttemptInput) (*TaskAttempt, *task.Task, error)

	// AnswerStep corrige um unico exercicio e devolve o feedback
	// instantaneo. E idempotente: responder o mesmo passo de novo nao
	// devolve XP duas vezes.
	AnswerStep(c context.Context, userID, taskID uuid.UUID, stepIndex int, answer json.RawMessage) (*StepResult, error)

	// Finish encerra a sessao: calcula o score, da o bonus final, atualiza
	// o progresso do topico e a atividade do dia.
	Finish(c context.Context, userID, taskID uuid.UUID, metadata *TaskAttemptMetadata) (*SessionResult, error)

	ListByUser(c context.Context, userID uuid.UUID) ([]*TaskAttempt, error)
	ListByUserAndTask(c context.Context, userID, taskID uuid.UUID) ([]*TaskAttempt, error)
}

type taskAttemptService struct {
	repo           Repository
	taskRepo       task.Repository
	topics         topic.Service
	profileService profile.Service
	steps          task_step_attempt.Service
	reviews        review.Service
	daily          daily_activity.Service
}

func NewService(
	r Repository,
	taskRepo task.Repository,
	topics topic.Service,
	profileService profile.Service,
	steps task_step_attempt.Service,
	reviews review.Service,
	daily daily_activity.Service,
) Service {
	return &taskAttemptService{
		repo:           r,
		taskRepo:       taskRepo,
		topics:         topics,
		profileService: profileService,
		steps:          steps,
		reviews:        reviews,
		daily:          daily,
	}
}

// Submit grava a tentativa inteira de uma vez.
//
// A rota legada (envio em lote) continua funcionando, mas internamente
// percorre os mesmos caminhos de AnswerStep e Finish. Assim as regras de
// XP e de progresso nao existem em dois lugares diferentes.
func (s *taskAttemptService) Submit(c context.Context, userID, taskID uuid.UUID, input *CreateAttemptInput) (*TaskAttempt, *task.Task, error) {
	currentTask, err := s.taskRepo.GetByID(c, userID, taskID)
	if err != nil {
		return nil, nil, err
	}

	if input.Type != currentTask.Type {
		return nil, nil, apperrors.NewAppError(apperrors.ErrTaskAttemptTypeMismatch, "task attempt type does not match task type", nil)
	}

	var items []QuizAttemptResponseItem
	if err := json.Unmarshal(input.Response, &items); err != nil {
		return nil, nil, apperrors.NewAppError(apperrors.ErrInvalidInput, "quiz response must be an array", err)
	}

	for _, item := range items {
		if _, err := s.AnswerStep(c, userID, taskID, item.QuestionIndex, item.Answer); err != nil {
			return nil, nil, err
		}
	}

	result, updatedTask, err := s.finishSession(c, userID, taskID, input.Metadata)
	if err != nil {
		return nil, nil, err
	}
	_ = result

	attempts, err := s.repo.ListByUserAndTask(c, userID, taskID)
	if err != nil {
		return nil, nil, err
	}
	if len(attempts) == 0 {
		return nil, nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't persist attempt", nil)
	}

	return attempts[0], updatedTask, nil
}
// AnswerStep corrige um exercicio e devolve o feedback instantaneo.
func (s *taskAttemptService) AnswerStep(c context.Context, userID, taskID uuid.UUID, stepIndex int, answer json.RawMessage) (*StepResult, error) {
	currentTask, err := s.taskRepo.GetByID(c, userID, taskID)
	if err != nil {
		return nil, err
	}

	lesson, err := currentTask.Decode()
	if err != nil {
		return nil, err
	}

	if stepIndex < 0 || stepIndex >= len(lesson.Steps) {
		return nil, apperrors.NewAppError(
			apperrors.ErrInvalidQuestionIndex,
			fmt.Sprintf("step index out of range: received %d but the session has %d exercises", stepIndex, len(lesson.Steps)),
			nil,
		)
	}

	step := lesson.Steps[stepIndex]

	// Idempotencia: o passo ja respondido devolve o mesmo resultado.
	existing, err := s.steps.GetByTaskAndStep(c, taskID, stepIndex)
	if err == nil && existing != nil {
		return s.buildStepResult(c, userID, currentTask, lesson, stepIndex, existing.Correct, existing.XP)
	}

	submittedIndex, hasAnswer := parseAnswerIndex(answer)
	correct := hasAnswer && submittedIndex == step.Answer

	attempts, err := s.steps.ListByTask(c, taskID)
	if err != nil {
		return nil, err
	}

	combo := 0
	for _, attempt := range attempts {
		if attempt.StepIndex >= stepIndex {
			continue
		}
		if attempt.Correct {
			combo++
		} else {
			combo = 0
		}
	}
	if correct {
		combo++
	} else {
		// Errar quebra o combo: é o que zera a sequência.
		combo = 0
	}

	xp := gamification.XPWrongStep
	if correct {
		xp = gamification.StepXP(combo)
	}

	recorded, err := s.steps.Record(c, userID, taskID, stepIndex, cloneRawMessage(answer), correct, xp)
	if err != nil {
		return nil, err
	}

	// XP e streak: tudo calculado no servidor.
	if _, err := s.profileService.AddXP(c, userID, xp); err != nil {
		return nil, err
	}
	if _, err := s.profileService.TouchActivity(c, userID); err != nil {
		return nil, err
	}

	// Atividade do dia: a meta diaria conta o XP ganho, nao o penalty.
	dailyXP := xp
	if dailyXP < 0 {
		dailyXP = 0
	}
	if _, err := s.daily.Record(c, userID, dailyXP, 1, 0, 0); err != nil {
		return nil, err
	}

	// Fila de revisao espacada: errou -> amanha; acertou -> consolida.
	if _, err := s.reviews.Schedule(c, userID, taskID, stepIndex, step.QuestionHash(), correct); err != nil {
		return nil, err
	}

	// Estado da sessao.
	currentTask.StepCursor = maxInt(currentTask.StepCursor, stepIndex+1)
	currentTask.Status = task.StatusInProgress
	if combo > currentTask.MaxCombo {
		currentTask.MaxCombo = combo
	}
	if _, err := s.taskRepo.UpdateSession(c, currentTask); err != nil {
		return nil, err
	}

	return s.buildStepResult(c, userID, currentTask, lesson, stepIndex, recorded.Correct, recorded.XP)
}

// buildStepResult monta a resposta de feedback instantaneo.
func (s *taskAttemptService) buildStepResult(
	c context.Context,
	userID uuid.UUID,
	currentTask *task.Task,
	lesson *task.LessonContent,
	stepIndex int,
	correct bool,
	xp int,
) (*StepResult, error) {
	step := lesson.Steps[stepIndex]

	attempts, err := s.steps.ListByTask(c, currentTask.ID)
	if err != nil {
		return nil, err
	}

	combo := 0
	for _, attempt := range attempts {
		if attempt.StepIndex >= stepIndex {
			continue
		}
		if attempt.Correct {
			combo++
		} else {
			combo = 0
		}
	}
	if correct {
		combo++
	} else {
		combo = 0
	}

	maxCombo := currentTask.MaxCombo
	if combo > maxCombo {
		maxCombo = combo
	}

	profile, err := s.profileService.GetProfileByUserID(c, userID)
	if err != nil {
		return nil, err
	}

	daily, err := s.daily.Today(c, userID)
	if err != nil {
		return nil, err
	}

	nextStep := stepIndex + 1
	if nextStep >= len(lesson.Steps) {
		nextStep = -1
	}

	return &StepResult{
		TaskID:        currentTask.ID,
		StepIndex:     stepIndex,
		TotalSteps:    len(lesson.Steps),
		Correct:       correct,
		CorrectAnswer: step.Answer,
		Explanation:   step.Explanation,
		Hint:          step.Hint,
		Skill:         step.Skill,
		XP:            xp,
		XPTotal:       profile.XP,
		Combo:         combo,
		MaxCombo:      maxCombo,
		NextStepIndex: nextStep,
		Streak:        profile.StreakExibida(time.Now()),
		DailyXP:       daily.XP,
		DailyGoal:     profile.DailyGoalXP,
	}, nil
}

// Finish encerra a sessao.
func (s *taskAttemptService) Finish(c context.Context, userID, taskID uuid.UUID, metadata *TaskAttemptMetadata) (*SessionResult, error) {
	result, _, err := s.finishSession(c, userID, taskID, metadata)
	return result, err
}

// finishSession encerra a sessao e devolve o resumo junto da task
// atualizada.
func (s *taskAttemptService) finishSession(c context.Context, userID, taskID uuid.UUID, metadata *TaskAttemptMetadata) (*SessionResult, *task.Task, error) {
	currentTask, err := s.taskRepo.GetByID(c, userID, taskID)
	if err != nil {
		return nil, nil, err
	}

	lesson, err := currentTask.Decode()
	if err != nil {
		return nil, nil, err
	}

	attempts, err := s.steps.ListByTask(c, taskID)
	if err != nil {
		return nil, nil, err
	}

	// Idempotencia: sessao ja encerrada devolve o resultado persistido.
	if currentTask.Status == task.StatusCompleted || currentTask.Status == task.StatusFailed {
		result, err := s.buildSessionResult(c, userID, currentTask, lesson, attempts, 0, true)
		return result, currentTask, err
	}

	correctByIndex := make(map[int]bool, len(attempts))
	for _, attempt := range attempts {
		correctByIndex[attempt.StepIndex] = attempt.Correct
	}

	correctCount := 0
	wrongSteps := make([]int, 0)
	for i := range lesson.Steps {
		if correctByIndex[i] {
			correctCount++
		} else {
			wrongSteps = append(wrongSteps, i)
		}
	}

	total := len(lesson.Steps)
	score := 0.0
	if total > 0 {
		// Arredondado uma unica vez para que score, comparacao com a
		// maestria e exibicao usem exatamente o mesmo valor.
		score = roundFloat(float64(correctCount) / float64(total))
	}

	perfect := total > 0 && correctCount == total

	// Bonus final.
	finishXP := 0
	if perfect {
		finishXP += gamification.XPPerfectBonus
	}

	tp, err := s.topics.Get(c, currentTask.TopicID)
	if err != nil {
		return nil, nil, err
	}
	requiredMastery := tp.RequiredMastery
	mastered := score >= requiredMastery

	// A pratica livre nao mexe no progresso do topico: ela existe para
	// treinar sem consequence na trilha.
	affectsProgress := currentTask.Source == task.SourceLesson || currentTask.Source == task.SourceReview

	if affectsProgress && mastered {
		finishXP += gamification.MasteryXP(tp.Weight)
	}

	if finishXP != 0 {
		if _, err := s.profileService.AddXP(c, userID, finishXP); err != nil {
			return nil, nil, err
		}
	}

	if affectsProgress {
		if _, err := s.topics.RecordAttempt(c, userID, currentTask.TopicID, score); err != nil {
			return nil, nil, err
		}
	}

	// Estado da sessao.
	currentTask.Done = true
	currentTask.Score = &score
	currentTask.XPGained = finishXP
	if perfect {
		currentTask.Status = task.StatusCompleted
	} else if score >= requiredMastery {
		currentTask.Status = task.StatusCompleted
	} else {
		currentTask.Status = task.StatusFailed
	}

	updatedTask, err := s.taskRepo.UpdateDone(c, currentTask)
	if err != nil {
		return nil, nil, err
	}

	// Registro da tentativa (historico + correcao da IA).
	attempt, err := s.persistAttempt(c, userID, updatedTask, lesson, attempts, score)
	if err != nil {
		return nil, nil, err
	}

	// Atividade do dia: uma lesson concluida.
	seconds := 0
	if metadata != nil && metadata.TimeSpentMs != nil {
		seconds = *metadata.TimeSpentMs / 1000
	}
	if _, err := s.daily.Record(c, userID, 0, 0, 1, seconds); err != nil {
		return nil, nil, err
	}

	result, err := s.buildSessionResult(c, userID, updatedTask, lesson, attempts, finishXP, false, attempt.ID)
	if err != nil {
		return nil, nil, err
	}

	return result, updatedTask, nil
}

// buildSessionResult monta o resumo final da sessao.
func (s *taskAttemptService) buildSessionResult(
	c context.Context,
	userID uuid.UUID,
	currentTask *task.Task,
	lesson *task.LessonContent,
	attempts []*task_step_attempt.TaskStepAttempt,
	finishXP int,
	replay bool,
	attemptID ...uuid.UUID,
) (*SessionResult, error) {
	correctByIndex := make(map[int]bool, len(attempts))
	for _, attempt := range attempts {
		correctByIndex[attempt.StepIndex] = attempt.Correct
	}

	correctCount := 0
	wrongSteps := make([]int, 0)
	for i := range lesson.Steps {
		if correctByIndex[i] {
			correctCount++
		} else {
			wrongSteps = append(wrongSteps, i)
		}
	}

	total := len(lesson.Steps)
	score := 0.0
	if total > 0 {
		score = roundFloat(float64(correctCount) / float64(total))
	}

	tp, err := s.topics.Get(c, currentTask.TopicID)
	if err != nil {
		return nil, err
	}

	profile, err := s.profileService.GetProfileByUserID(c, userID)
	if err != nil {
		return nil, err
	}

	daily, err := s.daily.Today(c, userID)
	if err != nil {
		return nil, err
	}

	// O XP total da sessao e a soma do que cada passo rendeu, mais o
	// bonus final (perfeito/dominio do topico).
	//
	// Nao fica negativo: o perfil nunca fica, e mostrar "-3 XP" no
	// resumo contradiz o que o usuario ve no perfil.
	totalXP := currentTask.XPGained
	if finishXP != 0 {
		totalXP = finishXP
	}
	for _, attempt := range attempts {
		totalXP += attempt.XP
	}
	if totalXP < 0 {
		totalXP = 0
	}

	var id uuid.UUID
	if len(attemptID) > 0 {
		id = attemptID[0]
	}

	return &SessionResult{
		TaskID:          currentTask.ID,
		TopicID:         currentTask.TopicID,
		Source:          string(currentTask.Source),
		Score:           score,
		CorrectAnswers:  correctCount,
		TotalQuestions:  total,
		XP:              totalXP,
		MaxCombo:        currentTask.MaxCombo,
		Mastered:        score >= tp.RequiredMastery,
		RequiredMastery: tp.RequiredMastery,
		Perfect:         total > 0 && correctCount == total,
		Streak:          profile.StreakExibida(time.Now()),
		DailyXP:         daily.XP,
		DailyGoal:       profile.DailyGoalXP,
		WrongSteps:      wrongSteps,
		AttemptID:       id,
	}, nil
}

// persistAttempt grava a tentativa no formato legado (historico e
// correcao da IA dependem dele).
func (s *taskAttemptService) persistAttempt(
	c context.Context,
	userID uuid.UUID,
	currentTask *task.Task,
	lesson *task.LessonContent,
	attempts []*task_step_attempt.TaskStepAttempt,
	score float64,
) (*TaskAttempt, error) {
	answersByIndex := make(map[int]json.RawMessage, len(attempts))
	for _, attempt := range attempts {
		answersByIndex[attempt.StepIndex] = attempt.Answer
	}

	responseItems := make([]QuizAttemptResponseItem, 0, len(attempts))
	for index := range lesson.Steps {
		answer, ok := answersByIndex[index]
		if !ok {
			answer = json.RawMessage("null")
		}
		responseItems = append(responseItems, QuizAttemptResponseItem{
			QuestionIndex: index,
			Answer:        answer,
		})
	}

	content, err := json.Marshal(&CreateAttemptInput{
		Type:     currentTask.Type,
		Response: mustMarshal(responseItems),
	})
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't marshal attempt content", err)
	}

	evaluation := QuizEvaluation{
		TotalQuestions: len(lesson.Steps),
		CorrectAnswers: 0,
		Items:          make([]QuizQuestionEvaluation, 0, len(lesson.Steps)),
		ScoringMethod:  "correct_answers/total_questions",
	}

	for index, step := range lesson.Steps {
		submitted := answersByIndex[index]
		submittedIndex, hasAnswer := parseAnswerIndex(submitted)
		correct := hasAnswer && submittedIndex == step.Answer
		if correct {
			evaluation.CorrectAnswers++
		}
		evaluation.Items = append(evaluation.Items, QuizQuestionEvaluation{
			QuestionIndex:   index,
			CorrectAnswer:   step.Answer,
			SubmittedAnswer: cloneRawMessage(submitted),
			Correct:         correct,
			Explanation:     step.Explanation,
		})
	}

	evaluationPayload, err := json.Marshal(evaluation)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't marshal quiz evaluation", err)
	}

	return s.repo.Create(c, &TaskAttempt{
		UserID:         userID,
		TaskID:         currentTask.ID,
		Content:        content,
		Score:          &score,
		Status:         StatusProcessed,
		TaskEvaluation: evaluationPayload,
	})
}

func (s *taskAttemptService) ListByUser(c context.Context, userID uuid.UUID) ([]*TaskAttempt, error) {
	return s.repo.ListByUser(c, userID)
}

func (s *taskAttemptService) ListByUserAndTask(c context.Context, userID, taskID uuid.UUID) ([]*TaskAttempt, error) {
	return s.repo.ListByUserAndTask(c, userID, taskID)
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

func mustMarshal(v any) json.RawMessage {
	payload, err := json.Marshal(v)
	if err != nil {
		return json.RawMessage("null")
	}
	return payload
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// roundFloat arredonda o score para duas casas, evitando ruído de ponto
// flutuante no JSON (0.30000000000000004).
func roundFloat(v float64) float64 {
	return math.Round(v*100) / 100
}
