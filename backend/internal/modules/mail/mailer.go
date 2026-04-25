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

func (m *Mailer) SendVerifyEmail(to string, username string, code string) error {
	return m.sendTemplateEmail(
		to,
		"Verifique seu email",
		"internal/modules/mail/templates/email_verify.html",
		"Seu codigo de verificacao de email e: "+code,
		map[string]string{
			"Code":     code,
			"Username": username,
		},
	)
}

func (m *Mailer) SendPasswordResetEmail(to string, username string, code string) error {
	return m.sendTemplateEmail(
		to,
		"Redefina sua senha",
		"internal/modules/mail/templates/password_reset.html",
		"Seu codigo para redefinicao de senha e: "+code,
		map[string]string{
			"Code":     code,
			"Username": username,
		},
	)
}

func (m *Mailer) sendTemplateEmail(to, subject, templatePath, textBody string, data map[string]string) error {
	t, err := template.ParseFiles(templatePath)
	if err != nil {
		return err
	}

	var body bytes.Buffer

	err = t.Execute(&body, data)
	if err != nil {
		return err
	}

	msg := mail.NewMsg()

	msg.From(m.from)
	msg.To(to)
	msg.Subject(subject)

	msg.SetBodyString(mail.TypeTextPlain, textBody)
	msg.AddAlternativeString(mail.TypeTextHTML, body.String())

	return m.client.DialAndSend(msg)
}
