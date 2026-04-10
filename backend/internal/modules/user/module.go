package user

import "github.com/brunoguimas/metapps/backend/internal/platform/database/db"

type Module struct {
	Repository UserRepository
	Service    UserService
}

func NewModule(q *db.Queries) *Module {
	r := NewUserRepository(q)
	s := NewUserService(r)

	return &Module{
		Repository: r,
		Service:    s,
	}
}
