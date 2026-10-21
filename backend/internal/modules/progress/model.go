package progress

import (
	"math"

	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_attempt"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/google/uuid"
)

// XPPerLevel e a mesma constante que profile.LevelFromXP usa. O front
// tambem mantem 100 por nivel (XP_STEP em Homepage.jsx); enquanto os dois
// lados concordam, a barra de progresso da home bate com o numero do
// servidor. Este e o unico lugar do backend que expoe o tamanho do degrau.
const XPPerLevel = 100

// Summary e o resumo de progresso do usuario: o suficiente para a home
// desenhar anel de XP, sequencia, tarefas e revisao de flashcards sem
// fazer quatro requisições.
//
// Tudo aqui e somente leitura. Nao existe Summary mutavel nem rota que
// aceite XP do cliente — o credito vem do task_attempt, no servidor.
type Summary struct {
	XP         int         `json:"xp"`
	Level      int         `json:"level"`
	XPInLevel  int         `json:"xp_in_level"`
	XPMissing  int         `json:"xp_missing"`
	LevelPct   int         `json:"level_pct"`
	Streak     int         `json:"streak"`
	Goals      GoalStat    `json:"goals"`
	Tasks      TaskStat    `json:"tasks"`
	Attempts   AttemptStat `json:"attempts"`
	Topics     TopicStat   `json:"topics"`
	Flashcards FlashStat   `json:"flashcards"`
}

type GoalStat struct {
	Total int `json:"total"`
}

// TaskStat conta as tarefas do usuario.
type TaskStat struct {
	Total int `json:"total"`
	Done  int `json:"done"`
}

// TaskPct e a porcentagem de tarefas concluidas, de 0 a 100. Retorna 0
// quando nao ha tarefa nenhuma: um usuario novo nao deve ver "0%" nem
// NaN no lugar da barra.
func (s TaskStat) Pct() int {
	if s.Total == 0 {
		return 0
	}
	return int(math.Round(float64(s.Done) / float64(s.Total) * 100))
}

// AttemptStat resume as respostas enviadas. Score e a fracao de acertos,
// de 0 a 1.
type AttemptStat struct {
	Total        int     `json:"total"`
	Scored       int     `json:"scored"`
	AverageScore float64 `json:"average_score"`
}

// AccuracyScore e a media de acerto em porcentagem, de 0 a 100.
func (s AttemptStat) AccuracyScore() int {
	if s.Scored == 0 {
		return 0
	}
	return int(math.Round(s.AverageScore * 100))
}

// TopicStat conta os topicos do roadmap e quantos ja atingiram o
// dominio exigido pelo roadmap.
type TopicStat struct {
	Total    int `json:"total"`
	Mastered int `json:"mastered"`
}

// MasteryPct e a porcentagem de topicos dominados, de 0 a 100.
func (s TopicStat) MasteryPct() int {
	if s.Total == 0 {
		return 0
	}
	return int(math.Round(float64(s.Mastered) / float64(s.Total) * 100))
}

// FlashStat e a fila de revisao no momento da leitura.
type FlashStat struct {
	Due int `json:"due"`
}

// TopicInput agrupa os topicos de um objetivo com o progresso do usuario
// em cada um. O repositorio expoe ListByUserAndGoal, entao a montagem
// acontece aqui e nao na camada de dados.
type TopicInput struct {
	GoalID   uuid.UUID
	Topics   []*topic.Topic
	Progress []*topic.TopicProgress
}

// Input e tudo o que Summarize precisa. Passar as fatias ja carregadas
// mantem a agregacao como funcao pura: nenhum acesso a banco, nenhum
// erro de I/O, e por isso ela roda em teste sem Postgres.
type Input struct {
	Profile *profile.Profile
	Goals   []*goal.Goal
	Tasks   []*task.Task
	// Attempts traz as tentativas do usuario, em qualquer ordem.
	Attempts []*task_attempt.TaskAttempt
	// TopicsByGoal indexa os topicos por objetivo, ja com o progresso do
	// usuario ao lado de cada topico.
	TopicsByGoal []TopicInput
	// DueFlashcards e o tamanho da fila de revisao, ja consultada pelo
	// servico.
	DueFlashcards int
}

// Summarize agrega o progresso. Nao ha efeito colateral: nada e gravado e
// nada depende da ordem de entrada.
func Summarize(in Input) Summary {
	s := Summary{
		Level: 1,
		Goals: GoalStat{Total: len(in.Goals)},
		// Total e construido contando os elementos, nao com len(): a
		// fatia vem do banco e uma entrada nil nao e uma tarefa do
		// usuario, so um registro que o agregador nao deve contar.
		Tasks:      TaskStat{},
		Flashcards: FlashStat{Due: max(0, in.DueFlashcards)},
	}

	if p := in.Profile; p != nil {
		s.XP = p.XP
		s.Level = profile.LevelFromXP(p.XP)
		s.XPInLevel = p.XP % XPPerLevel
		s.XPMissing = XPPerLevel - s.XPInLevel
		s.LevelPct = int(math.Round(float64(s.XPInLevel) / float64(XPPerLevel) * 100))
		s.Streak = p.Streak
	}

	for _, t := range in.Tasks {
		if t == nil {
			continue
		}
		s.Tasks.Total++
		if t.Done {
			s.Tasks.Done++
		}
	}

	for _, a := range in.Attempts {
		if a == nil {
			continue
		}
		s.Attempts.Total++
		if a.Score != nil {
			s.Attempts.Scored++
			s.Attempts.AverageScore += *a.Score
		}
	}
	if s.Attempts.Scored > 0 {
		s.Attempts.AverageScore /= float64(s.Attempts.Scored)
		// Media de fracao de acerto nao passa de 1; um scorePersistido
		// fora da faixa viraria porcentagem enganosa na barra.
		s.Attempts.AverageScore = math.Min(s.Attempts.AverageScore, 1)
	}

	for _, group := range in.TopicsByGoal {
		// O progresso vem do topic_progress, indexado por topico; o
		// topico so traz o RequiredMastery que o status compara.
		byTopic := make(map[uuid.UUID]*topic.TopicProgress, len(group.Progress))
		for _, p := range group.Progress {
			if p != nil {
				byTopic[p.TopicID] = p
			}
		}
		for _, t := range group.Topics {
			if t == nil {
				continue
			}
			s.Topics.Total++
			p := byTopic[t.ID]
			if p == nil || p.AttemptsCount == 0 {
				// Sem tentativa nao ha dominio medido: um topico recem
				// criado nao entra como dominado so porque o requisito
				// padrao ja e baixo.
				continue
			}
			if p.Status == topic.TopicStatusMastered || p.MasteryScore >= t.RequiredMastery {
				s.Topics.Mastered++
			}
		}
	}

	return s
}
