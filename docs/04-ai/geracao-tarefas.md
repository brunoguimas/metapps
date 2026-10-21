# Estratégia de geração de tarefas

## Sessão (lesson)

Uma sessão é uma sequência de **3 a 5 exercícios curtos**, gerados em
uma única chamada à IA. O formato v2 usa `content.steps[]` (o formato
antigo, `content.questions[]`, é normalizado na leitura).

```
backend/internal/ai/
├── schemas/lesson.schema.json     # contrato com limites rígidos
└── templates/generate_lesson.txt  # prompt de geração
```

## Limites (validados no Go, não só no prompt)

| Campo | Limite | Motivo |
|-------|--------|--------|
| `steps` | 3 a 5 | Menos de 3 não é "sequência"; mais de 5 cansa |
| `statement` | 8 a 180 caracteres | Uma pergunta tem que caber em 15–30 segundos |
| `alternatives` | 3 a 4, distintas | 4 só quando a distinção exigir |
| `answer` | índice válido | — |
| `explanation` | 5 a 400 caracteres | 1–2 frases: ela ensina, não repete |
| `hint` | até 200 caracteres | Opcional |

A validação vive em `task.LessonContent.Validate()`. Quando a IA erra,
o erro volta para ela no retry seguinte com o motivo exato
(`enhanceTaskPromptWithFeedback`), em até 3 tentativas.

## O prompt

`generate_lesson.txt` segue quatro princípios:

1. **Uma pergunta = uma micro-habilidade.** Nunca dois conceitos na
   mesma pergunta.
2. **O enunciado já é a pergunta.** Nada de "Considerando o contexto
   acima…" nem de parágrafos.
3. **Dificuldade crescente dentro da sessão.** O primeiro exercício é o
   mais direto.
4. **Sem repetição.** O prompt recebe `PreviousStatements` — os
   enunciados já usados nas sessões do mesmo tópico, extraídos do JSONB
   por `ListTaskStatementsByTopic`. Sem isso, a regra "não repita" era
   apenas um pedido sem verificação.

## Custo e latência

| Situação | Chamadas à IA |
|----------|---------------|
| Primeira sessão de um tópico | 1 |
| Retomar uma sessão em andamento | **0** (`POST /tasks/generate` reaproveita) |
| Treino | **0** (reaproveita exercícios existentes) |
| Revisão | **0** |
| Refazer os errados | **0** |
| Comentário final da sessão | 1 (opcional, pode falhar sem quebrar a sessão) |

## Feedback da IA na sessão

O feedback **por exercício** é determinístico (a alternativa correta e a
explicação já estão no conteúdo da sessão). A IA entra só no
**comentário final** (`POST /corrections/quiz/:attemptId`), que resume
o desempenho e sugere o que revisar.
