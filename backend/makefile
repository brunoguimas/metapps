include .env
export

create_migration:
	migrate create -ext=sql -dir=internal/database/migrations -seq $(name)

migrate_up:
	migrate -path=internal/database/migrations -database "${DATABASE_URL}" -verbose up

migrate_down:
	migrate -path=internal/database/migrations -database "${DATABASE_URL}" -verbose down 1

.PHONY: create_migration migrate_up migrate_down
