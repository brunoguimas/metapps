# Metapps

Plataforma web de aprendizagem personalizada orientada por metas. O objetivo do Metapps é transformar metas de estudo em jornadas adaptativas, utilizando IA para geração de atividades, acompanhamento de progresso e personalização contínua baseada no desempenho do usuário.

---

## ✨ Visão Geral

O Metapps permite que usuários:

* Criem metas de aprendizado
* Definam dificuldades e objetivos
* Recebam tarefas geradas por IA
* Respondam quizzes e atividades
* Acompanhem evolução ao longo do tempo
* Construam revisões com flashcards
* Recebam feedback inteligente sobre desempenho

A ideia central do projeto é aproximar tecnologia e educação de forma prática, adaptativa e escalável.

---

## 🏗️ Arquitetura

O projeto é dividido em:

### Backend

* Linguagem: Go
* Framework HTTP: Gin
* Banco de dados: PostgreSQL
* Queries tipadas: SQLC
* Autenticação:

  * JWT
  * Refresh Tokens
  * OAuth Google
  * Verificação de email
  * Recuperação de senha
* IA:

  * Integração com API da Groq
* Email:

  * SMTP

### Frontend

* React
* Vite
* React Router

---

## 📦 Estrutura do Projeto

```txt
metapps/
├── backend
│   ├── cmd
│   │   └── api
│   └── internal
│       ├── ai
│       │   └── templates
│       ├── httpx
│       ├── middleware
│       ├── modules
│       │   ├── auth
│       │   ├── goal
│       │   ├── health
│       │   ├── jwt
│       │   ├── mail
│       │   ├── oauth
│       │   ├── task
│       │   ├── taskattempt
│       │   └── user
│       ├── platform
│       │   ├── config
│       │   ├── database
│       │   ├── jobs
│       │   ├── logger
│       │   └── security
│       ├── router
│       └── shared
│           └── error
├── frontend
    ├── public
    └── src
        ├── assets
        └── pages
```

---

## 🚀 Funcionalidades Atuais

### 🔐 Autenticação

* Cadastro de usuários
* Login com JWT
* Refresh token
* Logout
* OAuth com Google
* Verificação de email
* Recuperação de senha

### 🎯 Sistema de Metas

* Criação de metas de estudo
* Organização por objetivos
* Histórico de progresso

### 📝 Sistema de Tarefas

* Geração automática de tarefas com IA
* Tentativas de resolução
* Correção automática de quizzes
* Feedback inicial de desempenho

### 🌐 Frontend

* Landing page
* Fluxo completo de autenticação
* Criação de metas
* Resolução de tarefas

---

## 🧠 Objetivos Futuros

O Metapps está evoluindo para uma plataforma adaptativa completa, incluindo:

* Correção inteligente de respostas abertas
* Sistema avançado de flashcards
* Jornada de aprendizado personalizada
* Métricas pedagógicas
* Recomendação automática de revisões
* Análise de dificuldades reais do usuário
* Observabilidade e monitoramento
* Sistema de streaks e gamificação
* PWA
* Dashboard avançado de progresso

---

## ⚙️ Configuração do Ambiente

### Pré-requisitos

* Go 1.22+
* Node.js 20+
* PostgreSQL
* Make (opcional)

---

## 🔧 Backend

### 1. Entrar na pasta

```bash
cd backend
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env`:

```env
PORT=8080

DATABASE_URL=postgres://user:password@localhost:5432/metapps

JWT_SECRET=your_secret

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=example@example.com
SMTP_PASS=password

GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

GROQ_API_KEY=your_api_key
```

### 3. Rodar migrations

```bash
make migrate-up
```

ou

```bash
goose up
```

### 4. Executar servidor

```bash
go run cmd/api/main.go
```

---

## 💻 Frontend

### 1. Entrar na pasta

```bash
cd frontend
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Executar aplicação

```bash
npm run dev
```

---

## ❤️ Health Check

O backend possui endpoints de monitoramento:

```http
GET /health
```

Exemplo:

```json
{
  "ai": {
    "status": "UP",
    "latency_ms": 1756
  },
  "database": {
    "status": "UP",
    "latency_ms": 4
  },
  "status": "OK"
}
```

Também é recomendado utilizar:

```http
GET /health/live
GET /health/ready
```

* `/health/live` → verifica se a aplicação está viva
* `/health/ready` → verifica dependências externas

---

## 🧪 Testes

Backend:

```bash
go test ./...
```

Frontend:

```bash
npm run test
```

---

## 📚 Filosofia do Projeto

O Metapps foi criado com foco em:

* Aprendizado adaptativo
* Controle real do progresso
* Uso prático de IA na educação
* Arquitetura modular e escalável
* Transparência tecnológica
* Evolução contínua baseada em dados

A proposta não é apenas gerar exercícios, mas entender o histórico do usuário e construir uma experiência de aprendizado personalizada de verdade.

---

## 🔒 Arquitetura Backend

O backend segue arquitetura em camadas:

```txt
Handler -> Service -> Repository -> Database
```

### Handler

Responsável por:

* HTTP
* validação
* serialização
* status codes

### Service

Responsável por:

* regras de negócio
* fluxo da aplicação
* integração com IA

### Repository

Responsável por:

* acesso ao banco
* queries SQL
* persistência

Essa separação facilita:

* testes
* manutenção
* escalabilidade
* desacoplamento

---

## 📈 Roadmap

* [x] Autenticação completa
* [x] Integração com IA
* [x] Sistema de metas
* [x] Sistema de tarefas
* [x] Correção automática de quizzes
* [ ] Flashcards adaptativos
* [ ] Correção de respostas abertas com IA
* [ ] Sistema de revisão espaçada
* [ ] Dashboard analítico
* [ ] Observabilidade completa
* [ ] PWA
* [ ] Gamificação
* [ ] Recomendações inteligentes

---

## 📄 Licença

Copyright (c) 2026 Bruno Guimarães, Luis Felipe, Nicolas Santos

Este projeto está disponível apenas para uso pessoal, educacional e não comercial.

Uso comercial sem autorização explícita do autor é proibido.

Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
