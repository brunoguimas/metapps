package task_correction

import (
	"github.com/brunoguimas/metapps/backend/internal/ai"
	"github.com/brunoguimas/metapps/backend/internal/modules/jwt"
	"github.com/brunoguimas/metapps/backend/internal/modules/task"
	"github.com/brunoguimas/metapps/backend/internal/modules/task_attempt"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Service  Service
	Handler  *Handler
	Repository Repository
}

func NewModule(q *db.Queries, taskAttemptRepo task_attempt.Repository, taskRepo task.TaskRepository, aiClient ai.Client, jwtService jwt.JWTService) *Module {
	repo := NewRepository(q)
	service := NewService(repo, taskAttemptRepo, taskRepo, aiClient)
	handler := NewHandler(service, jwtService)

	return &Module{
		Service:  service,
		Handler:  handler,
		Repository: repo,
	}
}
