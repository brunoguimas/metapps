// ─── MENSAGENS DE ERRO PARA O USUÁRIO ─────────────────────────────
//
// O backend responde em inglês e, nos erros internos (5xx), devolve
// "internal server error": um texto técnico que não ajuda ninguém e
// ainda expõe o estado interno do servidor na tela.
//
// A partir deste módulo, todo erro exibido na interface passa por
// userMessage(), que decide entre:
//
//   - mensagem específica (erro de negócio: e-mail já cadastrado,
//     senha incorreta, código inválido…);
//   - mensagem genérica de erro interno (5xx), com o detalhe real
//     indo para o console em vez da tela;
//   - mensagem genérica de contexto, quando não sabemos explicar.
//
// O módulo não depende do cliente de API de propósito: ele lê apenas
// status, code e message de qualquer erro, o que permite usá-lo tanto
// no api.js (ao criar o erro) quanto nos componentes (ao exibir).

// ─── MENSAGENS PADRÃO ───────────────────────────────────────────

// Fallback final: não sabemos o que aconteceu.
export const GENERIC_ERROR_MESSAGE =
  'Algo deu errado. Tente novamente em alguns instantes.'

// Erro interno do servidor (5xx / INTERNAL_ERROR).
export const INTERNAL_ERROR_MESSAGE =
  'Algo deu errado do nosso lado. Tente novamente em alguns instantes.'

// A requisição nem chegou ao servidor.
export const NETWORK_ERROR_MESSAGE =
  'Sem conexão com o servidor. Verifique sua internet e tente novamente.'

// A sessão não vale mais (401 sem código mais específico).
export const SESSION_EXPIRED_MESSAGE =
  'Sua sessão expirou. Entre novamente para continuar.'


// ─── MENSAGENS POR CÓDIGO ───────────────────────────────────────
//
// Códigos do contrato de erro do backend
// (docs/06-api/api-frontend-contract.md) traduzidos para o usuário.

const CODE_MESSAGES = {
  INVALID_INPUT:
    'Dados inválidos. Verifique as informações e tente novamente.',

  INVALID_CREDENTIALS:
    'E-mail ou senha incorretos.',

  USER_NOT_FOUND:
    'Usuário não encontrado.',

  EMAIL_ALREADY_IN_USE:
    'Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.',

  INVALID_TOKEN:
    SESSION_EXPIRED_MESSAGE,

  INVALID_OR_EXPIRED_EMAIL_CODE:
    'Código inválido ou expirado. Solicite um novo código.',

  GOAL_NOT_FOUND:
    'Objetivo não encontrado.',

  TOPIC_NOT_FOUND:
    'Tópico não encontrado.',

  GOAL_ALREADY_EXISTS:
    'Você já tem um objetivo com esse nome.',

  TASK_NOT_FOUND:
    'Atividade não encontrada.',

  TASK_ATTEMPT_NOT_FOUND:
    'Tentativa não encontrada.',

  TASK_ATTEMPT_TYPE_MISMATCH:
    'Essa resposta não se encaixa na atividade.',

  DUPLICATE_QUESTION_ANSWER:
    'Você já respondeu esta questão.',

  INVALID_QUESTION_INDEX:
    'Questão inválida.',

  TOO_COMMON_PASSWORD:
    'Essa senha é muito comum. Escolha outra.',

  PASSWORD_TOO_SHORT:
    'A senha precisa ter pelo menos 8 caracteres.',

  EMAIL_NOT_VERIFIED:
    'Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada.',

  UNAUTHORIZED:
    SESSION_EXPIRED_MESSAGE,

  FORBIDDEN:
    'Você não tem permissão para fazer isso.',

  TASK_CORRECTION_NOT_FOUND:
    'Feedback não encontrado.',

  PROFILE_NOT_FOUND:
    'Perfil não encontrado.',

  PROFILE_ALREADY_EXISTS:
    'Este perfil já existe.',

  // O provedor de IA está em alta demanda. A resposta do backend é
  // transitória (503), então a mensagem convida a tentar de novo em vez
  // de sugerir que algo quebrou.
  UPSTREAM_UNAVAILABLE:
    'A IA está sobrecarregada agora. Aguarde alguns segundos e tente novamente.',
}


// ─── MENSAGENS POR STATUS ───────────────────────────────────────

const STATUS_MESSAGES = {
  400: 'Dados inválidos. Verifique as informações e tente novamente.',
  401: SESSION_EXPIRED_MESSAGE,
  403: 'Você não tem permissão para fazer isso.',
  404: 'Não encontramos o que você procura.',
  409: 'Já existe um registro com esses dados.',
  422: 'Dados inválidos. Verifique as informações e tente novamente.',
  429: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
}


