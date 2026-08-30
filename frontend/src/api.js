// ─── API CLIENT ────────────────────────────────────────────────
//
// A troca do backend para Gemini acontece dentro do provider de IA.
// Os endpoints e formatos consumidos pelo frontend continuam os mesmos.
//
// Access token fica apenas em memória.
// Nunca armazenamos o access token em localStorage/sessionStorage.
//
// O refresh_token é mantido pelo backend em cookie HttpOnly.
//

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8080'

const JWT_TOKEN_COOKIE_PATH =
  import.meta.env.VITE_JWT_TOKEN_COOKIE_PATH || '/auth/refresh'


// ─── ACCESS TOKEN ──────────────────────────────────────────────

let accessToken = null

export function getAccessToken() {
  return accessToken
}

export function clearAccessToken() {
  accessToken = null
}

export function setAccessToken(token) {
  accessToken = token || null
}


// ─── SESSÃO EXPIRADA ──────────────────────────────────────────
//
// O aplicativo pode registrar um callback global:
//
// setSessionExpiredHandler(() => {
//   navigate('/auth/login')
// })
//
// Dessa forma, qualquer chamada de authFetch que perder a sessão
// consegue disparar o mesmo comportamento sem duplicar lógica
// em cada componente.
//
// Mantemos o callback aqui, no cliente da API, para evitar que
// api.js dependa diretamente do React Router.
//

let onSessionExpired = null

export function setSessionExpiredHandler(callback) {
  onSessionExpired =
    typeof callback === 'function'
      ? callback
      : null
}

function notifySessionExpired() {
  if (typeof onSessionExpired !== 'function') return

  try {
    onSessionExpired()
  } catch (error) {
    // O callback de sessão não deve quebrar o fluxo da API.
    console.error(
      'Erro no callback de sessão expirada:',
      error
    )
  }
}


// ─── REFRESH EM ANDAMENTO ─────────────────────────────────────
//
// Evita múltiplas chamadas simultâneas para /auth/refresh.
//
// Exemplo:
//
// 5 requisições retornam 401 ao mesmo tempo.
//
// Sem esta proteção:
//   -> 5 chamadas para /auth/refresh
//
// Com esta proteção:
//   -> 1 chamada para /auth/refresh
//   -> as demais aguardam a mesma Promise.
//

let refreshPromise = null


// ─── ERRO DE API ──────────────────────────────────────────────
//
// Formato novo do contrato:
//
// {
//   "error": {
//     "code": "EMAIL_ALREADY_IN_USE",
//     "message": "email already in use",
//     "details": null
//   }
// }
//
// Também aceitamos formatos antigos:
//
// {
//   "error": "EMAIL_ALREADY_IN_USE"
// }
//
// ou:
//
// {
//   "message": "alguma mensagem",
//   "code": "ALGUM_ERRO"
// }
//

export class ApiError extends Error {

  constructor(
    message,
    status = 0,
    code = null,
    data = null,
    details = null
  ) {

    super(message)

    this.name = 'ApiError'

    this.status = status

    this.code = code

    this.data = data

    // Details fica disponível diretamente no erro.
    //
    // Assim um formulário pode fazer:
    //
    // if (err.details?.email) {
    //   ...
    // }
    //
    // Além disso, data continua preservado para compatibilidade.

    this.details = details
  }
}


// ─── UTILITÁRIOS ──────────────────────────────────────────────

async function parseResponse(res) {

  const contentType =
    res.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {

    try {
      return await res.json()
    } catch {
      return {}
    }
  }

  try {

    const text = await res.text()

    return text
      ? { message: text }
      : {}

  } catch {

    return {}
  }
}


// ─── EXTRAÇÃO DE ERROS ────────────────────────────────────────

function getErrorCode(data) {

  // Formato novo do contrato:
  //
  // error: {
  //   code: "EMAIL_ALREADY_IN_USE"
  // }

  if (
    data?.error &&
    typeof data.error === 'object' &&
    typeof data.error.code === 'string' &&
    data.error.code.trim()
  ) {
    return data.error.code.trim()
  }


  // Formatos alternativos/legados.

  if (
    typeof data?.error_code === 'string' &&
    data.error_code.trim()
  ) {
    return data.error_code.trim()
  }


  if (
    typeof data?.code === 'string' &&
    data.code.trim()
  ) {
    return data.code.trim()
  }


  // Formato antigo:
  //
  // error: "EMAIL_ALREADY_IN_USE"

  if (
    typeof data?.error === 'string' &&
    /^[A-Z0-9_]+$/.test(data.error)
  ) {
    return data.error
  }


  return null
}


function getErrorMessage(data, fallback) {

  // Formato novo:
  //
  // error: {
  //   message: "email already in use"
  // }

  if (
    data?.error &&
    typeof data.error === 'object' &&
    typeof data.error.message === 'string' &&
    data.error.message.trim()
  ) {
    return data.error.message.trim()
  }


  // Formato antigo/alternativo.

  if (
    typeof data?.message === 'string' &&
    data.message.trim()
  ) {
    return data.message.trim()
  }


  // Formato antigo:
  //
  // error: "email already in use"

  if (
    typeof data?.error === 'string' &&
    !/^[A-Z0-9_]+$/.test(data.error) &&
    data.error.trim()
  ) {
    return data.error.trim()
  }


  return fallback
}


