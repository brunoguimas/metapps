package ai

import (
	"bytes"
	"embed"
	"fmt"
	"text/template"
)

//go:embed templates/*.txt
var promptsFS embed.FS

func RenderPrompt(path string, data any) (string, error) {
	content, err := promptsFS.ReadFile("templates/" + path)
	if err != nil {
		return "", fmt.Errorf("failed to read prompt %s: %w", path, err)
	}

	tmpl, err := template.New(path).Parse(string(content))
	if err != nil {
		return "", fmt.Errorf("failed to parse prompt %s: %w", path, err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute prompt %s: %w", path, err)
	}

	return buf.String(), nil
}
