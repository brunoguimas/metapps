import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listGoals, createGoal, generateTask, submitAttempt, authFetch, logout as apiLogout, refreshSession } from './api'

const MATERIAS = ['Matemática', 'Português', 'História', 'Geografia', 'Ciências', 'Física', 'Química', 'Biologia', 'Inglês', 'Filosofia']
const NIVEIS = ['facil', 'medio', 'dificil']
const NIVEL_LABEL = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' }
const NIVEL_COLOR = { facil: '#6aaf6a', medio: '#c4a44a', dificil: '#e08080' }

const Spin = () => (
  <svg style={{ animation:'spin .7s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <circle cx="12" cy="12" r="10" strokeOpacity=".22"/>
    <path d="M12 2a10 10 0 0 1 10 10"/>
  </svg>
)

/* ── Sidebar ── */
function Sidebar({ view, setView, email, onLogout }) {
  const initial = email ? email[0].toUpperCase() : '?'
  return (
    <aside style={sidebar}>
      <div style={profileSection}>
        <div style={avatar}>{initial}</div>
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <span style={profileEmail}>{email || 'Carregando...'}</span>
        </div>
      </div>
      <nav style={sideNav}>
        {[
          { key:'goals', icon:'📋', label:'Objetivos' },
          { key:'new',   icon:'✦',  label:'Nova Tarefa' },
        ].map(({ key, icon, label }) => (
          <button key={key} onClick={() => setView(key)}
            style={{ ...navBtn, background: view===key ? 'rgba(79,126,221,0.1)' : 'transparent', color: view===key ? '#4f7edd' : '#a8a6c8' }}>
            <span>{icon}</span> {label}
          </button>
        ))}
      </nav>
      <button onClick={onLogout} style={logoutBtn}>🚪 Sair</button>
    </aside>
  )
}

/* ── ChatPanel ── */
function ChatPanel({ task, onBack }) {
  const [answers, setAnswers] = useState({})
  const [essay, setEssay]     = useState('')
  const [result, setResult]   = useState(null)
  const [err, setErr]         = useState('')
  const [load, setLoad]       = useState(false)

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

  if (result) {
    const score    = result.task_attempt.score
    const evalData = result.task_attempt.task_evaluation
    let evaluation = null
    try { evaluation = typeof evalData === 'string' ? JSON.parse(evalData) : evalData } catch(_) {}

    return (
      <div style={page}>
        <div style={container}>
          <div style={resultHeader}>
            <div style={{ fontSize:48, marginBottom:8 }}>{score >= 0.7 ? '🎉' : score >= 0.4 ? '💪' : '📚'}</div>
            <h2 style={htitle}>{score >= 0.7 ? 'Muito bem!' : score >= 0.4 ? 'Bom esforço!' : 'Continue praticando!'}</h2>
            <div style={scoreBadge}>
              <span style={{ fontSize:32, fontWeight:800, color: score >= 0.7 ? '#6aaf6a' : score >= 0.4 ? '#c4a44a' : '#e08080' }}>
                {Math.round((score||0)*100)}%
              </span>
              <span style={{ fontSize:13, color:'#a8a6c8' }}>de acertos</span>
            </div>
          </div>

          {isQuiz && evaluation?.items && (
            <div style={feedbackList}>
              {evaluation.items.map((item, i) => (
                <div key={i} style={{ ...feedbackCard, borderColor: item.correct ? 'rgba(106,175,106,0.2)' : 'rgba(220,80,80,0.2)', background: item.correct ? 'rgba(106,175,106,0.04)' : 'rgba(220,80,80,0.04)' }}>
                  <div style={feedbackTop}>
                    <span style={{ fontSize:13, color: item.correct ? '#6aaf6a' : '#e08080', fontWeight:700 }}>{item.correct ? '✓' : '✗'} Questão {i+1}</span>
                    <span style={{ fontSize:12, color:'#a8a6c8' }}>Sua resposta: {content.questions[i]?.alternatives?.[item.submitted_answer] || item.submitted_answer}</span>
                  </div>
                  {!item.correct && <p style={{ fontSize:12, color:'#a8a6c8', marginTop:6, lineHeight:1.5 }}>Correta: {content.questions[i]?.alternatives?.[item.correct_answer]}</p>}
                  {item.explanation && <p style={{ fontSize:12, color:'#a8a6c8', marginTop:4, lineHeight:1.5, fontStyle:'italic' }}>{item.explanation}</p>}
                </div>
              ))}
            </div>
          )}

          <div style={{ display:'flex', gap:10, marginTop:24 }}>
            <button onClick={onBack} style={{ ...btnMain, background:'rgba(247,247,255,0.04)', border:'1px solid rgba(168,166,200,0.15)', color:'#f7f7ff' }}>Nova tarefa</button>
            <button onClick={() => { setResult(null); setAnswers({}); setEssay('') }} style={btnMain}>Tentar novamente</button>
          </div>
        </div>
        <style>{ANIMS}</style>
      </div>
    )
  }

  return (
    <div style={page}>
      <div style={container}>
        <button onClick={onBack} style={backLink}>← Voltar para objetivos</button>
        <div style={taskHeader}>
          <span style={typeBadge}>{isQuiz ? '📝 Quiz' : '✍️ Dissertação'}</span>
          <h1 style={htitle}>{meta.title}</h1>
          <p style={hsub}>{meta.description}</p>
          {meta.expectations && <p style={expectations}>🎯 {meta.expectations}</p>}
        </div>

        {isQuiz && content.questions?.map((q, qi) => (
          <div key={qi} style={questionCard}>
            <p style={questionText}><span style={qNum}>{qi+1}.</span> {q.statement}</p>
            {q.material?.filter(m=>m.type==='text').map((m,mi) => <p key={mi} style={materialText}>{m.data}</p>)}
            <div style={altList}>
              {q.alternatives.map((alt, ai) => (
                <button key={ai} onClick={() => setAnswers(prev => ({...prev, [qi]: ai}))}
                  style={{ ...altBtn, borderColor: answers[qi]===ai ? '#4f7edd' : 'rgba(168,166,200,0.12)', background: answers[qi]===ai ? 'rgba(79,126,221,0.08)' : 'rgba(247,247,255,0.02)', color: answers[qi]===ai ? '#f7f7ff' : '#a8a6c8' }}>
                  <span style={altLetter}>{String.fromCharCode(65+ai)}</span>{alt}
                </button>
              ))}
            </div>
          </div>
        ))}

        {!isQuiz && (
          <div style={questionCard}>
            {content.material?.filter(m=>m.type==='text').map((m,mi) => <p key={mi} style={materialText}>{m.data}</p>)}
            <p style={questionText}>{content.instructions}</p>
            <p style={{ fontSize:12, color:'#a8a6c8', marginBottom:10 }}>{content.min_words}–{content.max_words} palavras</p>
            <textarea value={essay} onChange={e=>{setEssay(e.target.value);setErr('')}} placeholder="Escreva sua resposta aqui…" rows={10}
              style={{ ...inp, resize:'vertical', lineHeight:1.6, height:'auto' }} />
            <p style={{ fontSize:12, color:'#a8a6c8', marginTop:6 }}>{essay.trim() ? essay.trim().split(/\s+/).length : 0} palavras</p>
          </div>
        )}

        {err && <div style={errBox}>{err}</div>}
        <button onClick={handleSubmit} disabled={load} style={{ ...btnMain, opacity:load?.6:1, fontSize:15, padding:'14px 0', background:'linear-gradient(135deg, #4f7edd, #27187e)' }}>
          {load ? <><Spin /> Enviando…</> : 'Enviar resposta'}
        </button>
      </div>
      <style>{ANIMS}</style>
    </div>
  )
}

/* ── Homepage principal ── */
export default function Homepage() {
  const navigate = useNavigate()
  const [email, setEmail]         = useState('')
  const [task, setTask]           = useState(null)
  const [view, setView]           = useState('goals')
  const [goals, setGoals]         = useState([])
  const [selectedGoal, setSelected] = useState(null)
  const [showNew, setShowNew]     = useState(false)
  const [title, setTitle]         = useState('')
  const [diffs, setDiffs]         = useState({})
  const [err, setErr]             = useState('')
  const [loadGoals, setLoadGoals] = useState(true)
  const [loadGen, setLoadGen]     = useState(false)
  const [loadCreate, setLoadCreate] = useState(false)

  useEffect(() => {
  async function init() {
    // 1. Tenta recuperar o token via refresh_token cookie
    try {
      await refreshSession()
    } catch {
      navigate('/auth/login')
      return
    }

    // 2. Busca dados do usuário
    try {
      const res = await authFetch('/auth/me')
      const data = await res.json()
      if (!res.ok) { navigate('/auth/login'); return }
      setEmail(data.user?.email || '')
    } catch { navigate('/auth/login'); return }

    // 3. Carrega goals
    try {
      const gl = await listGoals()
      setGoals(gl || [])
      if (!gl?.length) setShowNew(true)
    } catch(e) { console.error(e) }
    finally { setLoadGoals(false) }
  }
  init()
}, [navigate])

  async function handleLogout() {
    apiLogout()
    navigate('/auth/login')
  }

  function toggleMateria(m) {
    setDiffs(prev => { if (prev[m]) { const n={...prev}; delete n[m]; return n } return {...prev, [m]:'medio'} })
  }
  function setNivel(m, n) { setDiffs(prev => ({...prev, [m]: n})) }

  async function handleCreate(e) {
    e.preventDefault(); setErr('')
    if (!title.trim()) { setErr('Digite um título.'); return }
    if (!Object.keys(diffs).length) { setErr('Selecione pelo menos uma matéria.'); return }
    setLoadCreate(true)
    try {
      const goal = await createGoal(title.trim(), diffs)
      setGoals(prev => [goal, ...prev])
      setSelected(goal)
      setShowNew(false)
      setTitle(''); setDiffs({})
      setView('new')
    } catch(er) { setErr(er.message) }
    finally { setLoadCreate(false) }
  }

  async function handleGenerate() {
    if (!selectedGoal) return
    setErr(''); setLoadGen(true)
    try {
      const generatedTask = await generateTask(selectedGoal.id)
      setTask(generatedTask)
    } catch(er) { setErr(er.message) }
    finally { setLoadGen(false) }
  }

  if (task) return <ChatPanel task={task} onBack={() => setTask(null)} />

  return (
    <div style={dashboard}>
      <Sidebar view={view} setView={setView} email={email} onLogout={handleLogout} />

      <main style={main}>
        {view === 'goals' && (
          <div>
            <h1 style={pageTitle}>Seus Objetivos</h1>
            {loadGoals ? (
              <div style={{ color:'#a8a6c8', padding:20 }}>Carregando...</div>
            ) : goals.length === 0 ? (
              <div>
                <p style={{ color:'#a8a6c8', marginBottom:16 }}>Nenhum objetivo criado ainda.</p>
                <button onClick={() => setView('new')} style={btnMain}>Criar primeiro objetivo</button>
              </div>
            ) : (
              <div style={goalGrid}>
                {goals.map(g => (
                  <div key={g.id} style={{ ...goalCard, borderColor: selectedGoal?.id===g.id ? '#4f7edd' : 'rgba(168,166,200,0.12)', background: selectedGoal?.id===g.id ? 'rgba(79,126,221,0.08)' : 'rgba(247,247,255,0.02)' }}>
                    <span style={goalTitle}>{g.title}</span>
                    <div style={goalDiffs}>
                      {Object.entries(g.difficulties||{}).map(([m, n]) => (
                        <span key={m} style={{ ...diffBadge, color: NIVEL_COLOR[n]||'#a8a6c8', borderColor: NIVEL_COLOR[n]||'#a8a6c8' }}>{m} · {NIVEL_LABEL[n]||n}</span>
                      ))}
                    </div>
                    <button onClick={() => { setSelected(g); setView('new') }} style={smallBtn}>Gerar tarefa →</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'new' && (
          <div>
            <h1 style={pageTitle}>Nova Tarefa</h1>

            {goals.length > 0 && !showNew && (
              <div style={sectionHead}>
                <span style={sectionLabel}>Seus objetivos</span>
                <button onClick={() => { setShowNew(true); setErr('') }} style={btnOutline}>+ Novo objetivo</button>
              </div>
            )}

            {!showNew && goals.length > 0 && (
              <div style={goalGrid}>
                {goals.map(g => (
                  <button key={g.id} onClick={() => { setSelected(g); setErr('') }}
                    style={{ ...goalCard, borderColor: selectedGoal?.id===g.id ? '#4f7edd' : 'rgba(168,166,200,0.12)', background: selectedGoal?.id===g.id ? 'rgba(79,126,221,0.08)' : 'rgba(247,247,255,0.02)' }}>
                    <span style={goalTitle}>{g.title}</span>
                    <div style={goalDiffs}>
                      {Object.entries(g.difficulties||{}).map(([m, n]) => (
                        <span key={m} style={{ ...diffBadge, color: NIVEL_COLOR[n]||'#a8a6c8', borderColor: NIVEL_COLOR[n]||'#a8a6c8' }}>{m} · {NIVEL_LABEL[n]||n}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showNew && (
              <form onSubmit={handleCreate} style={newGoalForm}>
                <div style={sectionLabel}>Novo objetivo</div>
                <input type="text" placeholder="Ex: Passar no ENEM" value={title} onChange={e=>{setTitle(e.target.value);setErr('')}} style={inp} />
                <div style={sectionLabel2}>Matérias e dificuldades</div>
                <div style={materiaGrid}>
                  {MATERIAS.map(m => {
                    const sel = diffs[m]
                    return (
                      <div key={m} style={{ ...materiaCard, borderColor: sel ? '#4f7edd' : 'rgba(168,166,200,0.12)', background: sel ? 'rgba(79,126,221,0.06)' : 'rgba(247,247,255,0.02)' }}>
                        <div style={materiaTop} onClick={() => toggleMateria(m)}>
                          <span style={{ fontSize:13, color: sel ? '#c8d8f8' : '#a8a6c8', fontWeight:500 }}>{m}</span>
                          <div style={{ ...checkbox, borderColor: sel ? '#4f7edd' : 'rgba(168,166,200,0.2)', background: sel ? '#4f7edd' : 'transparent' }}>
                            {sel && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                          </div>
                        </div>
                        {sel && (
                          <div style={nivelRow}>
                            {NIVEIS.map(n => (
                              <button key={n} type="button" onClick={() => setNivel(m, n)}
                                style={{ ...nivelBtn, background: sel===n ? NIVEL_COLOR[n]+'22' : 'transparent', color: sel===n ? NIVEL_COLOR[n] : '#a8a6c8', borderColor: sel===n ? NIVEL_COLOR[n] : 'rgba(168,166,200,0.15)' }}>
                                {NIVEL_LABEL[n]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {err && <div style={errBox}>{err}</div>}
                <div style={{ display:'flex', gap:10 }}>
                  {goals.length > 0 && <button type="button" onClick={() => { setShowNew(false); setErr('') }} style={{ ...btnOutline, flex:1 }}>Cancelar</button>}
                  <button type="submit" disabled={loadCreate} style={{ ...btnMain, opacity:loadCreate?.6:1, flex:2, marginTop:0 }}>
                    {loadCreate ? <><Spin /> Criando…</> : 'Criar objetivo'}
                  </button>
                </div>
              </form>
            )}

            {selectedGoal && !showNew && (
              <div style={{ marginTop:24 }}>
                {err && <div style={{ ...errBox, marginBottom:14 }}>{err}</div>}
                <div style={selectedInfo}>
                  <span style={{ fontSize:13, color:'#a8a6c8' }}>Objetivo selecionado:</span>
                  <span style={{ fontSize:14, fontWeight:600, color:'#f7f7ff' }}>{selectedGoal.title}</span>
                </div>
                <button onClick={handleGenerate} disabled={loadGen} style={{ ...btnMain, background: loadGen ? 'rgba(79,126,221,0.5)' : 'linear-gradient(135deg, #4f7edd, #27187e)', fontSize:15, padding:'14px 0' }}>
                  {loadGen ? <><Spin /> A IA está gerando sua tarefa…</> : '✦ Gerar tarefa com IA'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      <style>{ANIMS}</style>
    </div>
  )
}

const ANIMS = `@keyframes spin{to{transform:rotate(360deg)}}`

const dashboard   = { display:'flex', minHeight:'100vh', fontFamily:"'Inter',-apple-system,sans-serif", background:'linear-gradient(158deg,#14182b 0%,#212842 55%,#14182b 100%)', color:'#f7f7ff' }
const sidebar     = { width:240, background:'rgba(247,247,255,0.02)', borderRight:'1px solid rgba(168,166,200,0.06)', padding:'24px 14px', display:'flex', flexDirection:'column', gap:20, flexShrink:0 }
const profileSection = { display:'flex', alignItems:'center', gap:10, paddingBottom:16, borderBottom:'1px solid rgba(168,166,200,0.06)' }
const avatar      = { width:38, height:38, borderRadius:'50%', background:'#4f7edd', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, flexShrink:0 }
const profileEmail = { fontSize:12, color:'#a8a6c8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }
const sideNav     = { display:'flex', flexDirection:'column', gap:4 }
const navBtn      = { padding:'10px 12px', borderRadius:8, border:'none', fontSize:13, fontWeight:500, textAlign:'left', cursor:'pointer', fontFamily:'inherit', transition:'background .15s', display:'flex', alignItems:'center', gap:8 }
const logoutBtn   = { padding:'10px 12px', borderRadius:8, border:'1px solid rgba(168,166,200,0.1)', background:'transparent', color:'#a8a6c8', fontSize:13, fontWeight:500, cursor:'pointer', marginTop:'auto', fontFamily:'inherit', textAlign:'left' }
const main        = { flex:1, padding:'32px 40px', overflowY:'auto' }
const pageTitle   = { fontSize:24, fontWeight:700, color:'#f7f7ff', marginBottom:24, letterSpacing:'-0.3px' }
const page        = { minHeight:'100vh', background:'linear-gradient(158deg,#14182b 0%,#212842 55%,#14182b 100%)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'48px 20px', fontFamily:"'Inter',-apple-system,sans-serif" }
const container   = { width:'100%', maxWidth:680 }
const htitle      = { fontSize:26, fontWeight:700, color:'#f7f7ff', letterSpacing:'-0.5px', marginBottom:6 }
const hsub        = { fontSize:14, color:'#a8a6c8', lineHeight:1.6 }
const section     = { marginBottom:28 }
const sectionHead = { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }
const sectionLabel  = { fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'#a8a6c8' }
const sectionLabel2 = { fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'#a8a6c8', margin:'16px 0 10px', display:'block' }
const goalGrid    = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }
const goalCard    = { padding:'14px 16px', borderRadius:10, border:'1.5px solid', cursor:'pointer', transition:'all .15s', display:'flex', flexDirection:'column', gap:8, background:'none', fontFamily:'inherit', textAlign:'left' }
const goalTitle   = { fontSize:14, fontWeight:600, color:'#f7f7ff' }
const goalDiffs   = { display:'flex', flexWrap:'wrap', gap:5 }
const diffBadge   = { fontSize:11, fontWeight:500, padding:'2px 8px', borderRadius:20, border:'1px solid', background:'transparent' }
const smallBtn    = { padding:'5px 12px', borderRadius:6, border:'1px solid rgba(168,166,200,0.15)', background:'transparent', color:'#4f7edd', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', marginTop:4, alignSelf:'flex-start' }
const newGoalForm = { background:'rgba(247,247,255,0.02)', border:'1px solid rgba(168,166,200,0.08)', borderRadius:14, padding:'22px 20px', display:'flex', flexDirection:'column', gap:0 }
const materiaGrid = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, margin:'4px 0 16px' }
const materiaCard = { borderRadius:8, border:'1.5px solid', padding:'10px 12px', cursor:'pointer', transition:'all .15s' }
const materiaTop  = { display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }
const checkbox    = { width:16, height:16, borderRadius:4, border:'1.5px solid', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }
const nivelRow    = { display:'flex', gap:5, marginTop:8 }
const nivelBtn    = { flex:1, fontSize:11, fontWeight:600, padding:'4px 0', borderRadius:5, border:'1px solid', cursor:'pointer', transition:'all .15s', fontFamily:"'Inter',-apple-system,sans-serif" }
const selectedInfo = { display:'flex', flexDirection:'column', gap:3, marginBottom:14, padding:'12px 16px', background:'rgba(79,126,221,0.06)', borderRadius:8, border:'1px solid rgba(79,126,221,0.15)' }
const inp         = { width:'100%', background:'rgba(247,247,255,0.04)', border:'1.5px solid rgba(168,166,200,0.15)', borderRadius:10, color:'#f7f7ff', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, padding:'12px 14px', outline:'none', marginBottom:4, boxSizing:'border-box', transition:'border-color .2s' }
const errBox      = { background:'rgba(220,60,60,0.06)', border:'1px solid rgba(220,60,60,0.15)', borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:500, color:'#e08080', lineHeight:1.45, marginBottom:13 }
const btnMain     = { width:'100%', padding:13, border:'none', borderRadius:10, fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#4f7edd', color:'#fff', transition:'all .2s', marginTop:4 }
const btnOutline  = { padding:'6px 12px', borderRadius:6, border:'1px solid rgba(168,166,200,0.15)', background:'transparent', color:'#a8a6c8', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }
const backLink    = { background:'none', border:'none', color:'#4f7edd', fontSize:13, fontWeight:500, cursor:'pointer', padding:0, marginBottom:20, display:'inline-block', fontFamily:'inherit' }
const taskHeader  = { marginBottom:32, paddingBottom:24, borderBottom:'1px solid rgba(168,166,200,0.08)' }
const typeBadge   = { fontSize:12, fontWeight:600, color:'#4f7edd', background:'rgba(79,126,221,0.1)', border:'1px solid rgba(79,126,221,0.2)', borderRadius:20, padding:'3px 10px', display:'inline-block', marginBottom:12 }
const expectations = { fontSize:13, color:'#a8a6c8', lineHeight:1.6, padding:'10px 14px', background:'rgba(247,247,255,0.02)', borderRadius:6, border:'1px solid rgba(168,166,200,0.08)', marginTop:8 }
const questionCard = { background:'rgba(247,247,255,0.02)', border:'1px solid rgba(168,166,200,0.08)', borderRadius:12, padding:'20px', marginBottom:14 }
const questionText = { fontSize:15, color:'#f7f7ff', lineHeight:1.65, marginBottom:14 }
const qNum        = { fontWeight:700, color:'#4f7edd', marginRight:6 }
const materialText = { fontSize:13, color:'#a8a6c8', lineHeight:1.65, marginBottom:12, fontStyle:'italic', padding:'8px 12px', background:'rgba(247,247,255,0.02)', borderRadius:6 }
const altList     = { display:'flex', flexDirection:'column', gap:8 }
const altBtn      = { textAlign:'left', padding:'11px 14px', borderRadius:8, border:'1.5px solid', cursor:'pointer', fontSize:14, fontWeight:500, display:'flex', alignItems:'center', gap:10, transition:'all .15s', fontFamily:"'Inter',-apple-system,sans-serif" }
const altLetter   = { width:22, height:22, borderRadius:4, background:'rgba(247,247,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0, color:'#a8a6c8' }
const resultHeader = { textAlign:'center', marginBottom:28, padding:'28px 20px', background:'rgba(247,247,255,0.02)', borderRadius:14, border:'1px solid rgba(168,166,200,0.08)' }
const scoreBadge  = { display:'flex', flexDirection:'column', alignItems:'center', gap:2, marginTop:8 }
const feedbackList = { display:'flex', flexDirection:'column', gap:10 }
const feedbackCard = { borderRadius:10, border:'1px solid', padding:'14px 16px' }
const feedbackTop  = { display:'flex', justifyContent:'space-between', alignItems:'center' }