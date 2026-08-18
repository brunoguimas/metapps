package profile

import (
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

// Module contains the dependencies for the profile module.
type Module struct {
	Repository ProfileRepository
	Service    ProfileService
	Handler    *ProfileHandler
}

// NewProfileModule returns a new ProfileModule with the given dependencies.
func NewProfileModule(q *db.Queries, c *config.Config) *Module {
	r := NewProfileRepository(q)
	s := NewProfileService(r)
	h := NewProfileHandler(s, c)

	return &Module{
		Repository: r,
		Service:    s,
		Handler:    h,
	}
}