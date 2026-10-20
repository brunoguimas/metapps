// ─── TESTES DA ABERTURA DE TRILHA ──────────────────────────────────
//
// O bug que estes testes cobrem: o GET /protected/roadmap/:goalID
// responde 200 com a trilha VAZIA quando o objetivo ainda não tem
// roadmap (por exemplo, quando a geração falhou no momento em que o
// objetivo foi criado). O frontend tratava isso como erro e nunca
// pedia a geração — a trilha ficava inacessível.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const apiMock = {
  logout: vi.fn(),
  getAccessToken: vi.fn(),
  refreshSession: vi.fn(),
  listGoals: vi.fn(),
  createGoal: vi.fn(),
  generateRoadmap: vi.fn(),
  generateTask: vi.fn(),
  getProfile: vi.fn(),
  getMe: vi.fn(),
  getRoadmap: vi.fn(),
  listAttemptsByUser: vi.fn(),
  uploadAvatar: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  setSessionExpiredHandler: vi.fn(),
  getDaily: vi.fn(),
  createPractice: vi.fn(),
  createReview: vi.fn(),
  answerStep: vi.fn(),
  finishSession: vi.fn(),
  generateCorrection: vi.fn(),
}

// O factory do vi.mock é executado antes do módulo do teste: por isso
// cada função é um wrapper que só acessa apiMock na hora da chamada.
vi.mock('../api', () => ({
  logout: (...args) => apiMock.logout(...args),
  getAccessToken: (...args) => apiMock.getAccessToken(...args),
  refreshSession: (...args) => apiMock.refreshSession(...args),
  listGoals: (...args) => apiMock.listGoals(...args),
  createGoal: (...args) => apiMock.createGoal(...args),
  generateRoadmap: (...args) => apiMock.generateRoadmap(...args),
  generateTask: (...args) => apiMock.generateTask(...args),
  getProfile: (...args) => apiMock.getProfile(...args),
  getMe: (...args) => apiMock.getMe(...args),
  getRoadmap: (...args) => apiMock.getRoadmap(...args),
  listAttemptsByUser: (...args) => apiMock.listAttemptsByUser(...args),
  uploadAvatar: (...args) => apiMock.uploadAvatar(...args),
  updateGoal: (...args) => apiMock.updateGoal(...args),
  deleteGoal: (...args) => apiMock.deleteGoal(...args),
  setSessionExpiredHandler: (...args) => apiMock.setSessionExpiredHandler(...args),
  getDaily: (...args) => apiMock.getDaily(...args),
  createPractice: (...args) => apiMock.createPractice(...args),
  createReview: (...args) => apiMock.createReview(...args),
  answerStep: (...args) => apiMock.answerStep(...args),
  finishSession: (...args) => apiMock.finishSession(...args),
  generateCorrection: (...args) => apiMock.generateCorrection(...args),
}))

import Homepage from '../Homepage.jsx'

const goal = {
  id: 'goal-1',
  title: 'Redação do enem',
  settings: {},
  created_at: '2026-10-20T01:25:44Z',
}

const roadmap = {
  topics: [
    {
      id: 'topic-1',
      goal_id: 'goal-1',
      parent_topic_id: null,
      title: 'Matriz de Referência',
      description: 'Critérios de correção',
      required_mastery: 0.85,
      weight: 0.9,
      order_index: 0,
    },
  ],
  dependencies: [],
  progress: [],
}

const EMPTY_ROADMAP = { topics: [], dependencies: [], progress: [] }

// trilha com um módulo e uma lição dentro dele
const MODULE = {
  id: 'topic-module',
  goal_id: 'goal-1',
  parent_topic_id: null,
  title: 'Módulo de redação',
  description: 'Como planejar a redação',
  required_mastery: 0.8,
  weight: 1,
  order_index: 0,
}

const LESSON = {
  id: 'topic-lesson',
  goal_id: 'goal-1',
  parent_topic_id: 'topic-module',
  title: 'Lição 1',
  description: 'Introdução ao tema',
  required_mastery: 0.8,
  weight: 1,
  order_index: 0,
  blocked: false,
}

const TRACK_ROADMAP = {
  topics: [MODULE, LESSON],
  dependencies: [],
  progress: [],
}

function renderHomepage() {
  return render(
    <MemoryRouter>
      <Homepage />
    </MemoryRouter>
  )
}

