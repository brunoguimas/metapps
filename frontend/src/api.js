// ─── API CLIENT ────────────────────────────────────────────────
// Nota: a troca do backend para Gemini (GeminiClient.Generate) foi feita
// dentro do provider de IA — não muda os endpoints nem o formato de
// resposta que este arquivo consome. Se em algum momento o backend passar
// a devolver o roadmap no formato "nodes/edges" (igual ao schema do prompt,
// com `parent_id` em vez de `parent_topic_id`), só ajustar getLeafTopics
// no Homepage.jsx — ele já foi feito pra aceitar os dois formatos.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
const JWT_TOKEN_COOKIE_PATH = import.meta.env.VITE_JWT_TOKEN_COOKIE_PATH || '/auth/refresh'

// Access token guardado apenas em memória — nunca em localStorage
let accessToken = null

export function getAccessToken()      { return accessToken }
export function clearAccessToken()    { accessToken = null }
export function setAccessToken(token) { accessToken = token }

// POST /auth/register
export async function register(username, email, password) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao criar conta')
  return data
}

// POST /auth/login — guarda access_token em memória
export async function login(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao fazer login')
  accessToken = data.access_token
  return data
}

// GET /auth/google/login — redireciona o browser
export function loginWithGoogle() {
  window.location.href = `${API_URL}/auth/google/login`
}

// POST /auth/refresh — usa o cookie refresh_token, atualiza o accessToken
export async function refreshSession() {
  const res = await fetch(`${API_URL}${JWT_TOKEN_COOKIE_PATH}`, {
    method: 'POST',
    credentials: 'include',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Sessão expirada')
  accessToken = data.access_token
  return data
}

// Fetch autenticado — refaz uma vez via refresh em caso de 401
export async function authFetch(input, init = {}) {
  const buildHeaders = () => {
    const h = new Headers(init.headers)
    if (accessToken) h.set('Authorization', `Bearer ${accessToken}`)
    return h
  }

  let res = await fetch(`${API_URL}${input}`, {
    ...init,
    headers: buildHeaders(),
    credentials: 'include',
  })

  if (res.status !== 401) return res

  try {
    await refreshSession()
  } catch {
    accessToken = null
    return res
  }

  return fetch(`${API_URL}${input}`, {
    ...init,
    headers: buildHeaders(),
    credentials: 'include',
  })
}

export function logout() {
  accessToken = null
}

// POST /auth/email/verify
export async function emailVerify(email, code) {
  const res = await fetch(`${API_URL}/auth/email/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, code }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Código inválido')
  accessToken = data.access_token
  return data
}

// GOALS
export async function createGoal(title, settings) {
  const res = await authFetch('/protected/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, settings }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao criar goal')
  return data.goal
}

export async function listGoals() {
  const res = await authFetch('/protected/goals')
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao listar goals')
  return data.goals
}

export async function generateRoadmap(goalId) {
  const res = await authFetch('/protected/roadmap/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal_id: goalId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao gerar roadmap')
  return data.roadmap
}

export async function generateTask(topicId) {
  const res = await authFetch('/protected/tasks/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic_id: topicId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao gerar tarefa')
  return data.task
}

export async function submitAttempt(taskId, type, response) {
  const res = await authFetch(`/protected/tasks/${taskId}/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, response, metadata: { attempt_source: 'web' } }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao submeter resposta')
  return data
}

// POST /auth/email/resend
export async function resendVerification(email) {
  const res = await fetch(`${API_URL}/auth/email/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao reenviar')
  return data
}