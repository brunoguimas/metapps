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

// ── HOMEPAGE ──────────────────────────────────────────────────
export default function Homepage() {
  const navigate = useNavigate()

  const [email,     setEmail]     = useState('')
  const [profile,   setProfile]   = useState(null)
  const [goals,     setGoals]     = useState([])
  const [view,      setView]      = useState('home') // home | roadmap | task | result
  const [input,     setInput]     = useState('')
  const [curGoal,   setCurGoal]   = useState(null)
  const [topics,    setTopics]    = useState([])
  const [deps,      setDeps]      = useState([])
  const [completed, setCompleted] = useState([])
  const [selNode,   setSelNode]   = useState(null) // clique 1
  const [task,      setTask]      = useState(null)
  const [taskNode,  setTaskNode]  = useState(null) // tópico da tarefa atual (persiste até a view result)
  const [answers,   setAnswers]   = useState({})
  const [essay,     setEssay]     = useState('')
  const [result,    setResult]    = useState(null)
  const [correction, setCorrection] = useState(null)
  const [err,       setErr]       = useState('')
  const [loading,   setLoading]   = useState(false)
  const [initDone,  setInitDone]  = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [editInput, setEditInput] = useState('')
  const [deletingGoal, setDeletingGoal] = useState(null)
  const [selPhase, setSelPhase] = useState(null) // fase (tópico pai) aberta na view 'phase'
  const mountainRef = useRef(null) // área rolável da montanha (roadmap)

  // ── inicialização ──
  useEffect(() => {
    async function init() {
      try { await refreshSession() } catch { navigate('/auth/login'); return }
      try {
        const user = await getMe()
        setEmail(user?.email || '')
      } catch { navigate('/auth/login'); return }
      try { setProfile(await getProfile()) } catch { /* ignore */ }
      try { setGoals(await listGoals()) } catch { /* ignore */ }
      setInitDone(true)
    }
    init()
  }, [navigate])

  // ── animação de chegada no roadmap: foca o cume (topo) e desce até a fase atual ──
  useEffect(() => {
    if (view !== 'roadmap') return
    const el = mountainRef.current
    if (!el) return
    // constrói fases na mesma lógica da view para achar a fase atual
    const available = getAvailable(topics, deps, completed)
    const parents = getParents(topics)
    const fases = []
    parents.forEach(p => {
      const ch = available.filter(t => t.parent_topic_id === p.id)
      if (ch.length) fases.push({ key: p.id, children: ch })
    })
    available.filter(t => !t.parent_topic_id).forEach(o => fases.push({ key: o.id, children: [o] }))
    fases.forEach((ph, i) => {
      const allDone = ph.children.length && ph.children.every(n => completed.includes(n.id))
      const hasPrev = fases.slice(0, i).some(q => !(q.children.length && q.children.every(n => completed.includes(n.id))))
      ph.current = !allDone && !hasPrev
    })
    const curIdx = Math.max(0, fases.findIndex(f => f.current))
    const N = fases.length
    const slotH = 150
    const summitReserve = 210
    el.scrollTop = 0 // começa olhando o cume
    const t = setTimeout(() => {
      const y = summitReserve + (N - 1 - curIdx) * slotH
      el.scrollTo({ top: Math.max(0, y - el.clientHeight * 0.55), behavior: 'smooth' })
    }, 550)
    return () => clearTimeout(t)
  }, [view, topics, completed, deps])

  // ── criar goal + gerar roadmap ──
  async function handleSend() {
    if (!input.trim() || loading) return
    setErr(''); setLoading(true)
    try {
      const goal    = await createGoal(input.trim(), {})
      const roadmap = await generateRoadmap(goal.id)
      const rawTopics = sa(roadmap?.topics)
      if (rawTopics.length === 0) {
        setErr('Não foi possível gerar o roadmap (nenhum tópico retornado). Tente novamente.')
        setGoals(prev => [goal, ...prev])
        return
      }
      setCurGoal(goal)
      setTopics(rawTopics)
      setDeps(sa(roadmap?.dependencies))
      setCompleted([])
      setSelNode(null)
      setGoals(prev => [goal, ...prev])
      setView('roadmap')
      setInput('')
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  // ── abrir roadmap de goal existente ──
  async function handleOpenGoal(goal) {
    if (loading) return
    setErr(''); setLoading(true)
    try {
      let roadmap
      try {
        roadmap = await getRoadmap(goal.id)
      } catch { /* ignore */ 
        roadmap = await generateRoadmap(goal.id)
      }
      const rawTopics = sa(roadmap?.topics)
      if (rawTopics.length === 0) {
        setErr('Não foi possível carregar o roadmap (nenhum tópico retornado). Tente novamente.')
        return
      }
      setCurGoal(goal)
      setTopics(rawTopics)
      setDeps(sa(roadmap?.dependencies))
      setCompleted([])
      setSelNode(null)
      setView('roadmap')
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  // uma lição já dentro de uma fase → gera a tarefa direto (um clique)
  async function handleClimbLesson(n) {
    if (n.blocked || loading) return
    setErr(''); setLoading(true)
    try {
      const t = await generateTask(n.id)
      setTask(t); setTaskNode(n); setAnswers({}); setEssay(''); setResult(null)
      setView('task')
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  // ── submeter resposta ──
  async function handleSubmit() {
    if (!task || loading) return
    setErr(''); setLoading(true); setCorrection(null)
    try {
      const isQuiz = task.type === 'quiz'
      const content = task.content || {}
      const questions = sa(content.questions)
      let response
      if (isQuiz) {
        response = Object.entries(answers).map(([qi, ans]) => ({ question_index: parseInt(qi), answer: ans }))
        if (response.length < questions.length) { setErr('Responda todas as perguntas.'); setLoading(false); return }
      } else {
        response = essay.trim()
        const words = response.split(/\s+/).filter(Boolean).length
        if (words < (content.min_words || 0)) { setErr(`Mínimo de ${content.min_words} palavras.`); setLoading(false); return }
      }
      const data = await submitAttempt(task.id, task.type, response)
      setResult(data)

      const attempt = data.task_attempt || data
      const score = typeof attempt.score === 'number' ? attempt.score : 0
      const requiredMastery = taskNode?.required_mastery ?? 0.7
      const topicId = task.topic_id || taskNode?.id
      const mastered = score >= requiredMastery
      if (topicId && mastered) {
        setCompleted(prev => prev.includes(topicId) ? prev : [...prev, topicId])
      }

      setView('result')

      const attemptId = attempt.id
      if (attemptId) {
        try {
          const corr = await generateCorrection(attemptId, task.type)
          setCorrection(corr)
        } catch { /* ignore */ }
      }

      if (mastered) {
        const xpGain = Math.round((taskNode?.weight || 1) * 10)
        if (xpGain > 0) {
          try {
            const updatedProfile = await addXP(xpGain)
            if (updatedProfile) setProfile(updatedProfile)
          } catch { /* ignore */ }
        }
      }
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  // ── logout ──
  function handleLogout() { apiLogout(); navigate('/auth/login') }

  async function handleUpdateGoal() {
    if (!editingGoal || !editInput.trim()) return
    setErr(''); setLoading(true)
    try {
      await updateGoal(editingGoal.id, editInput.trim(), editingGoal.settings || {})
      setGoals(prev => prev.map(g => g.id === editingGoal.id ? { ...g, title: editInput.trim() } : g))
      setEditingGoal(null); setEditInput('')
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
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

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/png','image/jpeg','image/gif','image/webp']
    if (!allowed.includes(file.type)) { setErr('Tipo não permitido. Use PNG, JPG, GIF ou WebP.'); return }
    if (file.size > 10*1024*1024) { setErr('O arquivo deve ter no máximo 10MB.'); return }
    setErr(''); setLoading(true)
    try {
      const data = await uploadAvatar(file)
      if (data?.avatar_url) setProfile(prev => ({ ...prev, avatar_url: data.avatar_url }))
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  if (!initDone) return (
    <div style={center}>
      <GlobalStyles/>
      <MountainMark size={40} color="#6382FF" style={{ animation:'metaPulse 1.6s ease-in-out infinite' }}/>
      <div style={{ marginTop:14, fontWeight:700, color:'#8A8AA3', fontSize:13 }}>Preparando sua jornada…</div>
    </div>
  )

  // ── VIEWS ─────────────────────────────────────────────────

  // HOME
  if (view === 'home') {
    const username = email?.split('@')[0] || ''
    return (
    <div style={page}>
      <GlobalStyles/>
      <div style={header}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <MountainMark size={22} color="#F5C542"/>
          <span style={{ fontWeight:800, fontSize:16, color:'#f5f4ff', letterSpacing:'-0.02em' }}>Metapps</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setView('profile')} style={iconNavBtn} aria-label="Perfil"><IconUser/></button>
          <button onClick={handleLogout} style={iconNavBtn} aria-label="Sair"><IconLogout/></button>
        </div>
      </div>

      <div style={box}>
        {username && <div style={welcomeText}>Bem-vindo(a) de volta, <b style={{ color:'#1E1E32' }}>{username}</b></div>}

        <div style={{ ...card, marginTop:14, padding:0, overflow:'hidden' }}>
          <div style={homeSceneBg}>
            <MiniPeaks/>
            <div style={{ position:'relative', padding:'18px 20px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={peakBadge}><MountainMark size={18} color="#6382FF"/></div>
                <div>
                  <h2 style={h2}>Qual montanha você quer escalar?</h2>
                  <div style={{ fontSize:12, color:'#5B5B78', fontWeight:600, marginTop:2 }}>Descreva um objetivo e sua trilha é gerada na hora</div>
                </div>
              </div>
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
                <span style={{ fontSize:12, color:'#6382FF', fontWeight:700 }}>Definindo checkpoints da jornada…</span>
              </div>
            )}

            {goals.length > 0 && (
              <div style={{ marginTop:26 }}>
                <div style={label}>Suas montanhas</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {goals.slice(0,8).map(g => (
                    <div key={g.id} style={{ display:'flex', gap:8 }}>
                      <button onClick={() => handleOpenGoal(g)} style={{ ...goalBtn, flex:1 }}>
                        <span style={goalIconWrap}><MountainMark size={14} color="#6382FF"/></span>
                        <span style={{ flex:1 }}>{g.title}</span>
                        <IconChevron/>
                      </button>
                      <button onClick={() => { setEditingGoal(g); setEditInput(g.title) }}
                        style={squareIconBtn} aria-label="Editar">
                        <IconEdit/>
                      </button>
                      <button onClick={() => setDeletingGoal(g)}
                        style={{ ...squareIconBtn, color:'#F06A6A' }} aria-label="Excluir">
                        <IconTrash/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {editingGoal && (
          <div style={overlay} onClick={() => setEditingGoal(null)}>
            <div style={modal} onClick={e => e.stopPropagation()}>
              <h3 style={modalTitle}>Editar objetivo</h3>
              <textarea value={editInput} onChange={e => setEditInput(e.target.value)}
                rows={2} autoFocus style={ta}/>
              {err && <div style={errStyle}><IconAlert/> {err}</div>}
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button onClick={() => setEditingGoal(null)} style={btnGhost}>
                  Cancelar
                </button>
                <button onClick={handleUpdateGoal} disabled={!editInput.trim()||loading} style={{ ...btn, flex:1, marginTop:0, opacity:(!editInput.trim()||loading)?0.6:1 }}>
                  {loading ? <Spinner/> : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {deletingGoal && (
          <div style={overlay} onClick={() => setDeletingGoal(null)}>
            <div style={modal} onClick={e => e.stopPropagation()}>
              <h3 style={modalTitle}>Excluir objetivo</h3>
              <p style={{ color:'#8A8AA3', fontSize:14, lineHeight:1.6 }}>
                Tem certeza que deseja excluir <strong style={{ color:'#1E1E32' }}>{deletingGoal.title}</strong>? Esta trilha e seu progresso serão perdidos.
              </p>
              {err && <div style={errStyle}><IconAlert/> {err}</div>}
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button onClick={() => setDeletingGoal(null)} style={btnGhost}>
                  Cancelar
                </button>
                <button onClick={() => handleDeleteGoal(deletingGoal)} disabled={loading} style={{ ...btn, flex:1, marginTop:0, background:'#F06A6A', boxShadow:'0 8px 20px rgba(240,106,106,0.35)', opacity:loading?0.6:1 }}>
                  {loading ? <Spinner/> : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
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
                  <div key={ph.key} style={{ position:'absolute', left:`${a.x}%`, top:a.y, transform:`translate(-50%,-100%) scale(${a.scale})`, transformOrigin:'50% 100%', zIndex:3 }}>
                    <StageLandmark
                      theme={THEMES[themeIdx]}
                      state={ph.done ? 'done' : ph.current ? 'current' : ph.locked ? 'locked' : 'open'}
                      title={ph.parent.title}
                      count={{ done: ph.children.filter(n => completed.includes(n.id)).length, total: ph.children.length }}
                      onClick={() => { if (ph.locked) return; setSelPhase({ ...ph, theme: THEMES[themeIdx] }); setView('phase') }}
                      disabled={ph.locked}
                    />
                  </div>
                )
              })}

              <div style={{ position:'absolute', left:'50%', bottom:6, transform:'translateX(-50%)', zIndex:1, color:'rgba(154,180,255,0.4)', fontSize:10, fontWeight:700, letterSpacing:'0.5px' }}>
                ▾ BASE ▾
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

        {!isQuiz && (
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:20, marginBottom:12 }}>
            {content.material?.filter(m=>m.type==='text').map((m,mi) => <p key={mi} style={{ fontSize:13, color:'rgba(245,244,255,0.5)', fontStyle:'italic', padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:6, marginBottom:12 }}>{m.data}</p>)}
            <p style={{ fontSize:15, color:'#f5f4ff', lineHeight:1.65, marginBottom:10 }}>{content.instructions}</p>
            <p style={{ fontSize:12, color:'rgba(245,244,255,0.35)', marginBottom:10 }}>{content.min_words}–{content.max_words} palavras</p>
            <textarea value={essay} onChange={e=>{setEssay(e.target.value);setErr('')}} placeholder="Escreva sua resposta aqui…" rows={10}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1.5px solid rgba(255,255,255,0.08)', borderRadius:10, color:'#f5f4ff', fontFamily:'inherit', fontSize:14, padding:'12px 14px', outline:'none', resize:'vertical', lineHeight:1.6, boxSizing:'border-box' }} />
            <p style={{ fontSize:12, color:'rgba(245,244,255,0.35)', marginTop:6 }}>{essay.trim() ? essay.trim().split(/\s+/).length : 0} palavras</p>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {ph.children.map(n => (
              <LessonRow key={n.id} n={n} done={completed.includes(n.id)} current={selNode?.id===n.id} onClick={() => handleClimbLesson(n)} accent={theme.accent}/>
            ))}
          </div>

          {err && <div style={{ ...errDark, marginTop:16 }}><IconAlert/> {err}</div>}
        </div>
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

          {correction && (
            <div style={correctionCard}>
              <div style={correctionEyebrow}><IconSpark/> Feedback da jornada</div>
              {typeof correction === 'string' ? (
                <p style={{ color:'#1E1E32', fontSize:14, lineHeight:1.7, whiteSpace:'pre-wrap', margin:0 }}>{correction}</p>
              ) : (
                <>
                  {correction.summary && <p style={{ color:'#1E1E32', fontSize:14, lineHeight:1.7, marginBottom:10 }}>{correction.summary}</p>}
                  {sa(correction.feedback || correction.comments || correction.items).map((f, i) => (
                    <div key={i} style={feedbackItem}>
                      {typeof f === 'string' ? (
                        <p style={{ color:'#4A4A66', fontSize:13, lineHeight:1.6, margin:0 }}>{f}</p>
                      ) : (
                        <>
                          {f.comment && <p style={{ color:'#4A4A66', fontSize:13, lineHeight:1.6, margin:'0 0 4px' }}>{f.comment}</p>}
                          {f.correct === false && <p style={{ color:'#F06A6A', fontSize:12, lineHeight:1.5, margin:0, fontWeight:700 }}>Correta: {f.correct_answer ?? f.expected}</p>}
                          {f.explanation && <p style={{ color:'#8A8AA3', fontSize:12, fontStyle:'italic', lineHeight:1.5, margin:'4px 0 0' }}>{f.explanation}</p>}
                        </>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {ev?.items && sa(ev.items).map((item, i) => {
            const q    = questions[i] || {}
            const opts = sa(q.options || q.alternatives)
            const ok   = item.correct || item.is_correct || false
            const sub  = item.submitted_answer ?? item.selected_answer ?? item.answer
            const cor  = item.correct_answer   ?? item.expected_answer
            return (
              <div key={i} style={{ ...reviewRow, ...(ok?reviewRowOk:reviewRowBad) }}>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                  {ok ? <IconCheck color="#3ECF8E"/> : <IconX color="#F06A6A"/>}
                  <span style={{ color:ok?'#0E7A55':'#B23A3A', fontWeight:800, fontSize:12.5 }}>Questão {i+1}</span>
                  {opts[sub] !== undefined && <span style={{ color:'#8A8AA3', fontSize:11.5, marginLeft:'auto' }}>Sua: {opts[sub]}</span>}
                </div>
                {!ok && opts[cor] && <p style={{ color:'#8A8AA3', fontSize:12, margin:'4px 0 0', lineHeight:1.5 }}>Correta: {opts[cor]}</p>}
                {item.explanation && <p style={{ color:'#8A8AA3', fontSize:12, margin:'4px 0 0', lineHeight:1.5, fontStyle:'italic' }}>{item.explanation}</p>}
              </div>
            )
          })}

          <div style={{ display:'flex', gap:10, marginTop:18 }}>
            <button onClick={() => { setView('task'); setAnswers({}); setEssay(''); setResult(null) }} style={btnGhost}>
              Tentar novamente
            </button>
            <button onClick={() => setView('roadmap')} style={{ ...btn, flex:1, marginTop:0 }}>
              Próxima lição <IconArrowRight/>
            </button>
          </div>
        </div>
      </div>
    )
  }

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