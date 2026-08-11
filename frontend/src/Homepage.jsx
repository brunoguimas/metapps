// ─── REACT DO CELLBIT ────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { listGoals, createGoal, generateRoadmap, generateTask, submitAttempt, authFetch, logout as apiLogout, refreshSession } from './api'

// ─── ASSETS (coloque seus GIFs na pasta assets) ─────────────
import gif1 from './assets/gif1.gif'
import gif2 from './assets/gif2.gif'

// ─── ÍCONES ──────────────────────────────────────────────────
const IcoTarget  = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
const IcoPlus    = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IcoLogout  = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const IcoSend    = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
const IcoBack    = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
const IcoCheck   = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const IcoPlay    = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const Spin       = ()       => <svg style={{ animation:'spin .7s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10" strokeOpacity=".22"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>

// ─── HELPERS ─────────────────────────────────────────────────
function getLeafTopics(topics) {
  const hasChildren = new Set(topics.filter(t => t.parent_topic_id).map(t => t.parent_topic_id))
  return topics.filter(t => !hasChildren.has(t.id))
}

// ─── CHAT PANEL (tarefa ativa) ────────────────────────────────
function ChatPanel({ task, onBack }) {
  const [answers, setAnswers] = useState({})
  const [essay,   setEssay]   = useState('')
  const [result,  setResult]  = useState(null)
  const [err,     setErr]     = useState('')
  const [load,    setLoad]    = useState(false)

  const isQuiz  = task.type === 'quiz'
  const content = task.content
  const meta    = {
    title:        content?.title       || task.meta?.title       || 'Tarefa',
    description:  content?.description || task.meta?.description || '',
    expectations: content?.expectation || task.meta?.expectations || '',
  }

  async function handleSubmit() {
    setErr(''); setLoad(true)
    try {
      let response
      if (isQuiz) {
        response = Object.entries(answers).map(([qi, ans]) => ({ question_index: parseInt(qi), answer: ans }))
        if (response.length < content.questions.length) { setErr('Responda todas as perguntas antes de enviar.'); setLoad(false); return }
      } else {
        if (!essay.trim() || essay.trim().split(/\s+/).length < (content.min_words || 0)) { setErr(`Mínimo de ${content.min_words} palavras.`); setLoad(false); return }
        response = essay.trim()
      }
      const data = await submitAttempt(task.id, task.type, response)
      setResult(data)
    } catch(er) { setErr(er.message) }
    finally { setLoad(false) }
  }

  if (result) {
    const score    = result.task_attempt.score
    const evalData = result.task_attempt.task_evaluation
    let evaluation = null
    try { evaluation = typeof evalData === 'string' ? JSON.parse(evalData) : evalData } catch(_) {}
    const pct  = Math.round((score||0)*100)
    const mood = score >= 0.7 ? 'great' : score >= 0.4 ? 'ok' : 'bad'
    const moodColor = mood==='great' ? '#3ecf8e' : mood==='ok' ? '#f5c542' : '#f06a6a'

    return (
      <div style={fullPage}>
        <div style={narrowBox}>
          <div style={{ textAlign:'center', padding:'32px 24px', background:'rgba(255,255,255,0.03)', borderRadius:16, border:`1px solid ${moodColor}30`, marginBottom:20 }}>
            <div style={{ fontSize:52, fontWeight:900, color:moodColor, lineHeight:1 }}>{pct}%</div>
            <div style={{ fontSize:14, color:'rgba(245,244,255,0.5)', marginTop:6 }}>de acertos</div>
            <div style={{ fontSize:18, fontWeight:700, color:'#f5f4ff', marginTop:12 }}>
              {mood==='great' ? 'Excelente trabalho!' : mood==='ok' ? 'Bom esforço!' : 'Continue tentando!'}
            </div>
          </div>

          {isQuiz && evaluation?.items && (
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {evaluation.items.map((item, i) => (
                <div key={i} style={{ padding:'12px 16px', borderRadius:10, border:`1px solid ${item.correct ? 'rgba(62,207,142,0.2)' : 'rgba(240,106,106,0.2)'}`, background: item.correct ? 'rgba(62,207,142,0.04)' : 'rgba(240,106,106,0.04)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ color: item.correct ? '#3ecf8e' : '#f06a6a', fontWeight:700, fontSize:13 }}>{item.correct ? '✓' : '✗'} Questão {i+1}</span>
                    <span style={{ fontSize:12, color:'rgba(245,244,255,0.4)', marginLeft:'auto' }}>
                      Sua: {(content.questions[i]?.options || content.questions[i]?.alternatives)?.[item.submitted_answer] || item.submitted_answer}
                    </span>
                  </div>
                  {!item.correct && (
                    <p style={{ fontSize:12, color:'rgba(245,244,255,0.5)', margin:'4px 0 0', lineHeight:1.5 }}>
                      Correta: {(content.questions[i]?.options || content.questions[i]?.alternatives)?.[item.correct_answer]}
                    </p>
                  )}
                  {item.explanation && <p style={{ fontSize:12, color:'rgba(245,244,255,0.4)', margin:'4px 0 0', lineHeight:1.5, fontStyle:'italic' }}>{item.explanation}</p>}
                </div>
              ))}
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onBack} style={btnSecondary}>Nova tarefa</button>
            <button onClick={() => { setResult(null); setAnswers({}); setEssay('') }} style={{ ...btnPrimary, flex:1 }}>Tentar novamente</button>
          </div>
        </div>
        <style>{ANIMS}</style>
      </div>
    )
  }

  return (
    <div style={fullPage}>
      <div style={narrowBox}>
        <button onClick={onBack} style={backLink}><IcoBack s={14}/> Voltar</button>

        <div style={{ marginBottom:28, paddingBottom:24, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color: isQuiz ? '#6382ff' : '#3ecf8e', background: isQuiz ? 'rgba(99,130,255,0.1)' : 'rgba(62,207,142,0.1)', padding:'3px 10px', borderRadius:20, border:`1px solid ${isQuiz ? 'rgba(99,130,255,0.2)' : 'rgba(62,207,142,0.2)'}`, display:'inline-block', marginBottom:12 }}>
            {isQuiz ? 'Quiz' : 'Dissertação'}
          </span>
          <h1 style={{ fontSize:22, fontWeight:900, color:'#f5f4ff', letterSpacing:'-0.4px', marginBottom:8 }}>{meta.title}</h1>
          <p style={{ fontSize:14, color:'rgba(245,244,255,0.55)', lineHeight:1.65 }}>{meta.description}</p>
          {meta.expectations && <p style={{ fontSize:13, color:'rgba(245,244,255,0.4)', lineHeight:1.6, padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', marginTop:10 }}>Objetivo: {meta.expectations}</p>}
        </div>

        {isQuiz && content.questions?.map((q, qi) => (
          <div key={qi} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:20, marginBottom:12 }}>
            <p style={{ fontSize:15, color:'#f5f4ff', lineHeight:1.65, marginBottom:14 }}>
              <span style={{ color:'#6382ff', fontWeight:700, marginRight:6 }}>{qi+1}.</span>
              {q.question}
            </p>
            {q.material && typeof q.material === 'string' && (
              <p style={{ fontSize:12, color:'rgba(245,244,255,0.4)', fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:12 }}>{q.material}</p>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(q.options || q.alternatives || []).map((alt, ai) => {
                const sel = answers[qi] === ai
                return (
                  <button key={ai} onClick={() => setAnswers(prev => ({...prev, [qi]: ai}))}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderRadius:9, border:`1.5px solid ${sel ? '#6382ff' : 'rgba(255,255,255,0.07)'}`, background: sel ? 'rgba(99,130,255,0.1)' : 'rgba(255,255,255,0.02)', color: sel ? '#f5f4ff' : 'rgba(245,244,255,0.6)', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:500, textAlign:'left', transition:'all .15s' }}>
                    <span style={{ width:24, height:24, borderRadius:6, background: sel ? '#6382ff' : 'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color: sel ? '#fff' : 'rgba(245,244,255,0.4)', flexShrink:0 }}>{String.fromCharCode(65+ai)}</span>
                    {alt}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {!isQuiz && (
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:20, marginBottom:12 }}>
            {content.materials?.filter(m=>m.type==='text').map((m,mi) => <p key={mi} style={{ fontSize:13, color:'rgba(245,244,255,0.5)', fontStyle:'italic', padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:6, marginBottom:12 }}>{m.data}</p>)}
            <p style={{ fontSize:15, color:'#f5f4ff', lineHeight:1.65, marginBottom:10 }}>{content.instructions}</p>
            <p style={{ fontSize:12, color:'rgba(245,244,255,0.35)', marginBottom:10 }}>{content.min_words}–{content.max_words} palavras</p>
            <textarea value={essay} onChange={e=>{setEssay(e.target.value);setErr('')}} placeholder="Escreva sua resposta aqui…" rows={10}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1.5px solid rgba(255,255,255,0.08)', borderRadius:10, color:'#f5f4ff', fontFamily:'inherit', fontSize:14, padding:'12px 14px', outline:'none', resize:'vertical', lineHeight:1.6, boxSizing:'border-box' }} />
            <p style={{ fontSize:12, color:'rgba(245,244,255,0.35)', marginTop:6 }}>{essay.trim() ? essay.trim().split(/\s+/).length : 0} palavras</p>
          </div>
        )}

        {err && <div style={errBox}>{err}</div>}
        <button onClick={handleSubmit} disabled={load} style={{ ...btnPrimary, width:'100%', padding:'14px', fontSize:15, opacity:load?0.6:1, marginTop:8 }}>
          {load ? <><Spin /> Enviando…</> : 'Enviar resposta'}
        </button>
      </div>
      <style>{ANIMS}</style>
    </div>
  )
}

// ─── HOMEPAGE REDESIGNADA ────────────────────────────────────
export default function Homepage() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [task,     setTask]     = useState(null)
  const [goals,    setGoals]    = useState([])
  const [input,    setInput]    = useState('')
  const [step,     setStep]     = useState('home') // 'home' | 'loading' | 'roadmap'
  const [topics,   setTopics]   = useState([])
  const [selTopic, setSelTopic] = useState(null)
  const [curGoal,  setCurGoal]  = useState(null)
  const [err,      setErr]      = useState('')
  const [loadInit, setLoadInit] = useState(true)
  const [loadGen,  setLoadGen]  = useState(false)

  // GIFs
  const [gifStage, setGifStage] = useState(1)
  const GIF1_DURATION = 10000   // 10 segundos

  // Tooltip do roadmap
  const [hoveredTopic, setHoveredTopic] = useState(null)

  // Lições em andamento (últimas 3 tarefas)
  const [recentTasks, setRecentTasks] = useState([])

  useEffect(() => {
    async function init() {
      try { await refreshSession() } catch { navigate('/auth/login'); return }
      try {
        const res = await authFetch('/auth/me')
        const data = await res.json()
        if (!res.ok) { navigate('/auth/login'); return }
        setEmail(data.user?.email || '')
      } catch { navigate('/auth/login'); return }
      try { const gl = await listGoals(); setGoals(gl || []) } catch(e) { console.error(e) }
      finally { setLoadInit(false) }
    }
    init()
  }, [navigate])

  useEffect(() => {
    if (step !== 'home') return
    const timer = setTimeout(() => {
      setGifStage(2)
    }, GIF1_DURATION)
    return () => clearTimeout(timer)
  }, [step])

  async function handleSend() {
    if (!input.trim()) return
    setErr(''); setLoadGen(true); setStep('loading')
    try {
      const goal = await createGoal(input.trim(), {})
      setCurGoal(goal)
      const roadmap = await generateRoadmap(goal.id)
      const leaves = getLeafTopics(roadmap.topics || [])
      setTopics(leaves)
      setGoals(prev => [goal, ...prev])
      setStep('roadmap')
    } catch(er) { setErr(er.message); setStep('home') }
    finally { setLoadGen(false) }
  }

  async function handleGenerateTask() {
    if (!selTopic) return
    setErr(''); setLoadGen(true)
    try {
      const t = await generateTask(selTopic.id)
      setTask(t)
      // Adiciona à lista de lições em andamento (máximo 3)
      setRecentTasks(prev => [t, ...prev].slice(0, 3))
    } catch(er) { setErr(er.message) }
    finally { setLoadGen(false) }
  }

  function handleLogout() { apiLogout(); navigate('/auth/login') }

  // Voltar do ChatPanel mantém a tarefa na lista e retorna ao roadmap
  function handleBackFromChat() {
    setTask(null)
    setStep('roadmap')
  }

  if (task) return <ChatPanel task={task} onBack={handleBackFromChat} />

  return (
    <div style={shell}>
      {/* Etapa HOME: GIF + formulário */}
      {step === 'home' && (
        <div style={homeContainer}>
          <div style={gifArea}>
            <img
              src={gifStage === 1 ? gif1 : gif2}
              alt="Animação"
              style={{ maxWidth:'90%', maxHeight:'70vh', objectFit:'contain', borderRadius:24, boxShadow:'0 20px 40px rgba(0,0,0,0.3)' }}
            />
          </div>
          <div style={formArea}>
            <h1 style={heroTitle}>O que você quer aprender hoje?</h1>
            <p style={heroSub}>Digite qualquer assunto. A IA vai criar um caminho de aprendizado e gerar tarefas para você.</p>
            <div style={inputWrapper}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Ex: Funções do segundo grau, Revolução Francesa, Present perfect..."
                rows={3}
                style={heroTextarea}
              />
              <button onClick={handleSend} disabled={!input.trim() || loadGen} style={heroButton}>
                <IcoSend s={15}/>
              </button>
            </div>
            {err && <div style={{ ...errBox, marginTop:16 }}>{err}</div>}
          </div>
        </div>
      )}

      {/* LOADING */}
      {step === 'loading' && (
        <div style={loadingContainer}>
          <Spin />
          <p style={{ color:'rgba(245,244,255,0.5)', marginTop:16 }}>A IA está preparando sua jornada de aprendizado…</p>
        </div>
      )}

      {/* ROADMAP */}
      {step === 'roadmap' && (
        <div style={roadmapContainer}>
          <div style={roadmapHeader}>
            <button onClick={() => { setStep('home'); setSelTopic(null); setCurGoal(null) }} style={backLink}>
              <IcoBack s={14}/> Voltar
            </button>
            <h2 style={roadmapTitle}>{curGoal?.title}</h2>
            <p style={roadmapSub}>Escolha por onde quer começar.</p>
          </div>

          <div style={timeline}>
            {topics.map((topic, index) => {
              const isSelected = selTopic?.id === topic.id
              const isHovered  = hoveredTopic === topic.id
              return (
                <div key={topic.id} style={timelineItem}>
                  {/* Linha conectora (exceto o primeiro) */}
                  {index > 0 && <div style={connectorLine} />}

                  {/* Nó (bolinha) */}
                  <div
                    style={timelineNode(isSelected, isHovered)}
                    onClick={() => setSelTopic(isSelected ? null : topic)}
                    onMouseEnter={() => setHoveredTopic(topic.id)}
                    onMouseLeave={() => setHoveredTopic(null)}
                  >
                    {isSelected && <IcoCheck s={18} color="#fff" />}
                    {/* Tooltip no hover */}
                    {isHovered && !isSelected && (
                      <div style={tooltipBubble}>
                        {topic.title}
                        <div style={tooltipArrow} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Seção de Lições em andamento */}
          {recentTasks.length > 0 && (
            <div style={lessonsSection}>
              <h3 style={lessonsTitle}>Lições em andamento</h3>
              <div style={lessonsList}>
                {recentTasks.map((t, i) => (
                  <div key={i} style={lessonCard} onClick={() => setTask(t)}>
                    <div style={lessonIcon}>
                      <IcoPlay s={14} />
                    </div>
                    <div style={lessonInfo}>
                      <span style={lessonName}>{t.meta?.title || t.content?.title || 'Tarefa'}</span>
                      <span style={lessonType}>{t.type === 'quiz' ? 'Quiz' : 'Dissertação'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {err && <div style={{ ...errBox, marginTop:20 }}>{err}</div>}

          <button onClick={handleGenerateTask} disabled={!selTopic || loadGen}
            style={generateButton(!selTopic || loadGen)}>
            {loadGen ? <><Spin /> Gerando tarefa…</> : 'Gerar tarefa com IA'}
          </button>
        </div>
      )}

      <style>{ANIMS}</style>
    </div>
  )
}

// ─── ESTILOS ─────────────────────────────────────────────────
const ANIMS = `
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(99,130,255,0.4); } 50% { box-shadow: 0 0 0 12px rgba(99,130,255,0); } }
  button:active { transform: scale(0.98) }
  textarea::placeholder { color: rgba(245,244,255,0.3) }
  textarea:focus { outline: none }
`

const shell = {
  width: '100vw',
  minHeight: '100vh',
  background: '#141930',
  fontFamily: "'Inter', -apple-system, sans-serif",
  WebkitFontSmoothing: 'antialiased',
  color: '#f5f4ff',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
}

// HOME
const homeContainer = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4rem',
  padding: '2rem',
  flex: 1,
  minHeight: '100vh',
  flexWrap: 'wrap',
}
const gifArea = {
  flex: '0 0 40%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}
const formArea = {
  flex: '0 1 500px',
  textAlign: 'left',
}
const heroTitle = {
  fontSize: 'clamp(2rem, 5vw, 3.5rem)',
  fontWeight: 900,
  color: '#f5f4ff',
  letterSpacing: '-0.04em',
  lineHeight: 1.1,
  marginBottom: '0.8rem',
}
const heroSub = {
  fontSize: '1.1rem',
  color: 'rgba(245,244,255,0.5)',
  lineHeight: 1.6,
  marginBottom: '2rem',
}
const inputWrapper = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1.5px solid rgba(255,255,255,0.1)',
  borderRadius: 14,
  padding: '14px 14px 14px 18px',
  transition: 'border-color .2s',
}
const heroTextarea = {
  flex: 1,
  background: 'none',
  border: 'none',
  outline: 'none',
  color: '#f5f4ff',
  fontFamily: 'inherit',
  fontSize: 15,
  lineHeight: 1.6,
  resize: 'none',
  padding: 0,
}
const heroButton = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: 'none',
  background: '#6382ff',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all .2s',
  flexShrink: 0,
}

// LOADING
const loadingContainer = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  minHeight: '100vh',
}

// ROADMAP
const roadmapContainer = {
  maxWidth: 600,
  margin: '0 auto',
  padding: '3rem 1.5rem',
  width: '100%',
}
const roadmapHeader = { marginBottom: '2.5rem' }
const roadmapTitle = {
  fontSize: '2rem',
  fontWeight: 900,
  color: '#f5f4ff',
  letterSpacing: '-0.03em',
  marginBottom: '0.3rem',
}
const roadmapSub = {
  fontSize: '0.95rem',
  color: 'rgba(245,244,255,0.5)',
}

// TIMELINE (estilo Duolingo)
const timeline = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0,
  marginBottom: '2.5rem',
}
const timelineItem = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  position: 'relative',
}
const connectorLine = {
  width: 2,
  height: '2.5rem',
  background: 'linear-gradient(to bottom, #9ab4ff, rgba(154,180,255,0.3))',
  borderRadius: 1,
}
const timelineNode = (isSelected, isHovered) => ({
  width: 52,
  height: 52,
  borderRadius: '50%',
  background: isSelected ? '#6382ff' : 'rgba(255,255,255,0.06)',
  border: isSelected ? '3px solid #9ab4ff' : '2px solid rgba(255,255,255,0.15)',
  boxShadow: isSelected
    ? '0 0 0 6px rgba(99,130,255,0.25), 0 8px 20px rgba(0,0,0,0.3)'
    : isHovered
      ? '0 0 0 10px rgba(99,130,255,0.15), 0 6px 16px rgba(0,0,0,0.25)'
      : '0 4px 12px rgba(0,0,0,0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  zIndex: 2,
  animation: isSelected ? 'pulse 2s infinite' : 'none',
})

const tooltipBubble = {
  position: 'absolute',
  bottom: 'calc(100% + 16px)',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#262d4a',
  color: '#f5f4ff',
  padding: '8px 18px',
  borderRadius: 20,
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  boxShadow: '0 12px 28px rgba(0,0,0,0.4)',
  border: '1px solid rgba(154,180,255,0.3)',
  zIndex: 10,
}
const tooltipArrow = {
  position: 'absolute',
  top: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '6px solid transparent',
  borderRight: '6px solid transparent',
  borderTop: '6px solid #262d4a',
}

// LIÇÕES EM ANDAMENTO
const lessonsSection = {
  marginTop: '2rem',
  marginBottom: '2rem',
}
const lessonsTitle = {
  fontSize: '0.9rem',
  fontWeight: 700,
  color: 'rgba(245,244,255,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '0.8rem',
}
const lessonsList = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
}
const lessonCard = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 18px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  cursor: 'pointer',
  transition: 'all 0.2s',
}
const lessonIcon = {
  width: 36,
  height: 36,
  borderRadius: 12,
  background: 'rgba(99,130,255,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#9ab4ff',
}
const lessonInfo = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}
const lessonName = {
  fontSize: 14,
  fontWeight: 600,
  color: '#f5f4ff',
}
const lessonType = {
  fontSize: 12,
  color: 'rgba(245,244,255,0.45)',
}

// BOTÃO GERAR TAREFA
const generateButton = (disabled) => ({
  width: '100%',
  padding: '14px',
  border: 'none',
  borderRadius: 14,
  background: disabled ? 'rgba(99,130,255,0.3)' : '#6382ff',
  color: '#fff',
  fontSize: 15,
  fontWeight: 700,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.6 : 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontFamily: 'inherit',
  transition: 'all 0.2s',
  boxShadow: disabled ? 'none' : '0 8px 24px rgba(99,130,255,0.3)',
})

// COMPARTILHADOS
const fullPage = { minHeight:'100vh', background:'#141930', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'48px 20px', fontFamily:"'Inter',-apple-system,sans-serif" }
const narrowBox = { width:'100%', maxWidth:660 }
const backLink = { display:'inline-flex', alignItems:'center', gap:6, background:'none', border:'none', color:'rgba(245,244,255,0.45)', fontSize:13, fontWeight:600, cursor:'pointer', padding:0, marginBottom:24, fontFamily:'inherit', transition:'color .15s' }
const errBox = { background:'rgba(240,106,106,0.08)', border:'1px solid rgba(240,106,106,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:500, color:'#f06a6a', lineHeight:1.45 }
const btnPrimary = { display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px 24px', border:'none', borderRadius:10, background:'#6382ff', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'opacity .15s' }
const btnSecondary = { display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px 24px', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, background:'rgba(255,255,255,0.04)', color:'#f5f4ff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', flex:1 }