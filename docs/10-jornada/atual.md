# Jornada atual

## O que existe hoje

O usuário cria um **objetivo** ("Aprender Go", "Revolução Francesa"), o
backend gera um **roadmap** com a IA (tópicos pai e filho, com
dependências) e o usuário avanza pela trilha: cada nó da trilha é um
tópico, e responder a aula do tópico libera o próximo.

Uma **sessão** (task) é a unidade de estudo: uma sequência de **3 a 5
exercícios curtos**, respondidos **um de cada vez**, com **feedback
instantâneo** do servidor.

## O fluxo de uma sessão

```
trilha ──► clique no nó ──► POST /tasks/generate
                              (reaproveita a sessão em andamento
                               do tópico: sem nova chamada à IA)
                            │
                            ▼
                     ┌─────────────┐
                     │  PLAYER     │  um exercício por vez
                     │             │  alternativas grandes
                     │  1 de 4 ▓▓░░ │  progresso no topo
                     └─────────────┘
                            │
                    POST /tasks/:id/answer
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
        ✅ Correto!                 ❌ Quase!
        +12 XP (combo ×1)           −5 XP
        "explicação"                "a resposta certa era X"
              └─────────────┬─────────────┘
                            ▼
                  último exercício?
                            │ sim
                            ▼
                   POST /tasks/:id/finish
                            │
                            ▼
                   ┌────────────────┐
                   │    RESUMO      │  anel de score, XP, combo,
                   │   75% · +33 XP │  streak, exercícios errados
                   └────────────────┘
                     │              │
        "Refazer os errados"    "Continuar"
                     │              │
              nova sessão só     volta para
              com os erros       a trilha
```

## Progresso e recompensas

| Mecanismo | Como funciona |
|-----------|---------------|
| **XP por exercício** | `10 + min(combo × 2, 10)` quando acerta; `−5` quando erra (o XP total nunca fica negativo) |
| **Bônus de sessão perfeita** | `+5` quando todos os exercícios são acertados |
| **Bônus de domínio** | `+round(peso do tópico × 10)` quando o score atinge a maestria exigida |
| **Combo** | Acertos seguidos multiplicam o XP; errar zera a sequência |
| **Streak** | Dias consecutivos com atividade. Contar qualquer resposta (mesmo errada) já vale como dia de estudo |
| **Meta diária** | Anel de XP na home: `daily_activity` guarda o XP, exercícios, lições e tempo de cada dia |
| **Revisão (SRS)** | Cada exercício vira item de repetição espaçada: errou → volta amanhã; acertou → o intervalo cresce (1 → 3 → 7 → 21 dias) |
| **Treino** | Sessão montada com os exercícios errados e os vencidos na revisão, **sem chamar a IA** |

## Onde a IA entra

| Momento | Uso |
|---------|-----|
| `POST /roadmap/generate` | Monta a trilha (tópicos, pesos, dependências) |
| `POST /tasks/generate` | Gera os 3–5 exercícios da sessão, com validação estrita no servidor e até 3 tentativas com feedback do erro |
| `POST /corrections/quiz/:id` | Comentário final da IA sobre a sessão (aparece no resumo) |

> A IA **não** é chamada para Treino, Revisão ou "Refazer os errados":
> essas sessões reaproveitam exercícios já existentes, o que as torna
> instantâneas e de custo zero.
