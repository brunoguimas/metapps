package mail

import (
	"bytes"
	"html/template"

	"github.com/brunoguimas/metapps/backend/internal/platform/config"
	mail "github.com/wneessen/go-mail"
)

type Mailer struct {
	client *mail.Client
	from   string
}

func NewMailer(c config.Config) (*Mailer, error) {
	client, err := mail.NewClient(
		c.SMTPHost,
		mail.WithPort(c.SMTPPort),
		mail.WithSMTPAuth(mail.SMTPAuthPlain),
		mail.WithUsername(c.SMTPUser),
		mail.WithPassword(c.SMTPPass),
	)
	if err != nil {
		return nil, err
	}

	return &Mailer{
		client: client,
		from:   c.EmailFrom,
	}, nil
}

func (m *Mailer) SendVerifyEmail(to string, verifyURL string) error {

	t, err := template.ParseFiles("internal/mail/templates/email_verify.html")
	if err != nil {
		return err
	}

	var body bytes.Buffer

	err = t.Execute(&body, map[string]string{
		"VerifyURL": verifyURL,
	})
	if err != nil {
		return err
	}

	msg := mail.NewMsg()

	msg.From(m.from)
	msg.To(to)
	msg.Subject("Verifique seu email")

	msg.SetBodyString(mail.TypeTextPlain, "Verifique seu email: "+verifyURL)
	msg.AddAlternativeString(mail.TypeTextHTML, body.String())

	return m.client.DialAndSend(msg)
}
