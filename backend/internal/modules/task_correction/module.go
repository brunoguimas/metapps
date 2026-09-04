package task_correction

import (
	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_attempt"
	"github.com/brunoguimas/metapps/backend/internal/modules/topic"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Repository Repository
	Service    Service
	Handler    *Handler
}

func NewModule(q *db.Queries, taskAttemptRepo task_attempt.Repository, taskRepo task.Repository, aiClient ai.Client, jwtService jwt.Service) *Module {
	repo := NewRepository(q)
	topicRepo := topic.NewRepository(q)
	progressRepo := topic.NewProgressRepository(q)
	service := NewService(repo, taskAttemptRepo, taskRepo, topicRepo, progressRepo, aiClient)
	handler := NewHandler(service, jwtService)

	return &Module{
		Repository: repo,
		Service:    service,
		Handler:    handler,
	}
}
