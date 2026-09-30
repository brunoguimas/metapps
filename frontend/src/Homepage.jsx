import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  logout as apiLogout,
  getAccessToken,
  refreshSession,
  listGoals,
  createGoal,
  generateRoadmap,
  generateTask,
  submitAttempt,
  getProfile,
  getMe,
  getRoadmap,
  generateCorrection,
  listAttemptsByUser,
  uploadAvatar,
  updateGoal,
  deleteGoal,
  setSessionExpiredHandler,
} from './api'
import perfilIcon from './assets/perfil.svg'
import conquistaIcon from './assets/conquista.svg'
import configIcon from './assets/config.svg'
import pixelIcon from './assets/pixel.png'
import { useTheme } from './theme'
import './Homepage.css'

// ─── HELPERS ─────────────────────────────────────────────────────

const sa = v => (Array.isArray(v) ? v : [])

const XP_STEP = 100
const xpInLevel = xp => (xp || 0) % XP_STEP
const xpPct = xp => Math.min(100, Math.round((xpInLevel(xp) / XP_STEP) * 100))

// geometria do caminho de aprendizado (usada pelo render e pelo auto-scroll)
const PATH_SLOT_H = 148
const PATH_HEAD = 200
const PATH_X = [34, 66] // serpentina: alterna entre 34% e 66% da largura
const pathY = (index, total) => PATH_HEAD + (total - 1 - index) * PATH_SLOT_H

// pais = tópicos sem parent_topic_id
function getParents(topics) {
  return sa(topics).filter(t => !t.parent_topic_id)
}

// nós disponíveis = folhas cujos pré-requisitos diretos (dependencies:
// { topic_id, depends_on }) já foram completados.
function getAvailable(topics, dependencies, completedIds) {
  const ts = sa(topics)
  const ds = sa(dependencies)
  const done = new Set(sa(completedIds))
  const parentIds = new Set(ts.map(t => t.parent_topic_id).filter(Boolean))
  const leaves = ts.filter(t => !parentIds.has(t.id))
  return leaves.map(t => {
    const prereqs = ds.filter(d => d.topic_id === t.id).map(d => d.depends_on)
    const blocked = prereqs.some(p => !done.has(p))
    return { ...t, blocked }
  })
}

// Etapas: cada tópico pai é um módulo do caminho; órfãos viram módulos de
// lição única. A última etapa é o destino (o troféu), a primeira é o início.
function buildPhases(topics, dependencies, completedIds) {
  const available = getAvailable(topics, dependencies, completedIds)
  const parents = getParents(topics)
  const phases = []

  parents.forEach(p => {
    const children = available.filter(t => t.parent_topic_id === p.id)
    if (children.length) phases.push({ key: p.id, parent: p, children })
  })
  available.filter(t => !t.parent_topic_id).forEach(o => {
    phases.push({ key: o.id, parent: { id: o.id, title: o.title, description: o.description }, children: [o] })
  })

  phases.forEach((ph, i) => {
    const allDone = ph.children.length && ph.children.every(n => completedIds.includes(n.id))
    const hasPrevIncomplete = phases.slice(0, i).some(q => !(q.children.length && q.children.every(n => completedIds.includes(n.id))))
    ph.done = allDone
    ph.current = !allDone && !hasPrevIncomplete
    ph.locked = !allDone && hasPrevIncomplete
  })

  return phases
}

// materiais de texto de uma questão/lição (array de { type, data })
function textMaterials(rawMaterial) {
  return sa(rawMaterial)
    .map(m => (typeof m === 'string' ? m : m?.data))
    .filter(Boolean)
}

// Tópicos dominados, lidos do progresso persistido pelo backend.
//
// O roadmap já devolve `progress` (topic_progress). Derivar a lista de
// concluídos daqui é o que faz a trilha voltar como estava depois de um
// logout: antes o estado vivia só no React, que é desmontado no logout.
function completedFromProgress(roadmap) {
  return sa(roadmap?.progress)
    .filter(p => p?.topic_id && p?.status === 'MASTERED')
    .map(p => p.topic_id)
}

// Trilhas mais recentes primeiro. O backend não garante ordenação, então
// ordena no cliente para "recentes" significar realmente recente.
function byRecency(goals) {
  return [...sa(goals)].sort((a, b) => {
    const at = Date.parse(a?.created_at || '') || 0
    const bt = Date.parse(b?.created_at || '') || 0
    return bt - at
  })
}

function relativeDate(iso) {
  const t = Date.parse(iso || '')
  if (!t) return ''
  const days = Math.floor((Date.now() - t) / 86400000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  if (days < 30) return `há ${Math.floor(days / 7)} semanas`
  return `há ${Math.floor(days / 30)} meses`
}

function pctOfScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return null
  return Math.max(0, Math.min(100, Math.round(score * 100)))
}

