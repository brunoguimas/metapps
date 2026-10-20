# Seleção do provedor de IA

## Objetivo

Uma única variável de ambiente decide qual modelo responde às requisições de IA:

```
AI_PROVIDER=gemini   # padrão
AI_PROVIDER=groq
```

O provedor **não selecionado** entra como *fallback* automático: se o primário
falhar (erro da API ou resposta vazia), a requisição é refeita no outro.

## Fluxo

```
config.Load()
  └─ AI_PROVIDER
       ├─ vazio        → "gemini"
       ├─ inválido     → slog.Error + os.Exit(1)
       └─ válido       → cfg.AIProvider
                         └─ chave do provedor selecionado é obrigatória
                            (ausência → slog.Error + os.Exit(1))
                            chave do alternativo é opcional

ai.NewClient(ctx, cfg)
  ├─ gemini → GeminiClient (primário) + GroqClient (fallback, se GROQ_API_KEY)
  └─ groq   → GroqClient   (primário) + GeminiClient (fallback, se GEMINI_API_KEY)
```

| Arquivo | Responsabilidade |
|---------|------------------|
| `internal/platform/config/config.go` | Lê e valida `AI_PROVIDER`; guarda as chaves e os modelos |
| `internal/ai/factory.go` | Monta a cadeia primário → fallback |
| `internal/ai/client.go` | Interface `Client` e o formato esperado da resposta |
| `internal/ai/fallback.go` | Tentativa no primário e, se falhar, no secundário |

## Formato da resposta

A interface `Client` recebe um `ai.Request` com o formato esperado
(`OutputFormatJSON` ou `OutputFormatText`). Isso evita adivinhar o formato pelo
conteúdo do prompt — o prompt de feedback (`correct_quiz.txt`) diz
"NÃO retorne JSON" e era obrigação do JSON mode do Groq por uma heurística.

| Formato | Gemini | Groq |
|---------|--------|------|
| `OutputFormatJSON` | JSON puro | `response_format=json_object` |
| `OutputFormatText` | texto | texto |

Quando o formato é JSON, a camada `ai` remove cercas de markdown
(```` ```json ... ``` ````) da resposta, para que os dois provedores sejam
equivalentes na hora do `json.Unmarshal`.

## Operação

```bash
AI_PROVIDER=groq go run cmd/api/main.go
```

- Log de boot: `ai provider selected provider=groq`
- Log da cadeia: `AI provider configured provider=groq fallback=gemini`
- `/health/ready` expõe `services.ai.provider`

Se a chave do provedor alternativo não existir, ele não entra na cadeia
(`fallback=disabled`) — um cliente sem chave não pode mascarar a falha do
primário.
