package progress

import (
	"github.com/brunoguimas/metapps/backend/internal/modules/flashcard"
	"github.com/brunoguimas/metapps/backend/internal/modules/goal"
	"github.com/brunoguimas/metapps/backend/internal/modules/profile"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_attempt"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
)

type Module struct {
	Service Service
	Handler *Handler
}

// NewModule monta o resumo a partir dos servicos que ja existem. Nao ha
// repositorio proprio: o modulo so le, e cada leitura vem de um modulo
// que ja sabe respeitar o dono dos dados.
func NewModule(
	profileService profile.Service,
	goalService goal.Service,
	taskService task.Service,
	attemptService task_attempt.Service,
	topicRepo topic.Repository,
	topicProgress topic.ProgressRepository,
	flashcardService flashcard.Service,
) *Module {
	s := NewService(
		profileService,
		goalService,
		taskService,
		attemptService,
		topicRepo,
		topicProgress,
		flashcardService,
	)
	h := NewHandler(s)

	return &Module{
		Service: s,
		Handler: h,
	}
}
