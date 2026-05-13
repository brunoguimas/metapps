package health

import (
	"context"
	"time"

	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type DBchecker interface {
	DBStatus(c context.Context) StatusService
}

type dbChecker struct {
	queries db.Queries
}

func NewDBChecker(q *db.Queries) DBchecker {
	return &dbChecker{
		queries: *q,
	}
}

func (d *dbChecker) DBStatus(c context.Context) StatusService {
	start := time.Now()

	n, err := d.queries.CheckHealth(c)

	latency := time.Since(start).Milliseconds()

	if err != nil {
		return StatusService{
			Status: "down",
			LatencyMS: int64(latency),
			Error: err.Error(),
		}
	}
	if n != 1 {
		return StatusService{
			Status: "down",
			LatencyMS: int64(latency),
			Error: err.Error(),
		}
	}
	if latency > 50 {
		return StatusService{
			Status: "slow",
			LatencyMS: int64(latency),
			Error: err.Error(),
		}
	}

	return StatusService{
		Status: "up",
		LatencyMS: int64(latency),
		Error: "",
	}
}
