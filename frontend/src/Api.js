const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Access token stored in memory only — never localStorage
let accessToken = null

export function getAccessToken()   { return accessToken }
export function clearAccessToken() { accessToken = null }

// POST /auth/register
export async function register(username, email, password) {
  const res  = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao criar conta')
  return data
}

// POST /auth/login — stores access_token in memory on success
export async function login(email, password) {
  const res  = await fetch(`${API_URL}/auth/login`, {
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

// GET /auth/google/login — redirects browser
export function loginWithGoogle() {
  window.location.href = `${API_URL}/auth/google/login`
}

// POST /auth/refresh — uses refresh_token cookie, updates accessToken
export async function refreshSession() {
  const res  = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Sessão expirada')
  accessToken = data.access_token
  return data
}

// Authenticated fetch — auto-retry once on 401 via refresh
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