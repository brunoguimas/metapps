# Topic - Tópico

Representam tópicos e/ou subtópicos de uma matéria da qual o usuário deseja aprender.

Uma `árvore` de Topics é chamada de `roadmap`.

### 001 - Responsabilidades

- Representam tópicos de um assunto
- Carregam informações úteis para geração de tarefas sobre o assunto
- Ligados a uma Goal

### 002 - Relações

- Topic -> pertence a 1 Goal (1:1)
- Topic -> tem N tarefas (1:N)
- Topic -> tem 1 `Topic progress`

### 003 - Regras de negócio

- Todo Goal conterá 1 Topic raíz.
- Topics formam uma árvore (roadmap)
- Subtopics são Topics sem filhos (leaf nodes)
- Usuários podem gerar tarefas apenas para Subtopics

### 004 - Ciclo de vida

1. Usuário define meta
2. Topic raíz é gerado com N filhos
3. Subtopics são elegíveis para geração de tarefas
4. Usuário gera tarefa com IA em Subtopic
5. Correção gera scores
6. Topic progress é atualizado

### 005 - Observações técnicas

- Backend: Serviço Go `topic_service`
- Banco de dados: Tabela `topics`
- API: `/roadmap`
