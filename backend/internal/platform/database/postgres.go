package database

import (
	"database/sql"
	"os"

	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	platformlogger "github.com/brunoguimas/metapps/backend/internal/platform/logger"
	_ "github.com/lib/pq"
)

func Connect(c *config.Config) *sql.DB {
	db, err := sql.Open(c.DatabaseDriver, c.DatabaseURL)
	if err != nil {
		platformlogger.LogSystemError("couldn't connect to database", err, "driver", c.DatabaseDriver)
		os.Exit(1)
	}

	return db
}
