package repository

import (
	"context"

	"github.com/brunoguimas/metapps/backend/internal/database/db"
)

type DBchecker interface {
	DBstatus(c context.Context) bool
}

type dbChecker struct {
	queries db.Queries
}

func NewChecker(q *db.Queries) DBchecker {
	return &dbChecker{
		queries: *q,
	}
}
func (d *dbChecker) DBstatus(c context.Context) bool {
	n, err := d.queries.CheckHealth(c)
	if err != nil {
		return false
	}

	if n != 1 {
		return false
	}

	return true
}
