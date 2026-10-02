package progress

import (
	"math"
	"testing"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_attempt"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/google/uuid"
)

func f64(v float64) *float64 { return &v }

func prof(xp, streak int) *profile.Profile {
	return &profile.Profile{ID: uuid.New(), XP: xp, Streak: streak}
}

func done(id uuid.UUID, isDone bool) *task.Task {
	return &task.Task{ID: id, Done: isDone}
}

// Um usuario recem-criado nao pode ver NaN nem divisao por zero em
// nenhuma barra da home.
func TestSummarizeEmptyIsZeroNotNaN(t *testing.T) {
	s := Summarize(Input{Profile: prof(0, 0)})

	if s.XP != 0 || s.Level != 1 || s.XPInLevel != 0 || s.LevelPct != 0 {
		t.Errorf("nivel inicial inesperado: %+v", s)
	}
	if s.XPMissing != XPPerLevel {
		t.Errorf("faltam %d XP, esperava %d", s.XPMissing, XPPerLevel)
	}
	if got := s.Tasks.Pct(); got != 0 {
		t.Errorf("pct de tarefas sem tarefa nenhuma = %d, esperava 0", got)
	}
	if got := s.Attempts.AccuracyScore(); got != 0 {
		t.Errorf("acuracia sem tentativa = %d, esperava 0", got)
	}
	if got := s.Topics.MasteryPct(); got != 0 {
		t.Errorf("pct de topicos sem topico = %d, esperava 0", got)
	}
	if math.IsNaN(s.Attempts.AverageScore) {
		t.Error("media de acerto virou NaN")
	}
}

// O degrau de nivel tem que bater com profile.LevelFromXP, que e o que o
// resto do backend usa para contar nivel.
func TestSummarizeLevelMatchesProfileHelper(t *testing.T) {
	for _, xp := range []int{0, 1, 99, 100, 101, 340, 1000} {
		s := Summarize(Input{Profile: prof(xp, 0)})
		if want := profile.LevelFromXP(xp); s.Level != want {
			t.Errorf("xp %d: nivel %d, LevelFromXP diz %d", xp, s.Level, want)
		}
		if s.XPInLevel != xp%XPPerLevel {
			t.Errorf("xp %d: xp no nivel %d, esperava %d", xp, s.XPInLevel, xp%XPPerLevel)
		}
		if s.XPMissing <= 0 {
			t.Errorf("xp %d: faltando %d XP, tem de sobrar algo para o proximo nivel", xp, s.XPMissing)
		}
	}
}

// Barra cheia: xp multiplo exato do degrau. O nivel ja subiu e o degrau
// recomeca, entao xp_missing volta a 100.
func TestSummarizeExactLevelBoundary(t *testing.T) {
	s := Summarize(Input{Profile: prof(200, 3)})

	if s.Level != 3 {
		t.Errorf("nivel %d, esperava 3", s.Level)
	}
	if s.XPInLevel != 0 {
		t.Errorf("xp no nivel %d, esperava 0", s.XPInLevel)
	}
	if s.XPMissing != XPPerLevel {
		t.Errorf("faltam %d, esperava %d", s.XPMissing, XPPerLevel)
	}
	if s.Streak != 3 {
		t.Errorf("sequencia %d, esperava 3", s.Streak)
	}
}

func TestSummarizeCountsTasks(t *testing.T) {
	s := Summarize(Input{
		Profile: prof(0, 0),
		Tasks: []*task.Task{
			done(uuid.New(), true),
			done(uuid.New(), true),
			done(uuid.New(), true),
			done(uuid.New(), false),
		},
	})

	if s.Tasks.Total != 4 || s.Tasks.Done != 3 {
		t.Errorf("contou %d/%d, esperava 3/4", s.Tasks.Done, s.Tasks.Total)
	}
	if got := s.Tasks.Pct(); got != 75 {
		t.Errorf("pct %d, esperava 75", got)
	}
}

// Task nil nao pode virar tarefa na contagem: a fatia vem do banco e o
// agregador nao deve depender disso.
func TestSummarizeIgnoresNilEntries(t *testing.T) {
	s := Summarize(Input{
		Profile: prof(0, 0),
		Tasks:   []*task.Task{nil, done(uuid.New(), true), nil},
	})

	if s.Tasks.Total != 1 || s.Tasks.Done != 1 {
		t.Errorf("contou %d/%d com nils, esperava 1/1", s.Tasks.Done, s.Tasks.Total)
	}
}

func TestSummarizeAveragesScoredAttempts(t *testing.T) {
	s := Summarize(Input{
		Profile: prof(0, 0),
		Attempts: []*task_attempt.TaskAttempt{
			{Score: f64(1)},
			{Score: f64(0.5)},
			{Score: f64(0)},
			// Tentativa sem nota ainda nao foi corrigida: conta no total,
			// nao na media.
			{Score: nil},
		},
	})

	if s.Attempts.Total != 4 {
		t.Errorf("total %d, esperava 4", s.Attempts.Total)
	}
	if s.Attempts.Scored != 3 {
		t.Errorf("corrigidas %d, esperava 3", s.Attempts.Scored)
	}
	if math.Abs(s.Attempts.AverageScore-0.5) > 1e-9 {
		t.Errorf("media %.4f, esperava 0.5", s.Attempts.AverageScore)
	}
	if got := s.Attempts.AccuracyScore(); got != 50 {
		t.Errorf("acuracia %d%%, esperava 50%%", got)
	}
}

