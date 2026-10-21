// ─── TESTES DO PLAYER ────────────────────────────────────────────────
//
// Verificam o comportamento do ponto de vista do usuario: uma pergunta
// por vez, feedback instantâneo e o resumo no fim.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const answerStepMock = vi.fn()
const finishSessionMock = vi.fn()
const generateCorrectionMock = vi.fn()

vi.mock('../../../api', () => ({
  answerStep: (...args) => answerStepMock(...args),
  finishSession: (...args) => finishSessionMock(...args),
  generateCorrection: (...args) => generateCorrectionMock(...args),
}))

import LessonPlayer from '../LessonPlayer.jsx'

const lesson = {
  id: 'task-1',
  type: 'quiz',
  meta: { title: 'Inteiros e bits', description: 'Tipos inteiros em Go' },
  content: {
    version: 2,
    steps: [
      {
        statement: 'Qual o intervalo de um int32?',
        alternatives: ['0 a 2^32', '-2^31 a 2^31-1', '1 a 255'],
        answer: 1,
        explanation: 'int32 usa 32 bits com sinal.',
      },
      {
        statement: 'Qual tipo guarda 0 a 255?',
        alternatives: ['uint8', 'int64', 'bool'],
        answer: 0,
        explanation: 'uint8 vai de 0 a 255.',
      },
      {
        statement: 'Qual o tamanho de um int?',
        alternatives: ['4 bytes', '8 bytes', 'depende'],
        answer: 0,
        explanation: 'int tem 8 bytes em 64 bits.',
      },
    ],
  },
}

function stepResult(overrides = {}) {
  return {
    task_id: 'task-1',
    step_index: 0,
    total_steps: 3,
    correct: true,
    correct_answer: 1,
    explanation: 'int32 usa 32 bits com sinal.',
    xp_awarded: 12,
    xp_total: 12,
    combo: 1,
    max_combo: 1,
    next_step_index: 1,
    streak: 1,
    daily_xp: 12,
    daily_goal: 50,
    ...overrides,
  }
}

describe('LessonPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    answerStepMock.mockResolvedValue(stepResult())
    finishSessionMock.mockResolvedValue({
      task_id: 'task-1',
      score: 1,
      correct_answers: 3,
      total_questions: 3,
      xp_gained: 42,
      max_combo: 3,
      mastered: true,
      required_mastery: 0.7,
      perfect: true,
      streak: 1,
      daily_xp: 42,
      daily_goal: 50,
      wrong_steps: [],
      attempt_id: 'attempt-1',
    })
    generateCorrectionMock.mockResolvedValue(null)
  })

  it('mostra um exercício por vez', () => {
    render(<LessonPlayer task={lesson} onFinish={() => {}} onExit={() => {}} />)

    expect(screen.getByText('Qual o intervalo de um int32?')).toBeInTheDocument()
    expect(screen.queryByText('Qual tipo guarda 0 a 255?')).not.toBeInTheDocument()
    expect(screen.getByText('de 3')).toBeInTheDocument()
  })

  it('só habilita "Verificar" depois de escolher uma alternativa', async () => {
    const user = userEvent.setup()
    render(<LessonPlayer task={lesson} onFinish={() => {}} onExit={() => {}} />)

    const verify = screen.getByRole('button', { name: /verificar/i })
    expect(verify).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /-2\^31 a 2\^31-1/ }))
    expect(verify).toBeEnabled()
  })

  it('mostra o feedback instantâneo com a explicação', async () => {
    const user = userEvent.setup()
    render(<LessonPlayer task={lesson} onFinish={() => {}} onExit={() => {}} />)

    await user.click(screen.getByRole('button', { name: /-2\^31 a 2\^31-1/ }))
    await user.click(screen.getByRole('button', { name: /verificar/i }))

    await waitFor(() => {
      expect(screen.getByText(/Correto!/)).toBeInTheDocument()
    })
    expect(screen.getByText('int32 usa 32 bits com sinal.')).toBeInTheDocument()
    expect(screen.getByText('+12 XP')).toBeInTheDocument()
    expect(answerStepMock).toHaveBeenCalledWith('task-1', 0, 1)
  })

  it('avança para o próximo exercício ao continuar', async () => {
    const user = userEvent.setup()
    render(<LessonPlayer task={lesson} onFinish={() => {}} onExit={() => {}} />)

    await user.click(screen.getByRole('button', { name: /-2\^31 a 2\^31-1/ }))
    await user.click(screen.getByRole('button', { name: /verificar/i }))
    await user.click(await screen.findByRole('button', { name: /continuar/i }))

    expect(screen.getByText('Qual tipo guarda 0 a 255?')).toBeInTheDocument()
  })

  it('encerra a sessão no último exercício e mostra o resumo', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<LessonPlayer task={lesson} onFinish={onFinish} onExit={() => {}} />)

    // passo 0
    await user.click(screen.getByRole('button', { name: /-2\^31 a 2\^31-1/ }))
    await user.click(screen.getByRole('button', { name: /verificar/i }))
    await user.click(await screen.findByRole('button', { name: /continuar/i }))

    // passo 1
    await user.click(screen.getByRole('button', { name: /uint8/ }))
    await user.click(screen.getByRole('button', { name: /verificar/i }))
    await user.click(await screen.findByRole('button', { name: /continuar/i }))

    // passo 2 (último)
    await user.click(screen.getByRole('button', { name: /4 bytes/ }))
    await user.click(screen.getByRole('button', { name: /verificar/i }))
    await user.click(await screen.findByRole('button', { name: /ver resultado/i }))

    await waitFor(() => {
      expect(finishSessionMock).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByText('Perfeito!')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('permite escolher a alternativa pelo teclado', async () => {
    const user = userEvent.setup()
    render(<LessonPlayer task={lesson} onFinish={() => {}} onExit={() => {}} />)

    await user.keyboard('2')
    expect(screen.getByRole('button', { name: /verificar/i })).toBeEnabled()
  })

  it('mostra o feedback da IA no resumo da sessão', async () => {
    // O backend devolve o texto da IA em `feedback` (string).
    generateCorrectionMock.mockResolvedValue({
      id: 'correction-1',
      attempt_id: 'attempt-1',
      feedback: 'Parabéns! Você dominou o conteúdo desta sessão.',
      score: 1,
      status: 'completed',
    })

    const user = userEvent.setup()
    render(<LessonPlayer task={lesson} onFinish={() => {}} onExit={() => {}} />)

    await user.click(screen.getByRole('button', { name: /-2\^31 a 2\^31-1/ }))
    await user.click(screen.getByRole('button', { name: /verificar/i }))
    await user.click(await screen.findByRole('button', { name: /continuar/i }))

    await user.click(screen.getByRole('button', { name: /uint8/ }))
    await user.click(screen.getByRole('button', { name: /verificar/i }))
    await user.click(await screen.findByRole('button', { name: /continuar/i }))

    await user.click(screen.getByRole('button', { name: /4 bytes/ }))
    await user.click(screen.getByRole('button', { name: /verificar/i }))
    await user.click(await screen.findByRole('button', { name: /ver resultado/i }))

    expect(
      await screen.findByText('Parabéns! Você dominou o conteúdo desta sessão.')
    ).toBeInTheDocument()
  })
})
