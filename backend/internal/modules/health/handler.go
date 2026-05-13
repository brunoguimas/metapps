package health

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type HealthHandler struct {
	repo DBchecker
	ai AIChecker
	startedAt time.Time
}

func NewHealthHandler(r DBchecker, a AIChecker, t time.Time) *HealthHandler {
	return &HealthHandler{
		repo: r,
		ai: a,
		startedAt: t,
	}
}

type Services struct {
	DB StatusService `json:"database"`
	AI StatusService `json:"ai"`
}

func (h *HealthHandler) LiveCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *HealthHandler) ReadyCheck(c *gin.Context) {
	status := "ok"
	code := http.StatusOK

	dbStatus := h.repo.DBStatus(c.Request.Context())
	aiStatus := h.ai.AIStatus()
	
	if aiStatus.Status == "down" {
		status = "degraded"
	}
	if dbStatus.Status == "down" {
		status = "down"
		code = http.StatusServiceUnavailable
	}

	services := Services{
		DB: dbStatus,
		AI: aiStatus,
	}
	c.JSON(code, gin.H{
		"status": status,
		"timestamp": time.Now().UTC(),
		"uptime": time.Since(h.startedAt).Seconds(),
		"services": services,
	})
}