function getErrorDetails(data) {

  // Formato novo do contrato:
  //
  // error: {
  //   details: {
  //     email: "..."
  //   }
  // }

  if (
    data?.error &&
    typeof data.error === 'object' &&
    data.error.details !== undefined
  ) {
    return data.error.details
  }


  // Compatibilidade com possíveis formatos alternativos.

  if (data?.details !== undefined) {
    return data.details
  }


  return null
}


// ─── CRIAÇÃO CENTRALIZADA DE ApiError ─────────────────────────

function createApiError(
  data,
  status,
  fallback
) {

  const code = getErrorCode(data)

  const message = getErrorMessage(
    data,
    fallback
  )

  const details = getErrorDetails(data)


  // Mantém os dados originais.
  //
  // Além disso, se details existir somente dentro de
  // data.error.details, adicionamos uma cópia em data.details.
  //
  // Isso permite:
  //
  // err.data?.details
  //
  // sem destruir o formato original recebido do backend.

  let normalizedData = data

  if (
    details !== null &&
    data &&
    typeof data === 'object' &&
    data.details === undefined
  ) {
    normalizedData = {
      ...data,
      details,
    }
  }


  return new ApiError(
    message,
    status,
    code,
    normalizedData,
    details
  )
}


// ─── REQUEST ──────────────────────────────────────────────────

async function request(url, options = {}) {

  let res

  try {

    res = await fetch(
      url,
      options
    )

  } catch (error) {

    throw new ApiError(
      error?.message ||
        'Falha de conexão com o servidor.',
      0,
      'NETWORK_ERROR',
      null,
      null
    )
  }


  const data = await parseResponse(res)


  if (!res.ok) {

    throw createApiError(
      data,
      res.status,
      `Erro na requisição (${res.status}).`
    )
  }


  return data
}


// ─── AUTH: REGISTER ───────────────────────────────────────────

export async function register(
  username,
  email,
  password
) {

  const data = await request(
    `${API_URL}/auth/register`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      credentials: 'include',

      body: JSON.stringify({
        username,
        email,
        password,
      }),
    }
  )


  // Alguns backends podem devolver access_token junto
  // com o cadastro.
  //
  // Nesse caso, armazenamos somente em memória.

  if (data?.access_token) {
    setAccessToken(data.access_token)
  }


  return data
}


// ─── AUTH: LOGIN ──────────────────────────────────────────────

export async function login(
  email,
  password
) {

  const data = await request(
    `${API_URL}/auth/login`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      credentials: 'include',

      body: JSON.stringify({
        email,
        password,
      }),
    }
  )


  if (!data?.access_token) {

    throw new ApiError(
      'O servidor não retornou um access token.',
      500,
      'MISSING_ACCESS_TOKEN',
      data,
      data?.details ?? null
    )
  }


  setAccessToken(
    data.access_token
  )


  return data
}


// ─── AUTH: GOOGLE ─────────────────────────────────────────────

export function loginWithGoogle() {

  window.location.href =
    `${API_URL}/auth/google/login`
}


// ─── AUTH: REFRESH ────────────────────────────────────────────