// Abre a aba "Trilha" e clica no objetivo da lista.
async function openTrack(user) {
  const [nav] = await screen.findAllByRole('button', { name: 'Trilha' })
  await user.click(nav)
  await user.click(await screen.findByRole('button', { name: /Redação do enem/ }))
}

describe('abertura de trilha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getAccessToken.mockReturnValue('token')
    apiMock.refreshSession.mockResolvedValue({ access_token: 'token' })
    apiMock.getMe.mockResolvedValue({ email: 'ana@example.com' })
    apiMock.listGoals.mockResolvedValue([goal])
    apiMock.getProfile.mockResolvedValue(null)
    apiMock.listAttemptsByUser.mockResolvedValue([])
    apiMock.getDaily.mockResolvedValue(null)
  })

  it('gera a trilha quando o objetivo ainda não tem roadmap', async () => {
    // o backend responde 200 com a trilha vazia
    apiMock.getRoadmap.mockResolvedValue(EMPTY_ROADMAP)
    apiMock.generateRoadmap.mockResolvedValue(roadmap)

    const user = userEvent.setup()
    renderHomepage()

    await openTrack(user)

    await waitFor(() => {
      expect(apiMock.generateRoadmap).toHaveBeenCalledWith('goal-1')
    })
    // o título do módulo aparece no caminho e na lista de etapas
    expect(await screen.findAllByText('Matriz de Referência')).not.toHaveLength(0)
    expect(
      screen.queryByText('Não foi possível carregar a trilha (nenhum tópico retornado). Tente novamente.')
    ).not.toBeInTheDocument()
  })

  it('não gera de novo quando o objetivo já tem roadmap', async () => {
    apiMock.getRoadmap.mockResolvedValue(roadmap)

    const user = userEvent.setup()
    renderHomepage()

    await openTrack(user)

    expect(await screen.findAllByText('Matriz de Referência')).not.toHaveLength(0)
    expect(apiMock.generateRoadmap).not.toHaveBeenCalled()
  })

  it('mostra aviso enquanto a trilha está sendo montada', async () => {
    let resolveGenerate
    apiMock.getRoadmap.mockResolvedValue(EMPTY_ROADMAP)
    apiMock.generateRoadmap.mockReturnValue(
      new Promise((resolve) => { resolveGenerate = resolve })
    )

    const user = userEvent.setup()
    renderHomepage()

    await openTrack(user)

    expect(await screen.findByText(/Montando as etapas da sua trilha/)).toBeInTheDocument()

    resolveGenerate(roadmap)
    await waitFor(() => {
      expect(screen.getAllByText('Matriz de Referência')).not.toHaveLength(0)
    })
  })

  it('avisa quando a geração não devolve nenhum tópico', async () => {
    apiMock.getRoadmap.mockResolvedValue(EMPTY_ROADMAP)
    apiMock.generateRoadmap.mockResolvedValue(EMPTY_ROADMAP)

    const user = userEvent.setup()
    renderHomepage()

    await openTrack(user)

    expect(
      await screen.findByText('Não foi possível carregar a trilha (nenhum tópico retornado). Tente novamente.')
    ).toBeInTheDocument()
  })
})

describe('abertura de atividade (lição do módulo)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getAccessToken.mockReturnValue('token')
    apiMock.refreshSession.mockResolvedValue({ access_token: 'token' })
    apiMock.getMe.mockResolvedValue({ email: 'ana@example.com' })
    apiMock.listGoals.mockResolvedValue([goal])
    apiMock.getProfile.mockResolvedValue(null)
    apiMock.listAttemptsByUser.mockResolvedValue([])
    apiMock.getDaily.mockResolvedValue(null)
    apiMock.getRoadmap.mockResolvedValue(TRACK_ROADMAP)
  })

  // abre a trilha, entra no módulo e clica na lição
  async function openLesson(user) {
    await openTrack(user)

    const [modulo] = await screen.findAllByRole('button', { name: /Módulo de redação/ })
    await user.click(modulo)

    await user.click(await screen.findByRole('button', { name: /Lição 1/ }))
  }

  it('mostra que a atividade está sendo preparada', async () => {
    let resolveTask
    apiMock.generateTask.mockReturnValue(
      new Promise((resolve) => { resolveTask = resolve })
    )

    const user = userEvent.setup()
    renderHomepage()

    await openLesson(user)

    // o bloco de espera e a lição clicada avisam que está em andamento
    expect(await screen.findAllByText('Preparando a atividade…')).toHaveLength(2)

    resolveTask({ id: 'task-1' })
    await waitFor(() => {
      expect(apiMock.generateTask).toHaveBeenCalledWith('topic-lesson')
    })
  })

  it('não deixa clicar em outra lição enquanto a activity está sendo montada', async () => {
    let resolveTask
    apiMock.generateTask.mockReturnValue(
      new Promise((resolve) => { resolveTask = resolve })
    )

    const user = userEvent.setup()
    renderHomepage()

    await openLesson(user)

    await screen.findAllByText('Preparando a atividade…')

    const licao = screen.getByRole('button', { name: /Lição 1/ })
    expect(licao).toBeDisabled()

    resolveTask({ id: 'task-1' })
  })
})

