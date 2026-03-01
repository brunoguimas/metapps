package database

import (
	"database/sql"
	"log"

	"github.com/brunoguimas/metasapp/config"
	_ "github.com/lib/pq"
)

func Connect(c *config.Config) *sql.DB {
	db, err := sql.Open(c.DatabaseDriver, c.DatabaseURL)
	if err != nil {
		log.Fatal("couldn't connect to database: ", err.Error())
	}

	return db
}
