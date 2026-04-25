package mail

import (
	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	"github.com/brunoguimas/metapps/backend/internal/platform/database/db"
)

type Module struct {
	Repository EmailRepository
	Service    EmailService
	Mailer     *Mailer
}

func NewModule(q *db.Queries, c *config.Config) (*Module, error) {
	mailer, err := NewMailer(*c)
	if err != nil {
		return nil, err
	}

	r := NewEmailRepository(q)
	s := NewEmailService(r, c, mailer)

	return &Module{
		Repository: r,
		Service:    s,
		Mailer:     mailer,
	}, nil
}
