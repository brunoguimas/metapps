# Contrato API-Frontend Metapps

Este documento define o contrato entre o frontend (React/PWA) e o backend API REST do sistema Metapps. Ele detalha endpoints, formatos de request/response, autenticação, tratamento de erros e convenções para implementação frontend.

## Versão do Documento
- **Versão**: 1.0.0
- **Data**: 2026-08-18
- **Backend**: Go/Golang com Gin Framework
- **Frontend**: React (PWA recomendado)

## Sumário
1. [Autenticação e Sessão](#1-autenticação-e-sessão)
2. [Formato de Requisição e Resposta](#2-formato-de-requisição-e-resposta)
3. [Tratamento de Erros](#3-tratamento-de-erros)
4. [Endpoints da API](#4-endpoints-da-api)
5. [Upload de Arquivos](#5-upload-de-arquivos)
6. [Considerações de Desenvolvimento](#6-considerações-de-desenvolvimento)
7. [Exemplos de Implementação](#7-exemplos-de-implementação)

---

## 1. Autenticação e Sessão

O Metapps utiliza autenticação baseada em JWT (JSON Web Tokens) com mecanismo de refresh token.

### 1.1. Tokens
- **Access Token**: JWT de curta duração (configurável, padrão 5 minutos)
  - Enviado no header `Authorization: Bearer <token>`
  - Usado para autenticar requisições às rotas protegidas
- **Refresh Token**: Token de longa duração (configurável, padrão 24 horas)
  - Armazenado em cookie HTTP-only, secure, SameSite=Lax
  - Nome do cookie: `refresh_token`
  - Usado para obter novos access tokens sem requerer credenciais

### 1.2. Fluxo de Autenticação

#### Login Inicial (Email/Senha)
```mermaid
sequenceDiagram
    Frontend->>Backend: POST /auth/login {email, password}
    Backend->>Frontend: 200 OK {access_token, message}
    Backend->>Frontend: Set-Cookie: refresh_token=<value>; HttpOnly; Secure; SameSite=Lax
    Frontend->>Frontend: Armazenar access_token (memória ou storage)
```

#### Login via Google OAuth
```mermaid
sequenceDiagram
    Frontend->>Backend: GET /auth/google/login
    Backend->>Google: Redirect para consentimento
    Google->>Frontend: Redirect para /auth/google/callback?code=<code>&state=<state>
    Frontend->>Backend: GET /auth/google/callback?code=<code>&state=<state>
    Backend->>Frontend: 200 OK {access_token, message}
    Backend->>Frontend: Set-Cookie: refresh_token=<value>; HttpOnly; Secure; SameSite=Lax
    Frontend->>Frontend: Armazenar access_token
```

#### Renovação de Access Token
```mermaid
sequenceDiagram
    Frontend->>Backend: POST /auth/refresh
    (Cookie refresh_token enviado automaticamente)
    Backend->>Frontend: 200 OK {access_token, message}
    Frontend->>Frontend: Atualizar access_token armazenado
```

#### Logout
```mermaid
sequenceDiagram
    Frontend->>Backend: POST /auth/logout (se implementado)
    Frontend->>Frontend: Remover access_token armazenado
    Frontend->>Frontend: Limpar estado da aplicação
    // O refresh token será removido via expire automático ou explicitamente
```

### 1.3. Headers de Requisição Autenticada
Todas as requisições para rotas protegidas (`/protected/*`) devem incluir:
```
Authorization: Bearer <access_token>
```

### 1.4. Verificação de Sessão
O frontend deve:
- Verificar a validade do access token (pelo menos antes de requisições críticas)
- Lidar com respostas 401 (Unauthorized) tentando renovar o token
- Após falha na renovação, redirecionar para tela de login

---

## 2. Formato de Requisição e Resposta

### 2.1. Content-Type
- **Requisições com body**: `application/json`
- **Upload de arquivos**: `multipart/form-data`
- **Respostas**: Sempre `application/json` (exceto arquivos estáticos como avatares)

### 2.2. Formato de Resposta de Sucesso
```json
{
  "message": "Mensagem descritiva opcional",
  "<dados>": <valor ou objeto>
}
```

#### Exemplos:
```json
// GET /profile
{
  "profile": {
    "id": "uuid",
    "user_id": "uuid",
    "xp": 1250,
    "streak": 7,
    "last_activity_date": "2026-08-18T00:00:00Z",
    "avatar_url": "http://localhost:8080/avatars/abc123.png",
    "created_at": "2026-08-01T10:30:00Z",
    "updated_at": "2026-08-18T14:22:00Z"
  }
}

// POST /tasks/generate
{
  "task": {
    "id": "uuid",
    "user_id": "uuid",
    "topic_id": "uuid",
    "meta": {
      "title": "Título da tarefa",
      "description": "Descrição da tarefa",
      "expectations": "O que se espera da resposta"
    },
    "type": "quiz|essay",
    "content": {}, // Estrutura varia por tipo
    "done": false,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### 2.3. Formato de Resposta de Criação (201)
```json
{
  "message": "Recurso criado com sucesso",
  "<recurso>": <objeto criado>
}
```

#### Exemplo:
```json
// POST /auth/register
{
  "message": "usuário registrado com sucesso",
  "user": {
    "id": "uuid",
    "email": "usuario@example.com",
    "username": "nomeusuario"
  }
}
```

### 2.4. Respostas Vazias ou de Confirmação
Para operações sem retorno de dados significativos:
```json
{
  "message": "Operação realizada com sucesso"
}
```

### 2.5. Parâmetros de Consulta (Query Parameters)
- Utilizados para filtragem, paginação, ordenação
- Formato padrão: `?page=1&limit=10&sort=created_at:desc`
- Valores booleanos: `true`/`false` como strings
- Dates: formato ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`)

---

## 3. Tratamento de Erros

### 3.1. Formato de Resposta de Erro
Todas as respostas de erro seguem o formato padronizado:
```json
{
  "error": {
    "code": "CODIGO_DO_ERRO",
    "message": "Mensagem descritiva do erro",
    "details": <objeto opcional com informações adicionais>
  }
}
```

### 3.2. Códigos de Erro HTTP Comuns
| Código | Significante | Quando usar |
|--------|--------------|-------------|
| 400 | Bad Request | Requisição mal formada, validação falhou |
| 401 | Unauthorized | Token ausente, inválido ou expirado |
| 403 | Forbidden | Usuário autenticado mas sem permissão |
| 404 | Not Found | Recurso não encontrado |
| 409 | Conflict | Conflito com estado atual (ex: email duplicado) |
| 422 | Unprocessable Entity | Erros de validação de campo específicos |
| 500 | Internal Server Error | Erro inesperado no servidor |

### 3.3. Estrutura de Erros de Validação (422)
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Falha na validação dos campos",
    "details": {
      "field_name": ["mensagem de erro 1", "mensagem de erro 2"],
      "another_field": ["mensagem de erro"]
    }
  }
}
```

#### Exemplo real do cadastro:
```json
{
  "error": {
    "code": "EMAIL_ALREADY_IN_USE",
    "message": "email already in use",
    "details": null
  }
}
```

### 3.4. Tratamento no Frontend
- Interceptar todas as respostas HTTP
- Para 401: tentar renovar token; se falhar, redirecionar para login
- Para 422: exibir mensagens de erro por campo no formulário
- Para outros erros: exibir mensagem genérica ou específica conforme `error.message`
- Logar erros inesperados para debug em desenvolvimento

---

## 4. Endpoints da API

### 4.1. Autenticação (`/auth`)
*Não requer autenticação inicial*

| Método | Endpoint | Descrição | Request Body | Success Response |
|--------|----------|-----------|--------------|------------------|
| `POST` | `/register` | Registro de novo usuário | `{username, email, password}` | `201 Created` {user: {...}} |
| `POST` | `/login` | Login com email/senha | `{email, password}` | `200 OK` {access_token, message} |
| `POST` | `/refresh` | Renovação de access token | (cookie refresh_token) | `200 OK` {access_token, message} |
| `POST` | `/password/forgot` | Solicitar recuperação de senha | `{email}` | `200 OK` {message} |
| `POST` | `/password/reset` | Redefinir senha com token | `{code, new_password}` | `200 OK` {message} |
| `POST` | `/email/verify` | Verificar email com token | `{email}` | `200 OK` {message} |
| `POST` | `/email/resend` | Reenviar token de verificação | `{email}` | `200 OK` {message} |
| `GET` | `/google/login` | Iniciar fluxo Google OAuth | Nenhum | `302 Redirect` para Google |
| `GET` | `/google/callback` | Callback do Google OAuth | `?code=<code>&state=<state>` | `200 OK` {access_token, message} |

### 4.2. Perfil (`/protected/profile`)
*Requer autenticação*

| Método | Endpoint | Descrição | Request Body | Success Response |
|--------|----------|-----------|--------------|------------------|
| `GET` | `` | Obter perfil do usuário logado | Nenhum | `200 OK` {profile: {...}} |
| `POST` | `/avatar` | Upload de avatar de perfil | `multipart/form-data` (campo "avatar") | `200 OK` {message, avatar_url} |

#### Formato do Avatar (Response do POST /avatar)
```json
{
  "message": "avatar uploaded successfully",
  "avatar_url": "http://localhost:8080/avatars/filename.png"
}
```

### 4.3. Metas/Goals (`/protected/goals`)
*Requer autenticação*

| Método | Endpoint | Descrição | Request Body | Success Response |
|--------|----------|-----------|--------------|------------------|
| `POST` | `` | Criar nova meta | `{title, settings: {motivation, success_criteria, baseline, time_constraints, learning_style, priority}}` | `201 Created` {goal: {...}} |
| `GET` | `` | Listar todas as metas do usuário | Query: opcional filters | `200 OK` {goals: [...]} |
| `GET` | `/:id` | Obter meta específica | Nenhum | `200 OK` {goal: {...}} |
| `PUT` | `/:id` | Atualizar meta existente | `{title, settings: {...}}` | `200 OK` {message} |
| `DELETE` | `/:id` | Excluir meta | Nenhum | `200 OK` {message} |

#### Estrutura de `settings` em Goal
```json
{
  "motivation": "string",
  "success_criteria": "string",
  "baseline": "string",
  "time_constraints": {
    "daily_minutes": number (opcional),
    "weekly_minutes": number (opcional),
    "sessions_per_day": number (opcional),
    "extra": {} // objeto livre para extensões
  },
  "learning_style": "string",
  "priority": "string" // ex: "high", "medium", "low"
}
```

### 4.4. Tarefas (`/protected/tasks`)
*Requer autenticação*

| Método | Endpoint | Descrição | Request Body | Success Response |
|--------|----------|-----------|--------------|------------------|
| `POST` | `/generate` | Gerar nova tarefa para um tópico | `{topic_id: uuid}` | `201 Created` {task: {...}} |
| `GET` | `` | Listar tarefas do usuário | Query: opcional filters (topic_id, done, etc.) | `200 OK` {tasks: [...]} |
| `GET` | `/:id` | Obter tarefa específica | Nenhum | `200 OK` {task: {...}} |

#### Tipos de Tarefa
- `quiz`: Questão de múltipla escolha
- `essay`: Resposta dissertativa

#### Estrutura do Conteúdo por Tipo
**Quiz:**
```json
{
  "questions": [
    {
      "statement": "string",
      "alternatives": ["string", "string", "string", "string"],
      "answer": number (índice da alternativa correta),
      "explanation": "string"
    }
  ]
}
```

**Essay:**
```json
{
  "instructions": "string",
  "expectations": "string",
  "content": {
    // Estrutura livre, mas geralmente contém campos esperados na resposta
  }
}
```

#### Estrutura da Meta da Tarefa (comum para ambos os tipos)
```json
{
  "title": "string",
  "description": "string",
  "expectations": "string" // O que se espera que o usuário demonstre
}
```

### 4.5. Tentativas de Tarefa (`/protected/task-attempts`)
*Requer autenticação*

| Método | Endpoint | Descrição | Request Body | Success Response |
|--------|----------|-----------|--------------|------------------|
| `POST` | `/tasks/:taskId/attempts` | Submeter tentativa para uma tarefa | `{response: <varia por tipo>}` | `201 Created` {attempt: {...}} |
| `GET` | `/tasks/:taskId/attempts` | Listar tentativas de uma tarefa | Nenhum | `200 OK` {attempts: [...]} |
| `GET` | `/user` | Listar todas as tentativas do usuário | Query: opcional filters | `200 OK` {attempts: [...]} |

#### Formato da Resposta por Tipo de Tarefa
**Quiz Attempt:**
```json
{
  "response": [
    {
      "question_index": number,
      "answer": number (índice da alternativa escolhida)
    }
  ]
}
```

**Essay Attempt:**
```json
{
  "response": "string" // texto da resposta dissertativa
}
```

#### Estrutura da Tentativa (Response)
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "user_id": "uuid",
  "content": <mesmo formato enviado na request>,
  "score": number (opcional, entre 0 e 1, preenchido após correção),
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### 4.6. Correções (`/protected/corrections`)
*Requer autenticação*

| Método | Endpoint | Descrição | Request Body | Success Response |
|--------|----------|-----------|--------------|------------------|
| `POST` | `` | Criar correção manual (para professores/admins) | `{attempt_id, feedback, score?}` | `201 Created` {correction: {...}} |
| `GET` | `/attempt/:attemptId` | Obter correção de uma tentativa específica | Nenhum | `200 OK` {correction: {...}} |
| `POST` | `/essay/:attemptId` | Gerar correção de essay via IA | Nenhum | `200 OK` {correction: {...}} |
| `POST` | `/quiz/:attemptId` | Gerar correção de quiz via IA | Nenhum | `200 OK` {correction: {...}} |

#### Estrutura da Correção
```json
{
  "id": "uuid",
  "attempt_id": "uuid",
  "feedback": "string",
  "score": number (entre 0 e 1),
  "status": "completed", // ou outros status conforme implementação
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### 4.7. Roadmap/Jornada de Estudos (`/protected/roadmap`)
*Requer autenticação*

| Método | Endpoint | Descrição | Request Body | Success Response |
|--------|----------|-----------|--------------|------------------|
| `POST` | `/generate` | Gerar roadmap baseado em uma meta | `{goal_id: uuid}` | `201 Created` {roadmap: {...}} |
| `GET` | `/:goalID` | Obter roadmap de uma meta específica | Nenhum | `200 OK` {roadmap: {...}} |

#### Estrutura do Roadmap
```json
{
  "topics": [
    {
      "id": "uuid",
      "goal_id": "uuid",
      "parent_topic_id": null|uuid, // null para tópicos raiz
      "title": "string",
      "description": "string",
      "required_mastery": number (0-1, ex: 0.8 para 80%),
      "weight": number (peso relativo no cálculo de progresso),
      "order_index": number (ordem de exibição)
    }
  ],
  "dependencies": [
    {
      "id": "uuid",
      "topic_id": "uuid", // tópico que depende
      "depends_on_topic_id": "uuid" // pré-requisito
    }
  ]
}
```

---

## 5. Upload de Arquivos

### 5.1. Avatar de Perfil
- **Endpoint**: `POST /protected/profile/avatar`
- **Content-Type**: `multipart/form-data`
- **Campo do arquivo**: `avatar`
- **Tipos permitidos**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
- **Tamanho máximo**: 10MB (conforme implementação no handler)
- **Resposta**: URL pública do avatar no formato `http://<host>:<port>/avatars/<filename>`

### 5.2. Serving de Arquivos Estáticos
- Avatares são servidos em `/avatars/<filename>`
- URL construída como: `${config.AvatarBaseURL}/<filename>`
- No desenvolvimento: `http://localhost:8080/avatars/filename.png`
- Em produção: usar o domínio configurado

---

## 6. Considerações de Desenvolvimento

### 6.1. Configuração de Ambiente
- **Frontend em desenvolvimento**: geralmente roda em `http://localhost:5173` (Vite) ou `http://localhost:3000` (CRA)
- **Backend em desenvolvimento**: roda em `http://localhost:8080`
- **Variáveis de ambiente necessárias no frontend**:
  ```
  VITE_API_BASE_URL=http://localhost:8080
  ```

### 6.2. Proxy em Desenvolvimento (Vite Exemplo)
No `vite.config.js`:
```js
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```
Luego usar `/api/auth/login` ao invés de `http://localhost:8080/auth/login`

### 6.3. Tratamento de CORS
O backend já está configurado com CORS para permitir:
- Origem: `${FRONTEND_ORIGIN}` (do .env)
- Métodos: GET, POST, PUT, PATCH, DELETE, OPTIONS
- Headers: Origin, Content-Type, Authorization
- Credentials: true (necessário para cookies)

### 6.4. Headers Comuns
Todas as requisições autenticadas devem incluir:
```javascript
{
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json' // exceto para uploads
}
```

### 6.5. Lidando com Tokens no Frontend
#### Armazenamento Recomendado
- **Access Token**: memória RAM (variável em estado global ou context) ou sessionStorage (mais seguro que localStorage contra XSS)
- **Never store in localStorage** devido à vulnerabilidade a XSS

#### Exemplo de Context/API Service (React)
```javascript
// apiClient.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

class ApiClient {
  constructor() {
    this.accessToken = null;
    this.refreshTokenCookieName = 'refresh_token';
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  clearAccessToken() {
    this.accessToken = null;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.accessToken && !options.noAuth) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Lidar com token expirado
      if (response.status === 401) {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          this.setAccessToken(newToken);
          headers.Authorization = `Bearer ${newToken}`;
          return fetch(url, { ...options, headers }); // retry
        } else {
          // Redirecionar para login
          window.location.href = '/login';
          throw new Error('Sessão expirada');
        }
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro desconhecido');
      }

      return response.json();
    } catch (error) {
      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include' // importante para enviar cookies
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.access_token;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // Métodos convenience
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  postFormData(endpoint, formData, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: formData, // não stringify for FormData
      headers: {
        // Content-Type será definido automaticamente pelo browser
        ...options.headers
      }
    });
  }
}

export default new ApiClient();
```

### 6.6. Tratamento de Loading e Estados
- Implementar estados de loading, error, success para todas as chamadas de API
- Usar esquemas como:
  ```
  idle → loading → success/error
  ```
- Para mutations: otimistic updates quando apropriado (ex: marcar tarefa como concluída)

### 6.7. Paginação e Listas
Quando endpoints suportarem paginação (implementar conforme necessidade):
- Parâmetros: `page` (padrão 1), `limit` (padrão 10 ou 20)
- Resposta pode incluir metadados:
  ```json
  {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 150,
      "totalPages": 15,
      "hasNext": true,
      "hasPrev": false
    }
  }
  ```

---

## 7. Exemplos de Implementação

### 7.1. Serviço de Autenticação (AuthService.js)
```javascript
import apiClient from './apiClient';

export const authService = {
  login: async (credentials) => {
    const response = await apiClient.post('/auth/login', credentials);
    apiClient.setAccessToken(response.access_token);
    // refresh token vem no cookie automaticamente
    return response;
  },

  register: async (userData) => {
    const response = await apiClient.post('/auth/register', userData);
    apiClient.setAccessToken(response.access_token);
    return response;
  },

  logout: () => {
    apiClient.clearAccessToken();
    // Em implementação completa: chamar endpoint de logout se existir
    window.location.href = '/login';
  },

  refreshToken: async () => {
    const newToken = await apiClient.refreshAccessToken();
    if (newToken) {
      apiClient.setAccessToken(newToken);
      return newToken;
    }
    return null;
  },

  // Verifica se o token está presente (não valida expiração aqui)
  isAuthenticated: () => !!apiClient.accessToken
};
```

### 7.2. Hook Customizado para Requisições Autenticadas (useAuthenticatedRequest.js)
```javascript
import { useState, useCallback } from 'react';
import apiClient from '../utils/apiClient';

export const useAuthenticatedRequest = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const execute = useCallback(async (endpoint, method = 'GET', body = null) => {
    setLoading(true);
    setError(null);
    
    try {
      let response;
      switch (method.toUpperCase()) {
        case 'GET':
          response = await apiClient.get(endpoint);
          break;
        case 'POST':
          response = await apiClient.post(endpoint, body);
          break;
        case 'PUT':
          response = await apiClient.put(endpoint, body);
          break;
        case 'DELETE':
          response = await apiClient.delete(endpoint);
          break;
        default:
          throw new Error(`Método não suportado: ${method}`);
      }
      
      setData(response);
      return response;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { execute, loading, error, data };
};
```

### 7.3. Componente de Upload de Avatar
```javascript
import { useState } from 'react';
import apiClient from '../utils/apiClient';

export const AvatarUploader = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    const file = e.target.avatar.files[0];
    
    if (!file) {
      setError('Por favor, selecione um arquivo');
      return;
    }

    // Validação básica do frontend
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Tipo de arquivo não permitido. Use PNG, JPG, GIF ou WebP');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      setError('O arquivo deve ter no máximo 10MB');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      formData.append('avatar', file);
      const response = await apiClient.postFormData(
        '/protected/profile/avatar',
        formData
      );
      
      setPreview(response.avatar_url);
      if (onSuccess) onSuccess(response.avatar_url);
    } catch (err) {
      setError(err.message || 'Erro ao fazer upload do avatar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input 
          type="file" 
          name="avatar" 
          accept="image/png, image/jpeg, image/gif, image/webp"
          onChange={(e) => {
            if (e.target.files[0]) {
              const file = e.target.files[0];
              const reader = new FileReader();
              reader.onload = (ev) => setPreview(ev.target.result);
              reader.readAsDataURL(file);
            }
          }}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Fazendo upload...' : 'Atualizar Avatar'}
        </button>
        
        {error && <div className="error">{error}</div>}
        {preview && <div className="preview">
          <img src={preview} alt="Prévia do avatar" />
        </div>}
      </form>
    </div>
  );
};
```

---

## 8. Mensagens de Erro Comuns do Backend

Baseada na análise do código, estas são algumas mensagens de erro que o frontend pode esperar:

| Código de Erro | Mensagem | Quando ocorre |
|----------------|----------|---------------|
| `EMAIL_ALREADY_IN_USE` | "email already in use" | Durante registro ou atualização de email |
| `USER_NOT_FOUND` | "user not found" | Durante login ou busca por ID |
| `INVALID_CREDENTIALS` | "invalid email or password" | Senha incorreta ou usuário não encontrado |
| `INVALID_TOKEN` | "missing id token" ou "invalid id token" | Durante OAuth quando token do Google é inválido |
| `EMAIL_NOT_VERIFIED` | "email not verified" | Quando usuário tenta fazer login sem verificar email (se RNF06 estiver ativada) |
| `ERR_PROFILE_NOT_FOUND` | (provavelmente) | Quando tenta acessar perfil que não existe (deveria ser raro com a criação automática) |
| `ERR_PROFILE_ALREADY_EXISTS` | (provavelmente) | Quando tenta criar perfil para usuário que já tem |

## 9. Fluxos Recomendados no Frontend

### 9.1. Fluxo de Registro
1. Usuário preenche formulário de registro
2. Frontend valida campos básicos (email format, senha strength, etc.)
3. Frontend chama `authService.register()`
4. Em sucesso:
   - Armazenar access token
   - Redirecionar para dashboard ou tela de boas-vindas
5. Em erro:
   - Exibir mensagem específica (especialmente para email duplicado)
   - Manter usuário na tela de registro

### 9.2. Fluxo de Login
1. Usuário preenche email e senha
2. Frontend valida formato de email
3. Frontend chama `authService.login()`
4. Em sucesso:
   - Armazenar access token
   - Redirecionar para página originalmente solicitada ou dashboard
5. Em erro 401:
   - Exibir "Email ou senha incorretos"
6. Em erro de outros tipos:
   - Exibir mensagem genérica ou específica

### 9.3. Fluxo de Renovação de Token (Interceptor)
Implementar um interceptor que:
1. Antes de cada requisição verificando se o token está próximo de expirar (ex: menos de 30s)
2. Se estiver próximo, tentar renovar silenciosamente
3. Se renovação falhar, redirecionar para login

### 9.4. Tratamento de Sessão Expirada
Quando receber 401:
1. Tentar renovar token com refresh token (via cookie automático no fetch com credentials: 'include')
2. Se renovação funcionar, repetir a requisição original
3. Se renovação falhar (401 ou outro erro):
   - Limpar estado de autenticação
   - Redirecionar para tela de login
   - Opcional: mostrar mensagem "Sua sessão expirou. Por favor, faça login novamente."

---

## 10. Considerações de Performance e UX

### 10.1. Prefetch e Cache
- Considerar cache de dados pouco frequentes (perfil, metas) por curto período
- Implementar estratégia de cache-invalidade após mutations
- Usar React Query, SWR ou similar para gerenciamento avançado de estado server-side

### 10.2. Otimistic Updates
- Para ações como "marcar tarefa como concluída", atualizar UI imediatamente e reverter em caso de erro
- Para upload de avatar, mostrar pré-visualização imediatamente enquanto upload ocorre em background

### 10.3. Tratamento de Estados Vazios
- Telas vazias devem mostrar mensagens amigáveis e ações sugeridas
- Exemplo: Nenhuma meta cadastrada → botão "+ Nova Meta" destacados

### 10.4. Acessibilidade
- Todos os formulários devem ter labels adequados
- Mensagens de erro devem ser associadas aos campos via `aria-describedby`
- Funcionalidade deve ser navegável via teclado
- Cores devem atender contraste WCAG AA mínimo

---

## 11. Perguntas Frequentes (FAQ)

**Q: Onde devo armazenar o access token?**  
A: Em memória RAM (variável de estado global ou Context API) ou sessionStorage. Nunca em localStorage devido a vulnerabilidade a XSS.

**Q: Como o refresh token é enviado automaticamente?**  
A: Ao fazer requisições com `credentials: 'include'` no fetch API, o browser enviará automaticamente cookies incluindo o refresh_token para o domínio correto.

**Q: O que acontece se o usuário bloquear cookies?**  
A: O fluxo de OAuth quebrará pois depende do cookie refresh_token. O frontend deveria detectar essa situação e oferecer fallback ou aviso claro.

**Q: Posso usar o access token diretamente do cookie?**  
A: Não, o access token não é armazenado em cookie por razões de segurança. Apenas o refresh token está em cookie HTTP-only.

**Q: Com que frequência devo renovar o access token?**  
A: Renove quando estiver próximo de expirar (ex: <30s de validade restante) ou ao receber 401 de uma requisição.

**Q: E se o usuário tiver múltiplas abas abertas?**  
A: Considere usar eventos de storage ou BroadcastChannel para sincronizar estado de autenticação entre abas quando o token for renovado em uma aba.

**Q: Como lidar com perda de conexão durante upload?**  
A: Implemente retry com backoff exponencial e permita que o usuário tente novamente manualmente. Considere mostrar progresso do upload.

---

*Este contrato deve ser evoluído conforme a API for desenvolvida. Qualquer mudança que quebre compatibilidade retroativa deve ser documentada e comunicada com antecedência.*