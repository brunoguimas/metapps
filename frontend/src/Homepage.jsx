import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  logout as apiLogout, refreshSession,
  listGoals, createGoal, generateRoadmap, generateTask,
  submitAttempt, getProfile, getMe, getRoadmap,
  generateCorrection, uploadAvatar,
  updateGoal, deleteGoal
} from './api'

// ── helpers ──
const sa = v => Array.isArray(v) ? v : []

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

  // ── clique no nó: 1x seleciona, 2x gera tarefa ──
  async function handleNodeClick(n) {
    if (n.blocked || loading) return
    if (selNode?.id === n.id) {
      // segundo clique → gera tarefa
      setSelNode(null); setErr(''); setLoading(true)
      try {
        const t = await generateTask(n.id)
        setTask(t); setTaskNode(n); setAnswers({}); setEssay(''); setResult(null)
        setView('task')
      } catch(e) { setErr(e.message) }
      finally { setLoading(false) }
    } else {
      setSelNode(n)
    }
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
        try {
          const updatedProfile = await getProfile()
          if (updatedProfile) setProfile(updatedProfile)
        } catch { /* ignore */ }
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

  async function handleDeleteGoal(goal) {
    setErr(''); setLoading(true)
    try {
      await deleteGoal(goal.id)
      setGoals(prev => prev.filter(g => g.id !== goal.id))
      setDeletingGoal(null)
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

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

        <div style={{ ...card, marginTop:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <div style={peakBadge}><MountainMark size={18} color="#6382FF"/></div>
            <div>
              <h2 style={h2}>Qual montanha você quer escalar?</h2>
              <div style={{ fontSize:12.5, color:'#8A8AA3', fontWeight:600, marginTop:2 }}>Descreva um objetivo e sua trilha é gerada na hora</div>
            </div>
          </div>

          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()} }}
            placeholder="Ex: Funções do segundo grau, Revolução Francesa..."
            rows={3} style={ta}/>

          {err && <div style={errStyle}><IconAlert/> {err}</div>}

          <button onClick={handleSend} disabled={!input.trim()||loading} style={{ ...btn, opacity:(!input.trim()||loading)?0.6:1 }}>
            {loading ? <><Spinner/> Traçando a trilha…</> : <>Gerar roadmap <IconArrowRight/></>}
          </button>

          {loading && (
            <div style={buildingPanel}>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <div style={{ ...pulseDot, animationDelay:'0s' }}/>
                <div style={{ ...pulseDot, animationDelay:'.2s' }}/>
                <div style={{ ...pulseDot, animationDelay:'.4s' }}/>
              </div>
              <span style={{ fontSize:12, color:'#6382FF', fontWeight:700 }}>Definindo checkpoints da jornada…</span>
            </div>
          )}

          {goals.length > 0 && (
            <div style={{ marginTop:26 }}>
              <div style={label}>Objetivos anteriores</div>
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

  // ROADMAP
  if (view === 'roadmap') {
    const available = getAvailable(topics, deps, completed)
    const parents = getParents(topics)
    const childrenOf = (parentId) => available.filter(t => t.parent_topic_id === parentId)
    // tópicos principais sem parent que também são folha (sem subtópicos)
    const orphanLeaves = available.filter(t => !t.parent_topic_id)
    const totalLeaves = available.length
    const doneLeaves = available.filter(n => completed.includes(n.id)).length
    const progressPct = totalLeaves ? Math.round((doneLeaves / totalLeaves) * 100) : 0

    return (
      <div style={roadmapPage}>
        <GlobalStyles/>
        <MountainsBackground/>
        <div style={{ ...header, background:'rgba(26,26,46,0.72)', backdropFilter:'blur(10px)' }}>
          <button onClick={() => setView('home')} style={iconNavBtn} aria-label="Início"><IconArrowLeft/></button>
          <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14, textAlign:'center', flex:1, padding:'0 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{curGoal?.title}</span>
          <button onClick={handleLogout} style={iconNavBtn} aria-label="Sair"><IconLogout/></button>
        </div>

        <div style={{ ...roadmapBox }}>
          <div style={roadmapPeakCard}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <IconFlag/>
              <div>
                <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.5px', textTransform:'uppercase', color:'#F5C542' }}>Cume · objetivo</div>
                <div style={{ fontSize:14, fontWeight:800, color:'#f5f4ff', marginTop:2 }}>{curGoal?.title}</div>
              </div>
            </div>
            <div style={{ marginTop:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#9AB4FF', fontWeight:700, marginBottom:6 }}>
                <span>Progresso da trilha</span><span>{progressPct}%</span>
              </div>
              <div style={roadmapTrailBarTrack}><div style={{ ...roadmapTrailBarFill, width:`${progressPct}%` }}/></div>
            </div>
          </div>

          <p style={{ color:'rgba(245,244,255,0.55)', fontSize:12.5, margin:'18px 0', textAlign:'center' }}>
            Toque uma vez para selecionar o checkpoint · toque de novo para iniciá-lo
          </p>

          {err && <div style={{ ...errDark }}><IconAlert/> {err}</div>}

          {loading && (
            <div style={{ ...taskLoadingPanelDark }}>
              <FlagLoader/>
              <div style={{ fontSize:13, fontWeight:800, color:'#F5F4FF', marginTop:12 }}>Preparando seu checkpoint…</div>
              <div style={{ fontSize:11.5, color:'#9AB4FF', marginTop:4 }}>Posicionando a bandeira na trilha</div>
            </div>
          )}

          {!loading && available.length === 0 && (
            <div style={{ color:'rgba(245,244,255,0.5)', textAlign:'center', padding:24, fontSize:13 }}>
              Nenhum tópico disponível.
            </div>
          )}

          {!loading && parents.map(parent => {
            const children = childrenOf(parent.id)
            if (children.length === 0) return null
            return (
              <div key={parent.id} style={{ marginBottom:30, position:'relative', zIndex:2 }}>
                <div style={roadmapSectionHeader}><span style={sectionDot}/>{parent.title}</div>
                <div style={trailWrap}>
                  <div style={roadmapTrailLine}/>
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    {children.map((n, i) => (
                      <div key={n.id} style={{ display:'flex', justifyContent: i%2===0 ? 'flex-start' : 'flex-end', position:'relative' }}>
                        <TrailDot state={completed.includes(n.id)?'done':selNode?.id===n.id?'sel':n.blocked?'locked':'open'} side={i%2===0?'left':'right'}/>
                        <NodeCard n={n} sel={selNode?.id===n.id} done={completed.includes(n.id)} onClick={() => handleNodeClick(n)} dark />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          {!loading && orphanLeaves.length > 0 && (
            <div style={{ ...trailWrap, zIndex:2 }}>
              <div style={roadmapTrailLine}/>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {orphanLeaves.map((n, i) => (
                  <div key={n.id} style={{ display:'flex', justifyContent: i%2===0 ? 'flex-start' : 'flex-end', position:'relative' }}>
                    <TrailDot state={completed.includes(n.id)?'done':selNode?.id===n.id?'sel':n.blocked?'locked':'open'} side={i%2===0?'left':'right'}/>
                    <NodeCard n={n} sel={selNode?.id===n.id} done={completed.includes(n.id)} onClick={() => handleNodeClick(n)} dark />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // TASK
  if (view === 'task' && task) {
    const isQuiz   = task.type === 'quiz'
    const content  = task.content || {}
    const questions = sa(content.questions)
    const title    = content.title || task.meta?.title || 'Tarefa'
    const desc     = content.description || task.meta?.description || ''
    const taskPct  = isQuiz
      ? Math.round((Object.keys(answers).length / (questions.length || 1)) * 100)
      : Math.min(100, essay.trim() ? Math.round((essay.trim().split(/\s+/).filter(Boolean).length / (content.min_words || 1)) * 100) : 0)

    return (
      <div style={page}>
        <GlobalStyles/>
        <div style={header}>
          <button onClick={() => setView('roadmap')} style={iconNavBtn} aria-label="Voltar"><IconArrowLeft/></button>
          <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14, textAlign:'center', flex:1, padding:'0 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</span>
          <span style={{ width:36 }}/>
        </div>

        <div style={box}>
          <div style={taskProgressTrack}><div style={{ ...taskProgressFill, width:`${taskPct}%` }}/></div>

          {desc && <p style={{ color:'#8A8AA3', fontSize:13.5, margin:'16px 0 20px', lineHeight:1.6 }}>{desc}</p>}

          {isQuiz && questions.map((q, qi) => (
            <div key={qi} style={questionCard}>
              {q.material && <div style={materialTag}>{q.material}</div>}
              <p style={{ color:'#1E1E32', fontSize:15, marginBottom:14, lineHeight:1.6, fontWeight:600 }}>
                <span style={{ color:'#6382FF' }}>{qi+1}.</span> {q.question || q.statement}
              </p>
              {sa(q.options || q.alternatives).map((opt, ai) => {
                const sel = answers[qi] === ai
                return (
                  <button key={ai} onClick={() => setAnswers(p => ({...p,[qi]:ai}))}
                    style={{ ...optionBtn, ...(sel?optionBtnSel:{}) }}>
                    <span style={{ ...optionKey, ...(sel?optionKeySel:{}) }}>
                      {String.fromCharCode(65+ai)}
                    </span>
                    {opt}
                  </button>
                )
              })}
            </div>
          ))}

          {!isQuiz && (
            <div style={{ marginBottom:16 }}>
              <div style={questionCard}>
                <p style={{ color:'#1E1E32', fontSize:15, marginBottom:10, lineHeight:1.6, fontWeight:600 }}>{content.instructions}</p>
                <p style={{ color:'#8A8AA3', fontSize:12, marginBottom:10, fontWeight:700 }}>{content.min_words}–{content.max_words} palavras</p>
                <textarea value={essay} onChange={e=>{setEssay(e.target.value);setErr('')}}
                  placeholder="Escreva sua resposta aqui…" rows={12}
                  style={{ ...ta, marginBottom:6 }}/>
                <p style={{ color:'#8A8AA3', fontSize:12, fontWeight:700, textAlign:'right' }}>{essay.trim()?essay.trim().split(/\s+/).filter(Boolean).length:0} palavras</p>
              </div>
            </div>
          )}

          {err && <div style={errStyle}><IconAlert/> {err}</div>}
          <button onClick={handleSubmit} disabled={loading} style={{ ...btn, opacity:loading?0.6:1 }}>
            {loading ? <><Spinner/> Enviando…</> : <>Enviar resposta <IconArrowRight/></>}
          </button>
        </div>
      </div>
    )
  }

  // RESULT
  if (view === 'result' && result) {
    const attempt  = result.task_attempt || result
    const score    = typeof attempt.score === 'number' ? attempt.score : 0
    const pct      = Math.round(score * 100)
    const mc       = score>=0.7 ? '#3ECF8E' : score>=0.4 ? '#F5C542' : '#F06A6A'
    let ev = null
    try { ev = typeof attempt.task_evaluation==='string' ? JSON.parse(attempt.task_evaluation) : attempt.task_evaluation } catch { /* ignore */ }
    const content   = task?.content || {}
    const questions = sa(content.questions)
    const requiredMastery = taskNode?.required_mastery ?? 0.7
    const mastered = score >= requiredMastery
    const ringCirc = 2 * Math.PI * 52

    return (
      <div style={page}>
        <GlobalStyles/>
        <div style={header}>
          <button onClick={() => setView('roadmap')} style={iconNavBtn} aria-label="Roadmap"><IconArrowLeft/></button>
          <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14 }}>Resultado</span>
          <span style={{ width:36 }}/>
        </div>

        <div style={box}>
          <div style={{ ...resultCard, ...(mastered?{ boxShadow:`0 0 0 1px ${mc}33, 0 16px 40px ${mc}22` }:{}) }}>
            {mastered && <div style={{ position:'absolute', inset:0, borderRadius:22, animation:'metaGlow 1.8s ease-in-out infinite', background:`radial-gradient(circle at 50% 20%, ${mc}22, transparent 70%)` }}/>}
            <svg width="128" height="128" viewBox="0 0 128 128" style={{ position:'relative' }}>
              <circle cx="64" cy="64" r="52" fill="none" stroke="#F5F4FF" strokeWidth="10"/>
              <circle cx="64" cy="64" r="52" fill="none" stroke={mc} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={ringCirc} strokeDashoffset={ringCirc - (ringCirc*pct/100)}
                transform="rotate(-90 64 64)" style={{ transition:'stroke-dashoffset .8s ease' }}/>
              <text x="64" y="60" textAnchor="middle" fontSize="26" fontWeight="800" fill="#1E1E32">{pct}%</text>
              <text x="64" y="78" textAnchor="middle" fontSize="10" fontWeight="700" fill="#8A8AA3">ACERTOS</text>
            </svg>
            <div style={{ color:'#1E1E32', fontSize:16, fontWeight:800, marginTop:10, position:'relative', display:'flex', alignItems:'center', gap:6 }}>
              {mastered && <MountainMark size={16} color="#F5C542"/>}
              {mastered?'Checkpoint conquistado!':score>=0.4?'Bom esforço! Tente novamente para concluir.':'Continue tentando!'}
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

  // PERFIL
  if (view === 'profile') {
    const level    = profile?.level || 1
    const xp       = profile?.xp    || 0
    const xpInLevel = xp % 100
    const xpNext   = 100
    const pct      = Math.min(100, Math.round(xpInLevel / xpNext * 100))
    const username = profile?.username || email?.split('@')[0] || 'Usuário'
    return (
      <div style={page}>
        <GlobalStyles/>
        <div style={header}>
          <button onClick={() => setView('home')} style={iconNavBtn} aria-label="Início"><IconArrowLeft/></button>
          <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14 }}>Perfil</span>
          <button onClick={handleLogout} style={iconNavBtn} aria-label="Sair"><IconLogout/></button>
        </div>
        <div style={box}>
          <div style={{ ...card, textAlign:'center', paddingTop:28 }}>
            <label style={{ position:'relative', cursor:'pointer', display:'inline-block' }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" style={avatarImg}/>
              ) : (
                <div style={avatarFallback}>{username[0]?.toUpperCase()||'?'}</div>
              )}
              <div style={levelBadge}>{level}</div>
              <div style={avatarEditBtn}><IconEdit size={11}/></div>
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleAvatarUpload} style={{ display:'none' }}/>
            </label>
            <div style={{ fontSize:18, fontWeight:800, color:'#1E1E32', marginTop:12 }}>{username}</div>
            <div style={{ fontSize:12.5, color:'#8A8AA3', marginTop:2 }}>{email}</div>

            {err && <div style={{ ...errStyle, textAlign:'left' }}><IconAlert/> {err}</div>}

            <div style={{ marginTop:20, textAlign:'left' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, marginBottom:8 }}>
                <span style={{ color:'#1E1E32' }}>Nível {level}</span>
                <span style={{ color:'#8A8AA3' }}>{xpInLevel} / {xpNext} XP</span>
              </div>
              <div style={trailBarTrack}>
                <div style={{ ...trailBarFill, width:`${pct}%`, background:'linear-gradient(90deg,#6382FF,#9AB4FF)' }}/>
                <div style={{ ...xpMarker, left:`calc(${pct}% - 8px)` }}><MountainMark size={10} color="#fff"/></div>
              </div>
              <div style={{ fontSize:11, color:'#8A8AA3', marginTop:6, textAlign:'right', fontWeight:700 }}>{Math.max(0,xpNext-xpInLevel)} XP para o nível {level+1}</div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:16 }}>
            {[{l:'Nível',v:level,c:'#6382FF',bg:'rgba(99,130,255,0.1)'},{l:'XP total',v:xp,c:'#F5C542',bg:'rgba(245,197,66,0.14)'},{l:'Próximo nível',v:`${Math.max(0,xpNext-xpInLevel)} XP`,c:'#3ECF8E',bg:'rgba(62,207,142,0.12)'}].map(({l,v,c,bg}) => (
              <div key={l} style={statCard}>
                <div style={{ ...statIconWrap, background:bg }}><MountainMark size={14} color={c}/></div>
                <div style={{ fontSize:18, fontWeight:800, color:c, marginTop:8 }}>{v}</div>
                <div style={{ fontSize:10, color:'#8A8AA3', marginTop:2, fontWeight:700 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return <div style={center}><Spinner size={22}/></div>
}

// ─── componentes auxiliares ─────────────────────────────────
function NodeCard({ n, sel, done, onClick, dark }) {
  const state = done ? 'done' : sel ? 'sel' : n.blocked ? 'locked' : 'open'
  const styles = dark ? {
    done:   { border:'2px solid rgba(62,207,142,0.65)', background:'rgba(62,207,142,0.12)', boxShadow:'0 8px 24px rgba(62,207,142,0.18)', color:'#F5F4FF' },
    sel:    { border:'2px solid #6382FF', background:'rgba(99,130,255,0.16)', boxShadow:'0 10px 26px rgba(99,130,255,0.35)', color:'#F5F4FF' },
    locked: { border:'2px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.02)', color:'#8A8AA3' },
    open:   { border:'2px solid rgba(154,180,255,0.25)', background:'rgba(245,244,255,0.07)', color:'#F5F4FF', boxShadow:'0 6px 20px rgba(0,0,0,0.25)' },
  } : {
    done:   { border:'2px solid #3ECF8E', background:'rgba(62,207,142,0.08)', color:'#1E1E32' },
    sel:    { border:'2px solid #6382FF', background:'rgba(99,130,255,0.1)', boxShadow:'0 8px 20px rgba(99,130,255,0.25)', color:'#1E1E32' },
    locked: { border:'2px solid rgba(30,30,50,0.06)', background:'rgba(30,30,50,0.02)', color:'#8A8AA3' },
    open:   { border:'2px solid rgba(99,130,255,0.18)', background:'#fff', color:'#1E1E32' },
  }
  const descColor = dark ? '#8D91B8' : '#8A8AA3'
  return (
    <button onClick={onClick} disabled={n.blocked}
      style={{ width:220, padding:'14px 16px', borderRadius:16, cursor:n.blocked?'not-allowed':'pointer', fontFamily:'inherit', textAlign:'left', opacity:n.blocked?0.5:1, transition:'all .2s', boxShadow: state==='sel' && !dark ? '0 8px 20px rgba(99,130,255,0.25)' : undefined, ...styles[state] }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
        {done && <IconCheck color={dark?'#3ECF8E':'#3ECF8E'} size={14}/>}
        {n.blocked && <IconLock size={12}/>}
        <div style={{ fontSize:13, fontWeight:800 }}>{n.title}</div>
      </div>
      {n.description && <div style={{ fontSize:11, color:descColor, lineHeight:1.4 }}>{n.description.slice(0,80)}{n.description.length>80?'…':''}</div>}
      {sel && <div style={{ fontSize:11, color:'#6382FF', marginTop:8, fontWeight:800 }}>Toque novamente para gerar a tarefa</div>}
      {done && <div style={{ fontSize:11, color:'#3ECF8E', marginTop:8, fontWeight:800 }}>Concluído</div>}
    </button>
  )
}

function TrailDot({ state, side }) {
  const colors = { done:'#3ECF8E', sel:'#6382FF', locked:'#5A5A78', open:'#9AB4FF' }
  const hue = { done:'#3ECF8E', sel:'#6382FF', locked:'#5A5A78', open:'#9AB4FF' }
  return (
    <div style={{ position:'absolute', top:18, [side==='left'?'left':'right']:'calc(50% - 6px)', width:12, height:12, borderRadius:'50%', background:colors[state], boxShadow:`0 0 0 4px #1A1A2E, 0 0 0 6px ${hue[state]}40`, zIndex:2, ...(state==='sel'?{ animation:'metaPulseDot 1.4s ease-in-out infinite' }:{}) }}/>
  )
}

function MountainMark({ size=20, color='#6382FF', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M2 19L8.5 8L12.5 14.5L15 10.5L22 19H2Z" fill={color}/>
      <circle cx="12.5" cy="6" r="1.6" fill="#F5C542"/>
    </svg>
  )
}

function Spinner({ size=14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation:'metaSpin .8s linear infinite', verticalAlign:'-2px', marginRight:6 }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3"/>
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

function FlagLoader() {
  return (
    <svg width="88" height="100" viewBox="0 0 88 100">
      <circle cx="44" cy="86" r="6" fill="#6382FF"/>
      <line x1="44" y1="86" x2="44" y2="18" stroke="#9AB4FF" strokeWidth="3" strokeLinecap="round" style={{ animation:'metaFlagPole 1.4s ease-in-out infinite' }}/>
      <path d="M44,20 L44,42 L72,31 Z" fill="#F5C542" style={{ animation:'metaFlagWave 1.4s ease-in-out infinite' }}/>
    </svg>
  )
}

// Fundo de montanhas em camadas, fixo atrás do conteúdo do roadmap.
function MountainsBackground() {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:0, overflow:'hidden', pointerEvents:'none' }}>
      <svg width="100%" height="100%" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" style={{ display:'block' }}>
        <defs>
          <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1A1A2E"/>
            <stop offset="0.55" stopColor="#1E2040"/>
            <stop offset="1" stopColor="#232547"/>
          </linearGradient>
          <linearGradient id="moonGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9AB4FF"/>
            <stop offset="1" stopColor="#6382FF"/>
          </linearGradient>
        </defs>

        <rect width="1440" height="900" fill="url(#roadGrad)"/>

        {/* Estrelas */}
        <g fill="#FFFFFF" opacity="0.5">
          <circle cx="180" cy="120" r="1.6"/><circle cx="420" cy="70" r="1.2"/>
          <circle cx="620" cy="150" r="1.4"/><circle cx="850" cy="90" r="1.8"/>
          <circle cx="1040" cy="170" r="1.2"/><circle cx="1230" cy="110" r="1.6"/>
          <circle cx="1350" cy="60"  r="1.3"/><circle cx="320" cy="210" r="1.1"/>
          <circle cx="1120" cy="230" r="1.5"/><circle cx="70"  cy="250" r="1.2"/>
        </g>

        {/* Lua */}
        <circle cx="1140" cy="150" r="46" fill="url(#moonGlow)" opacity="0.9"/>
        <circle cx="1155" cy="140" r="40" fill="#1A1A2E" opacity="0.35"/>

        {/* Cordilheira mais distante */}
        <g fill="#2A2D52" opacity="0.9">
          <polygon points="0,620 180,470 340,610 560,450 780,600 980,470 1200,610 1440,500 1440,900 0,900"/>
          <polygon points="0,660 240,540 420,640 700,520 960,650 1220,540 1440,650 1440,900 0,900"/>
        </g>

        {/* Picos nevados intermediários */}
        <g fill="#333766">
          <polygon points="120,820 420,580 660,770 900,620 1200,790 1440,680 1440,900 0,900" opacity="0.95"/>
        </g>

        {/* Nevadas nos picos MAIS ALTOS */}
        <g fill="#F5F4FF">
          <polygon points="388,600 420,580 452,600 420,632 Z" opacity="0.9"/>
          <polygon points="868,640 900,620 932,640 900,676 Z" opacity="0.85"/>
        </g>

        {/* Primeiro plano */}
        <path d="M0,850 C260,730 480,820 760,760 C1040,700 1260,800 1440,740 L1440,900 0,900 Z" fill="#1B1D3B"/>

        {/* Trilha tracejada subindo */}
        <path d="M40,880 C220,840 300,780 420,760 C560,738 620,700 720,690 C840,678 900,650 1000,646" fill="none" stroke="#9AB4FF" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 10"/>

        {/* Pontos-bandeira de referência ao longo da trilha */}
        <circle cx="290" cy="795" r="6" fill="#F5C542" opacity="0.85"/>
        <circle cx="620" cy="708" r="6" fill="#6382FF" opacity="0.85"/>
        <circle cx="1000" cy="646" r="7" fill="#3ECF8E" opacity="0.9"/>
        <polygon points="1000,646 1008,636 1000,628 992,636" fill="#F5F4FF"/>
      </svg>
    </div>
  )
}

function IconEdit({ size=14 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> }
function IconTrash({ size=14 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> }
function IconLock({ size=14 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> }
function IconCheck({ size=16, color='currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> }
function IconX({ size=16, color='currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg> }
function IconArrowLeft() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> }
function IconArrowRight() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign:'-3px', marginLeft:6 }}><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg> }
function IconChevron() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A8AA3" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg> }
function IconUser() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg> }
function IconLogout() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg> }
function IconFlag() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5C542" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4"/><path d="M4 4h14l-3 4 3 4H4"/></svg> }
function IconAlert() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign:'-3px', marginRight:6, flexShrink:0 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg> }
function IconSpark() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="#9AB4FF" style={{ verticalAlign:'-2px', marginRight:6 }}><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z"/></svg> }

function GlobalStyles() {
  return (
    <style>{`
      @keyframes metaSpin { to { transform: rotate(360deg); } }
      @keyframes metaPulse { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(1.12); opacity:0.75; } }
      @keyframes metaPulseDot { 0%,100% { transform: scale(1); box-shadow:0 0 0 4px #F5F4FF; } 50% { transform: scale(1.35); box-shadow:0 0 0 4px #F5F4FF, 0 0 0 8px rgba(99,130,255,0.25); } }
      @keyframes metaFlagPole { 0% { stroke-dasharray: 0 68; } 60%,100% { stroke-dasharray: 68 68; } }
      @keyframes metaFlagWave { 0%,55% { opacity:0; transform: translateX(-4px); } 100% { opacity:1; transform: translateX(0); } }
      @keyframes metaGlow { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
      @keyframes metaFadeUp { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
    `}</style>
  )
}

// ─── CSS ──────────────────────────────────────────────────────
const page    = { minHeight:'100vh', background:'#F5F4FF', color:'#1E1E32', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased' }
const header  = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', background:'#1A1A2E', position:'sticky', top:0, zIndex:10, borderRadius:'0 0 20px 20px', boxShadow:'0 8px 24px rgba(26,26,46,0.18)' }
const box     = { maxWidth:600, margin:'0 auto', padding:'24px 18px 48px', animation:'metaFadeUp .35s ease' }
const center  = { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', color:'#8A8AA3', fontSize:14, fontFamily:'Inter,sans-serif', background:'#F5F4FF' }
const card    = { background:'#fff', borderRadius:22, padding:'20px', boxShadow:'0 10px 30px rgba(99,130,255,0.1)' }
const h2      = { fontSize:18, fontWeight:800, color:'#1E1E32', letterSpacing:'-0.02em', lineHeight:1.3 }
const welcomeText = { fontSize:13, color:'#8A8AA3', fontWeight:600 }
const peakBadge = { width:38, height:38, borderRadius:12, background:'rgba(99,130,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }
const ta      = { width:'100%', background:'#F5F4FF', border:'1.5px solid rgba(99,130,255,0.18)', borderRadius:14, color:'#1E1E32', fontFamily:'inherit', fontSize:14, padding:'12px 14px', outline:'none', resize:'vertical', lineHeight:1.6, boxSizing:'border-box' }
const btn     = { width:'100%', padding:'14px', border:'none', borderRadius:14, background:'#6382FF', color:'#fff', fontSize:14.5, fontWeight:800, cursor:'pointer', fontFamily:'inherit', marginTop:14, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 10px 24px rgba(99,130,255,0.35)' }
const btnGhost = { flex:1, padding:'14px', border:'1.5px solid rgba(99,130,255,0.2)', borderRadius:14, background:'#fff', color:'#6382FF', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }
const iconNavBtn = { width:36, height:36, borderRadius:10, border:'none', background:'rgba(255,255,255,0.08)', color:'#f5f4ff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }
const squareIconBtn = { width:40, padding:'8px 0', borderRadius:12, border:'1px solid rgba(99,130,255,0.14)', background:'#fff', color:'#6382FF', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }
const goalBtn = { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 14px', borderRadius:14, border:'1px solid rgba(99,130,255,0.1)', background:'#fff', color:'#1E1E32', fontSize:13.5, fontWeight:700, textAlign:'left', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 12px rgba(99,130,255,0.05)' }
const goalIconWrap = { width:26, height:26, borderRadius:8, background:'rgba(99,130,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }
const label   = { fontSize:11, fontWeight:800, letterSpacing:'0.8px', textTransform:'uppercase', color:'#B7B7CC', marginBottom:10 }
const sectionDot = { width:7, height:7, borderRadius:'50%', background:'#F5C542', display:'inline-block' }
const trailWrap = { position:'relative' }
const errStyle = { display:'flex', alignItems:'center', background:'rgba(240,106,106,0.08)', border:'1px solid rgba(240,106,106,0.2)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#B23A3A', fontWeight:600, marginBottom:12, marginTop:10 }
const errDark = { display:'flex', alignItems:'center', background:'rgba(240,106,106,0.14)', border:'1px solid rgba(240,106,106,0.35)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#FFB4B4', fontWeight:600, marginBottom:12, marginTop:10, position:'relative', zIndex:2 }
const overlay = { position:'fixed', inset:0, background:'rgba(26,26,46,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }
const modal = { width:'100%', maxWidth:440, background:'#fff', borderRadius:22, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }
const modalTitle = { color:'#1E1E32', fontSize:17, fontWeight:800, marginBottom:14 }
const buildingPanel = { display:'flex', alignItems:'center', gap:10, marginTop:14, padding:'10px 14px', background:'rgba(99,130,255,0.06)', borderRadius:12 }
const pulseDot = { width:6, height:6, borderRadius:'50%', background:'#6382FF', animation:'metaPulse 1s ease-in-out infinite' }
const trailBarTrack = { position:'relative', height:8, background:'rgba(255,255,255,0.12)', borderRadius:99, overflow:'hidden' }
const trailBarFill = { height:'100%', background:'linear-gradient(90deg,#3ECF8E,#6382FF)', borderRadius:99, transition:'width .6s ease' }
const xpMarker = { position:'absolute', top:-3, width:16, height:16, borderRadius:'50%', background:'#6382FF', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(99,130,255,0.5)' }

// ── Roadmap escuro / imersivo ──
const roadmapPage = { minHeight:'100vh', background:'#1A1A2E', color:'#F5F4FF', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', position:'relative', overflowX:'hidden' }
const roadmapBox = { position:'relative', zIndex:2, maxWidth:560, margin:'0 auto', padding:'24px 18px 56px', animation:'metaFadeUp .35s ease' }
const roadmapPeakCard = { background:'linear-gradient(145deg, rgba(245,197,66,0.12), rgba(99,130,255,0.12))', border:'1px solid rgba(245,197,66,0.28)', borderRadius:20, padding:'16px 18px', boxShadow:'0 12px 30px rgba(0,0,0,0.35)', backdropFilter:'blur(4px)' }
const roadmapTrailBarTrack = { position:'relative', height:8, background:'rgba(255,255,255,0.14)', borderRadius:99, overflow:'hidden' }
const roadmapTrailBarFill = { height:'100%', background:'linear-gradient(90deg,#3ECF8E,#9AB4FF)', borderRadius:99, transition:'width .6s ease' }
const roadmapSectionHeader = { display:'flex', alignItems:'center', gap:8, fontSize:12.5, fontWeight:800, letterSpacing:'0.4px', textTransform:'uppercase', color:'#9AB4FF', marginBottom:16, paddingBottom:10, borderBottom:'1.5px dashed rgba(154,180,255,0.25)' }
const roadmapTrailLine = { position:'absolute', top:0, bottom:0, left:'calc(50% - 1px)', width:2, background:'repeating-linear-gradient(180deg, rgba(154,180,255,0.35) 0 6px, transparent 6px 12px)' }
const taskLoadingPanelDark = { display:'flex', flexDirection:'column', alignItems:'center', padding:'30px 0', background:'rgba(245,244,255,0.06)', border:'1px solid rgba(245,244,255,0.1)', borderRadius:20, boxShadow:'0 8px 24px rgba(0,0,0,0.3)', backdropFilter:'blur(4px)' }
const taskProgressTrack = { height:8, background:'rgba(99,130,255,0.12)', borderRadius:99, overflow:'hidden', marginTop:4 }
const taskProgressFill = { height:'100%', background:'linear-gradient(90deg,#3ECF8E,#6382FF)', borderRadius:99, transition:'width .3s ease' }
const questionCard = { background:'#fff', border:'1px solid rgba(99,130,255,0.1)', borderRadius:18, padding:18, marginBottom:14, boxShadow:'0 6px 18px rgba(99,130,255,0.06)' }
const materialTag = { fontSize:11, color:'#6382FF', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8, background:'rgba(99,130,255,0.08)', display:'inline-block', padding:'3px 10px', borderRadius:99 }
const optionBtn = { display:'flex', alignItems:'center', gap:12, width:'100%', padding:'13px 14px', borderRadius:14, border:'2px solid rgba(99,130,255,0.12)', background:'#F5F4FF', color:'#1E1E32', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, textAlign:'left', marginBottom:8, transition:'all .15s' }
const optionBtnSel = { border:'2px solid #6382FF', background:'rgba(99,130,255,0.08)' }
const optionKey = { width:26, height:26, borderRadius:8, background:'rgba(99,130,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11.5, fontWeight:800, color:'#6382FF', flexShrink:0 }
const optionKeySel = { background:'#6382FF', color:'#fff' }
const resultCard = { position:'relative', textAlign:'center', padding:'30px 20px', background:'#fff', borderRadius:22, marginBottom:20, boxShadow:'0 10px 30px rgba(99,130,255,0.1)', overflow:'hidden' }
const correctionCard = { background:'#fff', border:'1px solid rgba(99,130,255,0.14)', borderRadius:18, padding:18, marginBottom:18, boxShadow:'0 6px 18px rgba(99,130,255,0.06)' }
const correctionEyebrow = { display:'flex', alignItems:'center', fontSize:11.5, fontWeight:800, letterSpacing:'0.6px', textTransform:'uppercase', color:'#6382FF', marginBottom:12 }
const feedbackItem = { padding:'10px 12px', borderRadius:10, background:'#F5F4FF', marginBottom:8 }
const reviewRow = { padding:'12px 14px', borderRadius:12, marginBottom:8 }
const reviewRowOk = { border:'1px solid rgba(62,207,142,0.25)', background:'rgba(62,207,142,0.05)' }
const reviewRowBad = { border:'1px solid rgba(240,106,106,0.25)', background:'rgba(240,106,106,0.05)' }
const avatarImg = { width:64, height:64, borderRadius:'50%', objectFit:'cover', display:'block', border:'3px solid #F5F4FF', boxShadow:'0 4px 14px rgba(99,130,255,0.25)' }
const avatarFallback = { width:64, height:64, borderRadius:'50%', background:'linear-gradient(160deg,#6382FF,#9AB4FF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:800, color:'#fff' }
const levelBadge = { position:'absolute', bottom:-2, left:-6, width:24, height:24, borderRadius:8, background:'#F5C542', color:'#3A2E00', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(0,0,0,0.15)' }
const avatarEditBtn = { position:'absolute', bottom:-2, right:-6, width:22, height:22, borderRadius:'50%', background:'#1A1A2E', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(0,0,0,0.2)' }
const statCard = { background:'#fff', borderRadius:16, padding:'14px 6px', textAlign:'center', boxShadow:'0 6px 16px rgba(99,130,255,0.07)' }
const statIconWrap = { width:28, height:28, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' }