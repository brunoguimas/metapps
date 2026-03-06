# Arquitetura da API

## Visão Geral
Este backend é uma API em Go construída com Gin, SQLC e PostgreSQL. O código segue uma arquitetura em camadas com limites claros entre pacotes:

- `handler`: camada de transporte HTTP.
- `service`: regras de negócio e orquestração.
- `repository` + repositórios de `auth`: abstrações de acesso a dados.
- `database/db`: camada de queries geradas pelo SQLC.
- `auth`: criação/validação de JWT, persistência de tokens e middleware de autenticação.
- `config`: configuração de runtime via ambiente.
- `errors`: códigos de erro de domínio e mapeamento para status HTTP.

Ponto de entrada: `cmd/api/main.go`.

## Composição em Runtime
No `cmd/api/main.go`, as dependências são montadas nesta ordem:

1. Carrega configurações de ambiente (`config.Load`).
2. Abre conexão com PostgreSQL (`database.Connect`).
3. Cria adaptador de queries SQLC (`db.New`).
4. Monta dependências de autenticação/tokens:
- `auth.NewJWTRepository(queries)`
- `auth.NewJWTService(...)`
5. Monta dependências de usuário:
- `repository.NewUserRepository(queries)`
- `service.NewUserService(userRepo)`
- `handler.NewUserHandler(userService, jwtService)`
6. Monta roteador (`handler.NewRouter`).
7. Anexa middleware de CORS.
8. Inicia servidor HTTP (`r.Run(cfg.Port)`).

Isso é injeção manual de dependências (sem framework de DI).

## Responsabilidades por Camada

### 1) Camada Handler (`internal/handler`)
Responsabilidades:

- Fazer parse e validação de payload HTTP (via binding do Gin e `handler/httpx`).
- Chamar abstrações de service/auth.
- Traduzir resultados em resposta HTTP e cookies.
- Definir rotas (`router.go`).

Rotas atuais:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /protected/home` (requer `Authorization: Bearer <access_token>`)

Pacote helper:

- `internal/handler/httpx/bind.go`: `BindJSON[T]` genérico.
- `internal/handler/httpx/response.go`: helpers de resposta (`OK`, `Message`, `Error`).

### 2) Camada Service (`internal/service`)
Responsabilidades:

- Conter regras de negócio independentes de HTTP e SQL.
- Orquestrar hash/check de senha e chamadas de repositório.

`user_service.go`:

- `CreateUser`: gera hash da senha, monta model e persiste via repositório.
- `Login`: busca usuário por email e valida hash da senha.

Os contratos de entrada estão em `internal/service/dto`.

### 3) Camada Repository

#### Repositório de Usuário (`internal/repository`)
Responsabilidades:

- Fazer mapeamento entre models de domínio (`internal/models`) e structs geradas pelo SQLC.
- Executar operações de persistência/consulta de usuário via `*db.Queries`.

#### Repositório JWT (`internal/auth/jwt_repository.go`)
Responsabilidades:

- Persistir refresh tokens.
- Buscar refresh token por ID.
- Revogar refresh token.

Essa divisão mantém persistência de token próxima do módulo de autenticação, enquanto persistência de usuário fica em `internal/repository`.

### 4) Módulo de Autenticação (`internal/auth`)
Responsabilidades:

- Modelo de claims JWT (`claims.go`).
- Geração/validação de access token.
- Geração/validação de refresh token com estado em banco.
- Revogação de refresh token.
- Middleware Gin para rotas protegidas (`jwt_middleware.go`).

Detalhe de design:

- Access token é JWT stateless.
- Refresh token é stateful: JWT + registro em banco (`refresh_tokens`), permitindo revogação e validação de expiração.

### 5) Camada de Dados (`internal/database` + `internal/database/db`)
Responsabilidades:

- Setup de conexão (`postgres.go`).
- SQL como fonte da verdade em `internal/database/queries/*.sql`.
- Código tipado gerado pelo SQLC em `internal/database/db`.
- Migrations em `internal/database/migrations`.

## Fluxos de Requisição

### Register
`POST /auth/register`

1. Handler faz bind de `RegisterRequest`.
2. Service gera hash da senha.
3. Repositório de usuário chama SQLC `CreateOneUser`.
4. Handler retorna `201` com id/email do usuário.

### Login
`POST /auth/login`

1. Handler faz bind de `LoginRequest`.
2. Service busca usuário por email e valida senha.
3. Auth service emite access token.
4. Auth service cria refresh token (JWT + registro em banco).
5. Handler seta cookie HTTP-only `refresh_token` e retorna access token.

### Refresh
`POST /auth/refresh`

1. Handler lê cookie `refresh_token`.
2. Auth service valida assinatura/claims do JWT e estado do token no banco.
3. Handler busca registro do token (`GetById`) para recuperar user ID.
4. Auth service emite novo access token.
5. Auth service emite novo refresh token.
6. Refresh token antigo é revogado.
7. Handler sobrescreve cookie e retorna novo access token.

### Rota Protegida
`GET /protected/home`

1. `AuthMiddleware` extrai bearer token.
2. Auth service valida access token.
3. Middleware injeta `user_id` e `claims` no contexto do Gin.
4. Handler retorna resposta autorizada.

## Modelo de Erros
`internal/errors/apperrors.go` define códigos de erro (`Code`) e mapeia para status HTTP.

Códigos atuais:

- `INTERNAL_ERROR`
- `INVALID_INPUT`
- `INVALID_CREDENTIALS`
- `USER_NOT_FOUND`
- `INVALID_TOKEN`

`NewAppError` encapsula erros de baixo nível com código de domínio + mensagem. Na prática, handlers costumam normalizar erros de autenticação para mensagens genéricas por segurança.

## Modelo de Configuração
`config.Load()` lê `.env` e variáveis obrigatórias:

- `PORT`
- `FRONTEND_ORIGIN`
- `ISSUER`
- `ACCESS_TOKEN_TTL`
- `REFRESH_TOKEN_TTL`
- `JWT_SECRET` (obrigatória)
- `DATABASE_URL` (obrigatória)
- `DATABASE_DRIVER` (obrigatória)

Os valores de TTL são parseados como `time.Duration`.

## Características de Segurança

- Senhas são hasheadas antes de persistir (`internal/security`).
- Access tokens usam assinatura HMAC (`jwt/v5`).
- Refresh tokens são persistidos e revogáveis.
- Endpoints protegidos dependem de middleware bearer auth.
- Refresh token é enviado como cookie HTTP-only.

## Convenções e Pontos de Extensão

- Adicionar novos casos de uso primeiro em `service`, depois expor em `handler`.
- Manter SQL em `internal/database/queries` e regenerar artefatos do SQLC.
- Reutilizar helpers de `httpx` para manter handlers enxutos.
- Se o número de endpoints crescer, centralizar tradução de erro/resposta na camada handler.