// ─── PROGRESSO APÓS A SESSÃO ─────────────────────────────────────
//
// O progresso do tópico é gravado pelo backend no fim da sessão
// (POST /tasks/:id/finish). Sem recarregar a trilha, a tela continuava
// mostrando a lição como pendente e o progresso do módulo zerado —
// mesmo com o dado já gravado no banco.
describe('progresso depois da sessão', () => {
  const LESSON_TASK = {
    id: 'task-1',
    type: 'quiz',
    meta: { title: 'Inteiros e bits' },
    content: {
      version: 2,
      steps: [
        {
          statement: 'Qual o intervalo de um int32?',
          alternatives: ['0 a 2^32', '-2^31 a 2^31-1', '1 a 255'],
          answer: 1,
          explanation: 'int32 usa 32 bits com sinal.',
        },
      ],
    },
  }

  const DONE_ROADMAP = {
    topics: [MODULE, LESSON],
    dependencies: [],
    progress: [{ topic_id: 'topic-lesson', status: 'MASTERED', mastery_score: 1 }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getAccessToken.mockReturnValue('token')
    apiMock.refreshSession.mockResolvedValue({ access_token: 'token' })
    apiMock.getMe.mockResolvedValue({ email: 'ana@example.com' })
    apiMock.listGoals.mockResolvedValue([goal])
    apiMock.getProfile.mockResolvedValue(null)
    apiMock.listAttemptsByUser.mockResolvedValue([])
    apiMock.getDaily.mockResolvedValue(null)
    apiMock.generateTask.mockResolvedValue(LESSON_TASK)
    apiMock.answerStep.mockResolvedValue({
      step_index: 0,
      total_steps: 1,
      correct: true,
      correct_answer: 1,
      explanation: 'int32 usa 32 bits com sinal.',
      xp_awarded: 12,
      combo: 1,
    })
    apiMock.finishSession.mockResolvedValue({
      task_id: 'task-1',
      score: 1,
      correct_answers: 1,
      total_questions: 1,
      xp_gained: 17,
      max_combo: 1,
      mastered: true,
      required_mastery: 0.8,
      perfect: true,
      streak: 1,
      daily_xp: 17,
      daily_goal: 50,
      wrong_steps: [],
      attempt_id: 'attempt-1',
    })
    apiMock.generateCorrection.mockResolvedValue(null)
  })

  it('recarrega a trilha e mostra a lição como concluída', async () => {
    // a primeira leitura da trilha vem sem progresso; a segunda (depois
    // da sessão) já traz o tópico dominado
    apiMock.getRoadmap
      .mockResolvedValueOnce(TRACK_ROADMAP)
      .mockResolvedValue(DONE_ROADMAP)

    const user = userEvent.setup()
    renderHomepage()

    await openTrack(user)

    const [modulo] = await screen.findAllByRole('button', { name: /Módulo de redação/ })
    await user.click(modulo)
    await user.click(await screen.findByRole('button', { name: /Lição 1/ }))

    // responde o único exercício e encerra a sessão
    await user.click(await screen.findByRole('button', { name: /-2\^31 a 2\^31-1/ }))
    await user.click(screen.getByRole('button', { name: /verificar/i }))
    await user.click(await screen.findByRole('button', { name: /ver resultado/i }))

    // o resumo aparece; o "Continuar" fecha a sessão
    await user.click(await screen.findByRole('button', { name: /continuar/i }))

    // a trilha é recarregada do servidor
    await waitFor(() => {
      expect(apiMock.getRoadmap).toHaveBeenCalledTimes(2)
    })

    // e a lição aparece como concluída no módulo
    expect(await screen.findByText('1/1 · 100%')).toBeInTheDocument()
  })
})