export async function refreshSession() {

  // Se já existe um refresh em andamento,
  // reutilizamos a mesma Promise.

  if (refreshPromise) {
    return refreshPromise
  }


  refreshPromise = (async () => {

    try {

      const data = await request(
        `${API_URL}${JWT_TOKEN_COOKIE_PATH}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      )


      if (!data?.access_token) {

        throw new ApiError(
          'O servidor não retornou um access token.',
          401,
          'MISSING_ACCESS_TOKEN',
          data,
          data?.details ?? null
        )
      }


      setAccessToken(
        data.access_token
      )


      return data

    } finally {

      // Permite que uma próxima tentativa de refresh
      // seja feita depois que esta terminar.

      refreshPromise = null
    }

  })()


  return refreshPromise
}


// ─── FETCH AUTENTICADO ────────────────────────────────────────
//
// Faz a requisição normalmente.
//
// Se receber 401:
//   1. tenta renovar a sessão uma única vez;
//   2. se conseguir, repete a requisição original;
//   3. se falhar, limpa o access token;
//   4. chama o callback global de sessão expirada;
//   5. devolve a resposta 401 original.
//
// O componente não precisa duplicar a lógica de redirecionamento.
//

export async function authFetch(
  input,
  init = {}
) {

  const buildHeaders = () => {

    const headers =
      new Headers(init.headers)


    if (accessToken) {

      headers.set(
        'Authorization',
        `Bearer ${accessToken}`
      )
    }


    return headers
  }


  let res

  try {

    res = await fetch(
      `${API_URL}${input}`,
      {
        ...init,

        headers:
          buildHeaders(),

        credentials:
          'include',
      }
    )

  } catch {

    throw new ApiError(
      'Sem conexão com o servidor.',
      0,
      'NETWORK_ERROR',
      null,
      null
    )
  }


  // Resposta normal.

  if (res.status !== 401) {
    return res
  }


  // ─── TOKEN EXPIRADO ─────────────────────────────────────────

  try {

    await refreshSession()

  } catch (error) {

    clearAccessToken()


    // Sessão inválida/expirada.
    //
    // O aplicativo pode ter configurado:
    //
    // setSessionExpiredHandler(() => {
    //   navigate('/auth/login')
    // })
    //
    // A chamada é centralizada aqui.

    notifySessionExpired()


    // Mantemos a resposta 401 original para preservar
    // o comportamento esperado por quem chama authFetch.

    return res
  }


  // ─── REPETE A REQUISIÇÃO COM TOKEN NOVO ─────────────────────

  try {

    const retryRes = await fetch(
      `${API_URL}${input}`,
      {
        ...init,

        headers:
          buildHeaders(),

        credentials:
          'include',
      }
    )


    // Se mesmo com o token renovado o backend
    // continuar respondendo 401, não fazemos outro refresh.
    //
    // Isso evita um loop infinito.

    if (retryRes.status === 401) {

      clearAccessToken()

      notifySessionExpired()
    }


    return retryRes

  } catch {

    throw new ApiError(
      'Sem conexão com o servidor.',
      0,
      'NETWORK_ERROR',
      null,
      null
    )
  }
}


// ─── AUTH: LOGOUT ─────────────────────────────────────────────

export function logout() {

  clearAccessToken()
}


// ─── AUTH: EMAIL VERIFY ───────────────────────────────────────

export async function emailVerify(
  email,
  code
) {

  const data = await request(
    `${API_URL}/auth/email/verify`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      credentials:
        'include',

      body: JSON.stringify({
        email,
        code,
      }),
    }
  )


  if (data?.access_token) {

    setAccessToken(
      data.access_token
    )
  }


  return data
}


// ─── AUTH: RESEND VERIFICATION ────────────────────────────────

export async function resendVerification(
  email
) {

  return request(
    `${API_URL}/auth/email/resend`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      credentials:
        'include',

      body: JSON.stringify({
        email,
      }),
    }
  )
}


// ─── AUTH: FORGOT PASSWORD ───────────────────────────────────

export async function forgotPassword(
  email
) {

  return request(
    `${API_URL}/auth/password/forgot`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      credentials:
        'include',

      body: JSON.stringify({
        email,
      }),
    }
  )
}


// ─── AUTH: RESET PASSWORD ────────────────────────────────────

export async function resetPassword(
  email,
  code,
  newPassword
) {

  return request(
    `${API_URL}/auth/password/reset`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      credentials:
        'include',

      body: JSON.stringify({
        email,
        code,
        new_password:
          newPassword,
      }),
    }
  )
}


// ─── GOALS ────────────────────────────────────────────────────

export async function createGoal(
  title,
  settings
) {

  const res = await authFetch(
    '/protected/goals',
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
        title,
        settings,
      }),
    }
  )


  const data =
    await parseResponse(res)


  if (!res.ok) {

    throw createApiError(
      data,
      res.status,
      'Erro ao criar goal.'
    )
  }


  return data.goal
}


export async function listGoals() {

  const res =
    await authFetch(
      '/protected/goals'
    )


  const data =
    await parseResponse(res)


  if (!res.ok) {

    throw createApiError(
      data,
      res.status,
      'Erro ao listar goals.'
    )
  }


  return data.goals
}


export async function generateRoadmap(
  goalId
) {

  const res =
    await authFetch(
      '/protected/roadmap/generate',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          goal_id: goalId,
        }),
      }
    )


  const data =
    await parseResponse(res)


  if (!res.ok) {

    throw createApiError(
      data,
      res.status,
      'Erro ao gerar roadmap.'
    )
  }


  return data.roadmap
}


export async function generateTask(
  topicId
) {

  const res =
    await authFetch(
      '/protected/tasks/generate',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          topic_id: topicId,
        }),
      }
    )


  const data =
    await parseResponse(res)


  if (!res.ok) {

    throw createApiError(
      data,
      res.status,
      'Erro ao gerar tarefa.'
    )
  }


  return data.task
}


export async function submitAttempt(
  taskId,
  type,
  response
) {

  const res =
    await authFetch(
      `/protected/tasks/${taskId}/attempts`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          type,
          response,

          metadata: {
            attempt_source:
              'web',
          },
        }),
      }
    )


  const data =
    await parseResponse(res)


  if (!res.ok) {

    throw createApiError(
      data,
      res.status,
      'Erro ao submeter resposta.'
    )
  }


  return data
}


// ─── CORRECTIONS ──────────────────────────────────────────────

export async function generateCorrection(
  attemptId,
  type
) {

  const res =
    await authFetch(
      `/protected/corrections/${type}/${attemptId}`,
      {
        method: 'POST',
      }
    )


  const data =
    await parseResponse(res)


  if (!res.ok) {

    throw createApiError(
      data,
      res.status,
      'Não foi possível gerar o feedback.'
    )
  }


  return data.correction
}