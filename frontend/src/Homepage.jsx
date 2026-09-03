import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  logout as apiLogout, refreshSession,
  listGoals, createGoal, generateRoadmap, generateTask,
  submitAttempt, getProfile, getMe, getRoadmap,
  generateCorrection, addXP, uploadAvatar,
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

          <div style={{ padding:'0 20px 20px' }}>
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

  // ROADMAP — a chegada: câmera foca o cume e desce até o início (a base), depois sobe conforme progride
  if (view === 'roadmap') {
    const available = getAvailable(topics, deps, completed)
    const parents = getParents(topics)
    const childrenOf = (parentId) => available.filter(t => t.parent_topic_id === parentId)

    // Fases (estágios): cada tópico pai é uma fase; órfãos viram fases de lição única.
    // A base (i=0) é o CHÃO (em baixo), as últimas fases sobem até o CUME (no topo).
    const phases = []
    parents.forEach(p => {
      const children = childrenOf(p.id)
      if (children.length) phases.push({ key: p.id, parent: p, children })
    })
    available.filter(t => !t.parent_topic_id).forEach(o => {
      phases.push({ key: o.id, parent: { id: o.id, title: o.title, description: o.description }, children: [o] })
    })

    phases.forEach((ph, i) => {
      const allDone = ph.children.length && ph.children.every(n => completed.includes(n.id))
      const hasPrevIncomplete = phases.slice(0, i).some(q => !(q.children.length && q.children.every(n => completed.includes(n.id))))
      ph.done = allDone
      ph.current = !allDone && !hasPrevIncomplete
      ph.locked = !allDone && hasPrevIncomplete
    })

    const totalLeaves = available.length
    const doneLeaves = available.filter(n => completed.includes(n.id)).length
    const progressPct = totalLeaves ? Math.round((doneLeaves / totalLeaves) * 100) : 0
    const currentPhase = phases.find(p => p.current) || phases[0]

    // geometria da subida — a base fica em baixo (perto/maior), o cume no topo (longe/menor)
    const N = phases.length
    const slotH = 150
    const summitReserve = 210
    const containerH = 16 + N * slotH + summitReserve
    const anchor = (i) => {
      const up = N > 1 ? i / (N - 1) : 0            // 0 = base, 1 = cume
      const y = summitReserve + (N - 1 - i) * slotH  // maior = mais perto da base (em baixo)
      const x = 50 + Math.sin(i * 1.7 + 0.4) * 24   // serpenteia num subir
      const scale = 1 - 0.42 * up                    // base grande, cume pequeno (distância)
      return { x, y, scale, up }
    }

    let pathD = ''
    phases.forEach((ph, i) => {
      const p = anchor(i)
      if (i === 0) pathD += `M ${p.x} ${p.y}`
      else {
        const prev = anchor(i - 1)
        const midY = (prev.y + p.y) / 2
        pathD += ` C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`
      }
    })

    return (
      <div style={mountainPage}>
        <GlobalStyles/>
        <div style={mountainHeader}>
          <button onClick={() => setView('home')} style={iconNavBtn} aria-label="Início"><IconArrowLeft/></button>
          <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14, textAlign:'center', flex:1, padding:'0 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{curGoal?.title}</span>
          <button onClick={handleLogout} style={iconNavBtn} aria-label="Sair"><IconLogout/></button>
        </div>

        <div style={{ maxWidth:560, margin:'0 auto', padding:'10px 16px 12px', position:'relative', zIndex:5 }}>
          <div style={hudLabel}>
            <span>PROGRESSO DA SUBIDA</span>
            <span>{doneLeaves}/{totalLeaves} · {progressPct}%</span>
          </div>
          <div style={hudBarTrack}><div style={{ ...hudBarFill, width:`${progressPct}%` }}/>
            <div style={{ ...hudMarker, left:`calc(${progressPct}% - 5px)` }}><MountainMark size={9} color="#fff"/></div>
          </div>
          {err && <div style={errDark}><IconAlert/> {err}</div>}
        </div>

        {loading && (
          <div style={{ maxWidth:560, margin:'16px auto 0', padding:'0 16px', position:'relative', zIndex:5 }}>
            <div style={loadingPanelDark}>
              <FlagLoader/>
              <div style={{ fontSize:13, fontWeight:800, color:'#F5F4FF', marginTop:12 }}>Preparando seu checkpoint…</div>
            </div>
          </div>
        )}

        {!loading && N === 0 && (
          <div style={{ color:'#9AB4FF', textAlign:'center', padding:40, fontSize:13, position:'relative', zIndex:5 }}>Nenhum tópico disponível.</div>
        )}

        {!loading && N > 0 && (
          <div ref={mountainRef} style={mountainScroll}>
            <div style={{ position:'relative', width:'100%', height:containerH, maxWidth:560, margin:'0 auto' }}>
              <MountainScene svgH={containerH} pathD={pathD}/>

              {/* Cume — destino almejado no topo */}
              <div style={{ position:'absolute', left:'50%', top:anchor(N-1).y - 118, transform:'translateX(-50%)', zIndex:2 }}>
                <SummitArt title={curGoal?.title} pct={progressPct}/>
              </div>

              {/* Marcador do usuário na fase atual */}
              {currentPhase && (
                <div style={{ position:'absolute', left:`${anchor(phases.indexOf(currentPhase)).x}%`, top:anchor(phases.indexOf(currentPhase)).y + 34, transform:'translate(-50%,0)', zIndex:4 }}>
                  <UserMarker/>
                </div>
              )}

              {/* Fases descendentes */}
              {phases.map((ph, i) => {
                const a = anchor(i)
                const themeIdx = i % THEMES.length
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

  // PHASE — dentro de uma fase: um "lugar" temático com as lições daquele estágio
  if (view === 'phase' && selPhase) {
    const ph = selPhase
    const theme = ph.theme || THEMES[0]
    return (
      <div style={{ minHeight:'100vh', background: theme.bg, color:'#F5F4FF', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', position:'relative', overflow:'hidden' }}>
        <GlobalStyles/>
        <ThemeDecor theme={theme}/>
        <div style={mountainHeader}>
          <button onClick={() => setView('roadmap')} style={iconNavBtn} aria-label="Voltar"><IconArrowLeft/></button>
          <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14, textAlign:'center', flex:1, padding:'0 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ph.parent.title}</span>
          <button onClick={() => setView('home')} style={iconNavBtn} aria-label="Início"><IconHome/></button>
        </div>

        <div style={{ position:'relative', zIndex:3, maxWidth:560, margin:'0 auto', padding:'26px 18px 60px' }}>
          <div style={{ fontSize:26, fontWeight:800, letterSpacing:'-0.02em', lineHeight:1.15 }}>{ph.parent.title}</div>
          <div style={{ fontSize:12.5, color:'rgba(245,244,255,0.6)', marginTop:8, lineHeight:1.6 }}>
            {ph.parent.description || `${ph.children.length} lição(ões) para concluir este estágio`}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:12, margin:'20px 0 14px' }}>
            <div style={{ flex:1, height:1, background:'rgba(245,244,255,0.15)' }}/>
            <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.5px', textTransform:'uppercase', color:'rgba(245,244,255,0.55)' }}>Lições do estágio</div>
            <div style={{ flex:1, height:1, background:'rgba(245,244,255,0.15)' }}/>
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

  // TASK
  if (view === 'task' && task) {
    const isQuiz   = task.type === 'quiz'
    const content  = task.content || {}
    const questions = sa(content.questions)
    const title    = content.title || task.meta?.title || 'Tarefa'
    const desc     = content.description || task.meta?.description || ''

    return (
      <div style={page}>
        <GlobalStyles/>
        <div style={header}>
          <button onClick={() => setView('roadmap')} style={iconNavBtn} aria-label="Voltar"><IconArrowLeft/></button>
          <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14, textAlign:'center', flex:1, padding:'0 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</span>
          <span style={{ width:36 }}/>
        </div>

        <div style={box}>
          <div style={taskProgressTrack}><div style={taskProgressFill}/></div>

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

// ── Temas de estágio: cada fase é um "lugar" com identidade própria ──
const THEMES = [
  { name:'Caverna',  accent:'#3ECF8E', glow:'62,207,142',     bg:'linear-gradient(180deg,#0B1026 0%, #10203E 55%, #14355A 100%)' },
  { name:'Torre',    accent:'#6382FF', glow:'99,130,255',      bg:'linear-gradient(180deg,#0D1430 0%, #1A2450 55%, #2A2E66 100%)' },
  { name:'Ponte',    accent:'#9AB4FF', glow:'154,180,255',     bg:'linear-gradient(180deg,#0E1230 0%, #1C2548 55%, #2E3B63 100%)' },
  { name:'Ruínas',   accent:'#F5C542', glow:'245,197,66',      bg:'linear-gradient(180deg,#151030 0%, #2A1D3E 55%, #43305C 100%)' },
  { name:'Porto',    accent:'#7FD8FF', glow:'127,216,255',     bg:'linear-gradient(180deg,#0A1226 0%, #10304A 55%, #1A4A66 100%)' },
  { name:'Floresta', accent:'#38D99A', glow:'56,217,154',      bg:'linear-gradient(180deg,#0A2418 0%, #123B2B 55%, #1B5B40 100%)' },
]

// cume — destino almejado no topo da montanha
function SummitArt({ title, pct }) {
  return (
    <div style={{ textAlign:'center', width:250 }}>
      <div style={{ position:'relative', width:250, height:150 }}>
        <svg width="250" height="150" viewBox="0 0 250 150">
          <defs>
            <linearGradient id="summitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F5F4FF"/>
              <stop offset="1" stopColor="#9AB4FF"/>
            </linearGradient>
          </defs>
          <polygon points="125,6 25,150 225,150" fill="#9AB4FF" opacity="0.35"/>
          <polygon points="125,6 75,150 175,150" fill="url(#summitGrad)"/>
          <polygon points="125,6 108,62 142,62" fill="#ffffff"/>
          <circle cx="125" cy="3" r="3" fill="#F5F4FF"/>
        </svg>
        <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', filter:'drop-shadow(0 0 14px rgba(245,244,255,0.7))' }}>
          <IconFlag/>
        </div>
      </div>
      <div style={{ marginTop:-12, position:'relative', display:'inline-flex', flexDirection:'column', alignItems:'center' }}>
        <div style={{ background:'linear-gradient(90deg,#F5C542,#F5A542)', color:'#2A1600', fontSize:12, fontWeight:800, padding:'7px 16px', borderRadius:10, boxShadow:'0 10px 24px rgba(245,197,66,0.4)', marginTop:4 }}>{title}</div>
        <div style={{ fontSize:11, color:'rgba(245,244,255,0.7)', fontWeight:800, marginTop:8 }}>{pct}% da meta concluída</div>
      </div>
    </div>
  )
}

// marca-bandeira que indica a fase atual do usuário na subida
function UserMarker() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', animation:'metaPulse 1.7s ease-in-out infinite' }}>
      <div style={{ width:16, height:16, borderRadius:'50%', background:'#F5F4FF', border:'3px solid #6382FF', boxShadow:'0 0 0 6px rgba(99,130,255,0.35), 0 0 18px rgba(99,130,255,0.8)' }}/>
      <div style={{ width:2, height:26, background:'rgba(245,244,255,0.5)' }}/>
    </div>
  )
}

// monumento/construção temática de cada estágio sobre a montanha
function StageLandmark({ theme, state, title, count, onClick, disabled }) {
  const stateColor = state==='done' ? '#3ECF8E' : state==='current' ? theme.accent : '#5A5F8A'
  const lit = state !== 'locked'
  const glow = state==='current' ? `${theme.glow},0.55` : state==='done' ? '62,207,142,0.45' : '0,0,0,0'
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'190px' }}>
      <button onClick={onClick} disabled={disabled} aria-label={title}
        style={{ position:'relative', background:'none', border:'none', padding:0, cursor:disabled?'not-allowed':'pointer', filter:`drop-shadow(0 8px 18px rgba(0,0,0,0.5)) ${lit?`drop-shadow(0 0 16px rgba(${glow}))`:''}`, opacity:disabled?0.7:1 }}>
        <svg width="190" height="120" viewBox="0 0 190 120">
          {/* plataforma/ilha */}
          <ellipse cx="95" cy="104" rx="86" ry="16" fill="#0B0E22" opacity="0.6"/>
          <ellipse cx="95" cy="102" rx="82" ry="13" fill={lit?theme.accent:'#343A61'} opacity="0.35"/>
          <LandmarkShape theme={theme} lit={lit} stateColor={stateColor}/>
        </svg>
      </button>
      <div style={{ marginTop:-8, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
        <div style={{ background: state==='locked' ? 'rgba(26,30,58,0.9)' : 'rgba(10,13,34,0.85)', border:`1.5px solid ${lit?stateColor:'rgba(90,95,138,0.5)'}`, color: lit?'#F5F4FF':'#8A8CAB', fontSize:11.5, fontWeight:800, textAlign:'center', padding:'6px 12px', borderRadius:12, maxWidth:170, boxShadow: lit?`0 6px 16px rgba(0,0,0,0.35), 0 0 12px rgba(${glow})`:undefined, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {title}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, fontWeight:700, color: lit?`rgba(245,244,255,0.7)`:'#8A8CAB' }}>
          {state==='done' && <><IconCheck size={11} color="#3ECF8E"/> {count.total}/{count.total}</>}
          {state==='current' && <><MountainMark size={11} color={theme.accent}/> {count.done}/{count.total} · aqui</>}
          {state==='locked' && <><IconLock size={11}/> bloqueado</>}
        </div>
      </div>
    </div>
  )
}

// formas internas do monumento por tema
function LandmarkShape({ theme, lit, stateColor }) {
  switch (theme.name) {
    case 'Caverna': return (
      <g>
        <path d="M55,30 Q95,8 130,34 L128,78 Q95,60 58,80 Z" fill={lit?stateColor:'#5A5F8A'} opacity={lit?0.55:0.35}/>
        <path d="M88,38 Q95,30 102,38 L100,72 Q95,70 91,72 Z" fill={lit?'#d6fff1':'#3A4066'} />
      </g>
    )
    case 'Torre': return (
      <g>
        <rect x="84" y="24" width="22" height="70" rx="4" fill={lit?stateColor:'#5A5F8A'}/>
        <polygon points="95,6 74,30 116,30" fill={lit?stateColor:'#5A5F8A'}/>
        <rect x="88" y="40" width="14" height="12" rx="3" fill={lit?'#0E1026':'#3A4066'}/>
        <rect x="88" y="58" width="14" height="12" rx="3" fill={lit?'#0E1026':'#3A4066'}/>
      </g>
    )
    case 'Ponte': return (
      <g>
        <path d="M30,80 Q95,10 160,80" fill="none" stroke={lit?stateColor:'#5A5F8A'} strokeWidth="5" strokeLinecap="round"/>
        <line x1="95" y1="18" x2="95" y2="6" stroke={lit?'#F5F4FF':'#5A5F8A'} strokeWidth="3" strokeLinecap="round"/>
        {[40,70,95,120,150].map(x=>(
          <line key={x} x1={x} y1={Math.abs(Math.pow((x-95)/70,2))*65+18} x2={x} y2={88} stroke={lit?stateColor:'#5A5F8A'} strokeWidth="2"/>
        ))}
      </g>
    )
    case 'Ruínas': return (
      <g>
        {[[70,50],[95,38],[120,52]].map(([cx,cy],k)=>(
          <g key={k}>
            <rect x={cx-7} y={cy-8} width="14" height="60" fill={lit?stateColor:'#5A5F8A'} opacity={lit?0.9:0.5}/>
            <rect x={cx-12} y={cy-12} width="24" height="7" rx="2" fill={lit?stateColor:'#5A5F8A'} opacity={lit?0.9:0.5}/>
          </g>
        ))}
      </g>
    )
    case 'Porto': return (
      <g>
        <rect x="88" y="26" width="14" height="66" rx="3" fill={lit?stateColor:'#5A5F8A'}/>
        <rect x="82" y="18" width="26" height="12" rx="5" fill={lit?stateColor:'#5A5F8A'}/>
        <circle cx="95" cy="24" r="4" fill={lit?theme.accent:'#3A4066'} strokeWidth="0"/>
      </g>
    )
    default: return (
      <g>
        <rect x="70" y="34" width="50" height="58" fill={lit?stateColor:'#5A5F8A'} opacity={lit?0.9:0.5}/>
        <rect x="74" y="28" width="42" height="8" rx="4" fill={lit?stateColor:'#5A5F8A'} opacity={lit?0.9:0.5}/>
        <rect x="90" y="50" width="10" height="42" fill={lit?'#0E1026':'#3A4066'}/>
      </g>
    )
  }
}

// lição dentro de uma fase (view phase)
function LessonRow({ n, done, current, onClick, accent }) {
  return (
    <button onClick={onClick} disabled={n.blocked}
      style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'14px 16px', borderRadius:16, cursor:n.blocked?'not-allowed':'pointer', fontFamily:'inherit', textAlign:'left', background: done?'rgba(62,207,142,0.14)':n.blocked?'rgba(245,244,255,0.04)':'rgba(245,244,255,0.08)', border: done?'1.5px solid rgba(62,207,142,0.5)':n.blocked?'1.5px solid rgba(245,244,255,0.08)':`1.5px solid ${accent}66`, boxShadow: current?`0 0 0 1px ${accent}99, 0 10px 26px rgba(0,0,0,0.3)`:undefined, opacity:n.blocked?0.6:1 }}>
      <div style={{ width:38, height:38, borderRadius:12, flexShrink:0, background: done?'rgba(62,207,142,0.25)':n.blocked?'rgba(245,244,255,0.06)':'rgba(245,244,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', color:done?'#3ECF8E':'#F5F4FF' }}>
        {done ? <IconCheck size={16}/> : n.blocked ? <IconLock size={14}/> : <MountainMark size={16} color="#F5F4FF"/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:800, color: n.blocked?'#8A8CAB':'#F5F4FF', lineHeight:1.3 }}>{n.title}</div>
        {n.description && <div style={{ fontSize:11, color:'rgba(245,244,255,0.55)', marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{n.description}</div>}
      </div>
      <IconChevron color="#F5F4FF"/>
    </button>
  )
}

// fundo decorativo da view phase
function ThemeDecor({ theme }) {
  return (
    <div style={{ position:'absolute', inset:0, zIndex:1, pointerEvents:'none', overflow:'hidden', opacity:0.5 }}>
      <svg width="100%" height="100%" viewBox="0 0 500 800" preserveAspectRatio="xMidYMax slice">
        <circle cx="420" cy="90" r="34" fill={theme.accent} opacity="0.8"/>
        <circle cx="430" cy="80" r="30" fill="#0B0E22" opacity="0.4"/>
        <polygon points="0,800 500,640 500,800" fill={theme.accent} opacity="0.12"/>
        <polygon points="0,800 500,700 500,800" fill="#0B0E22" opacity="0.5"/>
      </svg>
    </div>
  )
}

// cenário da montanha (planos empilhados, névoa no topo) + trilha ascendente
function MountainScene({ svgH, pathD }) {
  return (
    <svg width="100%" height={svgH} viewBox={`0 0 100 ${svgH}`} preserveAspectRatio="none" style={{ position:'absolute', top:0, left:0 }}>
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1026"/>
          <stop offset="0.5" stopColor="#0E1A3A"/>
          <stop offset="1" stopColor="#1B2750"/>
        </linearGradient>
        <linearGradient id="fogGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6FA0DE" stopOpacity="0"/>
          <stop offset="1" stopColor="#6FA0DE" stopOpacity="0.5"/>
        </linearGradient>
      </defs>

      <rect width="100" height={svgH} fill="url(#skyGrad)"/>

      {/* estrelas (somente região do topo) */}
      <g fill="#ffffff" opacity="0.5">
        {[[20,30],[32,55],[50,22],[63,48],[78,30],[40,80],[85,70],[15,70]].map(([x,y])=>
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.5"/>
        )}
      </g>

      {/* Planos de montanha: da névoa (topo/distante) ao chão (base/perto) */}
      <polygon points={`0,${svgH*0.18} 22,${svgH*0.06} 40,${svgH*0.2} 62,${svgH*0.03} 82,${svgH*0.2} 100,${svgH*0.1} 100,100 0,100`} fill="#16213E" opacity="0.9"/>
      <polygon points={`0,${svgH*0.3} 18,${svgH*0.16} 38,${svgH*0.32} 58,${svgH*0.12} 80,${svgH*0.3} 100,${svgH*0.2} 100,100 0,100`} fill="#1B2A4E"/>
      <polygon points={`0,${svgH*0.45} 18,${svgH*0.3} 40,${svgH*0.48} 60,${svgH*0.26} 82,${svgH*0.46} 100,${svgH*0.34} 100,100 0,100`} fill="#22335C"/>
      <polygon points={`0,${svgH*0.6} 20,${svgH*0.46} 42,${svgH*0.62} 64,${svgH*0.42} 86,${svgH*0.6} 100,${svgH*0.5} 100,100 0,100`} fill="#2A3E6E"/>
      <polygon points={`0,${svgH*0.74} 22,${svgH*0.6} 44,${svgH*0.76} 68,${svgH*0.58} 90,${svgH*0.74} 100,${svgH*0.66} 100,100 0,100`} fill="#334983"/>
      <polygon points={`0,100 18,${svgH*0.72} 40,${svgH*0.88} 64,${svgH*0.7} 88,${svgH*0.9} 100,${svgH*0.78} 100,100`} fill="#3D568F"/>

      {/* névoa atmosférica no topo (distância) */}
      <rect x="0" y="0" width="100" height={svgH*0.4} fill="url(#fogGrad)"/>

      {/* trilha ascendente (base → cume) */}
      <path d={pathD} fill="none" stroke="#F5F4FF" strokeWidth="0.9" strokeLinecap="round" opacity="0.85"/>
      <path d={pathD} fill="none" stroke="#9AB4FF" strokeWidth="0.5" strokeDasharray="0.2 1" strokeLinecap="round" opacity="0.7"/>
    </svg>
  )
}

function MiniPeaks() {
  return (
    <svg viewBox="0 0 400 120" style={{ position:'absolute', bottom:0, left:0, width:'100%', height:110, opacity:0.9 }} preserveAspectRatio="none">
      <polygon points="0,120 40,50 90,90 150,20 220,80 270,45 330,95 400,60 400,120" fill="#9AB4FF" opacity="0.28"/>
      <polygon points="0,120 60,75 110,105 170,55 230,100 300,70 360,110 400,90 400,120" fill="#6382FF" opacity="0.16"/>
    </svg>
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
      <line x1="44" y1="86" x2="44" y2="18" stroke="#1E1E32" strokeWidth="3" strokeLinecap="round" style={{ animation:'metaFlagPole 1.4s ease-in-out infinite' }}/>
      <path d="M44,20 L44,42 L72,31 Z" fill="#F5C542" style={{ animation:'metaFlagWave 1.4s ease-in-out infinite' }}/>
    </svg>
  )
}

function IconEdit({ size=14 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> }
function IconTrash({ size=14 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> }
function IconLock({ size=14 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> }
function IconCheck({ size=16, color='currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> }
function IconX({ size=16, color='currentColor' }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg> }
function IconArrowLeft() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> }
function IconArrowRight() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign:'-3px', marginLeft:6 }}><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg> }
function IconChevron({ color='#8A8AA3' }) { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg> }
function IconUser() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg> }
function IconHome() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg> }
function IconLogout() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg> }
function IconFlag() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5C542" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4"/><path d="M4 4h14l-3 4 3 4H4"/></svg> }
function IconAlert() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign:'-3px', marginRight:6, flexShrink:0 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg> }
function IconSpark() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="#9AB4FF" style={{ verticalAlign:'-2px', marginRight:6 }}><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z"/></svg> }

function GlobalStyles() {
  return (
    <style>{`
      @keyframes metaSpin { to { transform: rotate(360deg); } }
      @keyframes metaPulse { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(1.12); opacity:0.75; } }
      @keyframes metaPinBounce { 0%,100% { transform: rotate(-45deg) translateY(0); } 50% { transform: rotate(-45deg) translateY(-7px); } }
      @keyframes metaFlagPole { 0% { stroke-dasharray: 0 68; } 60%,100% { stroke-dasharray: 68 68; } }
      @keyframes metaFlagWave { 0%,55% { opacity:0; transform: translateX(-4px); } 100% { opacity:1; transform: translateX(0); } }
      @keyframes metaGlow { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
      @keyframes metaFadeUp { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
      @keyframes metaSlideUp { from { opacity:0; transform: translateY(24px); } to { opacity:1; transform: translateY(0); } }
    `}</style>
  )
}

// ─── CSS ──────────────────────────────────────────────────────
const page    = { minHeight:'100vh', background:'#F5F4FF', color:'#1E1E32', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased' }
const header  = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', background:'#1A1A2E', position:'sticky', top:0, zIndex:10, borderRadius:'0 0 20px 20px', boxShadow:'0 8px 24px rgba(26,26,46,0.18)' }
const box     = { maxWidth:600, margin:'0 auto', padding:'24px 18px 48px', animation:'metaFadeUp .35s ease' }
const center  = { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', color:'#8A8AA3', fontSize:14, fontFamily:'Inter,sans-serif', background:'#F5F4FF' }
const card    = { background:'#fff', borderRadius:22, boxShadow:'0 10px 30px rgba(99,130,255,0.1)' }
const h2      = { fontSize:17, fontWeight:800, color:'#1E1E32', letterSpacing:'-0.02em', lineHeight:1.3 }
const welcomeText = { fontSize:13, color:'#8A8AA3', fontWeight:600 }
const homeSceneBg = { position:'relative', background:'linear-gradient(180deg,#EDEBFF 0%, #E4E7FF 100%)', overflow:'hidden' }
const peakBadge = { width:38, height:38, borderRadius:12, background:'rgba(99,130,255,0.14)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }
const ta      = { width:'100%', background:'#F5F4FF', border:'1.5px solid rgba(99,130,255,0.18)', borderRadius:14, color:'#1E1E32', fontFamily:'inherit', fontSize:14, padding:'12px 14px', outline:'none', resize:'vertical', lineHeight:1.6, boxSizing:'border-box' }
const btn     = { width:'100%', padding:'14px', border:'none', borderRadius:14, background:'#6382FF', color:'#fff', fontSize:14.5, fontWeight:800, cursor:'pointer', fontFamily:'inherit', marginTop:14, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 10px 24px rgba(99,130,255,0.35)' }
const btnGhost = { flex:1, padding:'14px', border:'1.5px solid rgba(99,130,255,0.2)', borderRadius:14, background:'#fff', color:'#6382FF', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }
const iconNavBtn = { width:36, height:36, borderRadius:10, border:'none', background:'rgba(255,255,255,0.08)', color:'#f5f4ff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }
const squareIconBtn = { width:40, padding:'8px 0', borderRadius:12, border:'1px solid rgba(99,130,255,0.14)', background:'#fff', color:'#6382FF', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }
const goalBtn = { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 14px', borderRadius:14, border:'1px solid rgba(99,130,255,0.1)', background:'#fff', color:'#1E1E32', fontSize:13.5, fontWeight:700, textAlign:'left', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 12px rgba(99,130,255,0.05)' }
const goalIconWrap = { width:26, height:26, borderRadius:8, background:'rgba(99,130,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }
const label   = { fontSize:11, fontWeight:800, letterSpacing:'0.8px', textTransform:'uppercase', color:'#B7B7CC', marginBottom:10 }
const errStyle = { display:'flex', alignItems:'center', background:'rgba(240,106,106,0.08)', border:'1px solid rgba(240,106,106,0.2)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#B23A3A', fontWeight:600, marginBottom:12, marginTop:10 }
const overlay = { position:'fixed', inset:0, background:'rgba(26,26,46,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }
const modal = { width:'100%', maxWidth:440, background:'#fff', borderRadius:22, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }
const modalTitle = { color:'#1E1E32', fontSize:17, fontWeight:800, marginBottom:14 }
const buildingPanel = { display:'flex', alignItems:'center', gap:10, marginTop:14, padding:'10px 14px', background:'rgba(99,130,255,0.06)', borderRadius:12 }
const pulseDot = { width:6, height:6, borderRadius:'50%', background:'#6382FF', animation:'metaPulse 1s ease-in-out infinite' }
const trailBarTrack = { position:'relative', height:8, background:'rgba(99,130,255,0.12)', borderRadius:99, overflow:'hidden' }
const trailBarFill = { height:'100%', background:'linear-gradient(90deg,#3ECF8E,#6382FF)', borderRadius:99, transition:'width .6s ease' }
const xpMarker = { position:'absolute', top:-3, width:16, height:16, borderRadius:'50%', background:'#6382FF', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(99,130,255,0.5)' }
const taskProgressTrack = { height:8, background:'rgba(99,130,255,0.12)', borderRadius:99, overflow:'hidden', marginTop:4 }
const taskProgressFill = { height:'100%', width:'55%', background:'#6382FF', borderRadius:99 }
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

// ── estilos do roadmap-montanha (dark, imersivo) ──
const mountainPage = { minHeight:'100vh', background:'#0B1026', color:'#F5F4FF', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', position:'relative', overflow:'hidden' }
const mountainHeader = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', background:'rgba(11,16,38,0.85)', backdropFilter:'blur(10px)', position:'sticky', top:0, zIndex:10, borderBottom:'1px solid rgba(154,180,255,0.12)' }
const hudLabel = { display:'flex', justifyContent:'space-between', fontSize:11, color:'#9AB4FF', fontWeight:800, letterSpacing:'0.5px', marginBottom:8 }
const hudBarTrack = { position:'relative', height:8, background:'rgba(154,180,255,0.14)', borderRadius:99, overflow:'hidden' }
const hudBarFill = { height:'100%', background:'linear-gradient(90deg,#3ECF8E,#6382FF,#9AB4FF)', borderRadius:99, transition:'width .6s ease' }
const hudMarker = { position:'absolute', top:-3, width:16, height:16, borderRadius:'50%', background:'#6382FF', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(99,130,255,0.7)' }
const mountainScroll = { height:'calc(100vh - 112px)', overflowY:'auto', overflowX:'hidden', scrollBehavior:'smooth', WebkitOverflowScrolling:'touch', position:'relative' }
const errDark = { display:'flex', alignItems:'center', background:'rgba(240,106,106,0.14)', border:'1px solid rgba(240,106,106,0.35)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#FFB4B4', fontWeight:600, marginBottom:12, marginTop:10 }
const loadingPanelDark = { display:'flex', flexDirection:'column', alignItems:'center', padding:'26px 0', background:'rgba(245,244,255,0.06)', border:'1px solid rgba(245,244,255,0.1)', borderRadius:20 }