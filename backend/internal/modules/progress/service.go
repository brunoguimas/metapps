package progress

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/modules/flashcard"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_attempt"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

// Service monta o resumo de progresso do usuario. E somente leitura: nao
// ha metodo que credite XP, e o XP continua sendo derivado do desempenho
// pelo task_attempt dentro do servidor.
type Service interface {
	GetSummary(ctx context.Context, userID uuid.UUID) (*Summary, error)
}

type progressService struct {
	profiles   profile.Service
	goals      goal.Service
	tasks      task.Service
	attempts   task_attempt.Service
	topics     topic.Repository
	topicProg  topic.ProgressRepository
	flashcards flashcard.Service
}

func NewService(
	profiles profile.Service,
	goals goal.Service,
	tasks task.Service,
	attempts task_attempt.Service,
	topics topic.Repository,
	topicProg topic.ProgressRepository,
	flashcards flashcard.Service,
) Service {
	return &progressService{
		profiles:   profiles,
		goals:      goals,
		tasks:      tasks,
		attempts:   attempts,
		topics:     topics,
		topicProg:  topicProg,
		flashcards: flashcards,
	}
}

func (s *progressService) GetSummary(ctx context.Context, userID uuid.UUID) (*Summary, error) {
	prof, err := s.profiles.GetProfileByUserID(ctx, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't get user profile", err)
	}

	goals, err := s.goals.List(ctx, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list goals", err)
	}

	tasks, err := s.tasks.GetByUserID(ctx, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list tasks", err)
	}

	attempts, err := s.attempts.ListByUser(ctx, userID)
	if err != nil {
		if appErr, ok := apperrors.As(err); ok {
			return nil, appErr
		}
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list attempts", err)
	}

	byGoal, err := s.topicsByGoal(ctx, userID, goals)
	if err != nil {
		return nil, err
	}

	summary := Summarize(Input{
		Profile:      prof,
		Goals:        goals,
		Tasks:        tasks,
		Attempts:     attempts,
		TopicsByGoal: byGoal,
		// ListDue ja vem limitado pelo proprio modulo (maxCardsPerSession).
		// Como o contador e so informativo, um erro aqui nao pode derrubar
		// o resumo inteiro: a tela continua mostrando XP, tarefas e topicos,
		// so sem o numero de revisao.
		DueFlashcards: s.dueCount(ctx, userID),
	})
	return &summary, nil
}

// topicsByGoal carrega, para cada objetivo, os topicos e o progresso do
// usuario neles.
func (s *progressService) topicsByGoal(ctx context.Context, userID uuid.UUID, goals []*goal.Goal) ([]TopicInput, error) {
	groups := make([]TopicInput, 0, len(goals))
	for _, g := range goals {
		if g == nil {
			continue
		}
		topics, err := s.topics.GetByGoalID(ctx, g.ID)
		if err != nil {
			if appErr, ok := apperrors.As(err); ok {
				return nil, appErr
			}
			return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list topics", err)
		}
		progress, err := s.topicProg.ListByUserAndGoal(ctx, userID, g.ID)
		if err != nil {
			if appErr, ok := apperrors.As(err); ok {
				return nil, appErr
			}
			return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't list topic progress", err)
		}
		groups = append(groups, TopicInput{GoalID: g.ID, Topics: topics, Progress: progress})
	}
	return groups, nil
}

// dueCount conta a fila de revisao. Falhar aqui devolve zero em vez de
// erro: e um detalhe de tela, nao o progresso do usuario.
func (s *progressService) dueCount(ctx context.Context, userID uuid.UUID) int {
	cards, err := s.flashcards.ListDue(ctx, userID)
	if err != nil {
		return 0
	}
	return len(cards)
}
