import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getMe, listGoals } from '../api.js'
import { INTERNAL_ERROR_MESSAGE } from '../lib/errors.js'

// Resposta JSON com o formato de erro do backend.
function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () => 'application/json',
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

describe('api.js — exibição de erros', () => {
  let fetchMock
  let logSpy

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    logSpy.mockRestore()
  })

  it('não expõe "internal server error" na tela', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'internal server error', code: 'INTERNAL_ERROR' },
        500
      )
    )

    await expect(getMe()).rejects.toMatchObject({
      message: INTERNAL_ERROR_MESSAGE,
      rawMessage: 'internal server error',
      status: 500,
      code: 'INTERNAL_ERROR',
    })
  })

  it('não expõe detalhe interno do servidor na mensagem', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: "couldn't create goal: pq: relation does not exist", code: 'INTERNAL_ERROR' },
        500
      )
    )

    const error = await listGoals().catch((e) => e)

    expect(error.message).toBe(INTERNAL_ERROR_MESSAGE)
    expect(error.message).not.toContain('relation')
    expect(error.rawMessage).toContain('relation')
  })

  it('traduz erro de negócio para mensagem amigável', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'email already in use', code: 'EMAIL_ALREADY_IN_USE' },
        409
      )
    )

    await expect(getMe()).rejects.toMatchObject({
      message: 'Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.',
    })
  })

  it('não deixa HTML de proxy vazar para a mensagem', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      headers: { get: () => 'text/html' },
      json: async () => ({}),
      text: async () => '<html><body>Bad Gateway</body></html>',
    })

    const error = await listGoals().catch((e) => e)

    expect(error.message).toBe(INTERNAL_ERROR_MESSAGE)
    expect(error.message).not.toContain('<html>')
  })
})
