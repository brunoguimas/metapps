// ─── REACT DO CELLBIT ────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listGoals, createGoal, generateRoadmap, generateTask, submitAttempt, authFetch, logout as apiLogout, refreshSession } from './api'

// ─── ÍCONES ──────────────────────────────────────────────────
const IcoTarget  = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
const IcoPlus    = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IcoLogout  = ({s=20}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const IcoSend    = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
const IcoBack    = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
const IcoCheck   = ({s=14}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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
  const meta    = task.meta

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

  // ─── ODEIO HTML (resultado) ──────────────────────────────
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
                    <span style={{ fontSize:12, color:'rgba(245,244,255,0.4)', marginLeft:'auto' }}>Sua: {content.questions[i]?.alternatives?.[item.submitted_answer] || item.submitted_answer}</span>
                  </div>
                  {!item.correct && <p style={{ fontSize:12, color:'rgba(245,244,255,0.5)', margin:'4px 0 0', lineHeight:1.5 }}>Correta: {content.questions[i]?.alternatives?.[item.correct_answer]}</p>}
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

  // ─── ODEIO HTML (tarefa) ─────────────────────────────────
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
            <p style={{ fontSize:15, color:'#f5f4ff', lineHeight:1.65, marginBottom:14 }}><span style={{ color:'#6382ff', fontWeight:700, marginRight:6 }}>{qi+1}.</span>{q.statement}</p>
            {q.material?.filter(m=>m.type==='text').map((m,mi) => <p key={mi} style={{ fontSize:13, color:'rgba(245,244,255,0.5)', fontStyle:'italic', padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:6, marginBottom:12 }}>{m.data}</p>)}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {q.alternatives.map((alt, ai) => {
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
            {content.material?.filter(m=>m.type==='text').map((m,mi) => <p key={mi} style={{ fontSize:13, color:'rgba(245,244,255,0.5)', fontStyle:'italic', padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:6, marginBottom:12 }}>{m.data}</p>)}
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

// ─── HOMEPAGE ─────────────────────────────────────────────────
export default function Homepage() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [task,     setTask]     = useState(null)
  const [goals,    setGoals]    = useState([])
  const [input,    setInput]    = useState('')
  const [step,     setStep]     = useState('home') // home | topics | loading
  const [topics,   setTopics]   = useState([])
  const [selTopic, setSelTopic] = useState(null)
  const [curGoal,  setCurGoal]  = useState(null)
  const [err,      setErr]      = useState('')
  const [loadInit, setLoadInit] = useState(true)
  const [loadGen,  setLoadGen]  = useState(false)

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
      setStep('topics')
    } catch(er) { setErr(er.message); setStep('home') }
    finally { setLoadGen(false) }
  }

  async function handleGenerateTask() {
    if (!selTopic) return
    setErr(''); setLoadGen(true)
    try {
      const t = await generateTask(selTopic.id)
      setTask(t)
    } catch(er) { setErr(er.message) }
    finally { setLoadGen(false) }
  }

  async function handleGoalClick(goal) {
    setErr(''); setLoadGen(true); setStep('loading')
    try {
      const roadmap = await generateRoadmap(goal.id)
      const leaves = getLeafTopics(roadmap.topics || [])
      setCurGoal(goal)
      setTopics(leaves)
      setStep('topics')
    } catch(er) { setErr(er.message); setStep('home') }
    finally { setLoadGen(false) }
  }

  function handleLogout() { apiLogout(); navigate('/auth/login') }

  if (task) return <ChatPanel task={task} onBack={() => { setTask(null); setStep('home') }} />

  // ─── ODEIO HTML ──────────────────────────────────────────
  return (
    <div style={shell}>

      {/* sidebar desktop */}
      <aside style={sidebar}>
        <div style={{ padding:'4px 8px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:8 }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#f5f4ff', letterSpacing:'-0.3px', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'linear-gradient(135deg,#6382ff,#3d5af1)', flexShrink:0 }}/>
            Metapps
          </div>
        </div>

        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'rgba(245,244,255,0.25)', marginBottom:10, padding:'0 4px' }}>Objetivos recentes</div>

        {loadInit ? (
          <div style={{ color:'rgba(245,244,255,0.3)', fontSize:13, padding:'4px' }}>Carregando...</div>
        ) : goals.length === 0 ? (
          <div style={{ color:'rgba(245,244,255,0.3)', fontSize:13, padding:'4px', lineHeight:1.6 }}>Nenhum objetivo ainda. Comece digitando o que quer aprender.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {goals.slice(0,8).map(g => (
              <button key={g.id} onClick={() => handleGoalClick(g)}
                style={{ padding:'8px 10px', borderRadius:8, border:'none', background: curGoal?.id===g.id ? 'rgba(99,130,255,0.12)' : 'transparent', color: curGoal?.id===g.id ? '#9ab4ff' : 'rgba(245,244,255,0.5)', fontSize:13, fontWeight:500, textAlign:'left', cursor:'pointer', fontFamily:'inherit', transition:'all .15s', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {g.title}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop:'auto', borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:16, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#6382ff,#3d5af1)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
            {email?.[0]?.toUpperCase() || '?'}
          </div>
          <span style={{ fontSize:12, color:'rgba(245,244,255,0.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{email}</span>
          <button onClick={handleLogout} style={{ background:'none', border:'none', color:'rgba(245,244,255,0.3)', cursor:'pointer', display:'flex', alignItems:'center', padding:4, borderRadius:6, transition:'color .15s' }}
            onMouseEnter={e=>e.currentTarget.style.color='#f5f4ff'} onMouseLeave={e=>e.currentTarget.style.color='rgba(245,244,255,0.3)'}>
            <IcoLogout s={16}/>
          </button>
        </div>
      </aside>

      {/* main */}
      <main style={mainArea}>

        {/* TELA HOME — input de onboarding */}
        {step === 'home' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, padding:'40px 20px' }}>
            <div style={{ maxWidth:560, width:'100%', textAlign:'center' }}>
              <h1 style={{ fontSize:'clamp(28px,5vw,42px)', fontWeight:900, color:'#f5f4ff', letterSpacing:'-0.04em', lineHeight:1.1, marginBottom:12 }}>
                O que você quer aprender hoje?
              </h1>
              <p style={{ fontSize:16, color:'rgba(245,244,255,0.45)', lineHeight:1.65, marginBottom:36 }}>
                Digite qualquer assunto. A IA vai criar um caminho de aprendizado e gerar tarefas para você.
              </p>

              <div style={{ position:'relative', background:'rgba(255,255,255,0.04)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:14, display:'flex', alignItems:'flex-end', gap:8, padding:'14px 14px 14px 18px', transition:'border-color .2s' }}
                onFocus={e=>e.currentTarget.style.borderColor='#6382ff'}
                onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="Ex: Funções do segundo grau, Revolução Francesa, Present perfect..."
                  rows={3}
                  style={{ flex:1, background:'none', border:'none', outline:'none', color:'#f5f4ff', fontFamily:'inherit', fontSize:15, lineHeight:1.6, resize:'none', padding:0 }}
                />
                <button onClick={handleSend} disabled={!input.trim() || loadGen}
                  style={{ width:40, height:40, borderRadius:10, border:'none', background: input.trim() ? '#6382ff' : 'rgba(255,255,255,0.06)', color: input.trim() ? '#fff' : 'rgba(245,244,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', cursor: input.trim() ? 'pointer' : 'default', transition:'all .2s', flexShrink:0 }}>
                  <IcoSend s={15}/>
                </button>
              </div>

              {err && <div style={{ ...errBox, marginTop:16 }}>{err}</div>}

              {goals.length > 0 && (
                <div style={{ marginTop:40, textAlign:'left' }}>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'rgba(245,244,255,0.25)', marginBottom:12 }}>Ou continue de onde parou</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {goals.slice(0,4).map(g => (
                      <button key={g.id} onClick={() => handleGoalClick(g)}
                        style={{ padding:'12px 16px', borderRadius:10, border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.03)', color:'rgba(245,244,255,0.7)', fontSize:14, fontWeight:500, textAlign:'left', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}
                        onMouseEnter={e=>{e.currentTarget.style.background='rgba(99,130,255,0.08)';e.currentTarget.style.borderColor='rgba(99,130,255,0.2)'}}
                        onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'}}>
                        {g.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LOADING */}
        {step === 'loading' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:16, color:'rgba(245,244,255,0.5)' }}>
            <Spin />
            <p style={{ fontSize:14 }}>A IA está preparando sua jornada de aprendizado…</p>
          </div>
        )}

        {/* TELA DE TOPICS */}
        {step === 'topics' && (
          <div style={{ maxWidth:600, margin:'0 auto', padding:'40px 20px', width:'100%' }}>
            <button onClick={() => { setStep('home'); setSelTopic(null); setCurGoal(null) }} style={backLink}>
              <IcoBack s={14}/> Voltar
            </button>

            <h2 style={{ fontSize:24, fontWeight:900, color:'#f5f4ff', letterSpacing:'-0.04em', marginBottom:6 }}>{curGoal?.title}</h2>
            <p style={{ fontSize:14, color:'rgba(245,244,255,0.45)', marginBottom:28 }}>Escolha por onde quer começar.</p>

            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {topics.map(t => {
                const sel = selTopic?.id === t.id
                return (
                  <button key={t.id} onClick={() => setSelTopic(sel ? null : t)}
                    style={{ padding:'16px 18px', borderRadius:12, border:`1.5px solid ${sel ? '#6382ff' : 'rgba(255,255,255,0.07)'}`, background: sel ? 'rgba(99,130,255,0.1)' : 'rgba(255,255,255,0.03)', color:'#f5f4ff', fontSize:15, fontWeight:600, textAlign:'left', cursor:'pointer', fontFamily:'inherit', transition:'all .15s', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span>{t.title}</span>
                    {sel && <span style={{ color:'#6382ff' }}><IcoCheck s={16}/></span>}
                  </button>
                )
              })}
            </div>

            {err && <div style={{ ...errBox, marginBottom:16 }}>{err}</div>}

            <button onClick={handleGenerateTask} disabled={!selTopic || loadGen}
              style={{ ...btnPrimary, width:'100%', padding:'14px', fontSize:15, opacity: (!selTopic || loadGen) ? 0.5 : 1 }}>
              {loadGen ? <><Spin /> Gerando tarefa…</> : 'Gerar tarefa com IA'}
            </button>
          </div>
        )}

      </main>
      <style>{ANIMS}</style>
    </div>
  )
}

// ─── CSS QUE EU AMO <3 ───────────────────────────────────────
const ANIMS = `
  @keyframes spin { to { transform: rotate(360deg) } }
  button:active { transform: scale(0.98) }
  textarea::placeholder { color: rgba(245,244,255,0.3) }
  textarea:focus { outline: none }
  @media (max-width: 768px) { aside { display: none } }
`

const shell     = { display:'flex', height:'100vh', overflow:'hidden', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', background:'linear-gradient(160deg, #0f1535 0%, #141930 60%, #0f1535 100%)', color:'#f5f4ff' }
const sidebar   = { width:240, flexShrink:0, borderRight:'1px solid rgba(255,255,255,0.06)', padding:'20px 14px', display:'flex', flexDirection:'column', gap:6, background:'rgba(255,255,255,0.02)', overflowY:'auto' }
const mainArea  = { flex:1, display:'flex', flexDirection:'column', overflowY:'auto' }
const fullPage  = { minHeight:'100vh', background:'linear-gradient(160deg, #0f1535 0%, #141930 60%, #0f1535 100%)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'48px 20px', fontFamily:"'Inter',-apple-system,sans-serif" }
const narrowBox = { width:'100%', maxWidth:660 }
const backLink  = { display:'inline-flex', alignItems:'center', gap:6, background:'none', border:'none', color:'rgba(245,244,255,0.45)', fontSize:13, fontWeight:600, cursor:'pointer', padding:0, marginBottom:24, fontFamily:'inherit', transition:'color .15s' }
const errBox    = { background:'rgba(240,106,106,0.08)', border:'1px solid rgba(240,106,106,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:500, color:'#f06a6a', lineHeight:1.45 }
const btnPrimary   = { display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px 24px', border:'none', borderRadius:10, background:'#6382ff', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'opacity .15s' }
const btnSecondary = { display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px 24px', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, background:'rgba(255,255,255,0.04)', color:'#f5f4ff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', flex:1 }