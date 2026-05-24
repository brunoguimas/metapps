# Metapps - Documentação

Este diretório contém toda a documentação técnica e de produto do sistema Metapps.

Documentação organizada por áreas de responsabilidade, separando domínio, arquitetura, backend, frontend, IA, banco de dados e decisões técnicas.

Estrutura:
```
docs/
├── 00-geral/
├── 01-arquitetura/
├── 02-backend/
├── 03-frontend/
├── 04-ai/
├── 05-dominio/
│   ├── contratos/
│   │   └── tarefas/
│   ├── entidades/
│   └── regras/
├── 06-api/
│   └── schemas/
├── 06-banco-de-dados/
├── 08-devops/
├── 09-decisoes/
├── 10-jornada/
├── 11-requisitos/
├── 12-testes/
└── recursos/
    ├── diagramas
    └── imagens
```

# Organização

### 00 - Geral

Visão geral do sistema.
- O que é o Metapps?

### 01 - Arquitetura

Descrição técnica das funcionalidades do sistema.
- Design geral do sistema
- Fluxo de dados
- Estrutura backend/frontend

### 02 - Backend

Implementação do servidor em Go.
- Handlers
- Serviços
- Repositórios
- Autenticação

### 03 - Frontend

Aplicação PWA React.
- Páginas
- Componentes

### 04 - IA 

Funcionalidades relacionadas à inteligência artificial (Groq AI).
- Geração de tarefas
- Geração de jornadas de estudos
- Sistema de correção

### 05 - Domínio

Modelo centra do sistema
- Entidades
- Regras de negócio

### 06 - API

Contratos da API REST
- Endpoints
- Fluxos

### 07 - Banco de dados

Estrutura física de dados.
- Tabelas
- Relações
- Índices
- Migrations

### 08 - DevOps

Insfraestrutura e implantação.
- Variáveis de ambiente
- Deploy
- Logs

### 09 - Decisões

Decisões técnicas.
- Por que Go?
- Por que React?
- Por que PostgreSQL?
- Por que SQLC?
- Por que JWT?

### 10 - Jornada

Evolução do sistema.
- Situação atual
- Experimentos
- Próximas features

### 11 - Requisitos

Definição do comportamento do sistema.
- Requisitos funcionais
- Requisitos não funcionais

### 12 - Testes

Estratégia de testes
- Backend
- Integração
- IA
