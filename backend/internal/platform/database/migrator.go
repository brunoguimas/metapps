package database

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"

	"github.com/golang-migrate/migrate/v4"
	migratepg "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	platformlogger "github.com/brunoguimas/metapps/backend/internal/platform/logger"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// RunMigrations aplica as migrations pendentes antes de subir o servidor.
//
// Sem isso, qualquer migration nova (por exemplo a de `friendships`) só
// entra no banco se alguém rodar `make migrate_up` na mão — e, quando
// alguém esquece, o sintoma é um 500 "internal server error" genérico no
// endpoint que dependia da tabela nova.
func RunMigrations(conn *sql.DB) error {
	src, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("couldn't read embedded migrations: %w", err)
	}

	driver, err := migratepg.WithInstance(conn, &migratepg.Config{})
	if err != nil {
		return fmt.Errorf("couldn't create migrate driver: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", src, "postgres", driver)
	if err != nil {
		return fmt.Errorf("couldn't create migrator: %w", err)
	}

	current, dirty, err := m.Version()
	if err != nil && !errors.Is(err, migrate.ErrNilVersion) {
		return fmt.Errorf("couldn't read migration version: %w", err)
	}
	if dirty {
		return fmt.Errorf("database is in a dirty state at version %d; run 'make migrate_force' to fix", current)
	}

	before := current
	if before == 0 {
		before = 0
	}

	if err := m.Up(); err != nil && !errors.Is(err, fs.ErrNotExist) && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("couldn't apply migrations: %w", err)
	}

	after, _, err := m.Version()
	if err != nil && !errors.Is(err, migrate.ErrNilVersion) {
		slog.Warn("couldn't read migration version after migrating", "error", err)
	}

	platformlogger.LogSystemInfo("migrations applied",
		"from", versionOrZero(before),
		"to", versionOrZero(after),
	)

	return nil
}

func versionOrZero(v uint) uint {
	if v == 0 {
		return 0
	}
	return v
}