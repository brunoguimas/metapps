# Próximas features

Ordenadas por impacto na experiência. O núcleo Duolingo (sessão passo a
passo, feedback instantâneo, meta diária, streak, combo, Treino e
Revisão) já está implementado — o que falta são camadas em volta.

## Alta prioridade

### 🔔 Lembretes de estudo (push)
O streak só funciona se o usuário souber que ele existe. Um lembrete
diário ("faltam 20 XP para sua meta") é o motor de retenção mais
barato do Duolingo.

- Precisa de: tabela de push tokens, agendamento diário, endpoint de
  registro do token.
- Sem dependência externa se usar Web Push (Service Worker) no PWA.

### 📊 Heatmap de atividade e estatísticas por tópico
`daily_activity` já guarda XP, exercícios, lições e tempo por dia. Falta
expor:
- heatmap de 12 semanas na aba de progresso;
- precisão por tópico (acertos / tentativas a partir de
  `task_step_attempts`);
- tempo médio por exercício.

### 🏆 Semanas (league) e ranking
Tabela `weekly_league` + job semanal. Cuidado: compete com o objetivo
de ajudar a aprender, não de viciar.

### 🎨 Modo "Aula" vs "Treino" na trilha
Diferenciar visualmente os nós: aula (cadeado, precisa de maestria) e
treino (livre, repete erros). O backend já sabe a diferença pelo
`source` da sessão.

## Média prioridade

### 🔊 Efeitos sonoros e animação de combo
WebAudio (sem asset externo) + contador de combo crescendo na barra
superior. Trivial de implementar e de alto impacto.

### ⌨️ Gestos e modo offline
- responder por swipe;
- cache do conteúdo da sessão para continuar sem internet.

### 🧠 banco de questões por tópico
Hoje cada sessão é gerada do zero pela IA (embora a sessão em andamento
seja reaproveitada). Um **banco de questões por tópico** permitiria:
- iniciar sem latência;
- variedade real sem chamar a IA;
- Treino e Revisão mais ricos.

### 🧩 Mais tipos de exercício
Hoje só múltipla escolha. Vale adicionar:
- `true_false` (já previsto no schema);
- `type_answer` (resposta digitada, com normalização);
- `matching` (associar pares);
- `word_bank` (montar a frase com blocos).

## Baixa prioridade

- 🏅 Conquistas por sequência (7 dias, 30 dias, 100 dias);
- 👥 Estudo em grupo (opcional, com privacy first);
- 📈 Previsão de domínio ("você domina este tópico em ~3 sessões");
- 🧾 Exportar o histórico (CSV/JSON);
- 🌍 Modo bilíngue do conteúdo (EN/PT) — depende do modelo aceitar
  `language` no prompt.
