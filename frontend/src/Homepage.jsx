// ─── REACT DO CELLBIT ────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { listGoals, createGoal, generateRoadmap, generateTask, submitAttempt, authFetch, logout as apiLogout, refreshSession } from './api'

// ─── ÍCONES ──────────────────────────────────────────────────
const IcoHome   = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
const IcoMap    = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
const IcoUser   = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IcoLogout = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const IcoSend   = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
const IcoBack   = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
const IcoLock   = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const IcoStar   = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
const IcoCheck  = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoPlus   = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const Spin      = ()       => <svg style={{animation:'spin .7s linear infinite'}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10" strokeOpacity=".2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>

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
  dim:     'rgba(240,242,255,0.18)',
}

// ─── HELPERS ─────────────────────────────────────────────────
function getAvailableTopics(topics, dependencies, completedIds=[]) {
  const depMap = {}
  dependencies.forEach(d => {
    if (!depMap[d.topic_id]) depMap[d.topic_id] = []
    depMap[d.topic_id].push(d.depends_on)
  })
  const childIds = new Set(topics.filter(t => t.parent_topic_id).map(t => t.parent_topic_id))
  return topics
    .filter(t => !childIds.has(t.id))
    .map(t => ({
      ...t,
      blocked: (depMap[t.id]||[]).some(depId => !completedIds.includes(depId))
    }))
}

// ─── MONTANHA SVG (versão do segundo arquivo) ──────────────
function MountainScene({ height }) {
  const farY = height * 0.4, midY = height * 0.6, nearY = height * 0.82
  const jaggedPeaks = (baseY, amp, seed, w = 800) => {
    const pts = [`0,${baseY + amp}`]
    const steps = 8
    for (let i = 0; i <= steps; i++) {
      const x = (w / steps) * i
      const n = Math.sin(i * 12.9898 + seed) * 43758.5453
      const frac = n - Math.floor(n)
      const y = baseY - frac * amp
      pts.push(`${x},${y}`)
    }
    pts.push(`${w},${baseY + amp}`)
    return pts.join(' ')
  }
  return (
    <svg width="100%" height={height} viewBox={`0 0 800 ${height}`} preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <rect x="0" y="0" width="800" height={height} fill={C.bg} />
      <polygon points={`0,${height} ${jaggedPeaks(farY, height * 0.12, 1.3)} 800,${height}`} fill={C.surface} />
      <polygon points={`0,${height} ${jaggedPeaks(midY, height * 0.1, 4.7)} 800,${height}`} fill={C.bg} />
      <polygon points={`0,${height} ${jaggedPeaks(nearY, height * 0.08, 8.2)} 800,${height}`} fill={C.surface} />
    </svg>
  )
}

// ─── TRILHA + BANDEIRA ──────────────────────────────────────
function TrailPath({ points, progressRatio }) {
  const ref = useRef(null)
  const [len, setLen] = useState(0)
  useEffect(() => { if (ref.current) setLen(ref.current.getTotalLength()) }, [points])
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', overflow: 'visible' }}>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.6" strokeDasharray="1.5 2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path ref={ref} d={d} fill="none" stroke={C.blue} strokeWidth="0.7" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        style={{
          strokeDasharray: len, strokeDashoffset: len - len * Math.min(progressRatio, 1),
          transition: 'stroke-dashoffset .6s ease',
        }} />
    </svg>
  )
}

function SummitFlag({ x, top }) {
  return (
    <div style={{ position: 'absolute', left: `${x}%`, top: top - 80, transform: 'translateX(-50%)', zIndex: 3, pointerEvents: 'none' }}>
      <div style={{ width: 2, height: 54, background: C.border, margin: '0 auto' }} />
      <svg width="34" height="24" viewBox="0 0 34 24" style={{ position: 'absolute', top: 0, left: '50%' }}>
        <polygon points="1,1 25,1 18,7 25,13 1,13" fill={C.yellow} />
      </svg>
    </div>
  )
}

