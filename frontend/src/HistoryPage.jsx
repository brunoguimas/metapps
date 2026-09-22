import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  refreshSession,
  listTasks,
  listAttemptsByUser,
  getCorrectionByAttemptID,
  generateCorrection,
  setSessionExpiredHandler,
} from './api'

// ─── HELPERS ─────────────────────────────────────────────────

const sa = v => (Array.isArray(v) ? v : [])

function tryParse(raw) {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function attemptContent(a) {
  return tryParse(a?.content) || {}
}

function attemptEval(a) {
  return tryParse(a?.task_evaluation) || null
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function taskTitle(task, taskId) {
  if (task) return task.meta?.title || `Tarefa ${taskId?.slice(0, 8)}`
  return `Tarefa ${taskId?.slice(0, 8) || ''}`
}

function answerLabel(alts, idx) {
  if (idx === null || idx === undefined || idx === '') return '—'
  if (typeof idx === 'string' && isNaN(Number(idx))) return idx
  const i = parseInt(idx, 10)
  if (alts[i] !== undefined) return alts[i]
  return i >= 0 ? `Alternativa ${String.fromCharCode(65 + i)}` : String(idx)
}

function typeLabel(t) {
  if (t === 'quiz') return 'Quiz'
  if (t === 'essay') return 'Redação'
  return t || '—'
}

const typeColor = t => (t === 'essay' ? '#9B59F0' : '#6382FF')

// ─── ICONES ──────────────────────────────────────────────────

function IconArrowLeft() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
}
function IconRefresh() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></svg>
}
function IconChevron({ open }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform .18s ease', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}><path d="M9 18l6-6-6-6" /></svg>
}
function IconAlert() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px', marginRight: 6, flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
}
function IconSpark() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="#9AB4FF" style={{ verticalAlign: '-2px', marginRight: 6 }}><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z" /></svg>
}
function IconCheck({ color = '#3ECF8E' }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
}
function IconX({ color = '#F06A6A' }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>
}
function Spinner() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'metaSpin .8s linear infinite' }}><circle cx="12" cy="12" r="10" stroke="rgba(99,130,255,0.25)" strokeWidth="3" /> <path d="M12 2a10 10 0 0 1 10 10" stroke="#6382FF" strokeWidth="3" strokeLinecap="round" /></svg>
}
function GlobalStyles() {
  return (
    <style>{`
      @keyframes metaSpin { to { transform: rotate(360deg); } }
      @keyframes metaFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
  )
}

// ─── ESTILOS ─────────────────────────────────────────────────

const page = { minHeight: '100vh', background: '#F5F4FF', color: '#1E1E32', fontFamily: "'Inter',-apple-system,sans-serif", WebkitFontSmoothing: 'antialiased' }
const header = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#1A1A2E', position: 'sticky', top: 0, zIndex: 10, borderRadius: '0 0 20px 20px', boxShadow: '0 8px 24px rgba(26,26,46,0.18)' }
const headerTitle = { fontWeight: 800, color: '#f5f4ff', fontSize: 14 }
const iconNavBtn = { width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#f5f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const box = { maxWidth: 600, margin: '0 auto', padding: '24px 18px 48px', animation: 'metaFadeUp .35s ease' }
const card = { background: '#fff', borderRadius: 22, boxShadow: '0 10px 30px rgba(99,130,255,0.1)' }
const statCard = { background: '#fff', borderRadius: 16, padding: '14px 6px', textAlign: 'center', boxShadow: '0 6px 16px rgba(99,130,255,0.07)', flex: 1 }
const statNum = { color: '#1E1E32', fontSize: 20, fontWeight: 800 }
const statCaption = { color: '#8A8AA3', fontSize: 10.5, fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.4px' }
const select = { flex: 1, padding: '11px 12px', borderRadius: 12, border: '1.5px solid rgba(99,130,255,0.2)', background: '#fff', color: '#1E1E32', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer', minWidth: 0 }
const attemptCard = { background: '#fff', border: '1px solid rgba(99,130,255,0.1)', borderRadius: 16, marginBottom: 12, boxShadow: '0 6px 18px rgba(99,130,255,0.06)', overflow: 'hidden' }
const attemptHead = { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', width: '100%', border: 'none', background: 'transparent', fontFamily: 'inherit', textAlign: 'left' }
const attemptTitle = { color: '#1E1E32', fontSize: 13.5, fontWeight: 800, lineHeight: 1.35, wordBreak: 'break-word' }
const metaRow = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }
const badge = { fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase' }
const dateTxt = { color: '#8A8AA3', fontSize: 11.5, fontWeight: 600 }
const scoreWrap = { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }
const scoreChip = { minWidth: 54, fontSize: 13, fontWeight: 800, borderRadius: 10, padding: '6px 10px', textAlign: 'center' }
const chevCol = { display: 'flex', alignItems: 'center', color: '#B7B7CC' }
const detailBox = { padding: '0 16px 16px', borderTop: '1px dashed rgba(99,130,255,0.14)' }
const detailLabel = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#6382FF', paddingTop: 14, marginBottom: 10 }
const reviewRow = { padding: '11px 13px', borderRadius: 12, marginBottom: 8, border: '1px solid rgba(99,130,255,0.12)' }
const reviewRowOk = { border: '1px solid rgba(62,207,142,0.25)', background: 'rgba(62,207,142,0.05)' }
const reviewRowBad = { border: '1px solid rgba(240,106,106,0.25)', background: 'rgba(240,106,106,0.05)' }
const reviewHead = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }
const reviewTitle = { fontWeight: 800, fontSize: 12.5 }
const reviewMuted = { color: '#8A8AA3', fontSize: 12, lineHeight: 1.5, margin: '5px 0 0' }
const respText = { background: '#F5F4FF', border: '1px solid rgba(99,130,255,0.14)', borderRadius: 12, padding: '12px 14px', color: '#4A4A66', fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 8 }
const fbCard = { background: 'linear-gradient(180deg,#fff,#F8F7FF)', border: '1px solid rgba(99,130,255,0.16)', borderRadius: 14, padding: 14, marginTop: 10 }
const fbEyebrow = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#6382FF', marginBottom: 10 }
const fbText = { color: '#1E1E32', fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }
const fbScore = { display: 'inline-block', fontSize: 11.5, fontWeight: 800, color: '#0E7A55', background: 'rgba(62,207,142,0.12)', padding: '4px 10px', borderRadius: 99, marginBottom: 10 }
const muted = { color: '#8A8AA3', fontSize: 13, lineHeight: 1.6, margin: '4px 0 12px' }
const errStyle = { display: 'flex', alignItems: 'center', background: 'rgba(240,106,106,0.08)', border: '1px solid rgba(240,106,106,0.2)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#B23A3A', fontWeight: 600, marginBottom: 12 }
const btnSm = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', border: 'none', borderRadius: 12, background: '#6382FF', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 16px rgba(99,130,255,0.3)' }
const loadingWrap = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#8A8AA3', fontSize: 13, fontWeight: 700, padding: '40px 0' }
const emptyWrap = { textAlign: 'center', padding: '36px 20px' }

// ─── PÁGINA ──────────────────────────────────────────────────

export default function HistoryPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [attempts, setAttempts] = useState([])
  const [taskFilter, setTaskFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [corrStatus, setCorrStatus] = useState({})
  const [corrMap, setCorrMap] = useState({})
  const [err, setErr] = useState('')

  useEffect(() => {
    setSessionExpiredHandler(() => navigate('/auth/login'))
    let cancelled = false

    async function init() {
      try {
        try {
          await refreshSession()
        } catch {
          navigate('/auth/login')
          return
        }
        if (cancelled) return
        const [t, a] = await Promise.all([listTasks(), listAttemptsByUser()])
        if (cancelled) return
        setTasks(sa(t))
        setAttempts(sa(a))
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Erro ao carregar o histórico.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [navigate])

  const taskById = {}
  sa(tasks).forEach(t => { taskById[t.id] = t })

  async function toggleAttempt(a) {
    setErr('')
    if (expandedId === a.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(a.id)
    if (corrStatus[a.id]) return
    setCorrStatus(s => ({ ...s, [a.id]: 'loading' }))
    try {
      const c = await getCorrectionByAttemptID(a.id)
      setCorrMap(m => ({ ...m, [a.id]: c }))
      setCorrStatus(s => ({ ...s, [a.id]: 'ready' }))
    } catch {
      setCorrStatus(s => ({ ...s, [a.id]: 'none' }))
    }
  }

  async function genFeedback(a, type) {
    setErr('')
    setCorrStatus(s => ({ ...s, [a.id]: 'loading' }))
    try {
      const c = await generateCorrection(a.id, type)
      setCorrMap(m => ({ ...m, [a.id]: c }))
      setCorrStatus(s => ({ ...s, [a.id]: 'ready' }))
    } catch (e) {
      setCorrStatus(s => ({ ...s, [a.id]: 'error' }))
      setErr(e.message || 'Não foi possível gerar o feedback.')
    }
  }

  const filtered = sa(attempts)
    .filter(a => {
      const content = attemptContent(a)
      const t = content.type || taskById[a.task_id]?.type || ''
      if (typeFilter !== 'all' && t !== typeFilter) return false
      if (taskFilter !== 'all' && a.task_id !== taskFilter) return false
      return true
    })
    .slice()
    .sort((x, y) => new Date(y.created_at || 0) - new Date(x.created_at || 0))

  const scores = sa(attempts).map(a => a.score).filter(s => typeof s === 'number')
  const conquered = scores.filter(s => s >= 0.7).length
  const bestScore = scores.length ? Math.round(Math.max(...scores) * 100) : null

  function renderFeedback(a, task) {
    const st = corrStatus[a.id] || 'none'
    const type = a.type || task?.type || attemptContent(a).type

    if (st === 'ready' && corrMap[a.id]) {
      const c = corrMap[a.id]
      const fb = typeof c === 'string' ? c : c?.feedback
      const cScore = typeof c === 'string' ? null : c?.score
      return (
        <div style={fbCard}>
          <div style={fbEyebrow}><IconSpark /> Feedback</div>
          {typeof cScore === 'number' && cScore >= 0 && <div style={fbScore}>Nota sugerida: {Math.round(cScore * 100)}%</div>}
          {fb ? <p style={fbText}>{fb}</p> : <p style={muted}>Este feedback está vazio.</p>}
        </div>
      )
    }

    if (st === 'loading') {
      return (
        <div style={{ ...loadingWrap, padding: '14px 0' }}>
          <Spinner /> Gerando feedback…
        </div>
      )
    }

    return (
      <div style={fbCard}>
        <div style={fbEyebrow}><IconSpark /> Feedback</div>
        <p style={muted}>Este feedback ainda não foi gerado.</p>
        <button type="button" onClick={() => genFeedback(a, type)} style={btnSm}>
          {st === 'error' ? 'Tentar novamente' : 'Gerar feedback'} <IconSpark />
        </button>
      </div>
    )
  }

  function renderQuizDetail(a, task) {
    const taskContent = tryParse(task?.content) || {}
    const questions = sa(taskContent.questions)
    const items = sa(attemptEval(a)?.items)

    if (!items.length) {
      return <p style={muted}>Sem detalhamento de acertos para esta tentativa.</p>
    }

    return items.map((it, i) => {
      const idx = it.question_index ?? i
      const q = questions[idx] || {}
      const alts = sa(q.options || q.alternatives)
      const ok = !!it.correct
      const sub = it.submitted_answer
      const cor = it.correct_answer
      return (
        <div key={i} style={{ ...reviewRow, ...(ok ? reviewRowOk : reviewRowBad) }}>
          <div style={reviewHead}>
            {ok ? <IconCheck /> : <IconX />}
            <span style={{ ...reviewTitle, color: ok ? '#0E7A55' : '#B23A3A' }}>Questão {idx + 1}</span>
            {alts.length && <span style={{ marginLeft: 'auto', color: '#8A8AA3', fontSize: 11.5, fontWeight: 700 }}>Sua: {answerLabel(alts, sub)}</span>}
          </div>
          {!ok && alts.length > 0 && <p style={reviewMuted}>Correta: {answerLabel(alts, cor)}</p>}
          {it.explanation && <p style={{ ...reviewMuted, fontStyle: 'italic' }}>{it.explanation}</p>}
        </div>
      )
    })
  }

  function renderDetail(a) {
    const task = taskById[a.task_id]
    const type = a.type || task?.type || attemptContent(a).type
    const content = attemptContent(a)
    const isQuiz = type === 'quiz'

    return (
      <div style={detailBox}>
        {isQuiz ? (
          <div style={detailLabel}>Análise da tentativa</div>
        ) : (
          <div style={detailLabel}>Suas palavras</div>
        )}

        {isQuiz ? (
          renderQuizDetail(a, task)
        ) : (
          <p style={respText}>{content.response || '—'}</p>
        )}

        {renderFeedback(a, task)}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={page}>
        <GlobalStyles />
        <div style={header}>
          <button type="button" onClick={() => navigate('/home')} style={iconNavBtn} aria-label="Voltar"><IconArrowLeft /></button>
          <span style={headerTitle}>Histórico</span>
          <span style={{ width: 36 }} />
        </div>
        <div style={box}>
          <div style={loadingWrap}><Spinner /> Carregando histórico…</div>
        </div>
      </div>
    )
  }

  const hasAttempts = sa(attempts).length > 0

  return (
    <div style={page}>
      <GlobalStyles />
      <div style={header}>
        <button type="button" onClick={() => navigate('/home')} style={iconNavBtn} aria-label="Voltar"><IconArrowLeft /></button>
        <span style={headerTitle}>Histórico de estudo</span>
        <button type="button" onClick={() => window.location.reload()} style={iconNavBtn} aria-label="Atualizar"><IconRefresh /></button>
      </div>

      <div style={box}>
        {err && <div style={errStyle}><IconAlert /> {err}</div>}

        {!hasAttempts && !err ? (
          <div style={{ ...card, ...emptyWrap }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1E1E32', marginBottom: 6 }}>Nenhuma tentativa ainda</div>
            <p style={muted}>Resolva algumas tarefas no seu roadmap e seus resultados aparecem aqui.</p>
            <button type="button" onClick={() => navigate('/home')} style={btnSm}>Ir para o roadmap</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              <div style={statCard}>
                <div style={statNum}>{sa(attempts).length}</div>
                <div style={statCaption}>Tentativas</div>
              </div>
              <div style={statCard}>
                <div style={{ ...statNum, color: '#0E7A55' }}>{conquered}</div>
                <div style={statCaption}>Conquistados</div>
              </div>
              <div style={statCard}>
                <div style={statNum}>{bestScore === null ? '—' : `${bestScore}%`}</div>
                <div style={statCaption}>Melhor acerto</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={select} aria-label="Filtrar por tipo">
                <option value="all">Todos os tipos</option>
                <option value="quiz">Quiz</option>
                <option value="essay">Redação</option>
              </select>
              <select value={taskFilter} onChange={e => setTaskFilter(e.target.value)} style={select} aria-label="Filtrar por tarefa">
                <option value="all">Todas as tarefas</option>
                {sa(tasks).map(t => (
                  <option key={t.id} value={t.id}>{t.meta?.title || `Tarefa ${t.id?.slice(0, 8)}`}</option>
                ))}
              </select>
            </div>

            {filtered.length === 0 ? (
              <div style={emptyWrap}>
                <p style={muted}>Nenhuma tentativa encontrada com esses filtros.</p>
              </div>
            ) : (
              filtered.map(a => {
                const task = taskById[a.task_id]
                const type = a.type || task?.type || attemptContent(a).type
                const score = typeof a.score === 'number' ? a.score : null
                const pct = score === null ? null : Math.round(score * 100)
                const open = expandedId === a.id
                const scoreColor = score === null ? '#B7B7CC' : pct >= 70 ? '#3ECF8E' : pct >= 40 ? '#F5C542' : '#F06A6A'
                const scoreBg = score === null ? 'rgba(99,130,255,0.1)' : 'rgba(255,255,255,1)'

                return (
                  <div key={a.id} style={attemptCard}>
                    <button type="button" onClick={() => toggleAttempt(a)} style={attemptHead}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={attemptTitle}>{taskTitle(task, a.task_id)}</div>
                        <div style={metaRow}>
                          <span style={{ ...badge, color: typeColor(type), background: `${typeColor(type)}1a` }}>{typeLabel(type)}</span>
                          <span style={dateTxt}>{fmtDate(a.created_at)}</span>
                        </div>
                      </div>
                      <div style={scoreWrap}>
                        {score === null ? (
                          <span style={{ ...scoreChip, background: scoreBg, color: '#6382FF' }}>FEEDBACK</span>
                        ) : (
                          <span style={{ ...scoreChip, background: scoreBg, color: scoreColor }}>{pct}%</span>
                        )}
                        <span style={chevCol}><IconChevron open={open} /></span>
                      </div>
                    </button>
                    {open && renderDetail(a)}
                  </div>
                )
              })
            )}
          </>
        )}
      </div>
    </div>
  )
}