// Score e fracao de acerto e vai de 0 a 1. Uma media acima de 1 viraria
// porcentagem acima de 100 na barra.
func TestSummarizeClampsAverageAboveOne(t *testing.T) {
	s := Summarize(Input{
		Profile: prof(0, 0),
		Attempts: []*task_attempt.TaskAttempt{
			{Score: f64(1)},
			{Score: f64(4)}, // dado corrompido
		},
	})

	if s.Attempts.AverageScore > 1 {
		t.Errorf("media %.2f passou de 1", s.Attempts.AverageScore)
	}
	if got := s.Attempts.AccuracyScore(); got > 100 {
		t.Errorf("acuracia %d%% passou de 100", got)
	}
}

func TestSummarizeCountsMasteredTopics(t *testing.T) {
	mastered := uuid.New()
	inProgress := uuid.New()
	untouched := uuid.New()
	const required = 0.7

	s := Summarize(Input{
		Profile: prof(0, 0),
		TopicsByGoal: []TopicInput{{
			Topics: []*topic.Topic{
				{ID: mastered, RequiredMastery: required},
				{ID: inProgress, RequiredMastery: required},
				{ID: untouched, RequiredMastery: 0.2},
			},
			Progress: []*topic.TopicProgress{
				{TopicID: mastered, MasteryScore: 0.9, AttemptsCount: 2, Status: topic.TopicStatusMastered},
				{TopicID: inProgress, MasteryScore: 0.4, AttemptsCount: 1, Status: topic.TopicStatusInProgress},
				// untouched nao tem linha de progresso: nao conta como
				// dominado mesmo com requisito baixo.
			},
		}},
	})

	if s.Topics.Total != 3 {
		t.Errorf("total de topicos %d, esperava 3", s.Topics.Total)
	}
	if s.Topics.Mastered != 1 {
		t.Errorf("dominados %d, esperava 1", s.Topics.Mastered)
	}
	if got := s.Topics.MasteryPct(); got != 33 {
		t.Errorf("pct %d, esperava 33", got)
	}
}

// Sem perfil nenhum (usuario recem-criado antes da criacao automatica) o
// resumo ainda precisa responder, com nivel 1.
func TestSummarizeWithoutProfile(t *testing.T) {
	s := Summarize(Input{})

	if s.Level != 1 || s.XP != 0 {
		t.Errorf("sem perfil: %+v", s)
	}
	if s.Streak != 0 {
		t.Errorf("sequencia %d sem perfil, esperava 0", s.Streak)
	}
}

func TestSummarizeCountsGoalsAndDueFlashcards(t *testing.T) {
	s := Summarize(Input{
		Profile:       prof(120, 2),
		Goals:         []*goal.Goal{{ID: uuid.New()}, {ID: uuid.New()}},
		DueFlashcards: 7,
	})

	if s.Goals.Total != 2 {
		t.Errorf("objetivos %d, esperava 2", s.Goals.Total)
	}
	if s.Flashcards.Due != 7 {
		t.Errorf("flashcards %d, esperava 7", s.Flashcards.Due)
	}
}

// Fila negativa nunca deve chegar ao JSON.
func TestSummarizeClampsNegativeDue(t *testing.T) {
	s := Summarize(Input{Profile: prof(0, 0), DueFlashcards: -3})
	if s.Flashcards.Due != 0 {
		t.Errorf("fila negativa virou %d", s.Flashcards.Due)
	}
}

func TestSummarizeIsIndependentOfInputOrder(t *testing.T) {
	a := []*task_attempt.TaskAttempt{{Score: f64(1)}, {Score: f64(0)}, {Score: nil}}
	b := []*task_attempt.TaskAttempt{{Score: nil}, {Score: f64(0)}, {Score: f64(1)}}

	first := Summarize(Input{Profile: prof(50, 1), Attempts: a})
	second := Summarize(Input{Profile: prof(50, 1), Attempts: b})

	if first.Attempts.AverageScore != second.Attempts.AverageScore {
		t.Errorf("media depende da ordem: %v vs %v", first.Attempts.AverageScore, second.Attempts.AverageScore)
	}
	if first.Attempts.Total != second.Attempts.Total {
		t.Errorf("total depende da ordem: %d vs %d", first.Attempts.Total, second.Attempts.Total)
	}
}

// A sequencia vem do perfil como esta; a data da ultima atividade nao
// entra na conta e apenas precisa sobreviver a leitura.
func TestSummarizeTakesStreakFromProfile(t *testing.T) {
	day := time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC)
	p := prof(60, 4)
	p.LastActivityDate = day

	s := Summarize(Input{Profile: p})

	if s.Streak != 4 {
		t.Errorf("sequencia %d, esperava 4", s.Streak)
	}
}