// ─── REGRAS POR TEXTO ───────────────────────────────────────────
//
// Usadas quando o código não é conhecido (backend legado, proxy no
// meio do caminho, resposta de gateway…).

const TEXT_RULES = [
  {
    test: /email not verified|not verified/i,
    message:
      'Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada.',
  },
  {
    test: /email already in use|email already exists|email is already registered/i,
    message:
      'Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.',
  },
  {
    test: /user ?name already|username .*(taken|exists|already)/i,
    message: 'Este nome de usuário já está em uso. Escolha outro.',
  },
  {
    test: /invalid email or password|invalid credentials|wrong password|incorrect password/i,
    message: 'E-mail ou senha incorretos.',
  },
  {
    test: /invalid (or expired )?code|expired code|verification failed/i,
    message: 'Código inválido ou expirado. Solicite um novo código.',
  },
  {
    test: /invalid (or expired )?token|missing id token|invalid id token|token expired/i,
    message: SESSION_EXPIRED_MESSAGE,
  },
  {
    test: /too many requests|rate limit/i,
    message:
      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  },
  {
    test: /password too short/i,
    message: 'A senha precisa ter pelo menos 8 caracteres.',
  },
  {
    test: /password too common/i,
    message: 'Essa senha é muito comum. Escolha outra.',
  },
  {
    test: /unsupported file type|avatar file not found/i,
    message: 'Arquivo inválido. Envie uma imagem PNG, JPG, GIF ou WebP.',
  },
  {
    test: /not found/i,
    message: 'Não encontramos o que você procura.',
  },
  {
    test: /already exists/i,
    message: 'Já existe um registro com esses dados.',
  },
  {
    test: /invalid payload|invalid request body|invalid input|is required|invalid .* id/i,
    message:
      'Dados inválidos. Verifique as informações e tente novamente.',
  },
]


// ─── TEXTOS QUE NÃO DEVEM CHEGAR NA TELA ────────────────────────
//
// Sinais de erro interno: o backend sanitize a resposta 5xx, mas
// erro de proxy, HTML de gateway ou exceção vazada na mensagem ainda
// precisam ser barrados aqui.

const INTERNAL_TEXT = [
  /internal server error/i,
  /couldn'?t|could not/i,
  /failed to/i,
  /panic:/i,
  /sqlstate|sql error|no such table|database/i,
  /goroutine|stack trace|traceback/i,
  /unhandled (error|exception)/i,
  /\.go:\d+/i,
]

