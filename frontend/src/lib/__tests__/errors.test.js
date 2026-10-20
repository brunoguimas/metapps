import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  GENERIC_ERROR_MESSAGE,
  INTERNAL_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  GOOGLE_GENERIC_ERROR_MESSAGE,
  googleErrorMessage,
  isInternalError,
  safeGoogleReason,
  userMessage,
} from '../errors.js'

describe('userMessage', () => {
  let logSpy

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('troca erro interno (5xx) por mensagem genérica', () => {
    const error = {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'internal server error',
    }

    expect(userMessage(error)).toBe(INTERNAL_ERROR_MESSAGE)
    expect(userMessage(error)).not.toContain('internal server error')
  })

  it('não expõe o texto cru do servidor em erro interno', () => {
    const error = {
      status: 500,
      message: "couldn't create goal: pq: relation \"goals\" does not exist",
    }

    const message = userMessage(error)

    expect(message).toBe(INTERNAL_ERROR_MESSAGE)
    expect(message).not.toContain('relation')
    expect(message).not.toContain('couldn\'t')
  })

  it('registra o detalhe do erro interno no console', () => {
    userMessage({ status: 500, code: 'INTERNAL_ERROR', message: 'boom' })

    expect(logSpy).toHaveBeenCalledTimes(1)
  })

  it('traduz códigos conhecidos do contrato', () => {
    expect(userMessage({ status: 409, code: 'EMAIL_ALREADY_IN_USE' })).toBe(
      'Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.'
    )
    expect(userMessage({ status: 404, code: 'GOAL_NOT_FOUND' })).toBe(
      'Objetivo não encontrado.'
    )
  })

  it('traduz e-mail não verificado antes do código genérico de credenciais', () => {
    const error = {
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'email not verified',
    }

    expect(userMessage(error)).toBe(
      'Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada.'
    )
  })

  it('traduz erro de credenciais inválidas', () => {
    expect(userMessage({ status: 401, code: 'INVALID_CREDENTIALS' })).toBe(
      'E-mail ou senha incorretos.'
    )
  })

  it('traduz sessão expirada', () => {
    expect(userMessage({ status: 401, code: 'INVALID_TOKEN' })).toBe(
      SESSION_EXPIRED_MESSAGE
    )
    expect(userMessage({ status: 401 })).toBe(SESSION_EXPIRED_MESSAGE)
  })

  it('traduz erro de rede', () => {
    expect(userMessage({ status: 0, code: 'NETWORK_ERROR' })).toBe(
      NETWORK_ERROR_MESSAGE
    )
    expect(userMessage(new TypeError('Failed to fetch'))).toBe(
      NETWORK_ERROR_MESSAGE
    )
  })

  it('usa o texto do backend quando ele parece mensagem de usuário', () => {
    expect(userMessage({ status: 400, message: 'settings is required' })).toBe(
      'Dados inválidos. Verifique as informações e tente novamente.'
    )
  })

  it('usa o fallback quando o erro é técnico e não tem status', () => {
    const error = new TypeError("Cannot read properties of undefined (reading 'id')")

    expect(userMessage(error, 'Não foi possível carregar o histórico.')).toBe(
      'Não foi possível carregar o histórico.'
    )
  })

  it('usa o fallback genérico quando nada é informado', () => {
    expect(userMessage(null)).toBe(GENERIC_ERROR_MESSAGE)
    expect(userMessage(undefined)).toBe(GENERIC_ERROR_MESSAGE)
  })

  it('não mostra HTML vindo de proxy/gateway', () => {
    const error = {
      status: 502,
      message: '<html><body>502 Bad Gateway</body></html>',
    }

    const message = userMessage(error, 'Não foi possível carregar a trilha.')

    expect(message).toBe(INTERNAL_ERROR_MESSAGE)
    expect(message).not.toContain('<html>')
  })

  it('devolve a mesma mensagem quando o erro já foi traduzido', () => {
    const error = {
      status: 500,
      userFacing: true,
      message: INTERNAL_ERROR_MESSAGE,
    }

    expect(userMessage(error, 'Outro texto')).toBe(INTERNAL_ERROR_MESSAGE)
  })

  it('usa o rawMessage quando o erro foi traduzido antes', () => {
    const error = {
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'E-mail ou senha incorretos.',
      rawMessage: 'invalid email or password',
    }

    expect(userMessage(error)).toBe('E-mail ou senha incorretos.')
  })
})

describe('isInternalError', () => {
  it('reconhece erro interno por status e por código', () => {
    expect(isInternalError({ status: 500 })).toBe(true)
    expect(isInternalError({ status: 503 })).toBe(true)
    expect(isInternalError({ status: 0, code: 'INTERNAL_ERROR' })).toBe(true)
  })

  it('não confunde erro de negócio com erro interno', () => {
    expect(isInternalError({ status: 409, code: 'EMAIL_ALREADY_IN_USE' })).toBe(false)
    expect(isInternalError({ status: 401, code: 'INVALID_CREDENTIALS' })).toBe(false)
    expect(isInternalError(null)).toBe(false)
  })
})

describe('erro do login com Google', () => {
  it('traduz os erros conhecidos do OAuth', () => {
    expect(googleErrorMessage('access_denied')).toBe(
      'Você cancelou o login com o Google.'
    )
    expect(googleErrorMessage('invalid_token')).toBe(
      'Não foi possível validar sua autenticação com o Google.'
    )
    expect(googleErrorMessage('invalid_client')).toBe(
      'Não foi possível iniciar o login com o Google.'
    )
    expect(googleErrorMessage('algo-desconhecido')).toBe(
      GOOGLE_GENERIC_ERROR_MESSAGE
    )
  })

  it('aceita na URL apenas motivos conhecidos', () => {
    expect(safeGoogleReason('Você cancelou o login com o Google.')).toBe(
      'Você cancelou o login com o Google.'
    )
    expect(safeGoogleReason('sua conta foi bloqueada, ligue 0800')).toBe(
      GOOGLE_GENERIC_ERROR_MESSAGE
    )
    expect(safeGoogleReason('')).toBe(GOOGLE_GENERIC_ERROR_MESSAGE)
  })
})
