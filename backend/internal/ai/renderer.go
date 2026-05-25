package ai

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"text/template"
)

//go:embed templates/*.txt
var assetsFS embed.FS

func RenderPrompt(promptName string, data any) (string, error) {
	templateData, err := toMap(data)
	if err != nil {
		return "", fmt.Errorf("failed to convert template data: %w", err)
	}

	content, err := assetsFS.ReadFile("templates/" + promptName)
	if err != nil {
		return "", fmt.Errorf("failed to read prompt %s: %w", promptName, err)
	}

	tmpl, err := template.New(promptName).Parse(string(content))
	if err != nil {
		return "", fmt.Errorf("failed to parse prompt %s: %w", promptName, err)
	}

	var buf bytes.Buffer

	if err := tmpl.Execute(&buf, templateData); err != nil {
		return "", fmt.Errorf("failed to execute prompt %s: %w", promptName, err)
	}

	return buf.String(), nil
}

func toMap(v any) (map[string]any, error) {
	if v == nil {
		return map[string]any{}, nil
	}

	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}

	var result map[string]any
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, err
	}

	return result, nil
}
