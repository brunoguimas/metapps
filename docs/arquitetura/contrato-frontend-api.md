# Contrato da API para Frontend

## Base URL

Defina via ambiente do frontend:

- Desenvolvimento: `http://localhost:8080` (ajuste conforme `PORT` da API)
- Produção: domínio da API

## Regras Gerais

- Formato de payload: `application/json`.
- Access token: enviado em `Authorization: Bearer <token>`.
- Refresh token: cookie HTTP-only (`refresh_token`), enviado com `credentials: 'include'`.
- Em erro, a API retorna objeto com `error`.

Exemplo de erro:

```json
{ "error": "invalid email or password" }
```

## Endpoints

## 1) Registrar usuário

- Método/rota: `POST /auth/register`
- Auth: não

Request body:

```json
{
  "username": "bruno",
  "email": "bruno@email.com",
  "password": "12345678"
}
```

Sucesso:

- Status: `201 Created`
- Body:

```json
{
  "message": "user registered with success",
  "user": {
    "id": 1,
    "email": "bruno@email.com"
  }
}
```

Falhas comuns:

- `400 Bad Request`
  - `invalid credentials`
  - `couldn't create user`

## 2) Login

- Método/rota: `POST /auth/login`
- Auth: não

Request body:

```json
{
  "email": "bruno@email.com",
  "password": "12345678"
}
```

Sucesso:

- Status: `200 OK`
- Efeito colateral: define cookie HTTP-only `refresh_token`
- Body:

```json
{
  "message": "login successful",
  "access_token": "<jwt_access_token>"
}
```

Falhas comuns:

- `400 Bad Request`
  - `invalid credentials`
- `401 Unauthorized`
  - `invalid email or password`

## 3) Login com Google (OAuth)

- Método/rota: `GET /auth/google/login`
- Auth: não
- Comportamento: redireciona (`303 See Other`) para o consentimento do Google.

Callback:

- Método/rota: `GET /auth/google/callback`
- Auth: não
- Parâmetros esperados: `code`, `state`

Sucesso:

- Status: `200 OK`
- Efeito colateral: define cookie HTTP-only `refresh_token`
- Body:

```json
{
  "message": "login successful",
  "access_token": "<jwt_access_token>"
}
```

Falhas comuns:

- `401 Unauthorized`
  - `invalid oauth state`
  - `missing id token`
  - `invalid id token`
- `500 Internal Server Error`
  - `code-Token exchange failed`

## 4) Login com Microsoft (OAuth)

- Método/rota: `GET /auth/microsoft/login`
- Auth: não
- Comportamento: redireciona (`303 See Other`) para o consentimento da Microsoft.

Callback:

- Método/rota: `GET /auth/microsoft/callback`
- Auth: não
- Parâmetros esperados: `code`, `state`

Sucesso:

- Status: `200 OK`
- Efeito colateral: define cookie HTTP-only `refresh_token`
- Body:

```json
{
  "message": "login successful",
  "access_token": "<jwt_access_token>"
}
```

Falhas comuns:

- `401 Unauthorized`
  - `invalid oauth state`
  - `missing id token`
  - `invalid id token`
- `500 Internal Server Error`
  - `code-Token exchange failed`
  - `oidc provider init failed`

## 5) Refresh de sessão

- Método/rota: `POST /auth/refresh`
- Auth por header: não
- Requisito: enviar cookie de refresh (`credentials: 'include'`)
- Body: vazio

Sucesso:

- Status: `200 OK`
- Efeito colateral: substitui cookie `refresh_token`
- Body:

```json
{
  "message": "token refreshed",
  "access_token": "<new_jwt_access_token>"
}
```

Falhas comuns:

- `400 Bad Request`
  - `refresh token not found`
- `401 Unauthorized`
  - `invalid refresh token`
- `500 Internal Server Error`

## 6) Rota protegida de exemplo

- Método/rota: `GET /protected/home`
- Auth: sim (`Authorization: Bearer <access_token>`)

Sucesso:

- Status: `200 OK`
- Body:

```json
{
  "message": "Authorized",
  "user_id": "1"
}
```

Falhas comuns:

- `401 Unauthorized`
  - `missing or invalid authorization header`
  - `invalid or expired token`

## Fluxo recomendado no frontend

1. Usuário faz login (`/auth/login`).
2. Front recebe `access_token` e mantém em memória.
3. Chamadas protegidas enviam `Authorization: Bearer <access_token>`.
4. Se endpoint protegido retornar `401`, tentar `POST /auth/refresh` uma única vez.
5. Se refresh retornar `200`, atualizar `access_token` e repetir requisição original.
6. Se refresh falhar (`400/401/500`), limpar estado de sessão e redirecionar para login.

## Exemplo de cliente HTTP (fetch)

```ts
const API_URL = import.meta.env.VITE_API_URL;

let accessToken: string | null = null;

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'login failed');

  accessToken = data.access_token;
  return data;
}

export async function refreshSession() {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'refresh failed');

  accessToken = data.access_token;
  return data;
}

export async function authFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let res = await fetch(`${API_URL}${input}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status !== 401) return res;

  try {
    await refreshSession();
  } catch {
    accessToken = null;
    return res;
  }

  const retryHeaders = new Headers(init.headers);
  if (accessToken) retryHeaders.set('Authorization', `Bearer ${accessToken}`);

  return fetch(`${API_URL}${input}`, {
    ...init,
    headers: retryHeaders,
    credentials: 'include',
  });
}
```

## Checklist de integração

- Frontend e API com origins corretas (`FRONTEND_ORIGIN` na API).
- Requests com `credentials: 'include'` em login/refresh.
- Envio de `Authorization` nas rotas protegidas.
- Tratamento centralizado de `401` com tentativa única de refresh.
- Logout limpando estado em memória do access token.