const TECHNICAL_TEXT = [
  /cannot read/i,
  /is not a function/i,
  /is not defined/i,
  /undefined is not/i,
  /null is not/i,
  /unexpected token/i,
  /<html|<!doctype|<\?xml/i,
  /\bat\s+[\w.$]+\s*\(/i, // frame de stack
  /:\d+:\d+/, // arquivo:linha
  /\/usr\/|\/home\/|[A-Za-z]:\\/i, // caminho de arquivo
]

const CODE_LIKE = /^[A-Z0-9_]+$/


// ─── LOGIN COM GOOGLE (OAUTH) ────────────────────────────────────
//
// O motivo do erro do OAuth volta na URL (?reason=...), então precisa
// ser validado antes de aparecer na tela: um link forjado poderia
// escrever qualquer texto na caixa de erro. Só as mensagens geradas
// aqui são aceitas.

const GOOGLE_ERROR_MESSAGES = [
  'Você cancelou o login com o Google.',
  'Não foi possível validar sua autenticação com o Google.',
  'Não foi possível iniciar o login com o Google.',
  'Não foi possível entrar com o Google. Tente novamente.',
]

export const GOOGLE_GENERIC_ERROR_MESSAGE =
  'Não foi possível entrar com o Google. Tente novamente.'

/**
 * Traduz o erro devolvido pelo Google/backend no login social.
 */
export function googleErrorMessage(rawError) {
  const normalized = String(rawError || '').toLowerCase().trim()

  if (
    normalized === 'access_denied' ||
    normalized.includes('access denied') ||
    normalized.includes('cancel')
  ) {
    return 'Você cancelou o login com o Google.'
  }

  if (
    normalized === 'invalid_token' ||
    normalized.includes('invalid id token') ||
    normalized.includes('missing id token') ||
    normalized.includes('invalid token')
  ) {
    return 'Não foi possível validar sua autenticação com o Google.'
  }

  if (
    normalized === 'invalid_request' ||
    normalized === 'unauthorized_client' ||
    normalized === 'invalid_client'
  ) {
    return 'Não foi possível iniciar o login com o Google.'
  }

  return GOOGLE_GENERIC_ERROR_MESSAGE
}

/**
 * Motivo do OAuth que veio na URL: só é exibido quando é uma das
 * mensagens conhecidas.
 */
export function safeGoogleReason(reason) {
  const text = String(reason || '').trim()

  return GOOGLE_ERROR_MESSAGES.includes(text)
    ? text
    : GOOGLE_GENERIC_ERROR_MESSAGE
}


// ─── HELPERS ────────────────────────────────────────────────────

function normalizeStatus(error) {
  const status = Number(error?.status)
  return Number.isFinite(status) && status > 0 ? status : 0
}

function normalizeCode(error) {
  const code = error?.code ?? error?.error_code
  if (typeof code !== 'string') return ''
  return code.trim().toUpperCase()
}

// O texto original do servidor. Fica em error.rawMessage quando o
// erro já passou por aqui, e no message enquanto não passou.
function rawMessage(error) {
  const candidates = [
    error?.rawMessage,
    error?.message,
    typeof error?.data?.error === 'string' ? error.data.error : null,
    typeof error?.data?.message === 'string' ? error.data.message : null,
    typeof error?.data?.error?.message === 'string'
      ? error.data.error.message
      : null,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return ''
}

function looksInternal(raw) {
  return INTERNAL_TEXT.some((re) => re.test(raw))
}

function looksTechnical(raw) {
  return TECHNICAL_TEXT.some((re) => re.test(raw))
}

function isNetworkError(error, raw) {
  if (normalizeCode(error) === 'NETWORK_ERROR') return true

  const status = normalizeStatus(error)

  if (status === 0 && /failed to fetch|network ?error|load failed|err_internet|timeout|unreachable/i.test(raw)) {
    return true
  }

  return false
}


// ─── API PÚBLICA ────────────────────────────────────────────────

/**
 * Erro interno (5xx / INTERNAL_ERROR) do ponto de vista da interface.
 */
export function isInternalError(error) {
  if (!error) return false

  const status = normalizeStatus(error)

  if (status >= 500) return true

  if (normalizeCode(error) === 'INTERNAL_ERROR') return true

  return looksInternal(rawMessage(error))
}

/**
 * Detalhe do erro interno no console — nunca na tela.
 */
export function logInternalError(error, context) {
  const status = normalizeStatus(error)
  const code = normalizeCode(error)
  const raw = rawMessage(error)

  console.error('[metapps] erro interno da API', {
    status: status || null,
    code: code || null,
    message: raw || null,
    context: context || null,
  })
}

/**
 * Traduz um erro em uma mensagem segura para exibir na interface.
 *
 * @param {unknown} error    erro lançado pela API (ou qualquer exceção)
 * @param {string}  fallback mensagem de contexto usada quando o erro
 *                           não pode ser explicado (ex.: "Não foi possível
 *                           carregar o histórico.")
 * @returns {string} mensagem pronta para a tela
 */
export function userMessage(error, fallback) {
  const fallbackMessage = fallback || GENERIC_ERROR_MESSAGE

  if (!error) return fallbackMessage

  // Já traduzido: devolve como está (idempotente).
  if (
    error.userFacing === true &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message
  }

  const code = normalizeCode(error)
  const status = normalizeStatus(error)
  const raw = rawMessage(error)

  // 1) Sem conexão: não é erro do servidor.
  if (isNetworkError(error, raw)) {
    return NETWORK_ERROR_MESSAGE
  }

  // 2) E-mail não verificado vem com o código genérico de credenciais
  //    inválidas, então esse texto precisa ser conferido antes.
  if (/not verified/i.test(raw)) {
    return 'Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada.'
  }

  // 3) Código conhecido do contrato.
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code]
  }

  // 4) Erro interno: mensagem genérica na tela, detalhe no console.
  if (status >= 500 || code === 'INTERNAL_ERROR') {
    logInternalError(error)
    return INTERNAL_ERROR_MESSAGE
  }

  // 5) Status conhecido.
  if (status && STATUS_MESSAGES[status]) {
    return STATUS_MESSAGES[status]
  }

  // 6) Regras por texto (códigos desconhecidos, proxy, gateway).
  for (const rule of TEXT_RULES) {
    if (rule.test.test(raw)) {
      return rule.message
    }
  }

  // 7) Texto que parece ser do usuário (sem cara de erro técnico).
  if (raw && !CODE_LIKE.test(raw) && !looksTechnical(raw) && !looksInternal(raw) && raw.length <= 300) {
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  // 8) Nada mais a fazer: mensagem de contexto.
  return fallbackMessage
}
