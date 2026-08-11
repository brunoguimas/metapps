# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `make run`: Run the application
- `make dev`: Run the application in development mode with auto-reload (using reflex)
- `go test ./...`: Run all tests
- `go test -run TestFunctionName ./...`: Run a specific test
- `go build`: Build the application
- `docker build -t metapps-backend .`: Build the Docker image
- `docker run -p 8080:8080 metapps-backend`: Run the Docker container (adjust port as needed)

## Database Migrations

- `make create_migration name=migration_name`: Create a new migration
- `make migrate_up`: Apply migrations up
- `make migrate_down`: Rollback the last migration
- `make migrate_test`: Apply migrations to test database
- `make migrate_force`: Force a migration version

## Error Handling Improvements

The error handling has been simplified to make logs more informative and easier to understand:

1. **Simplified Logger Functions**:
   - Removed unused functions (`LogInfo`, `LogWithUser`)
   - Kept only essential functions: `LogError` and `LogWarn`
   - Focus on simplicity and direct usage

2. **Error Logging Details**:
   - Logs now include: error message, HTTP status, request ID, method, path, client IP
   - Uses structured logging with slog for consistency
   - Clear separation between error and warning levels

3. **Usage Guidelines**:
   - Use `logger.LogError(c, err, "message", http.StatusBadRequest)` for error conditions
   - Use `logger.LogWarn(c, err, "message", http.StatusBadRequest)` for warning conditions
   - In HTTP handlers, use helper functions from `internal/httpx/response.go`:
     - `Error(c, status, msg)` - simple error response
     - `ErrorFrom(c, err)` - handles errors and returns appropriate HTTP responses

## Code Structure

- `cmd/api/main.go`: Application entry point
- `internal/`: Private application and library code
  - `ai/`: AI-related functionality (Groq client, embeddings, etc.)
  - `httpx/`: HTTP utilities (context, response, binding)
  - `middleware/`: HTTP middleware (logger, rate limit, JWT)
  - `modules/`: Business modules (auth, goal, health, jwt, mail, oauth, task, taskattempt, topic, topic_dependency, user) each following a pattern:
    - `model.go`: Data models
    - `repository.go`: Data access layer
    - `service.go`: Business logic
    - `handler.go`: HTTP handlers
    - `*_test.go`: Unit tests
  - `platform/`: Platform-specific code (config, database, jobs, logger)
  - `router/`: HTTP router setup
  - `shared/`: Shared constants and utilities
  - `testutil`: Test utilities

## Environment

- The project uses `.env` for environment variables (see `.env.example` for reference)
- Database URL is expected in `DATABASE_URL` and `TEST_DATABASE_URL` for testing

## Notes

- The project uses Go 1.25.0 (as per go.mod)
- Dependencies are managed via Go modules
- The Makefile provides shortcuts for common tasks (see `makefile`)