// ─── NÓ DA TRILHA ────────────────────────────────────────────
function TrailNode({ topic, index, top, x, state, onSelect, onStart, hovered, onHover }) {
  const { isCompleted, isActive, isNext, isLocked } = state
  const showStart = hovered && !isLocked && !isCompleted

  return (
    <div
      data-index={index}
      onMouseEnter={() => onHover(topic.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => !isLocked && !isCompleted && onSelect(index)}
      style={{
        position: 'absolute', left: `${x}%`, top, transform: 'translate(-50%, -50%)', zIndex: 4,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        cursor: (isLocked || isCompleted) ? 'default' : 'pointer',
      }}
    >
      {showStart && (
        <button onClick={e => { e.stopPropagation(); onStart(topic, index) }} style={startPill}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          Iniciar
        </button>
      )}

      <div style={nodeCircle(isActive, isCompleted, isLocked, isNext)}>
        {isCompleted ? <IcoCheck s={18} /> : isLocked ? <IcoLock s={15} /> : <span style={{ fontWeight: 800, fontSize: 15 }}>{index + 1}</span>}
      </div>

      <div style={nodeLabel(isLocked, isActive)}>{topic.title}</div>
      {isNext && !hovered && !isCompleted && <div style={nextBadge}>Próximo</div>}
    </div>
  )
}

// ─── CHAT PANEL (idêntico ao original) ──────────────────────
function ChatPanel({ task, onBack }) {
  const [answers, setAnswers] = useState({})
  const [essay,   setEssay]   = useState('')
  const [result,  setResult]  = useState(null)
  const [err,     setErr]     = useState('')
  const [load,    setLoad]    = useState(false)

  const isQuiz  = task.type === 'quiz'
  const content = task.content
  const meta    = { title: content?.title||task.meta?.title||'Tarefa', description: content?.description||task.meta?.description||'', expectations: content?.expectation||task.meta?.expectations||'' }

  async function handleSubmit() {
    setErr(''); setLoad(true)
    try {
      let response
      if (isQuiz) {
        response = Object.entries(answers).map(([qi,ans]) => ({ question_index:parseInt(qi), answer:ans }))
        if (response.length < (content.questions||[]).length) { setErr('Responda todas as perguntas.'); setLoad(false); return }
      } else {
        if (!essay.trim()||essay.trim().split(/\s+/).length<(content.min_words||0)) { setErr(`Mínimo de ${content.min_words} palavras.`); setLoad(false); return }
        response = essay.trim()
      }
      const data = await submitAttempt(task.id, task.type, response)
      setResult(data)
    } catch(er) { setErr(er.message) }
    finally { setLoad(false) }
  }

  if (result) {
    const score    = result.task_attempt?.score || 0
    const evalData = result.task_attempt?.task_evaluation
    let ev = null; try { ev = typeof evalData==='string'?JSON.parse(evalData):evalData } catch(_) {}
    const pct = Math.round(score*100)
    const mc  = score>=0.7?C.green:score>=0.4?C.yellow:C.red

    return (
      <div style={pgStyle}>
        <div style={boxStyle}>
          <div style={{ textAlign:'center', padding:'32px 24px', background:C.surface, borderRadius:16, border:`1px solid ${mc}44`, marginBottom:20 }}>
            <div style={{ fontSize:56, fontWeight:900, color:mc, lineHeight:1 }}>{pct}%</div>
            <div style={{ fontSize:14, color:C.muted, marginTop:4 }}>de acertos</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.text, marginTop:10 }}>{score>=0.7?'Excelente!':score>=0.4?'Bom esforço!':'Continue tentando!'}</div>
          </div>
          {isQuiz && ev?.items && (
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {ev.items.map((item,i) => {
                const q    = content.questions?.[i]
                const opts = q?.options||q?.alternatives||[]
                return (
                  <div key={i} style={{ padding:'12px 16px', borderRadius:10, border:`1px solid ${item.correct?'rgba(62,207,142,0.2)':'rgba(240,106,106,0.2)'}`, background:item.correct?'rgba(62,207,142,0.04)':'rgba(240,106,106,0.04)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ color:item.correct?C.green:C.red, fontWeight:700, fontSize:13 }}>{item.correct?'✓':'✗'} Q{i+1}</span>
                      <span style={{ fontSize:12, color:C.muted, marginLeft:'auto' }}>Sua: {opts[item.submitted_answer]||item.submitted_answer}</span>
                    </div>
                    {!item.correct && <p style={{ fontSize:12, color:C.muted, margin:'4px 0 0', lineHeight:1.5 }}>Correta: {opts[item.correct_answer]}</p>}
                    {item.explanation && <p style={{ fontSize:12, color:C.muted, margin:'4px 0 0', lineHeight:1.5, fontStyle:'italic' }}>{item.explanation}</p>}
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onBack} style={btnSec}>Voltar</button>
            <button onClick={() => { setResult(null); setAnswers({}); setEssay('') }} style={{ ...btnPri, flex:1 }}>Tentar novamente</button>
          </div>
        </div>
        <style>{ANIMS}</style>
      </div>
    )
  }

  return (
    <div style={pgStyle}>
      <div style={boxStyle}>
        <button onClick={onBack} style={backLnk}><IcoBack s={14}/> Voltar</button>
        <div style={{ marginBottom:24, paddingBottom:20, borderBottom:`1px solid ${C.border}` }}>
          <span style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:isQuiz?C.blue:C.green, background:isQuiz?'rgba(99,130,255,0.1)':'rgba(62,207,142,0.1)', padding:'3px 10px', borderRadius:20, border:`1px solid ${isQuiz?'rgba(99,130,255,0.2)':'rgba(62,207,142,0.2)'}`, display:'inline-block', marginBottom:12 }}>
            {isQuiz?'Quiz':'Dissertação'}
          </span>
          <h1 style={{ fontSize:22, fontWeight:900, color:C.text, letterSpacing:'-0.4px', marginBottom:8 }}>{meta.title}</h1>
          <p style={{ fontSize:14, color:C.muted, lineHeight:1.65 }}>{meta.description}</p>
        </div>

        {isQuiz && (content.questions||[]).map((q,qi) => (
          <div key={qi} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20, marginBottom:12 }}>
            {q.material && <div style={{ fontSize:11, fontWeight:700, color:'#9ab4ff', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:8 }}>{q.material}</div>}
            <p style={{ fontSize:15, color:C.text, lineHeight:1.65, marginBottom:14 }}><span style={{ color:C.blue, fontWeight:700, marginRight:6 }}>{qi+1}.</span>{q.question||q.statement}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(q.options||q.alternatives||[]).map((alt,ai) => {
                const sel = answers[qi]===ai
                return (
                  <button key={ai} onClick={() => setAnswers(p=>({...p,[qi]:ai}))}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderRadius:9, border:`1.5px solid ${sel?C.blue:C.border}`, background:sel?'rgba(99,130,255,0.1)':'rgba(255,255,255,0.02)', color:sel?C.text:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:500, textAlign:'left', transition:'all .15s' }}>
                    <span style={{ width:24, height:24, borderRadius:6, background:sel?C.blue:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:sel?'#fff':'rgba(245,244,255,0.4)', flexShrink:0 }}>{String.fromCharCode(65+ai)}</span>
                    {alt}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {!isQuiz && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20, marginBottom:12 }}>
            <p style={{ fontSize:15, color:C.text, lineHeight:1.65, marginBottom:10 }}>{content.instructions}</p>
            <p style={{ fontSize:12, color:C.muted, marginBottom:10 }}>{content.min_words}–{content.max_words} palavras</p>
            <textarea value={essay} onChange={e=>{setEssay(e.target.value);setErr('')}} placeholder="Escreva sua resposta aqui…" rows={10}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, fontFamily:'inherit', fontSize:14, padding:'12px 14px', outline:'none', resize:'vertical', lineHeight:1.6, boxSizing:'border-box' }}/>
            <p style={{ fontSize:12, color:C.muted, marginTop:6 }}>{essay.trim()?essay.trim().split(/\s+/).length:0} palavras</p>
          </div>
        )}

        {err && <div style={errBox}>{err}</div>}
        <button onClick={handleSubmit} disabled={load} style={{ ...btnPri, width:'100%', padding:'14px', fontSize:15, opacity:load?0.6:1, marginTop:8 }}>
          {load?<><Spin/> Enviando…</>:'Enviar resposta'}
        </button>
      </div>
      <style>{ANIMS}</style>
    </div>
  )
}

// ─── PERFIL VIEW (idêntico ao original) ─────────────────────
function ProfileView({ profile, email }) {
  const level    = profile?.level||1
  const xp       = profile?.xp||0
  const xpNext   = level*100
  const pct      = Math.min(100, Math.round((xp%xpNext)/xpNext*100))
  const username = profile?.username||email?.split('@')[0]||'Usuário'

  return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'40px 20px', width:'100%' }}>
      <h2 style={{ fontSize:22, fontWeight:900, color:C.text, letterSpacing:'-0.04em', marginBottom:28 }}>Perfil</h2>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:24, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
          <div style={{ width:52, height:52, borderRadius:'50%', background:`linear-gradient(135deg,${C.blue},${C.blueD})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800, color:'#fff', flexShrink:0 }}>
            {username[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:C.text }}>{username}</div>
            <div style={{ fontSize:13, color:C.muted }}>{email}</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
          {[{l:'Nível',v:level,c:C.blue},{l:'XP total',v:xp,c:C.yellow},{l:'Próximo nível',v:`${xpNext-xp} XP`,c:C.green}].map(({l,v,c}) => (
            <div key={l} style={{ padding:'12px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2, fontWeight:600 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:12, color:C.muted, display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span>Progresso nível {level}</span><span>{pct}%</span>
        </div>
        <div style={{ height:6, background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background:`linear-gradient(90deg,${C.blue},${C.blueD})`, borderRadius:99, transition:'width .5s ease' }}/>
        </div>
      </div>
    </div>
  )
}

// ─── HOMEPAGE ─────────────────────────────────────────────────
export default function Homepage() {
  const navigate = useNavigate()
  const [view,      setView]      = useState('home')
  const [email,     setEmail]     = useState('')
  const [profile,   setProfile]   = useState(null)
  const [task,      setTask]      = useState(null)
  const [goals,     setGoals]     = useState([])
  const [input,     setInput]     = useState('')
  const [rmStep,    setRmStep]    = useState('input')
  const [topics,    setTopics]    = useState([])
  const [deps,      setDeps]      = useState([])
  const [completed, setCompleted] = useState([])
  const [curGoal,   setCurGoal]   = useState(null)
  const [err,       setErr]       = useState('')
  const [loadInit,  setLoadInit]  = useState(true)
  const [loadGen,   setLoadGen]   = useState(false)
  const [tooltip,   setTooltip]   = useState(null)
  // Estados específicos do visual da montanha
  const [hoveredId, setHoveredId] = useState(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    async function init() {
      try { await refreshSession() } catch { navigate('/auth/login'); return }
      try {
        const res = await authFetch('/auth/me')
        const d   = await res.json()
        if (!res.ok) { navigate('/auth/login'); return }
        setEmail(d.user?.email||'')
      } catch { navigate('/auth/login'); return }
      try {
        const res = await authFetch('/protected/profile')
        const d   = await res.json()
        if (res.ok) setProfile(d.profile)
      } catch(_) {}
      try { const gl = await listGoals(); setGoals(gl||[]) } catch(_) {}
      finally { setLoadInit(false) }
    }
    init()
  }, [navigate])

  // ─── FUNÇÕES ORIGINAIS (mantidas intactas) ──────────────
  async function handleSend() {
    if (!input.trim()) return
    setErr(''); setLoadGen(true)
    try {
      const goal    = await createGoal(input.trim(), {})
      const roadmap = await generateRoadmap(goal.id)
      setTopics(roadmap.topics||[])
      setDeps(roadmap.dependencies||[])
      setCurGoal(goal)
      setGoals(prev => [goal, ...prev])
      setRmStep('map')
      setView('roadmap')
    } catch(er) { setErr(er.message) }
    finally { setLoadGen(false) }
  }

  async function handleGoalClick(goal) {
    setErr(''); setLoadGen(true)
    try {
      const roadmap = await generateRoadmap(goal.id)
      setTopics(roadmap.topics||[])
      setDeps(roadmap.dependencies||[])
      setCurGoal(goal)
      setRmStep('map')
      setView('roadmap')
    } catch(er) { setErr(er.message) }
    finally { setLoadGen(false) }
  }

  // Função que gera a tarefa (chamada pelo botão "Iniciar" no nó)
  async function handleTopicClick(t) {
    setErr(''); setLoadGen(true)
    try { const gen = await generateTask(t.id); setTask(gen) }
    catch(er) { setErr(er.message) }
    finally { setLoadGen(false) }
  }

  function handleLogout() { apiLogout(); navigate('/auth/login') }

  // ─── LÓGICA DE DISPONIBILIDADE (original) ────────────────
  const available = getAvailableTopics(topics, deps, completed)
  const topicStates = {}
  topics.forEach(t => {
    const avail = available.find(a => a.id === t.id)
    const isCompleted = completed.includes(t.id)
    const isLocked = avail ? avail.blocked : true
    topicStates[t.id] = { isCompleted, isLocked }
  })

  // Próximo índice disponível (não concluído e não bloqueado)
  const nextAvailableIndex = topics.findIndex(t => {
    const st = topicStates[t.id]
    return !st.isCompleted && !st.isLocked
  })

  // Geometria da trilha
  const points = topics.map((_, i) => {
    const GAP = 140
    const wave = Math.sin(i * 0.85) * 20
    return { x: 50 + wave, y: 130 + i * GAP }
  })
  const canvasHeight = topics.length ? points[points.length-1].y + 280 : 640
  const topPxOf = idx => canvasHeight - (points[idx]?.y ?? 0)

  // Scroll inicial para mostrar topo e depois descer (efeito do segundo arquivo)
  useEffect(() => {
    if (!curGoal || topics.length === 0 || !canvasRef.current) return
    const el = canvasRef.current
    el.scrollTop = 0
    const target = el.scrollHeight - el.clientHeight
    const t = setTimeout(() => {
      // animação suave
      const start = el.scrollTop
      const diff = target - start
      const duration = 1200
      const startTime = performance.now()
      function step(now) {
        const p = Math.min((now - startTime) / duration, 1)
        const ease = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2
        el.scrollTop = start + diff * ease
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, 3000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curGoal, topics.length])

  // ─── RENDER ──────────────────────────────────────────────
  if (task) return <ChatPanel task={task} onBack={() => setTask(null)} />

  const NAV = [
    { key:'home',    Icon:IcoHome,  label:'Início' },
    { key:'roadmap', Icon:IcoMap,   label:'Roadmap' },
    { key:'profile', Icon:IcoUser,  label:'Perfil' },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', background:C.bg, color:C.text }}>

      {/* SIDEBAR (original) */}
      <aside style={{ width:56, flexShrink:0, borderRight:`1px solid ${C.border}`, padding:'0 8px', display:'flex', flexDirection:'column', background:'rgba(255,255,255,0.015)' }}>
        <div style={{ padding:'18px 0 16px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'center', marginBottom:8 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:`linear-gradient(135deg,${C.blue},${C.blueD})` }}/>
        </div>
        <nav style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
          {NAV.map(({ key, Icon, label }) => {
            const active = view===key
            return (
              <div key={key} style={{ position:'relative' }}
                onMouseEnter={() => setTooltip(key)} onMouseLeave={() => setTooltip(null)}>
                <button onClick={() => setView(key)}
                  style={{ width:'100%', padding:'11px 0', borderRadius:10, border:'none', background:active?`rgba(99,130,255,0.14)`:'transparent', color:active?C.blue:C.muted, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all .15s' }}>
                  <Icon s={19}/>
                </button>
                {tooltip===key && (
                  <div style={{ position:'absolute', left:52, top:'50%', transform:'translateY(-50%)', background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:600, color:C.text, whiteSpace:'nowrap', zIndex:100, pointerEvents:'none', boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>
                    {label}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, marginBottom:8 }}>
          <button onClick={handleLogout}
            onMouseEnter={e=>e.currentTarget.style.color=C.red} onMouseLeave={e=>e.currentTarget.style.color=C.muted}
            style={{ width:'100%', padding:'11px 0', borderRadius:10, border:'none', background:'transparent', color:C.muted, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'color .15s' }}>
            <IcoLogout s={18}/>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* HOME (original) */}
        {view==='home' && (
          <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
            <div style={{ flex:1, position:'relative', overflow:'hidden', minHeight:180 }}>
              <div style={{ position:'absolute', bottom:0, left:0, right:0 }}>
                <svg viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', display:'block' }}>
                  <defs>
                    <linearGradient id="mL" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2a3a7c"/><stop offset="100%" stopColor="#141930"/></linearGradient>
                    <linearGradient id="mM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3d5af1"/><stop offset="100%" stopColor="#1e2d6b"/></linearGradient>
                    <linearGradient id="mR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#253070"/><stop offset="100%" stopColor="#141930"/></linearGradient>
                    <linearGradient id="sn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0f2ff" stopOpacity="0.95"/><stop offset="100%" stopColor="#c8d4ff" stopOpacity="0.3"/></linearGradient>
                  </defs>
                  <path d="M0,300 L160,90 L320,300 Z" fill="url(#mL)" opacity="0.55"/>
                  <path d="M480,300 L640,70 L800,300 Z" fill="url(#mR)" opacity="0.55"/>
                  <path d="M200,300 L400,22 L600,300 Z" fill="url(#mM)"/>
                  <path d="M400,22 L600,300 L400,300 Z" fill="#0f1535" opacity="0.22"/>
                  <path d="M400,22 L368,78 L400,62 L432,78 Z" fill="url(#sn)"/>
                  <path d="M400,22 L384,52 L400,44 L416,52 Z" fill="#f0f2ff" opacity="0.92"/>
                  <path d="M0,248 Q200,228 400,242 Q600,256 800,238 L800,300 L0,300 Z" fill={C.bg} opacity="0.65"/>
                  <path d="M0,270 Q400,255 800,270 L800,300 L0,300 Z" fill={C.bg}/>
                </svg>
              </div>
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px 20px 80px' }}>
                <h1 style={{ fontSize:'clamp(22px,3.5vw,34px)', fontWeight:900, color:C.text, letterSpacing:'-0.04em', textAlign:'center', lineHeight:1.1, marginBottom:8, textShadow:'0 2px 20px rgba(0,0,0,0.6)' }}>
                  O que você quer aprender?
                </h1>
                <p style={{ fontSize:14, color:C.muted, textAlign:'center', marginBottom:24 }}>
                  Digite qualquer assunto e a IA cria seu caminho.
                </p>
                <div style={{ width:'100%', maxWidth:460, background:'rgba(15,17,23,0.82)', backdropFilter:'blur(14px)', border:`1.5px solid rgba(99,130,255,0.22)`, borderRadius:14, display:'flex', alignItems:'flex-end', gap:8, padding:'13px 13px 13px 17px' }}>
                  <textarea value={input} onChange={e=>setInput(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()} }}
                    placeholder="Ex: Funções do segundo grau, Revolução Francesa..."
                    rows={2}
                    style={{ flex:1, background:'none', border:'none', outline:'none', color:C.text, fontFamily:'inherit', fontSize:14, lineHeight:1.6, resize:'none', padding:0 }}/>
                  <button onClick={handleSend} disabled={!input.trim()||loadGen}
                    style={{ width:36, height:36, borderRadius:9, border:'none', background:input.trim()?C.blue:'rgba(255,255,255,0.06)', color:input.trim()?'#fff':'rgba(245,244,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', cursor:input.trim()?'pointer':'default', transition:'all .2s', flexShrink:0 }}>
                    {loadGen?<Spin/>:<IcoSend s={13}/>}
                  </button>
                </div>
                {err && <div style={{ ...errBox, marginTop:12, maxWidth:460, width:'100%' }}>{err}</div>}
              </div>
            </div>

            {goals.length>0 && (
              <div style={{ padding:'16px 24px', borderTop:`1px solid ${C.border}` }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'rgba(240,242,255,0.22)', marginBottom:10 }}>Continue de onde parou</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {goals.slice(0,6).map(g => (
                    <button key={g.id} onClick={() => handleGoalClick(g)}
                      style={{ padding:'7px 14px', borderRadius:99, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.03)', color:C.muted, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', whiteSpace:'nowrap' }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(99,130,255,0.3)';e.currentTarget.style.color=C.text}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted}}>
                      {g.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ROADMAP — AGORA COM O VISUAL DA MONTANHA */}
        {view==='roadmap' && (
          <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
            <div style={{ padding:'18px 24px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div>
                <h2 style={{ fontSize:17, fontWeight:800, color:C.text, letterSpacing:'-0.03em' }}>{curGoal?.title||'Roadmap'}</h2>
                <p style={{ fontSize:12, color:C.muted, marginTop:2 }}>Passe o mouse num nó para iniciar.</p>
              </div>
              <button onClick={() => { setView('home'); setRmStep('input'); setCurGoal(null) }}
                style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:`1px solid ${C.border}`, borderRadius:8, color:C.muted, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', padding:'6px 12px', transition:'color .15s' }}
                onMouseEnter={e=>e.currentTarget.style.color=C.text} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>
                <IcoPlus s={13}/> Novo
              </button>
            </div>

            {rmStep==='input' && !loadGen && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, padding:'40px 20px' }}>
                <p style={{ fontSize:15, color:C.muted, marginBottom:20, textAlign:'center' }}>Escolha um objetivo para ver o roadmap.</p>
                <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:380 }}>
                  {goals.slice(0,6).map(g => (
                    <button key={g.id} onClick={() => handleGoalClick(g)}
                      style={{ padding:'12px 16px', borderRadius:10, border:`1px solid ${C.border}`, background:C.surface, color:C.muted, fontSize:14, fontWeight:500, textAlign:'left', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}
                      onMouseEnter={e=>{e.currentTarget.style.background='rgba(99,130,255,0.08)';e.currentTarget.style.borderColor='rgba(99,130,255,0.22)';e.currentTarget.style.color=C.text}}
                      onMouseLeave={e=>{e.currentTarget.style.background=C.surface;e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted}}>
                      {g.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadGen && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, gap:8, color:C.muted, fontSize:14 }}>
                <Spin/> {rmStep==='input'?'Gerando roadmap…':'Gerando tarefa…'}
              </div>
            )}

            {rmStep==='map' && topics.length>0 && !loadGen && (
              <div ref={canvasRef} style={{ flex:1, position:'relative', overflowY:'auto', overflowX:'hidden' }}>
                <div style={{ position:'relative', width:'100%', height: canvasHeight }}>
                  <MountainScene height={canvasHeight} />
                  <div style={{ position:'relative', zIndex:2, textAlign:'center', padding:'48px 24px 12px' }}>
                    <span style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'1.4px', textTransform:'uppercase', color:C.blue, marginBottom:10, borderTop:`2px solid ${C.blue}`, paddingTop:6, width:68 }}>Trilha ativa</span>
                    <h2 style={{ fontSize:'clamp(1.6rem,3.4vw,2.2rem)', fontWeight:900, letterSpacing:'-0.03em', color:C.text, margin:'2px 0' }}>{curGoal?.title}</h2>
                    <p style={{ fontSize:13, color:C.muted }}>Passe o mouse num nó para iniciar. Clique para revisar.</p>
                  </div>

                  <TrailPath points={points} progressRatio={completed.length / Math.max(topics.length, 1)} />
                  <SummitFlag x={points[points.length-1]?.x ?? 50} top={topPxOf(points.length-1)} />

                  {topics.map((topic, index) => {
                    const st = topicStates[topic.id] || { isCompleted: false, isLocked: true }
                    const isActive = index === nextAvailableIndex && !st.isCompleted
                    return (
                      <TrailNode
                        key={topic.id}
                        topic={topic}
                        index={index}
                        top={topPxOf(index)}
                        x={points[index].x}
                        state={{
                          isCompleted: st.isCompleted,
                          isActive: isActive,
                          isNext: index === nextAvailableIndex && !st.isCompleted && !st.isLocked,
                          isLocked: st.isLocked || st.isCompleted,
                        }}
                        hovered={hoveredId === topic.id}
                        onHover={setHoveredId}
                        onSelect={(idx) => {
                          const t = topics[idx]
                          if (!t) return
                          const s = topicStates[t.id]
                          if (s.isCompleted || s.isLocked) return
                          const canvas = canvasRef.current
                          if (canvas) {
                            const card = canvas.querySelector(`[data-index="${idx}"]`)
                            if (card) card.scrollIntoView({ behavior:'smooth', block:'center' })
                          }
                        }}
                        onStart={(topic, idx) => handleTopicClick(topic)}
                      />
                    )
                  })}
                </div>
                {err && <div style={{ ...errBox, position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:6, maxWidth:480 }}>{err}</div>}
              </div>
            )}
          </div>
        )}

        {/* PERFIL (original) */}
        {view==='profile' && !loadInit && <ProfileView profile={profile} email={email}/>}

        {loadInit && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, gap:8, color:C.muted, fontSize:14 }}>
            <Spin/> Carregando…
          </div>
        )}
      </main>
      <style>{ANIMS}</style>
    </div>
  )
}

// ─── ESTILOS (mantidos os originais, com acréscimos visuais) ──
const ANIMS = `
  @keyframes spin { to { transform: rotate(360deg) } }
  button:active { transform: scale(0.97) }
  textarea::placeholder { color: rgba(240,242,255,0.28) }
  textarea:focus { outline: none }
  ::-webkit-scrollbar { display: none }
`

const pgStyle  = { minHeight:'100vh', background:C.bg, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'48px 20px', fontFamily:"'Inter',-apple-system,sans-serif" }
const boxStyle = { width:'100%', maxWidth:660 }
const backLnk  = { display:'inline-flex', alignItems:'center', gap:6, background:'none', border:'none', color:C.muted, fontSize:13, fontWeight:600, cursor:'pointer', padding:0, marginBottom:24, fontFamily:'inherit', transition:'color .15s' }
const errBox   = { background:'rgba(240,106,106,0.08)', border:'1px solid rgba(240,106,106,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:500, color:C.red, lineHeight:1.45 }
const btnPri   = { display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px 24px', border:'none', borderRadius:10, background:C.blue, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'opacity .15s' }
const btnSec   = { display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px 24px', border:`1px solid ${C.border}`, borderRadius:10, background:'rgba(255,255,255,0.04)', color:C.text, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', flex:1 }

// ─── ESTILOS DOS COMPONENTES DA MONTANHA ────────────────────
const nodeCircle = (active, completed, locked, next) => ({
  width: 54, height: 54, borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: completed ? C.green : (active || next) ? C.blue : C.surface,
  border: locked ? `2px dashed ${C.border}` : `2px solid ${C.border}`,
  color: locked ? C.muted : '#fff',
  opacity: locked ? 0.6 : 1,
})
const nodeLabel = (locked, active) => ({ fontSize: 12.5, fontWeight: active ? 800 : 600, color: locked ? C.muted : C.text, maxWidth: 128, textAlign: 'center', lineHeight: 1.35 })
const nextBadge = { fontSize: 10, fontWeight: 800, color: C.bg, textTransform: 'uppercase', letterSpacing: '0.6px', background: C.yellow, padding: '2px 8px', borderRadius: 99 }
const startPill = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 20, border: 'none',
  background: C.text, color: C.bg, fontSize: 12, fontWeight: 800, cursor: 'pointer',
}