package topic

import (
	"context"
	"math"

	apperrors "github.com/brunoguimas/metapps/backend/internal/shared/error"
	"github.com/google/uuid"
)

// Limiares que definem a fase de evolucao do topico no roadmap.
// Espelham o CASE usado na migration 000014 para manter o mesmo vocabulario.
const (
	stageEgg     = "Ovo"
	stageLarva   = "Larva"
	stagePupa    = "Pupa"
	stageJuvenil = "Juvenil"
	stageAdult   = "Adulto"
)

// RecordAttempt registra o resultado de uma tentativa em um topico e
// persiste o progresso do usuario.
//
// Sem isso, o progresso vivia apenas no estado do frontend: ao fazer logout
// o componente era desmontado e, ao logar de novo, a trilha reaparecia sem
// nenhuma etapa concluida -- obrigava o usuario a refazer a atividade.
//
// Regras:
//   - mastery e o maior score ja obtido no topico (repetir a atividade nao
//     faz o usuario perder o que ja tinha conquistado);
//   - confidence e a media movel das tentativas, dando mais peso as
//     tentativas recentes;
//   - o status so avanca: um topico dominado (MASTERED) nunca volta a ser
//     IN_PROGRESS, mesmo que o usuario erre uma tentativa seguinte.
func (s *topicService) RecordAttempt(c context.Context, userID, topicID uuid.UUID, score float64) (*TopicProgress, error) {
	t, err := s.repo.Get(c, topicID)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, apperrors.NewAppError(apperrors.ErrTopicNotFound, "topic not found", nil)
	}

	progress, err := s.progressRepo.GetOrCreate(c, userID, topicID)
	if err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't load topic progress", err)
	}

	if score < 0 {
		score = 0
	}
	if score > 1 {
		score = 1
	}

	progress.AttemptsCount++
	progress.MasteryScore = math.Max(progress.MasteryScore, score)
	progress.ConfidenceScore = movingAverage(progress.ConfidenceScore, progress.AttemptsCount, score)
	progress.Status = nextStatus(progress.Status, score, t.RequiredMastery)
	progress.EvolutionStage = stageForMastery(progress.MasteryScore)

	if err := s.progressRepo.Update(c, progress); err != nil {
		return nil, apperrors.NewAppError(apperrors.ErrInternal, "couldn't update topic progress", err)
	}

	return progress, nil
}

// movingAverage recalcula a media das tentativas incluindo a atual, com
// peso maior para as mais recentes. Com poucas tentativas o resultado e
// praticamente a propria nota, o que mantem o roadmap coerente logo no
// primeiro erro.
func movingAverage(previous float64, attempts int32, score float64) float64 {
	if attempts <= 1 {
		return score
	}

	const recencyWeight = 0.4
	weight := float64(attempts-1) * (1 - recencyWeight)
	if weight <= 0 {
		return score
	}

	return (previous*weight + score) / (weight + 1)
}

func nextStatus(current TopicStatus, score, requiredMastery float64) TopicStatus {
	if current == TopicStatusMastered {
		return TopicStatusMastered
	}
	if score >= requiredMastery {
		return TopicStatusMastered
	}
	return TopicStatusInProgress
}

func stageForMastery(mastery float64) string {
	switch {
	case mastery < 0.2:
		return stageEgg
	case mastery < 0.4:
		return stageLarva
	case mastery < 0.6:
		return stagePupa
	case mastery < 0.8:
		return stageJuvenil
	default:
		return stageAdult
	}
}
