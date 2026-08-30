// ─── REACT DO CELLBIT (CORRIGIDO - EXTRAÇÃO DE TÓPICOS) ────
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { listGoals, createGoal, generateRoadmap, generateTask, submitAttempt, authFetch, logout as apiLogout, getAccessToken, refreshSession } from './api'

// ─── ÍCONES ──────────────────────────────────────────────────
const IcoHome   = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
const IcoMap    = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
const IcoUser   = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IcoLogout = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const IcoSend   = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
const IcoBack   = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
const IcoPlus   = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const Spin      = ()       => <svg style={{animation:'spin .7s linear infinite'}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10" strokeOpacity=".2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
const IcoCheck  = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoLock   = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>

// ─── PALETA ──────────────────────────────────────────────────
const C = {
  bg:      '#0f1117',
  surface: '#181b26',
  border:  'rgba(255,255,255,0.07)',
  blue:    '#6382ff',
  blueD:   '#3d5af1',
  green:   '#3ecf8e',
  yellow:  '#f5c542',
  red:     '#f06a6a',
  text:    '#f0f2ff',
  muted:   '#7b82a0',
}

// ─── HELPERS ──────────────────────────────────────────────────
function toId(value) {
  if (!value) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return value.UUID || value.uuid || value.id || null
}

function normalizeTopic(topic, index) {
  const parent = topic.parent_topic_id ?? topic.parent_id ?? topic.parentTopicId
  const parentId = parent && typeof parent === 'object' && parent.Valid === false
    ? null
    : toId(parent)
  return {
    ...topic,
    id: toId(topic.id || topic.topic_id) || `topic-${index}`,
    parent_topic_id: parentId,
    title: String(topic.title || topic.name || topic.label || `Tópico ${index + 1}`),
  }
}

function normalizeDependency(dependency) {
  return {
    ...dependency,
    topic_id: toId(dependency.topic_id || dependency.topicId),
    depends_on: toId(dependency.depends_on || dependency.depends_on_topic_id || dependency.dependsOnTopicId),
  }
}

function getChildren(topics, parentId) {
  return topics.filter(t => t.parent_topic_id === parentId)
}
function isLeafTopic(topic, topics) {
  return getChildren(topics, topic.id).length === 0
}
function getRootTopics(topics) {
  const ids = new Set(topics.map(t => t.id))
  return topics.filter(t => !t.parent_topic_id || !ids.has(t.parent_topic_id))
}
function applyBlocking(topics, dependencies, completedIds) {
  const depMap = {}
  dependencies.forEach(d => {
    if (!d.topic_id || !d.depends_on) return
    if (!depMap[d.topic_id]) depMap[d.topic_id] = []
    depMap[d.topic_id].push(d.depends_on)
  })
  return topics.map(t => ({
    ...t,
    blocked: (depMap[t.id] || []).some(depId => !completedIds.includes(depId))
  }))
}

function MountainScene({ height }) {
  return <svg width="100%" height={height} viewBox={`0 0 800 ${height}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    <rect width="800" height={height} fill={C.bg} />
    <path d={`M0 ${height} L180 ${height * .35} L360 ${height} Z`} fill={C.surface} />
    <path d={`M180 ${height} L400 ${height * .12} L650 ${height} Z`} fill="#1e2d6b" opacity=".8" />
    <path d={`M470 ${height} L650 ${height * .28} L800 ${height} Z`} fill={C.surface} />
  </svg>
}

function TrailPath({ points, progressRatio }) {
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  return <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
    <path d={path} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth=".6" strokeDasharray="1.5 2" vectorEffect="non-scaling-stroke" />
    <path d={path} fill="none" stroke={C.blue} strokeWidth=".8" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - Math.min(progressRatio, 1)} vectorEffect="non-scaling-stroke" />
  </svg>
}

function SummitFlag({ x, top }) {
  return <div style={{ position: 'absolute', left: `${x}%`, top: top - 58, transform: 'translateX(-50%)', zIndex: 3, color: C.yellow }}>⚑</div>
}

function TrailNode({ topic, index, top, x, isCompleted, isLocked, isActive, onStart }) {
  return <div style={{ position: 'absolute', left: `${x}%`, top, transform: 'translate(-50%, -50%)', zIndex: 4, textAlign: 'center', minWidth: 100 }}>
    <button disabled={isLocked || isCompleted} onClick={() => onStart(topic)} title={isLocked ? 'Bloqueado' : 'Iniciar tópico'} style={{ width: 46, height: 46, borderRadius: '50%', border: `2px solid ${isActive ? C.blue : isCompleted ? C.green : C.border}`, background: isCompleted ? C.green : isLocked ? C.surface : C.bg, color: isCompleted ? C.bg : C.text, cursor: isLocked || isCompleted ? 'default' : 'pointer', fontWeight: 800 }}>
      {isCompleted ? <IcoCheck s={18} /> : isLocked ? <IcoLock s={15} /> : index + 1}
    </button>
    <div style={{ marginTop: 8, color: isLocked ? C.muted : C.text, fontSize: 12, lineHeight: 1.3, maxWidth: 150 }}>{topic.title}</div>
  </div>
}

// ─── SUBTÓPICOS VIEW ──────────────────────────────────────────
function SubtopicView({ parent, items, topics, completedIds, onBack, onStartTask, onOpenChildren }) {
  return <div style={{ padding: 24, overflowY: 'auto' }}>
    <button onClick={onBack} style={backLnk}><IcoBack /> Voltar</button>
    <h2 style={{ marginBottom: 8 }}>{parent.title}</h2>
    <p style={{ color: C.muted, marginBottom: 22 }}>Escolha um tópico para continuar.</p>
    <div style={{ display: 'grid', gap: 10, maxWidth: 680 }}>
      {items.map(topic => {
        const blocked = topic.blocked && !completedIds.includes(topic.id)
        const hasChildren = !isLeafTopic(topic, topics)
        return <button key={topic.id} disabled={blocked} onClick={() => hasChildren ? onOpenChildren(topic) : onStartTask(topic.id)} style={{ textAlign: 'left', padding: 16, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: blocked ? C.muted : C.text, cursor: blocked ? 'default' : 'pointer' }}>
          <strong>{topic.title}</strong><span style={{ display: 'block', marginTop: 5, color: C.muted, fontSize: 12 }}>{blocked ? 'Bloqueado' : hasChildren ? 'Ver subtópicos' : 'Iniciar tarefa'}</span>
        </button>
      })}
    </div>
  </div>
}

// ─── CHAT PANEL ──────────────────────────────────────────────
function ChatPanel({ task, onBack, onComplete }) {
  const [response, setResponse] = useState(task.type === 'quiz' ? [] : '')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const content = typeof task.content === 'string' ? (() => {
    try { return JSON.parse(task.content) } catch { return {} }
  })() : task.content || {}
  const meta = task.meta || {}
  const questions = content.questions || []
  const isQuiz = task.type === 'quiz'
  const canSubmit = isQuiz ? response.length === questions.length && questions.length > 0 : response.trim().length > 0
  async function submit() {
    setError(''); setLoading(true)
    try {
      const payload = isQuiz
        ? response.map((answer, questionIndex) => ({ question_index: questionIndex, answer }))
        : response
      const attempt = await submitAttempt(task.id, task.type || 'essay', payload)
      setResult(attempt)
      onComplete()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  return <div style={{ padding: 24, overflowY: 'auto', maxWidth: 760 }}>
    <button onClick={onBack} style={backLnk}><IcoBack /> Voltar</button>
    <h2>{meta.title || 'Tarefa'}</h2><p style={{ color: C.muted, whiteSpace: 'pre-wrap', margin: '12px 0 20px' }}>{meta.description || content.instructions || ''}</p>
    {isQuiz ? <div style={{ display: 'grid', gap: 18 }}>{questions.map((question, index) => <fieldset key={index} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
      <legend style={{ padding: '0 6px', color: C.text }}>{index + 1}. {question.statement}</legend>
      {(question.alternatives || []).map((alternative, optionIndex) => <label key={optionIndex} style={{ display: 'block', padding: '8px 0', color: C.muted }}><input type="radio" name={`question-${index}`} checked={response[index] === optionIndex} onChange={() => setResponse(previous => { const next = [...previous]; next[index] = optionIndex; return next })} />{' '}{alternative}</label>)}
    </fieldset>)}</div> : <textarea value={response} onChange={e => setResponse(e.target.value)} rows={8} placeholder="Escreva sua resposta..." style={{ width: '100%', padding: 14, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text, resize: 'vertical' }} />}
    <button onClick={submit} disabled={!canSubmit || loading} style={{ ...btnPri, marginTop: 14 }}>{loading ? <Spin /> : <IcoSend />} {loading ? 'Enviando...' : 'Enviar resposta'}</button>
    {error && <div style={{ ...errBox, marginTop: 14 }}>{error}</div>}
    {result && <div style={{ marginTop: 18, padding: 16, borderRadius: 10, background: 'rgba(62,207,142,.1)', color: C.text }}>Resposta enviada com sucesso.</div>}
  </div>
}

// ─── PERFIL ──────────────────────────────────────────────────
function ProfileView({ profile, email }) {
  return <div style={{ padding: 24, overflowY: 'auto' }}>
    <h2 style={{ marginBottom: 20 }}>Perfil</h2>
    <div style={{ ...boxStyle, padding: 20, border: `1px solid ${C.border}`, borderRadius: 12, background: C.surface }}>
      <p style={{ color: C.muted, fontSize: 12 }}>E-mail</p><p style={{ marginTop: 5 }}>{email || 'Não informado'}</p>
      {profile?.username && <><p style={{ color: C.muted, fontSize: 12, marginTop: 18 }}>Usuário</p><p style={{ marginTop: 5 }}>{profile.username}</p></>}
    </div>
  </div>
}

// ─── HOMEPAGE PRINCIPAL ──────────────────────────────────────
export default function Homepage() {
  const navigate = useNavigate()
  const [view, setView] = useState('home')
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState(null)
  const [task, setTask] = useState(null)
  const [goals, setGoals] = useState([])
  const [input, setInput] = useState('')
  const [topics, setTopics] = useState([])
  const [deps, setDeps] = useState([])
  const [completed, setCompleted] = useState([])
  const [curGoal, setCurGoal] = useState(null)
  const [err, setErr] = useState('')
  const [loadInit, setLoadInit] = useState(true)
  const [loadGen, setLoadGen] = useState(false)
  const [tooltip, setTooltip] = useState(null)
  const [subtopicStack, setSubtopicStack] = useState([])
  const canvasRef = useRef(null)

  useEffect(() => {
    async function init() {
      if (!getAccessToken()) {
        try { await refreshSession() } catch { navigate('/auth/login'); return }
      }
      try {
        const res = await authFetch('/auth/me')
        const d = await res.json()
        if (!res.ok) { navigate('/auth/login'); return }
        setEmail(d.user?.email || '')
      } catch { navigate('/auth/login'); return }
      try {
        const res = await authFetch('/protected/profile')
        const d = await res.json()
        if (res.ok) setProfile(d.profile)
      } catch { setProfile(null) }
      try { const gl = await listGoals(); setGoals(gl || []) } catch { setGoals([]) }
      finally { setLoadInit(false) }
    }
    init()
  }, [navigate])

  // ─── FUNÇÃO AUXILIAR PARA EXTRAIR TÓPICOS DO ROADMAP ──────
  function extractTopicsAndDeps(roadmap) {
    const source = roadmap?.roadmap || roadmap?.data || roadmap || {}
    const rawTopics = Array.isArray(source) ? source : source.topics || source.nodes || []
    const rawDependencies = Array.isArray(source) ? [] : source.dependencies || source.edges || []
    const topics = rawTopics.map(normalizeTopic)
    const dependencies = rawDependencies.map(normalizeDependency)
    return { topics, dependencies }
  }

  function roadmapError(rawTopics, rawDeps) {
    if (!rawTopics.length) return 'A API não devolveu tópicos para este roadmap. Tente gerar novamente.'
    const roots = getRootTopics(rawTopics)
    if (!roots.length) return 'Os tópicos vieram sem uma raiz válida. Tente gerar novamente.'
    if (rawTopics.some(topic => !topic.id || !topic.title)) return 'A API devolveu um tópico incompleto. Tente gerar novamente.'
    if (rawDeps.some(dep => !dep.topic_id || !dep.depends_on)) return 'O roadmap possui uma dependência inválida. Tente gerar novamente.'
    return ''
  }

  // ─── FUNÇÕES PRINCIPAIS ──────────────────────────────────
  async function handleSend() {
    if (!input.trim()) return
    setErr(''); setLoadGen(true)
    try {
      const goal = await createGoal(input.trim(), {})
      const roadmap = await generateRoadmap(goal.id)
      const { topics: rawTopics, dependencies: rawDeps } = extractTopicsAndDeps(roadmap)
      const validationError = roadmapError(rawTopics, rawDeps)
      if (validationError) {
        setErr(validationError)
        setGoals(prev => [goal, ...prev])
        return
      }

      setTopics(rawTopics)
      setDeps(rawDeps)
      setCurGoal(goal)
      setCompleted([])
      setSubtopicStack([])
      setGoals(prev => [goal, ...prev])
      setView('roadmap')
    } catch (er) {
      setErr(er?.message || 'Não foi possível gerar o roadmap. Verifique sua conexão e tente novamente.')
    } finally {
      setLoadGen(false)
    }
  }

  async function handleGoalClick(goal) {
    setErr(''); setLoadGen(true)
    try {
      const roadmap = await generateRoadmap(goal.id)
      const { topics: rawTopics, dependencies: rawDeps } = extractTopicsAndDeps(roadmap)
      const validationError = roadmapError(rawTopics, rawDeps)
      if (validationError) { setErr(validationError); return }

      setTopics(rawTopics)
      setDeps(rawDeps)
      setCurGoal(goal)
      setCompleted([])
      setSubtopicStack([])
      setView('roadmap')
    } catch (er) {
      setErr(er?.message || 'Não foi possível carregar este roadmap. Tente novamente.')
    } finally {
      setLoadGen(false)
    }
  }

  function openSubtopicView(topic) {
    setSubtopicStack(prev => [...prev, topic])
  }

  function closeSubtopicView() {
    setSubtopicStack(prev => prev.slice(0, -1))
  }

  async function handleStartTask(topicId) {
    const topic = topics.find(t => t.id === topicId)
    if (!topic || !isLeafTopic(topic, topics)) {
      setErr('Este tópico possui subtópicos. Navegue até um tópico folha para iniciar a tarefa.')
      return
    }
    setErr(''); setLoadGen(true)
    try {
      const gen = await generateTask(topicId)
      setTask(gen)
    } catch (er) {
      setErr(er?.message || 'Não foi possível gerar a tarefa. Tente novamente.')
    } finally {
      setLoadGen(false)
    }
  }

  function handleLogout() { apiLogout(); navigate('/auth/login') }

  // ─── LÓGICA DE EXIBIÇÃO ──────────────────────────────────
  const allTopics = topics || []
  const allDeps = deps || []
  const completedIds = completed || []

  const roots = getRootTopics(allTopics)
  const enrichedRoots = applyBlocking(roots, allDeps, completedIds)

  const points = enrichedRoots.map((_, i) => {
    const GAP = 140
    const wave = Math.sin(i * 0.85) * 20
    return { x: 50 + wave, y: 130 + i * GAP }
  })
  const canvasHeight = enrichedRoots.length ? points[points.length - 1].y + 280 : 640
  const topPxOf = idx => canvasHeight - (points[idx]?.y ?? 0)

  useEffect(() => {
    if (!curGoal || enrichedRoots.length === 0 || !canvasRef.current) return
    const el = canvasRef.current
    el.scrollTop = 0
    const target = el.scrollHeight - el.clientHeight
    const t = setTimeout(() => {
      const start = el.scrollTop
      const diff = target - start
      const duration = 1200
      const startTime = performance.now()
      function step(now) {
        const p = Math.min((now - startTime) / duration, 1)
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
        el.scrollTop = start + diff * ease
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, 3000)
    return () => clearTimeout(t)
  }, [curGoal, enrichedRoots.length])

  // ─── RENDER ──────────────────────────────────────────────
  const NAV = [
    { key: 'home', label: 'Início' },
    { key: 'roadmap', label: 'Roadmap' },
    { key: 'profile', label: 'Perfil' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Inter',-apple-system,sans-serif", WebkitFontSmoothing: 'antialiased', background: C.bg, color: C.text }}>
      <aside style={{ width: 56, flexShrink: 0, borderRight: `1px solid ${C.border}`, padding: '0 8px', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ padding: '18px 0 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: `linear-gradient(135deg,${C.blue},${C.blueD})` }} />
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {NAV.map(({ key, label }) => {
            const active = view === key
            return (
              <div key={key} style={{ position: 'relative' }}
                onMouseEnter={() => setTooltip(key)} onMouseLeave={() => setTooltip(null)}>
                <button onClick={() => setView(key)}
                  style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: active ? `rgba(99,130,255,0.14)` : 'transparent', color: active ? C.blue : C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .15s' }}>
                  {key === 'home' ? <IcoHome s={19} /> : key === 'roadmap' ? <IcoMap s={19} /> : <IcoUser s={19} />}
                </button>
                {tooltip === key && (
                  <div style={{ position: 'absolute', left: 52, top: '50%', transform: 'translateY(-50%)', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', zIndex: 100, pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                    {label}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginBottom: 8 }}>
          <button onClick={handleLogout}
            onMouseEnter={e => e.currentTarget.style.color = C.red} onMouseLeave={e => e.currentTarget.style.color = C.muted}
            style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: 'transparent', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'color .15s' }}>
            <IcoLogout s={18} />
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* SubtopicStack */}
        {subtopicStack.length > 0 ? (
          (() => {
            const parent = subtopicStack[subtopicStack.length - 1]
            const children = getChildren(allTopics, parent.id)
            const enriched = applyBlocking(children, allDeps, completedIds)
            return (
              <SubtopicView
                parent={parent}
                items={enriched}
                topics={allTopics}
                completedIds={completedIds}
                onBack={closeSubtopicView}
                onStartTask={handleStartTask}
                onOpenChildren={openSubtopicView}
              />
            )
          })()
        ) : task ? (
          <ChatPanel task={task} onBack={() => setTask(null)} onComplete={() => { setCompleted(previous => previous.includes(task.topic_id) ? previous : [...previous, task.topic_id]); setTask(null) }} />
        ) : view === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 180 }}>
              {/* SVG da montanha */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                <svg viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
                  <defs>
                    <linearGradient id="mL" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2a3a7c" /><stop offset="100%" stopColor="#141930" /></linearGradient>
                    <linearGradient id="mM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3d5af1" /><stop offset="100%" stopColor="#1e2d6b" /></linearGradient>
                    <linearGradient id="mR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#253070" /><stop offset="100%" stopColor="#141930" /></linearGradient>
                    <linearGradient id="sn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0f2ff" stopOpacity="0.95" /><stop offset="100%" stopColor="#c8d4ff" stopOpacity="0.3" /></linearGradient>
                  </defs>
                  <path d="M0,300 L160,90 L320,300 Z" fill="url(#mL)" opacity="0.55" />
                  <path d="M480,300 L640,70 L800,300 Z" fill="url(#mR)" opacity="0.55" />
                  <path d="M200,300 L400,22 L600,300 Z" fill="url(#mM)" />
                  <path d="M400,22 L600,300 L400,300 Z" fill="#0f1535" opacity="0.22" />
                  <path d="M400,22 L368,78 L400,62 L432,78 Z" fill="url(#sn)" />
                  <path d="M400,22 L384,52 L400,44 L416,52 Z" fill="#f0f2ff" opacity="0.92" />
                  <path d="M0,248 Q200,228 400,242 Q600,256 800,238 L800,300 L0,300 Z" fill={C.bg} opacity="0.65" />
                  <path d="M0,270 Q400,255 800,270 L800,300 L0,300 Z" fill={C.bg} />
                </svg>
              </div>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 20px 80px' }}>
                <h1 style={{ fontSize: 'clamp(22px,3.5vw,34px)', fontWeight: 900, color: C.text, letterSpacing: '-0.04em', textAlign: 'center', lineHeight: 1.1, marginBottom: 8, textShadow: '0 2px 20px rgba(0,0,0,0.6)' }}>
                  O que você quer aprender?
                </h1>
                <p style={{ fontSize: 14, color: C.muted, textAlign: 'center', marginBottom: 24 }}>
                  Digite qualquer assunto e a IA cria seu caminho.
                </p>
                <div style={{ width: '100%', maxWidth: 460, background: 'rgba(15,17,23,0.82)', backdropFilter: 'blur(14px)', border: `1.5px solid rgba(99,130,255,0.22)`, borderRadius: 14, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '13px 13px 13px 17px' }}>
                  <textarea value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder="Ex: Funções do segundo grau, Revolução Francesa..."
                    rows={2}
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6, resize: 'none', padding: 0 }} />
                  <button onClick={handleSend} disabled={!input.trim() || loadGen}
                    style={{ width: 36, height: 36, borderRadius: 9, border: 'none', background: input.trim() ? C.blue : 'rgba(255,255,255,0.06)', color: input.trim() ? '#fff' : 'rgba(245,244,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', transition: 'all .2s', flexShrink: 0 }}>
                    {loadGen ? <Spin /> : <IcoSend s={13} />}
                  </button>
                </div>
                {err && <div style={{ ...errBox, marginTop: 12, maxWidth: 460, width: '100%' }}>{err}</div>}
              </div>
            </div>
            {goals.length > 0 && (
              <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(240,242,255,0.22)', marginBottom: 10 }}>Continue de onde parou</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {goals.slice(0, 6).map(g => (
                    <button key={g.id} onClick={() => handleGoalClick(g)}
                      style={{ padding: '7px 14px', borderRadius: 99, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,130,255,0.3)'; e.currentTarget.style.color = C.text }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}>
                      {g.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : view === 'profile' ? (
          loadInit ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: C.muted }}><Spin /> Carregando…</div> : <ProfileView profile={profile} email={email} />
        ) : view === 'roadmap' ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>{curGoal?.title || 'Roadmap'}</h2>
                <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Passe o mouse num nó e clique em "Iniciar".</p>
              </div>
              <button onClick={() => { setView('home'); setCurGoal(null); setTopics([]); setCompleted([]); setSubtopicStack([]) }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 12px' }}
                onMouseEnter={e => e.currentTarget.style.color = C.text} onMouseLeave={e => e.currentTarget.style.color = C.muted}>
                <IcoPlus s={13} /> Novo
              </button>
            </div>

            {!curGoal && !loadGen && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: C.muted, fontSize: 14 }}>
                Escolha um objetivo para ver o roadmap.
              </div>
            )}

            {loadGen && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: C.muted, fontSize: 14 }}>
                <Spin /> Carregando…
              </div>
            )}

            {curGoal && enrichedRoots.length === 0 && !loadGen && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: C.muted, fontSize: 14 }}>
                Nenhum tópico encontrado. Verifique o console (F12) para detalhes.
              </div>
            )}

            {curGoal && enrichedRoots.length > 0 && !loadGen && (
              <div ref={canvasRef} style={{ flex: 1, position: 'relative', overflowY: 'auto', overflowX: 'hidden' }}>
                <div style={{ position: 'relative', width: '100%', height: canvasHeight }}>
                  <MountainScene height={canvasHeight} />
                  <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '48px 24px 12px' }}>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: C.blue, marginBottom: 10, borderTop: `2px solid ${C.blue}`, paddingTop: 6, width: 68 }}>Trilha ativa</span>
                    <h2 style={{ fontSize: 'clamp(1.6rem,3.4vw,2.2rem)', fontWeight: 900, letterSpacing: '-0.03em', color: C.text, margin: '2px 0' }}>{curGoal?.title}</h2>
                    <p style={{ fontSize: 13, color: C.muted }}>Passe o mouse num nó para iniciar.</p>
                  </div>

                  <TrailPath points={points} progressRatio={completed.length / Math.max(enrichedRoots.length, 1)} />
                  <SummitFlag x={points[points.length - 1]?.x ?? 50} top={topPxOf(points.length - 1)} />

                  {enrichedRoots.map((topic, index) => {
                    const isCompleted = completedIds.includes(topic.id)
                    const isLocked = topic.blocked && !isCompleted
                    const isActive = index === 0 && !isCompleted && !isLocked
                    const handleStart = (t) => {
                      if (isLeafTopic(t, allTopics)) {
                        handleStartTask(t.id)
                      } else {
                        openSubtopicView(t)
                      }
                    }
                    return (
                      <TrailNode
                        key={topic.id}
                        topic={topic}
                        index={index}
                        top={topPxOf(index)}
                        x={points[index].x}
                        isCompleted={isCompleted}
                        isLocked={isLocked}
                        isActive={isActive}
                        onStart={handleStart}
                      />
                    )
                  })}
                </div>
                {err && <div style={{ ...errBox, position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 6, maxWidth: 480 }}>{err}</div>}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>Carregando…</div>
        )}
      </main>
      <style>{ANIMS}</style>
    </div>
  )
}

// ─── ESTILOS GLOBAIS ─────────────────────────────────────────
const ANIMS = `
  @keyframes spin { to { transform: rotate(360deg) } }
  button:active { transform: scale(0.97) }
  textarea::placeholder { color: rgba(240,242,255,0.28) }
  textarea:focus { outline: none }
  ::-webkit-scrollbar { display: none }
`

// Os estilos pgStyle, boxStyle, backLnk, errBox, btnPri, btnSec precisam ser os mesmos de antes.
// Coloque-os aqui.
const boxStyle = { width: '100%', maxWidth: 660 }
const backLnk = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 24, fontFamily: 'inherit', transition: 'color .15s' }
const errBox = { background: 'rgba(240,106,106,0.08)', border: '1px solid rgba(240,106,106,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red, lineHeight: 1.45 }
const btnPri = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 24px', border: 'none', borderRadius: 10, background: C.blue, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity .15s' }

// ─── DEFINIR COMPONENTES FALTANTES (MountainScene, TrailPath, SummitFlag, TrailNode, SubtopicView, ChatPanel, ProfileView) ──
// Eles devem ser os mesmos do código anterior. Como não os incluí aqui para economizar, certifique-se de mantê-los no seu arquivo.
// Se precisar, posso enviá-los novamente.