function formatDateTime(iso) {
  const t = Date.parse(iso || '')
  if (!t) return ''
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ─── HOMEPAGE ─────────────────────────────────────────────────────

export default function Homepage() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState(null)
  const [goals, setGoals] = useState([])
  const [view, setView] = useState('home') // home | roadmap | phase | task | result | profile | achievements | settings
  const [input, setInput] = useState('')
  const [curGoal, setCurGoal] = useState(null)
  const [topics, setTopics] = useState([])
  const [deps, setDeps] = useState([])
  const [completed, setCompleted] = useState([])
  const [selNode, setSelNode] = useState(null)
  const [task, setTask] = useState(null)
  const [taskNode, setTaskNode] = useState(null)
  const [answers, setAnswers] = useState({})
  const [essay, setEssay] = useState('')
  const [result, setResult] = useState(null)
  const [correction, setCorrection] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [initDone, setInitDone] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [editInput, setEditInput] = useState('')
  const [deletingGoal, setDeletingGoal] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [selPhase, setSelPhase] = useState(null) // etapa aberta na view 'phase'
  const pathRef = useRef(null) // área rolável do caminho (trilha)

  const username = profile?.username || email?.split('@')[0] || ''

  // ── inicialização ──
  useEffect(() => {
    setSessionExpiredHandler(() => navigate('/auth/login'))

    let cancelled = false

    async function init() {
      try {
        await refreshSession()
      } catch {
        // O refresh falhou, mas se ainda temos um access token válido em
        // memória (ex.: acabamos de logar com Google e o navegador não
        // aceitou o cookie de refresh do OAuth), seguimos — o getMe abaixo
        // usa esse token. Só mandamos pra tela de login se não houver token.
        if (!getAccessToken()) {
          navigate('/auth/login')
          return
        }
      }
      try {
        const user = await getMe()
        if (!cancelled) setEmail(user?.email || '')
      } catch {
        navigate('/auth/login')
        return
      }
      try {
        const p = await getProfile()
        if (!cancelled) setProfile(p)
      } catch { /* ignore */ }
      try {
        const g = await listGoals()
        if (!cancelled) setGoals(byRecency(g))
      } catch { /* ignore */ }
      try {
        const a = await listAttemptsByUser()
        if (!cancelled) setAttempts(sa(a).slice(0, 6))
      } catch { /* ignore */ }
      if (!cancelled) setInitDone(true)
    }

    init()

    return () => { cancelled = true }
  }, [navigate])

  // ── animação de chegada no caminho: começa no topo (troféu) e desce até a etapa atual ──
  useEffect(() => {
    if (view !== 'roadmap') return
    const el = pathRef.current
    if (!el) return

    const phases = buildPhases(topics, deps, completed)
    const curIdx = Math.max(0, phases.findIndex(f => f.current))
    const N = phases.length

    el.scrollTop = 0 // começa olhando o destino
    const t = setTimeout(() => {
      const y = pathY(curIdx, N)
      el.scrollTo({ top: Math.max(0, y - el.clientHeight * 0.55), behavior: 'smooth' })
    }, 550)
    return () => clearTimeout(t)
  }, [view, topics, completed, deps])

  // ── criar goal + gerar roadmap ──
  async function handleSend() {
    if (!input.trim() || loading) return
    setErr('')
    setLoading(true)
    try {
      const goal = await createGoal(input.trim(), {})
      const roadmap = await generateRoadmap(goal.id)
      const rawTopics = sa(roadmap?.topics)

      setGoals(prev => (prev.some(g => g.id === goal.id) ? prev : [goal, ...prev]))

      if (rawTopics.length === 0) {
        setErr('Não foi possível gerar a trilha (nenhum tópico retornado). Tente novamente.')
        return
      }

      setCurGoal(goal)
      setTopics(rawTopics)
      setDeps(sa(roadmap?.dependencies))
      setCompleted(completedFromProgress(roadmap))
      setSelNode(null)
      setSelPhase(null)
      setView('roadmap')
      setInput('')
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── abrir trilha de goal existente ──
  async function handleOpenGoal(goal) {
    if (loading) return
    setErr('')
    setLoading(true)
    try {
      let roadmap
      try {
        roadmap = await getRoadmap(goal.id)
      } catch {
        roadmap = await generateRoadmap(goal.id)
      }
      const rawTopics = sa(roadmap?.topics)
      if (rawTopics.length === 0) {
        setErr('Não foi possível carregar a trilha (nenhum tópico retornado). Tente novamente.')
        return
      }
      setCurGoal(goal)
      setTopics(rawTopics)
      setDeps(sa(roadmap?.dependencies))
      setCompleted(completedFromProgress(roadmap))
      setSelNode(null)
      setSelPhase(null)
      setView('roadmap')
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  // uma lição já liberada dentro de um módulo → gera a tarefa direto (um clique)
  async function handleStartLesson(n) {
    if (n.blocked || loading) return
    setErr('')
    setLoading(true)
    try {
      const t = await generateTask(n.id)
      setTask(t)
      setTaskNode(n)
      setAnswers({})
      setEssay('')
      setResult(null)
      setCorrection(null)
      setView('task')
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── submeter resposta ──
  async function handleSubmit() {
    if (!task || loading) return
    setErr('')
    setLoading(true)
    setCorrection(null)
    try {
      const isQuiz = task.type === 'quiz'
      const content = task.content || {}
      const questions = sa(content.questions)
      let response

      if (isQuiz) {
        response = Object.entries(answers).map(([qi, ans]) => ({ question_index: parseInt(qi, 10), answer: ans }))
        if (response.length < questions.length) {
          setErr('Responda todas as perguntas.')
          setLoading(false)
          return
        }
      } else {
        response = essay.trim()
        const words = response.split(/\s+/).filter(Boolean).length
        if (words < (content.min_words || 0)) {
          setErr(`Mínimo de ${content.min_words} palavras.`)
          setLoading(false)
          return
        }
      }

      const data = await submitAttempt(task.id, task.type, response)
      setResult(data)

      const attempt = data.task_attempt || data
      const score = typeof attempt.score === 'number' ? attempt.score : 0
      const requiredMastery = taskNode?.required_mastery ?? 0.7
      const topicId = task.topic_id || taskNode?.id
      const mastered = score >= requiredMastery

      if (topicId && mastered) {
        setCompleted(prev => (prev.includes(topicId) ? prev : [...prev, topicId]))
      }

      setView('result')

      const attemptId = attempt.id
      if (attemptId) {
        try {
          const corr = await generateCorrection(attemptId, task.type)
          setCorrection(corr)
        } catch { /* ignore */ }
      }

      // O XP é concedido pelo backend no Submit. Aqui só recarregamos o
      // perfil para refletir o valor novo: calcular e enviar de novo
      // somava o mesmo XP duas vezes em toda tentativa dominada.
      if (mastered) {
        try {
          const updatedProfile = await getProfile()
          if (updatedProfile) setProfile(updatedProfile)
        } catch { /* ignore */ }
      }
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── CRUD de goals ──
  function handleLogout() {
    apiLogout()
    navigate('/auth/login')
  }

  // ── navegação principal (ícones / barra inferior) ──
  // A aba "Trilha" sempre abre a view de trilha: sem trilha selecionada ela
  // mostra as trilhas recentes do usuário, então não precisa cair no Início.
  function openRoadmap() {
    setErr('')
    setView('roadmap')
  }

  function handleNav(key) {
    setErr('')
    if (key === 'roadmap') openRoadmap()
    else setView(key)
  }

  async function handleUpdateGoal() {
    if (!editingGoal || !editInput.trim() || loading) return
    setErr('')
    setLoading(true)
    try {
      await updateGoal(editingGoal.id, editInput.trim(), editingGoal.settings || {})
      setGoals(prev => prev.map(g => (g.id === editingGoal.id ? { ...g, title: editInput.trim() } : g)))
      setEditingGoal(null)
      setEditInput('')
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteGoal(goal) {
    if (loading) return
    setErr('')
    setLoading(true)
    try {
      await deleteGoal(goal.id)
      setGoals(prev => prev.filter(g => g.id !== goal.id))
      if (curGoal?.id === goal.id) {
        setCurGoal(null)
        setTopics([])
        setDeps([])
        setCompleted([])
        // A view da trilha já trata "sem trilha aberta" mostrando as
        // recentes, então não precisa saltar para o Início.
        setView('roadmap')
      }
      setDeletingGoal(null)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── avatar ──
  async function handleAvatarUpload(e) {
    const input = e.target
    const file = input.files?.[0]
    // O value precisa ser zerado: sem isso, escolher o MESMO arquivo de novo
    // nao dispara change e o upload parece travado.
    input.value = ''
    if (!file) return
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type)) {
      setErr('Tipo não permitido. Use PNG, JPG, GIF ou WebP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErr('O arquivo deve ter no máximo 10MB.')
      return
    }
    setErr('')
    setLoading(true)
    try {
      const data = await uploadAvatar(file)
      if (data?.avatar_url) {
        setProfile(prev => ({ ...prev, avatar_url: data.avatar_url }))
        setAvatarBroken(false)
      } else {
        setErr('O servidor não devolveu o endereço da imagem.')
      }
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  // URL antiga mantida no state enquanto o <img> novo carrega. Se a imagem
  // falhar (404, formato que o navegador nao decodifica), volta a inicial
  // em vez de deixar o icone de imagem quebrada na tela.
  function handleAvatarError() {
    setAvatarBroken(true)
  }

  // ── LOADING ──
  if (!initDone) {
    return (
      <div className="mp-center">
        <div className="mp-mark"><BrandGlyph /></div>
        <span>Preparando seu ambiente…</span>
      </div>
    )
  }

  // a aba "Trilha" continua ativa nas views que fazem parte do caminho
  const navActive = ['phase', 'task', 'result'].includes(view) ? 'roadmap' : view
  const goBack = {
    phase: () => setView('roadmap'),
    task: () => setView('roadmap'),
    result: () => setView('roadmap'),
    profile: () => setView('home'),
    achievements: () => setView('home'),
    settings: () => setView('home'),
  }[view]

  return (
    <AppShell
      active={navActive}
      onNavigate={handleNav}
      onBack={goBack}
      profile={profile}
      username={username}
      email={email}
      onLogout={handleLogout}
      theme={theme}
      onToggleTheme={toggleTheme}
      avatarBroken={avatarBroken}
      onAvatarError={handleAvatarError}
    >
      {view === 'home' && (
        <HomeView
          username={username}
          profile={profile}
          goals={goals}
          attempts={attempts}
          input={input}
          setInput={setInput}
          err={err}
          loading={loading}
          onSend={handleSend}
        />
      )}

      {view === 'roadmap' && (
        curGoal && topics.length > 0 ? (
          <PathView
            curGoal={curGoal}
            topics={topics}
            deps={deps}
            completed={completed}
            goals={goals}
            loading={loading}
            err={err}
            pathRef={pathRef}
            onOpenGoal={handleOpenGoal}
            onEditGoal={g => { setErr(''); setEditingGoal(g); setEditInput(g.title) }}
            onDeleteGoal={g => { setErr(''); setDeletingGoal(g) }}
            onOpenPhase={(ph) => { setErr(''); setSelPhase(ph); setView('phase') }}
          />
        ) : (
          <RecentTracksView
            goals={goals}
            loading={loading}
            err={err}
            onOpenGoal={handleOpenGoal}
            onEditGoal={g => { setErr(''); setEditingGoal(g); setEditInput(g.title) }}
            onDeleteGoal={g => { setErr(''); setDeletingGoal(g) }}
          />
        )
      )}

      {view === 'phase' && selPhase && (
        <PhaseView
          phase={selPhase}
          completed={completed}
          selNode={selNode}
          loading={loading}
          err={err}
          onBack={() => setView('roadmap')}
          onLesson={handleStartLesson}
        />
      )}

      {view === 'task' && task && (
        <TaskView
          task={task}
          answers={answers}
          setAnswers={setAnswers}
          essay={essay}
          setEssay={setEssay}
          loading={loading}
          err={err}
          onSubmit={handleSubmit}
        />
      )}

      {view === 'result' && result && (
        <ResultView
          result={result}
          task={task}
          taskNode={taskNode}
          correction={correction}
          onRetry={() => { setView('task'); setAnswers({}); setEssay(''); setResult(null); setErr('') }}
          onNext={() => setView('roadmap')}
        />
      )}

      {view === 'profile' && (
        <ProfileView
          profile={profile}
          username={username}
          email={email}
          loading={loading}
          err={err}
          onUpload={handleAvatarUpload}
          avatarBroken={avatarBroken}
          onAvatarError={handleAvatarError}
        />
      )}

      {view === 'achievements' && (
        <AchievementsView
          profile={profile}
          goalsCount={goals.length}
          attempts={attempts}
          completedCount={completed.length}
          topicCount={topics.length}
        />
      )}

      {view === 'settings' && (
        <SettingsView
          profile={profile}
          username={username}
          email={email}
          onProfile={() => setView('profile')}
          onAchievements={() => setView('achievements')}
          onHistory={() => navigate('/history')}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
          avatarBroken={avatarBroken}
          onAvatarError={handleAvatarError}
        />
      )}

      {editingGoal && (
        <Modal onClose={() => { setEditingGoal(null); setErr('') }}>
          <h3 className="mp-modal__t">Editar objetivo</h3>
          <textarea
            className="mp-input"
            style={{ minHeight: 84 }}
            value={editInput}
            onChange={e => setEditInput(e.target.value)}
            rows={2}
            autoFocus
          />
          {err && <Alert>{err}</Alert>}
          <div className="mp-modal__a">
            <button type="button" onClick={() => { setEditingGoal(null); setErr('') }} style={{ flex: 1 }} className="mp-btn mp-btn--ghost">Cancelar</button>
            <button
              type="button"
              onClick={handleUpdateGoal}
              disabled={!editInput.trim() || loading}
              className="mp-btn"
              style={{ flex: 1 }}
            >
              {loading ? <Spinner /> : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}

      {deletingGoal && (
        <Modal onClose={() => { setDeletingGoal(null); setErr('') }}>
          <h3 className="mp-modal__t">Excluir objetivo</h3>
          <p className="mp-muted">
            Tem certeza que deseja excluir <strong style={{ color: 'var(--ink)' }}>{deletingGoal.title}</strong>? Esta trilha e todo o seu progresso serão perdidos.
          </p>
          {err && <Alert>{err}</Alert>}
          <div className="mp-modal__a">
            <button type="button" onClick={() => { setDeletingGoal(null); setErr('') }} style={{ flex: 1 }} className="mp-btn mp-btn--ghost">Cancelar</button>
            <button
              type="button"
              onClick={() => handleDeleteGoal(deletingGoal)}
              disabled={loading}
              className="mp-btn mp-btn--red"
              style={{ flex: 1 }}
            >
              {loading ? <Spinner /> : 'Excluir'}
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  )
}

// ─── VIEWS ────────────────────────────────────────────────────────

function HomeView({ username, profile, goals, attempts, input, setInput, err, loading, onSend }) {
  const level = profile?.level || 1
  const xp = profile?.xp || 0

  return (
    <div className="mp-canvas">
      <div className="mp-home">
        {/* ── composer ── */}
        <section className="mp-hero">
          <div className="mp-hero__head">
            <div className="mp-hero__badge"><IconSpark size={24} /></div>
            <div style={{ minWidth: 0 }}>
              <h1 className="mp-display">O que você quer aprender hoje?</h1>
              <p className="mp-muted" style={{ marginTop: 4 }}>
                {username ? `Bom te ver, ${username}. ` : ''}Descreva um objetivo e a trilha é montada na hora.
              </p>
            </div>
          </div>

          <textarea
            className="mp-input"
            value={input}
            onChange={e => { setInput(e.target.value) }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend() } }}
            placeholder="Ex: Funções do segundo grau, Revolução Francesa..."
            rows={3}
          />

          {err && <Alert>{err}</Alert>}

          <div className="mp-cta">
            <button type="button" onClick={onSend} disabled={!input.trim() || loading} className="mp-btn">
              {loading ? <><Spinner /> Montando a trilha…</> : <>Gerar trilha <IconArrowRight /></>}
            </button>
          </div>

          {loading && (
            <div className="mp-building">
              <span className="mp-dots"><i /><i /><i /></span>
              Montando as etapas da sua trilha…
            </div>
          )}
        </section>

        {/* ── números ── */}
        <section className="mp-stats">
          <StatCard tone="blue" ico={<IconBolt />} v={level} l="Nível" />
          <StatCard tone="amber" ico={<IconStar />} v={xp} l="XP total" />
          <StatCard tone="green" ico={<IconTarget />} v={goals.length} l="Objetivos" />
          <StatCard tone="violet" ico={<Ring value={xpPct(xp)} />} v={`${xpPct(xp)}%`} l={`Faltam ${Math.max(0, XP_STEP - xpInLevel(xp))} XP`} />
        </section>

        {/* ── histórico ── */}
        <section>
          <div className="mp-h" style={{ marginBottom: 12 }}>
            <IconHistory /> Histórico
            <HistoryLink />
          </div>

          {attempts.length === 0 ? (
            <div className="mp-empty">
              <IconHistory size={26} />
              Nenhuma atividade ainda. Faça a primeira atividade de uma trilha para ela aparecer aqui.
            </div>
          ) : (
            <div className="mp-attempts">
              {attempts.map(a => <AttemptRow key={a.id} attempt={a} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function HistoryLink() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate('/history')}
      className="mp-h__more"
    >
      Ver tudo <IconChevron size={14} />
    </button>
  )
}

function AttemptRow({ attempt }) {
  const pct = pctOfScore(attempt?.score)
  const tone = pct === null ? 'blue' : pct >= 70 ? 'green' : pct >= 40 ? 'amber' : 'red'
  const title = attempt?.task?.title || attempt?.task_title || 'Atividade'

  return (
    <div className="mp-attempt">
      <span className={`mp-attempt__ico mp-attempt__ico--${tone}`}>
        {pct === null ? <IconBolt /> : <IconCheck />}
      </span>
      <span className="mp-attempt__b">
        <span className="mp-attempt__t">{title}</span>
        <span className="mp-attempt__s">{formatDateTime(attempt?.created_at)}</span>
      </span>
      {pct !== null && <span className={`mp-attempt__p mp-attempt__p--${tone}`}>{pct}%</span>}
    </div>
  )
}

// Trilhas recentes dentro da própria tela da trilha: permite trocar de
// objetivo sem voltar ao Início. A trilha aberta fica marcada.
function RecentTracksCard({ goals, currentId, onOpenGoal, onEditGoal, onDeleteGoal }) {
  const list = byRecency(goals)

  if (list.length <= 1) return null

  return (
    <div className="mp-card mp-card--pad">
      <div className="mp-h" style={{ marginBottom: 10 }}><IconHistory /> Trilhas recentes</div>
      <div className="mp-list">
        {list.map(g => {
          const active = g.id === currentId
          return (
            <div key={g.id} className={`mp-listrow mp-listrow--track ${active ? 'is-now' : ''}`}>
              <button
                type="button"
                className="mp-listrow__main"
                onClick={() => { if (!active) onOpenGoal(g) }}
                disabled={active}
              >
                <span className="mp-listrow__t">{g.title}</span>
                <span className="mp-listrow__s">{active ? 'Trilha atual' : relativeDate(g.created_at)}</span>
              </button>
              <span className="mp-listrow__tools">
                <button
                  type="button"
                  className="mp-goal__tool"
                  onClick={() => onEditGoal(g)}
                  aria-label={`Editar ${g.title}`}
                >
                  <IconEdit />
                </button>
                <button
                  type="button"
                  className="mp-goal__tool mp-goal__tool--del"
                  onClick={() => onDeleteGoal(g)}
                  aria-label={`Excluir ${g.title}`}
                >
                  <IconTrash />
                </button>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GoalCard({ goal, onOpen, onEdit, onDelete }) {
  const s = goal.settings && typeof goal.settings === 'object' && !Array.isArray(goal.settings) ? goal.settings : {}
  const raw = goal.progress_pct ?? s.progress_pct
  const pct = typeof raw === 'number' ? Math.max(0, Math.min(100, Math.round(raw))) : null

  return (
    <div className="mp-goal">
      <button type="button" onClick={onOpen} className="mp-goal__open" aria-label={goal.title}>
        <span className="mp-goal__t">{goal.title}</span>
        {goal.description && (
          <span className="mp-faint" style={{ display: 'block', marginTop: 4, lineHeight: 1.45 }}>{goal.description}</span>
        )}
      </button>

      <div className="mp-goal__foot">
        {pct !== null ? (
          <>
            <span className="mp-goal__bar"><span className="mp-goal__fill" style={{ width: `${pct}%` }} /></span>
            <span className="mp-goal__n">{pct}%</span>
          </>
        ) : (
          <span className="mp-goal__n" style={{ flex: 1 }}>
            {typeof s.required_mastery === 'number' ? `Aprovar com ${Math.round(s.required_mastery * 100)}%` : 'Pronta para começar'}
          </span>
        )}
      </div>

      <div className="mp-goal__tools">
        <button type="button" className="mp-goal__tool" onClick={onEdit} aria-label="Editar objetivo"><IconEdit /></button>
        <button type="button" className="mp-goal__tool mp-goal__tool--del" onClick={onDelete} aria-label="Excluir objetivo"><IconTrash /></button>
      </div>
    </div>
  )
}

function RecentTracksView({ goals, loading, err, onOpenGoal, onEditGoal, onDeleteGoal }) {
  const list = byRecency(goals)

  return (
    <div className="mp-canvas">
      <div className="mp-home">
        <section>
          <div className="mp-h" style={{ marginBottom: 4 }}>
            <IconTarget /> Trilhas recentes
          </div>
          <p className="mp-muted" style={{ marginBottom: 16 }}>
            Retome de onde parou ou comece uma trilha nova pelo Início.
          </p>

          {err && <Alert>{err}</Alert>}

          {list.length === 0 ? (
            <div className="mp-empty">
              <IconTarget size={26} />
              {loading ? 'Carregando suas trilhas…' : 'Nenhuma trilha ainda. Vá para o Início e descreva o que você quer aprender.'}
            </div>
          ) : (
            <div className="mp-goals">
              {list.map(g => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onOpen={() => onOpenGoal(g)}
                  onEdit={() => onEditGoal(g)}
                  onDelete={() => onDeleteGoal(g)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function PathView({ curGoal, topics, deps, completed, goals, loading, err, pathRef, onOpenGoal, onEditGoal, onDeleteGoal, onOpenPhase }) {
  const phases = buildPhases(topics, deps, completed)
  const totalLeaves = getAvailable(topics, deps, completed).length
  const doneLeaves = sa(topics).filter(t => completed.includes(t.id)).length
  const pct = Math.min(100, Math.round((doneLeaves / Math.max(1, totalLeaves)) * 100))

  // geometria do caminho — o destino fica em cima, o início embaixo
  const N = phases.length
  const height = 16 + N * PATH_SLOT_H + PATH_HEAD
  const pos = i => ({ x: PATH_X[i % PATH_X.length], y: pathY(i, N) })
  let pathD = ''
  phases.forEach((_, i) => {
    const p = pos(i)
    if (i === 0) pathD += `M ${p.x} ${p.y}`
    else {
      const prev = pos(i - 1)
      const midY = (prev.y + p.y) / 2
      pathD += ` C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`
    }
  })

  return (
    <div className="mp-canvas">
      <div className="mp-trilha">
        <div>
          <div className="mp-card mp-card--pad mp-progress" style={{ marginBottom: 18 }}>
            <div className="mp-progress__top">
              <span>Progresso da trilha</span>
              <b>{doneLeaves}/{totalLeaves} · {pct}%</b>
            </div>
            <div className="mp-track"><div className="mp-track__fill" style={{ width: `${pct}%` }} /></div>
            {err && <Alert>{err}</Alert>}
          </div>

          {loading && (
            <div className="mp-card mp-card--pad" style={{ textAlign: 'center', marginBottom: 18 }}>
              <Spinner size={26} />
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 10 }}>Preparando sua etapa…</div>
            </div>
          )}

          {!loading && N === 0 && (
            <div className="mp-empty">Nenhum tópico disponível nesta trilha.</div>
          )}

          {!loading && N > 0 && (
            <div ref={pathRef} className="mp-path-scroll">
              <div className="mp-path" style={{ height }}>
                <svg className="mp-path__svg" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
                  <path d={pathD} fill="none" stroke="var(--line)" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  <path
                    d={pathD}
                    fill="none"
                    stroke="var(--blue)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="2 22"
                    vectorEffect="non-scaling-stroke"
                    opacity="0.55"
                  />
                </svg>

                {/* destino */}
                <div className="mp-goalend" style={{ top: PATH_HEAD - 176, left: `${pos(N - 1).x}%` }}>
                  <div className="mp-goalend__disc"><img src={conquistaIcon} alt="" draggable={false} /></div>
                  <div className="mp-goalend__t">{curGoal?.title || 'Sua trilha'}</div>
                  <div className="mp-goalend__s">{pct}% concluída</div>
                </div>

                {phases.map((ph, i) => {
                  const p = pos(i)
                  const done = sa(ph.children).filter(n => completed.includes(n.id)).length
                  return (
                    <button
                      key={ph.key}
                      type="button"
                      className={`mp-node ${ph.done ? 'mp-node--done' : ph.current ? 'mp-node--now' : 'mp-node--lock'}`}
                      style={{ left: `${p.x}%`, top: p.y }}
                      onClick={() => { if (!ph.locked) onOpenPhase(ph) }}
                      disabled={ph.locked}
                    >
                      <span className="mp-node__disc">
                        {ph.done ? <IconCheck /> : ph.locked ? <IconLock /> : <IconBolt />}
                      </span>
                      <span className="mp-node__t">{ph.parent.title}</span>
                      <span className="mp-node__m">
                        {ph.done ? <><IconCheck size={11} /> {done}/{ph.children.length}</> : ph.locked ? 'bloqueado' : <>{done}/{ph.children.length} · aqui</>}
                      </span>
                    </button>
                  )
                })}

                <div className="mp-baselabel" style={{ top: height - 22 }}>INÍCIO</div>
              </div>
            </div>
          )}
        </div>

        <aside className="mp-trilha__side">
          <div className="mp-card mp-card--pad">
            <div className="mp-h" style={{ marginBottom: 8 }}><IconTarget /> Objetivo</div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.4px', lineHeight: 1.3 }}>{curGoal?.title || '—'}</div>
            {curGoal?.description && <p className="mp-muted" style={{ marginTop: 8 }}>{curGoal.description}</p>}
          </div>

          <div className="mp-card mp-card--pad">
            <div className="mp-h" style={{ marginBottom: 10 }}><IconFlag /> Etapas</div>
            <div className="mp-list">
              {phases.map((ph, i) => (
                <button
                  key={ph.key}
                  type="button"
                  disabled={ph.locked}
                  onClick={() => { if (!ph.locked) onOpenPhase(ph) }}
                  className={`mp-listrow ${ph.done ? 'is-done' : ph.current ? 'is-now' : ''}`}
                  style={ph.locked ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                >
                  <span className="mp-listrow__n">{ph.locked ? <IconLock size={13} /> : ph.done ? <IconCheck size={13} /> : i + 1}</span>
                  <span className="mp-listrow__t">{ph.parent.title}</span>
                  <span className="mp-listrow__x">{sa(ph.children).filter(n => completed.includes(n.id)).length}/{ph.children.length}</span>
                </button>
              ))}
            </div>
          </div>

          <RecentTracksCard
            goals={goals}
            currentId={curGoal?.id}
            onOpenGoal={onOpenGoal}
            onEditGoal={onEditGoal}
            onDeleteGoal={onDeleteGoal}
          />
        </aside>
      </div>
    </div>
  )
}

function PhaseView({ phase, completed, selNode, loading, err, onBack, onLesson }) {
  const ph = phase
  const done = sa(ph.children).filter(n => completed.includes(n.id)).length
  const pct = ph.children.length ? Math.round((done / ph.children.length) * 100) : 0

  return (
    <div className="mp-canvas">
      <div className="mp-home">
        <section className="mp-card mp-card--pad">
          <div className="mp-h" style={{ marginBottom: 10 }}><IconFlag /> Etapa</div>
          <h1 className="mp-display">{ph.parent.title}</h1>
          <p className="mp-muted" style={{ marginTop: 8 }}>
            {ph.parent.description || `${ph.children.length} lição(ões) para concluir este módulo`}
          </p>
          <div className="mp-progress__top" style={{ marginTop: 20, marginBottom: 8 }}>
            <span>Lições concluídas</span>
            <b>{done}/{ph.children.length} · {pct}%</b>
          </div>
          <div className="mp-track"><div className="mp-track__fill" style={{ width: `${pct}%` }} /></div>
          {err && <Alert>{err}</Alert>}
        </section>

        <section>
          <div className="mp-h" style={{ marginBottom: 12 }}><IconBolt /> Lições do módulo</div>
          <div className="mp-lessons">
            {ph.children.map(n => (
              <LessonRow key={n.id} n={n} done={completed.includes(n.id)} current={selNode?.id === n.id} onClick={() => onLesson(n)} />
            ))}
          </div>
        </section>

        <div>
          <button type="button" onClick={onBack} className="mp-btn mp-btn--quiet" disabled={loading}>
            <IconArrowLeft /> Voltar para a trilha
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskView({ task, answers, setAnswers, essay, setEssay, loading, err, onSubmit }) {
  const isQuiz = task.type === 'quiz'
  const content = task.content || {}
  const questions = sa(content.questions)
  const title = content.title || task.meta?.title || 'Tarefa'
  const answered = isQuiz ? Object.keys(answers).length : 0
  const words = essay.trim() ? essay.trim().split(/\s+/).filter(Boolean).length : 0
  const pct = isQuiz
    ? (questions.length ? (answered / questions.length) * 100 : 0)
    : Math.min(100, (words / Math.max(1, content.min_words || 1)) * 100)

  return (
    <div className="mp-canvas">
      <div className="mp-task">
        <div>
          <div className="mp-h" style={{ marginBottom: 12 }}><IconBolt /> {title}</div>

          {content.description && (
            <div className="mp-card mp-card--pad" style={{ marginBottom: 16 }}>
              <p className="mp-muted" style={{ margin: 0 }}>{content.description}</p>
            </div>
          )}

          {isQuiz && questions.map((q, qi) => (
            <div key={qi} className="mp-qcard">
              <div className="mp-qcard__n">
                <span className="mp-qnum">{qi + 1}</span>
                {textMaterials(q.material).length > 0 && (
                  <span className="mp-tag" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>Material</span>
                )}
              </div>
              {textMaterials(q.material).map((t, mi) => <p key={mi} className="mp-material">{t}</p>)}
              <p className="mp-qtext">{q.statement || q.question}</p>
              <div className="mp-opts">
                {sa(q.options || q.alternatives).map((opt, ai) => (
                  <button
                    type="button"
                    key={ai}
                    onClick={() => setAnswers(p => ({ ...p, [qi]: ai }))}
                    className={`mp-opt ${answers[qi] === ai ? 'is-on' : ''}`}
                  >
                    <span className="mp-opt__k">{String.fromCharCode(65 + ai)}</span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {!isQuiz && (
            <div className="mp-qcard">
              {textMaterials(content.material).map((t, mi) => <p key={mi} className="mp-material">{t}</p>)}
              <p className="mp-qtext">{content.instructions}</p>
              <p className="mp-faint" style={{ marginBottom: 10 }}>
                {content.min_words}–{content.max_words} palavras
              </p>
              <textarea
                className="mp-input"
                style={{ minHeight: 260 }}
                value={essay}
                onChange={e => { setEssay(e.target.value) }}
                placeholder="Escreva sua resposta aqui…"
                rows={12}
              />
              <p className="mp-faint" style={{ textAlign: 'right', marginTop: 8 }}>
                {essay.trim() ? essay.trim().split(/\s+/).filter(Boolean).length : 0} palavras
              </p>
            </div>
          )}

          {err && <Alert>{err}</Alert>}
        </div>

        <aside className="mp-task__side mp-aside">
          <div className="mp-card mp-card--pad">
            <div className="mp-h" style={{ marginBottom: 10 }}>Seu progresso</div>
            <div className="mp-progress__top">
              <span>{isQuiz ? 'Respondidas' : 'Palavras'}</span>
              <b>{isQuiz ? `${answered}/${questions.length}` : `${words}/${content.min_words || 0}`}</b>
            </div>
            <div className="mp-track">
              <div className="mp-track__fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <button type="button" onClick={onSubmit} disabled={loading} className="mp-btn">
            {loading ? <><Spinner /> Enviando…</> : <>Enviar resposta <IconArrowRight /></>}
          </button>
        </aside>
      </div>
    </div>
  )
}

function ResultView({ result, task, taskNode, correction, onRetry, onNext }) {
  const attempt = result.task_attempt || result
  const score = typeof attempt.score === 'number' ? attempt.score : 0
  const pct = Math.round(score * 100)
  const tone = score >= 0.7 ? 'var(--green)' : score >= 0.4 ? 'var(--amber)' : 'var(--red)'
  let ev = null
  try { ev = typeof attempt.task_evaluation === 'string' ? JSON.parse(attempt.task_evaluation) : attempt.task_evaluation } catch { /* ignore */ }
  const content = task?.content || {}
  const questions = sa(content.questions)
  const requiredMastery = taskNode?.required_mastery ?? 0.7
  const mastered = score >= requiredMastery
  const items = sa(ev?.items)

  return (
    <div className="mp-canvas">
      <div className="mp-result">
        <div>
          <div className="mp-card mp-score">
            <Ring big value={pct} tone={tone} />
            <div className="mp-score__t">
              {mastered ? 'Etapa concluída!' : score >= 0.4 ? 'Bom esforço!' : 'Continue tentando!'}
            </div>
            <p className="mp-faint" style={{ textAlign: 'center' }}>
              {mastered ? 'Você dominou este tópico.' : `É preciso ${Math.round(requiredMastery * 100)}% para liberar a próxima etapa.`}
            </p>
          </div>

          <div className="mp-aside" style={{ marginTop: 16 }}>
            <button type="button" onClick={onRetry} className="mp-btn mp-btn--ghost">Tentar novamente</button>
            <button type="button" onClick={onNext} className="mp-btn">Próxima etapa <IconArrowRight /></button>
          </div>
        </div>

        <div className="mp-aside">
          {correction && (
            <div className="mp-ai">
              <div className="mp-ai__h"><IconSpark /> Feedback da IA</div>
              {typeof correction === 'string' ? (
                <p className="mp-ai__b" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{correction}</p>
              ) : (
                <>
                  {correction.summary && <p className="mp-ai__b" style={{ margin: 0 }}>{correction.summary}</p>}
                  {sa(correction.feedback || correction.comments || correction.items).map((f, i) => (
                    <div key={i} className="mp-ai__item">
                      {typeof f === 'string' ? f : (
                        <>
                          {f.comment && <div>{f.comment}</div>}
                          {f.correct === false && <div style={{ color: 'var(--red-d)', fontWeight: 800, marginTop: 4 }}>Correta: {f.correct_answer ?? f.expected}</div>}
                          {f.explanation && <div style={{ fontStyle: 'italic', opacity: 0.8, marginTop: 4 }}>{f.explanation}</div>}
                        </>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {items.length > 0 && (
            <div className="mp-fb">
              <div className="mp-ai__h" style={{ marginBottom: 14 }}><IconCheck /> Revisão das questões</div>
              {items.map((item, i) => {
                const q = questions[i] || {}
                const opts = sa(q.options || q.alternatives)
                const ok = item.correct || item.is_correct || false
                const sub = item.submitted_answer ?? item.selected_answer ?? item.answer
                const cor = item.correct_answer ?? item.expected_answer
                return (
                  <div key={i} className={`mp-fb__row ${ok ? 'mp-fb__row--ok' : 'mp-fb__row--bad'}`}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mp-fb__q">Questão {i + 1}</div>
                      {opts[sub] !== undefined && <div className="mp-fb__a">Sua resposta: {opts[sub]}</div>}
                      {!ok && opts[cor] && <div className="mp-fb__a">Correta: {opts[cor]}</div>}
                      {item.explanation && <div className="mp-fb__e">{item.explanation}</div>}
                    </div>
                    {ok ? <IconCheck color="var(--green-d)" /> : <IconX color="var(--red-d)" />}
                  </div>
                )
              })}
            </div>
          )}

          {!correction && items.length === 0 && (
            <div className="mp-empty">Sem feedback disponível para esta tentativa.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProfileView({ profile, username, email, loading, err, onUpload, avatarBroken, onAvatarError }) {
  const level = profile?.level || 1
  const xp = profile?.xp || 0
  const pct = xpPct(xp)
  const initial = (username[0]?.toUpperCase() || '?')
  const showImg = !!profile?.avatar_url && !avatarBroken

  return (
    <div className="mp-canvas">
      <div className="mp-profile">
        <section className="mp-card mp-card--pad" style={{ textAlign: 'center' }}>
          <label className="mp-avatar">
            {showImg ? (
              <img src={profile.avatar_url} alt="" onError={onAvatarError} />
            ) : (
              <div className="mp-avatar__fall">{initial}</div>
            )}
            <span className="mp-avatar__lvl">{level}</span>
            <span className="mp-avatar__edit"><IconEdit /></span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={onUpload}
              style={{ display: 'none' }}
            />
          </label>

          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.4px', marginTop: 16 }}>{username}</div>
          <div className="mp-faint" style={{ marginTop: 2 }}>{email}</div>

          {err && <Alert style={{ textAlign: 'left' }}>{err}</Alert>}

          <div className="mp-xpbar">
            <div className="mp-xpbar__top">
              <span>Nível {level}</span>
              <span style={{ color: 'var(--ink-3)' }}>{xpInLevel(xp)} / {XP_STEP} XP</span>
            </div>
            <div className="mp-track"><div className="mp-track__fill" style={{ width: `${pct}%` }} /></div>
            <div className="mp-faint" style={{ textAlign: 'right', marginTop: 8 }}>
              {Math.max(0, XP_STEP - xpInLevel(xp))} XP para o nível {level + 1}
            </div>
          </div>

          {loading && <div className="mp-faint" style={{ marginTop: 14 }}><Spinner /> Enviando…</div>}
        </section>

        <div className="mp-aside">
          <div className="mp-stats">
            <StatCard tone="blue" ico={<IconBolt />} v={level} l="Nível" />
            <StatCard tone="amber" ico={<IconStar />} v={xp} l="XP total" />
            <StatCard tone="green" ico={<IconSpark />} v={Math.max(0, XP_STEP - xpInLevel(xp))} l="XP restante" />
          </div>

          <div className="mp-card mp-card--pad">
            <div className="mp-h" style={{ marginBottom: 12 }}><IconBolt /> Como funciona</div>
            <p className="mp-muted" style={{ margin: 0 }}>
              Cada lição concluída com o mínimo de acerto rende XP. A cada {XP_STEP} XP você sobe um nível
              e desbloqueia novas conquistas.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AchievementsView({ profile, goalsCount, attempts, completedCount, topicCount }) {
  const level = profile?.level || 1
  const xp = profile?.xp || 0
  const pct = xpPct(xp)

  // Métricas derivadas de dados reais, nunca de valores fixos.
  const answered = attempts || []
  const scored = answered.map(a => pctOfScore(a?.score)).filter(v => v !== null)
  const lessons = completedCount || 0
  const topics = topicCount || 0
  const perfect = scored.filter(v => v === 100).length
  const good = scored.filter(v => v >= 70).length
  const accuracy = scored.length ? Math.round(scored.reduce((s, v) => s + v, 0) / scored.length) : 0

  const badges = [
    // ── primeiro passo ──
    { t: 'Primeiro Passo', d: 'Crie seu primeiro objetivo', done: goalsCount >= 1, tone: 'blue', n: `${Math.min(goalsCount, 1)}/1`, tier: 'inicio' },
    { t: 'Trilha Aberta', d: 'Gere um roadmap com tópicos', done: topics >= 1, tone: 'cyan', n: `${Math.min(topics, 1)}/1`, tier: 'inicio' },
    { t: 'Mapa Completo', d: 'Tenha um roadmap com 20 tópicos', done: topics >= 20, tone: 'sky', n: `${Math.min(topics, 20)}/20`, tier: 'constancia' },
    { t: 'Primeira Lição', d: 'Conclua 1 tópico do caminho', done: lessons >= 1, tone: 'green', n: `${Math.min(lessons, 1)}/1`, tier: 'inicio' },

    // ── constancia ──
    { t: 'Explorador', d: 'Crie 3 objetivos diferentes', done: goalsCount >= 3, tone: 'green', n: `${Math.min(goalsCount, 3)}/3`, tier: 'constancia' },
    { t: 'Estudante Dedicado', d: 'Conclua 10 tópicos', done: lessons >= 10, tone: 'blue', n: `${Math.min(lessons, 10)}/10`, tier: 'constancia' },
    { t: 'Maratonista', d: 'Conclua 25 tópicos', done: lessons >= 25, tone: 'teal', n: `${Math.min(lessons, 25)}/25`, tier: 'constancia' },
    { t: 'Devorador de Tópicos', d: 'Conclua 50 tópicos', done: lessons >= 50, tone: 'violet', n: `${Math.min(lessons, 50)}/50`, tier: 'constancia' },

    // ── precisao (exige nota alta, nao so volume) ──
    { t: 'Acerta Alto', d: 'Tire 70% ou mais numa atividade', done: good >= 1, tone: 'amber', n: `${Math.min(good, 1)}/1`, tier: 'precisao' },
    { t: 'Três Quase Perfeitos', d: 'Tire 100% em 3 atividades', done: perfect >= 3, tone: 'amber', n: `${Math.min(perfect, 3)}/3`, tier: 'precisao' },
    { t: 'Sniper', d: 'Tire 100% em 10 atividades', done: perfect >= 10, tone: 'pink', n: `${Math.min(perfect, 10)}/10`, tier: 'precisao' },
    { t: 'Cem por Cento', d: 'Média de 90% entre 10 atividades', done: scored.length >= 10 && accuracy >= 90, tone: 'pink', n: scored.length >= 10 ? `${accuracy}%` : `${scored.length}/10`, tier: 'precisao' },
    { t: 'Mente Afiada', d: 'Média de 80% entre 25 atividades', done: scored.length >= 25 && accuracy >= 80, tone: 'violet', n: scored.length >= 25 ? `${accuracy}%` : `${scored.length}/25`, tier: 'precisao' },

    // ── nivel e xp ──
    { t: 'Especialista', d: 'Alcance o nível 2', done: level >= 2, tone: 'amber', n: `Nível ${Math.min(level, 2)}/2`, tier: 'xp' },
    { t: 'Mestre', d: 'Alcance o nível 5', done: level >= 5, tone: 'violet', n: `Nível ${Math.min(level, 5)}/5`, tier: 'xp' },
    { t: 'Centenário', d: 'Acumule 100 XP', done: xp >= 100, tone: 'cyan', n: `${Math.min(xp, 100)}/100`, tier: 'xp' },
    { t: 'Lenda', d: 'Acumule 500 XP', done: xp >= 500, tone: 'green', n: `${Math.min(xp, 500)}/500`, tier: 'xp' },
    { t: 'Titã', d: 'Acumule 1.000 XP', done: xp >= 1000, tone: 'pink', n: `${Math.min(xp, 1000)}/1.000`, tier: 'xp' },
    { t: 'Lendário', d: 'Acumule 2.500 XP', done: xp >= 2500, tone: 'violet', n: `${Math.min(xp, 2500)}/2.500`, tier: 'xp' },

    // ── elite: exigem combinacao de varios numeros ao mesmo tempo ──
    { t: 'O Consagrado', d: 'Nível 10, 25 tópicos e 1.000 XP', done: level >= 10 && lessons >= 25 && xp >= 1000, tone: 'pink', n: `N${Math.min(level, 10)} · ${Math.min(lessons, 25)}/25 · ${Math.min(xp, 1000)}/1.000`, tier: 'elite' },
    { t: 'Arquiteto', d: '5 objetivos, 50 tópicos e nível 15', done: goalsCount >= 5 && lessons >= 50 && level >= 15, tone: 'violet', n: `${Math.min(goalsCount, 5)}/5 · ${Math.min(lessons, 50)}/50 · N${Math.min(level, 15)}/15`, tier: 'elite' },
    { t: 'Mestre da Precisão', d: '25 atividades, média 95% e nível 20', done: scored.length >= 25 && accuracy >= 95 && level >= 20, tone: 'amber', n: `${scored.length}/25 · ${accuracy}% · N${Math.min(level, 20)}/20`, tier: 'elite' },
  ]

  const unlocked = badges.filter(b => b.done).length
  const tiers = [...new Set(badges.map(b => b.tier))]
  const TIER_LABEL = {
    inicio: 'Primeiros passos',
    constancia: 'Consistência',
    precisao: 'Precisão',
    xp: 'Nível e XP',
    elite: 'Elite',
  }

  return (
    <div className="mp-canvas">
      <div className="mp-ach">
        <div className="mp-aside">
          <div className="mp-heroach">
            <Ring big value={pct} tone="var(--amber)" />
            <div style={{ minWidth: 0 }}>
              <div className="mp-heroach__t">Conquistas</div>
              <div className="mp-heroach__s">{unlocked}/{badges.length} desbloqueadas. Continue estudando para ganhar novas medalhas!</div>
              <span className="mp-chip">
                <img src={conquistaIcon} alt="" draggable={false} />
                {goalsCount} {goalsCount === 1 ? 'objetivo' : 'objetivos'}
              </span>
            </div>
          </div>

          <div className="mp-stats">
            <StatCard tone="blue" ico={<IconBolt />} v={level} l="Nível" />
            <StatCard tone="amber" ico={<IconStar />} v={xp} l="XP total" />
            <StatCard tone="green" ico={<IconTarget />} v={goalsCount} l="Objetivos" />
            <StatCard tone="violet" ico={<IconCheck />} v={lessons} l="Tópicos feitos" />
          </div>
        </div>

        <section>
          <div className="mp-h" style={{ marginBottom: 12 }}><IconStar /> Medalhas</div>
          {tiers.map(tier => {
            const list = badges.filter(b => b.tier === tier)
            const got = list.filter(b => b.done).length
            return (
              <div key={tier} className="mp-achtier">
                <div className="mp-achtier__h">
                  <span>{TIER_LABEL[tier]}</span>
                  <span className="mp-achtier__n">{got}/{list.length}</span>
                </div>
                <div className="mp-badges">
                  {list.map(b => (
                    <div key={b.t} className={`mp-badge ${b.done ? 'is-on' : ''}`}>
                      <div className="mp-badge__ico" style={{ background: `var(--${b.tone}-soft)` }}>
                        <img src={conquistaIcon} alt="" draggable={false} />
                      </div>
                      <div className="mp-badge__t">{b.t}</div>
                      <div className="mp-badge__d">{b.d}</div>
                      <div className="mp-badge__f">
                        <span className="mp-tag">{b.done ? 'Desbloqueada' : 'Bloqueada'}</span>
                        <span className="mp-badge__n">{b.n}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      </div>
    </div>
  )
}

function SettingsView({ profile, username, email, onProfile, onAchievements, onHistory, onLogout, theme, onToggleTheme, avatarBroken, onAvatarError }) {
  const initial = (username[0]?.toUpperCase() || '?')
  const showImg = !!profile?.avatar_url && !avatarBroken
  return (
    <div className="mp-canvas">
      <div className="mp-settings">
        <section className="mp-settinggroup">
          <div className="mp-h">Conta</div>
          <button type="button" onClick={onProfile} className="mp-row">
            {showImg ? (
              <span className="mp-row__ico" style={{ background: 'var(--surface-2)', overflow: 'hidden' }}>
                <img src={profile.avatar_url} alt="" onError={onAvatarError} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 7 }} />
              </span>
            ) : (
              <span className="mp-row__ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue)', fontWeight: 800, fontSize: 16 }}>
                {initial}
              </span>
            )}
            <span className="mp-row__b">
              <span className="mp-row__t">{username}</span>
              <span className="mp-row__s">{email}</span>
            </span>
            <span className="mp-row__cta">Editar</span>
          </button>
        </section>

        <section className="mp-settinggroup">
          <div className="mp-h">Estudo</div>
          <button type="button" onClick={onAchievements} className="mp-row">
            <span className="mp-row__ico" style={{ background: 'var(--amber-soft)' }}>
              <img src={conquistaIcon} alt="" draggable={false} />
            </span>
            <span className="mp-row__b"><span className="mp-row__t">Minhas conquistas</span></span>
            <IconChevron />
          </button>
          <button type="button" onClick={onHistory} className="mp-row">
            <span className="mp-row__ico" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><IconHistory /></span>
            <span className="mp-row__b"><span className="mp-row__t">Histórico de estudo</span></span>
            <IconChevron />
          </button>
        </section>

        <section className="mp-settinggroup">
          <div className="mp-h">Aparência</div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="mp-row"
            role="switch"
            aria-checked={theme === 'dark'}
          >
            <span className="mp-row__ico" style={{ background: 'var(--violet-soft)', color: 'var(--violet-d)' }}>
              {theme === 'dark' ? <IconMoon /> : <IconSun />}
            </span>
            <span className="mp-row__b">
              <span className="mp-row__t">Tema escuro</span>
              <span className="mp-row__s">{theme === 'dark' ? 'Ligado' : 'Desligado'}</span>
            </span>
            <span className={`mp-switch ${theme === 'dark' ? 'is-on' : ''}`} aria-hidden>
              <span className="mp-switch__dot" />
            </span>
          </button>
        </section>

        <section className="mp-settinggroup">
          <div className="mp-h">Perfil</div>
          <button type="button" onClick={onProfile} className="mp-row">
            <span className="mp-row__ico" style={{ background: 'var(--blue-soft)' }}>
              <img src={perfilIcon} alt="" draggable={false} />
            </span>
            <span className="mp-row__b"><span className="mp-row__t">Meu perfil</span></span>
            <IconChevron />
          </button>
          <button type="button" onClick={() => window.open('/termos.html', '_blank')} className="mp-row">
            <span className="mp-row__ico" style={{ background: 'var(--green-soft)', color: 'var(--green-d)' }}><IconFlag /></span>
            <span className="mp-row__b">
              <span className="mp-row__t">Termos de uso</span>
              <span className="mp-row__s">Versão 1.0.0</span>
            </span>
            <IconChevron />
          </button>
        </section>

        <section className="mp-settinggroup">
          <div className="mp-h">Sessão</div>
          <button type="button" onClick={onLogout} className="mp-row mp-row--danger">
            <span className="mp-row__ico"><IconLogout /></span>
            <span className="mp-row__b"><span className="mp-row__t">Sair da conta</span></span>
            <IconChevron />
          </button>
        </section>
      </div>
    </div>
  )
}

// ─── PEÇAS ────────────────────────────────────────────────────────

function ThemeToggle({ theme, onToggle }) {
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mp-iconbtn"
      aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
    >
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  )
}

function LessonRow({ n, done, current, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={n.blocked}
      className={`mp-lesson ${done ? 'is-done' : n.blocked ? 'is-lock' : current ? 'is-now' : ''}`}
    >
      <span className="mp-lesson__ico">
        {done ? <IconCheck /> : n.blocked ? <IconLock /> : current ? <IconSpark /> : <IconBolt />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="mp-lesson__t" style={{ display: 'block' }}>{n.title}</span>
        {n.description && <span className="mp-lesson__s" style={{ display: 'block' }}>{n.description}</span>}
      </span>
      <IconChevron />
    </button>
  )
}

function StatCard({ tone, ico, v, l }) {
  return (
    <div className="mp-stat">
      <span className="mp-stat__ico" style={{ background: `var(--${tone}-soft)`, color: `var(--${tone})` }}>{ico}</span>
      <span style={{ minWidth: 0 }}>
        <span className="mp-stat__v" style={{ display: 'block' }}>{v}</span>
        <span className="mp-stat__l" style={{ display: 'block' }}>{l}</span>
      </span>
    </div>
  )
}

// anel de progresso (SVG)
function Ring({ value, big, tone = 'var(--blue)' }) {
  const box = big ? 128 : 40
  const r = big ? 52 : 15
  const sw = big ? 12 : 7
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value || 0))
  return (
    <svg className={big ? 'mp-score__ring' : 'mp-xp__ring'} viewBox={`0 0 ${box} ${box}`} aria-hidden>
      <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={sw} />
      <circle
        cx={box / 2} cy={box / 2} r={r} fill="none" stroke={tone} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} transform={`rotate(-90 ${box / 2} ${box / 2})`}
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
      {big && (
        <>
          <text x={box / 2} y={box / 2 - 2} textAnchor="middle" fontSize="30" fontWeight="800" fill="var(--ink)">{pct}%</text>
          <text x={box / 2} y={box / 2 + 20} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--ink-3)">NO NÍVEL</text>
        </>
      )}
    </svg>
  )
}

function Modal({ children, onClose }) {
  return (
    <div className="mp-overlay" onClick={onClose} role="presentation">
      <div className="mp-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">{children}</div>
    </div>
  )
}

function Alert({ children, style }) {
  return <div className="mp-alert" style={style}><IconAlert /> {children}</div>
}

function Spinner({ size = 15 }) {
  return (
    <svg className="mp-spinner" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ─── SHELL + NAVEGAÇÃO ────────────────────────────────────────────

const NAV = [
  { key: 'home', label: 'Início', Icon: IconHome, src: null },
  { key: 'roadmap', label: 'Trilha', Icon: IconPath, src: null },
  { key: 'achievements', label: 'Conquistas', Icon: null, src: conquistaIcon },
  { key: 'profile', label: 'Perfil', Icon: null, src: perfilIcon },
  { key: 'settings', label: 'Config', Icon: null, src: configIcon },
]

const TITLES = {
  home: ['Início', 'Escolha o que aprender agora'],
  roadmap: ['Trilha', 'Siga o caminho até o objetivo'],
  phase: ['Etapa', 'Lições deste módulo'],
  task: ['Tarefa', 'Responda para avançar'],
  result: ['Resultado', 'Veja como você foi'],
  profile: ['Perfil', 'Seus dados e progresso'],
  achievements: ['Conquistas', 'Suas medalhas'],
  settings: ['Configurações', 'Conta e estudo'],
}

function AppShell({ active, onNavigate, onBack, profile, username, email, onLogout, theme, onToggleTheme, avatarBroken, onAvatarError, children }) {
  const initial = (username[0]?.toUpperCase() || '?')
  const showImg = !!profile?.avatar_url && !avatarBroken
  const [title, sub] = TITLES[active] || TITLES.home

  return (
    <div className="mp">
      <div className="mp-stage">
        <header className="mp-top">
          {onBack && (
            <button type="button" onClick={onBack} className="mp-iconbtn" aria-label="Voltar">
              <IconArrowLeft />
            </button>
          )}
          <div className="mp-mark mp-mark--on-navy"><BrandGlyph /></div>
          <div className="mp-top__brand" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
            <span className="mp-top__title">{title}</span>
            <span className="mp-top__sub">{sub}</span>
          </div>
          <div className="mp-top__actions">
            <XpPill profile={profile} />
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button type="button" onClick={onLogout} className="mp-iconbtn mp-iconbtn--danger" aria-label="Sair">
              <IconLogout />
            </button>
          </div>
        </header>

        {children}
      </div>

      <nav className="mp-tabbar" aria-label="Navegação principal">
        {NAV.map(it => <NavButton key={it.key} item={it} active={active === it.key} onNavigate={onNavigate} />)}
      </nav>

      <aside className="mp-rail">
        <div className="mp-rail__brand">
          <div className="mp-mark mp-mark--on-navy"><BrandGlyph /></div>
          <span>Metapps</span>
        </div>
        <div className="mp-rail__nav">
          {NAV.map(it => <NavButton key={it.key} item={it} active={active === it.key} onNavigate={onNavigate} />)}
        </div>
        <div className="mp-rail__foot">
          <div className="mp-user">
            <span className="mp-user__a">
              {showImg ? <img src={profile.avatar_url} alt="" onError={onAvatarError} /> : <span>{initial}</span>}
            </span>
            <span className="mp-user__b">
              <span className="mp-user__n">{username || 'Usuário'}</span>
              <span className="mp-user__e">{email}</span>
            </span>
          </div>
          <button type="button" onClick={onLogout} className="mp-signout">
            <IconLogout /> Sair da conta
          </button>
        </div>
      </aside>
    </div>
  )
}

function NavButton({ item, active, onNavigate }) {
  return (
    <button
      type="button"
      className={`mp-nav ${active ? 'is-on' : ''}`}
      onClick={() => onNavigate(item.key)}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
    >
      <span className="mp-nav__ico">
        {item.src ? <img src={item.src} alt="" draggable={false} /> : <item.Icon />}
      </span>
      <span className="mp-nav__label">{item.label}</span>
    </button>
  )
}

function XpPill({ profile }) {
  const level = profile?.level || 1
  const xp = profile?.xp || 0
  const pct = xpPct(xp)
  return (
    <div className="mp-xp" title={`Nível ${level} · ${xp} XP`}>
      <div className="mp-xp__meta">
        <div className="mp-xp__lvl">Nível {level}</div>
        <div className="mp-xp__val">{xp} XP</div>
      </div>
      <Ring value={pct} />
    </div>
  )
}

// ─── ÍCONES ───────────────────────────────────────────────────────

function BrandGlyph() {
  return <img className="mp-mark__img" src={pixelIcon} alt="" draggable={false} />
}

function IconSpark({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden>
      <path d="M12 2.5l1.9 6.4 6.4 1.9-6.4 1.9L12 19.1l-1.9-6.4L3.7 10.8l6.4-1.9Z" />
      <path d="M19 15l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9Z" opacity=".75" />
    </svg>
  )
}

function IconEdit({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
}

function IconTrash({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
}

function IconLock({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="11" width="16" height="9" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
}

function IconCheck({ size = 18, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
}

function IconX({ size = 18, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>
}

function IconArrowLeft({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
}

function IconArrowRight({ size = 17 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
}

function IconChevron({ size = 15, color = 'var(--ink-3)' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
}

function IconHome() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></svg>
}

function IconPath() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="6" cy="18" r="2.6" /><circle cx="18" cy="6" r="2.6" /><path d="M8.6 18H14a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h5.4" /></svg>
}

function IconLogout() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
}

function IconHistory() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3 4v5h5" /><path d="M12 7.5V12l3 2" /></svg>
}

function IconSun() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M5.8 5.8 4.2 4.2M19.8 19.8l-1.6-1.6M18.2 5.8l1.6-1.6M4.2 19.8l1.6-1.6" /></svg>
}

function IconMoon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" /></svg>
}

function IconFlag() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 21V4" /><path d="M5 4.5h13l-2.6 3.7L18 12H5" /></svg>
}

function IconAlert() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9.5" /><path d="M12 7.5V13" /><path d="M12 16.2h.01" /></svg>
}

function IconBolt({ size = 21, style }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden><path d="M13.4 2 5 13.4h5.2L9.6 22 19 10.4h-5.4L13.4 2Z" /></svg>
}

function IconStar({ size = 21, style }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden><path d="m12 2.6 2.85 5.9 6.4.9-4.63 4.5 1.1 6.4L12 17.3l-5.72 3 1.1-6.4-4.63-4.5 6.4-.9L12 2.6Z" /></svg>
}

function IconTarget({ size = 21, style }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.6" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
}
