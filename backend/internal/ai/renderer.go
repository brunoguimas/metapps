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
	// 1. Ler template do embed
	content, err := promptsFS.ReadFile("templates/" + path)
	if err != nil {
		return "", fmt.Errorf("failed to read prompt %s: %w", path, err)
	}

	// 2. Parse template
	tmpl, err := template.New(path).Parse(string(content))
	if err != nil {
		return "", fmt.Errorf("failed to parse prompt %s: %w", path, err)
	}

	// 3. Executar template
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute prompt %s: %w", path, err)
	}

	return buf.String(), nil
}
