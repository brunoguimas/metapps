package ai

import "strings"

// stripCodeFences remove as cercas de markdown (```json ... ```) da resposta do
// modelo, devolvendo apenas o conteúdo.
//
// É aplicado somente quando o formato pedido é JSON, para que os provedores se
// comportem igual: o Gemini costuma devolver JSON puro, enquanto o Groq pode
// devolver o JSON envolvido em cercas.
func stripCodeFences(content string) string {
	cleaned := strings.TrimSpace(content)
	if !strings.HasPrefix(cleaned, "```") {
		return cleaned
	}

	// remove a linha de abertura (``` ou ```json)
	openIdx := strings.Index(cleaned, "\n")
	if openIdx < 0 {
		return ""
	}
	cleaned = cleaned[openIdx+1:]

	// remove a cerca de fechamento, se houver
	if closeIdx := strings.LastIndex(cleaned, "```"); closeIdx >= 0 {
		cleaned = cleaned[:closeIdx]
	}

	return strings.TrimSpace(cleaned)
}
