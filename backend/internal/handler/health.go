package handler

import (
	"net/http"

	"github.com/brunoguimas/metapps/backend/internal/repository"
	"github.com/gin-gonic/gin"
)

type HealthHandler struct {
	repo repository.DBchecker
}

func NewHealthHandler(r repository.DBchecker) *HealthHandler {
	return &HealthHandler{
		repo: r,
	}
}
func (h *HealthHandler) HealthCheck(c *gin.Context) {
	status := http.StatusOK
	checks := map[string]string{
		"database": "UP",
	}
	response := gin.H{
		"status": "UP",
		"checks": checks,
	}
	dbOk := h.repo.DBstatus(c.Request.Context())
	if !dbOk {
		status = http.StatusServiceUnavailable
		checks["database"] = "DOWN"
	}

	c.JSON(status, response)
}
