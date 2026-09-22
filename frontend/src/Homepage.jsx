import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Home, Map, Route, User, Trophy, Settings, LogOut, ChevronRight,
  Target, Sparkles, Lock, Check, X, ArrowLeft, ArrowRight, ShieldCheck,
  Palette, Bell, Smartphone, HelpCircle, Flag, Pencil, Trash2, Compass
} from 'lucide-react'
import {
  logout as apiLogout, refreshSession,
  listGoals, createGoal, generateRoadmap, generateTask,
  submitAttempt, getProfile, getMe, getRoadmap,
  generateCorrection, addXP, uploadAvatar,
  updateGoal, deleteGoal
} from './api'
import perfilIcon from './assets/perfil.png'
import conquistaIcon from './assets/conquista.png'
import configIcon from './assets/config.png'
import logoImg from './assets/logo.png'

// ── helpers ──
const sa = v => Array.isArray(v) ? v : []

// acompanhamento de breakpoint (mobile "app" vs desktop com gaveta lateral)
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' ? window.matchMedia(query).matches : false)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    onChange(mql)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// tópicos já dominados (persistidos no backend) → lista de ids para a UI
function completedFromProgress(roadmap) {
  return sa(roadmap?.progress)
    .filter(p => p?.status === 'MASTERED' && p?.topic_id)
    .map(p => p.topic_id)
}

// pais = tópicos sem parent_topic_id
function getParents(topics) {
  return sa(topics).filter(t => !t.parent_topic_id)
}

// nós disponíveis = folhas cujos pré-requisitos diretos já foram completados.
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

// Roupa pronta de conquistas — APENAS VISUAL / mock. Sem integração com backend.
const MOCK_ACHIEVEMENTS = [
  { id: 'first', icon: Target, title: 'Primeira Meta',   desc: 'Crie a sua primeira meta.',     color: '#6382FF', unlocked: true,  bg: 'rgba(99,130,255,0.14)' },
  { id: 'steps', icon: Check,  title: 'Passos Firmes',   desc: 'Complete os primeiros passos.', color: '#3ECF8E', unlocked: false, bg: 'rgba(62,207,142,0.12)' },
  { id: 'half',  icon: Flag,   title: 'Meio do Caminho', desc: 'Conclua 50% de uma meta.',      color: '#F5C542', unlocked: false, bg: 'rgba(245,197,66,0.12)' },
]

// ── HOMEPAGE — HUB ──────────────────────────────────────────────
export default function Homepage() {
  const navigate = useNavigate()

  const [email,     setEmail]     = useState('')
  const [profile,   setProfile]   = useState(null)
  const [goals,     setGoals]     = useState([])
  const [tab,       setTab]       = useState('hub') // hub | roadmap | phase | task | result | perfil | conquistas | config
  const [input,     setInput]     = useState('')
  const [curGoal,   setCurGoal]   = useState(null)
  const [topics,    setTopics]    = useState([])
  const [deps,      setDeps]      = useState([])
  const [completed, setCompleted] = useState([])
  const [task,      setTask]      = useState(null)
  const [taskNode,  setTaskNode]  = useState(null)
  const [answers,   setAnswers]   = useState({})
  const [result,    setResult]    = useState(null)
  const [correction, setCorrection] = useState(null)
  const [err,       setErr]       = useState('')
  const [loading,   setLoading]   = useState(false)
  const [initDone,  setInitDone]  = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [editInput, setEditInput] = useState('')
  const [deletingGoal, setDeletingGoal] = useState(null)
  const [selPhase, setSelPhase] = useState(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const mountainRef = useRef(null)
  const isDesktop  = useMediaQuery('(min-width: 900px)')

  const shellWide   = isDesktop ? { maxWidth:1000, margin:'0 auto', padding:'0 24px' } : shell
  const pageStyle   = isDesktop ? { ...pageDark, paddingBottom:24 } : pageDark
  const navActive   = ['roadmap','phase','task','result'].includes(tab) ? 'roadmap' : tab
  const roadStage   = isDesktop ? 'min(1150px, calc(100vw - 40px))' : 560
  const contentStage= isDesktop ? 'min(860px, calc(100vw - 40px))' : 560

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

  // ── animação de chegada no roadmap: foca o cume e desce até a fase atual ──
  useEffect(() => {
    if (tab !== 'roadmap') return
    const el = mountainRef.current
    if (!el) return
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
    el.scrollTop = 0
    const t = setTimeout(() => {
      const y = summitReserve + (N - 1 - curIdx) * slotH
      el.scrollTo({ top: Math.max(0, y - el.clientHeight * 0.55), behavior: 'smooth' })
    }, 550)
    return () => clearTimeout(t)
  }, [tab, topics, completed, deps])

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
      setGoals(prev => [goal, ...prev])
      setTab('roadmap')
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
      } catch {
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
      // restaura o progresso salvo (tópicos dominados) direto do backend
      setCompleted(completedFromProgress(roadmap))
      setSelPhase(null)
      setTab('roadmap')
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  // lição dentro de uma fase → gera a tarefa direto (um clique)
  async function handleClimbLesson(n) {
    if (n.blocked || loading) return
    setErr(''); setLoading(true)
    try {
      const t = await generateTask(n.id)
      setTask(t); setTaskNode(n); setAnswers({}); setResult(null)
      setTab('task')
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  // ── submeter resposta ──
  async function handleSubmit() {
    if (!task || loading) return
    setErr(''); setLoading(true); setCorrection(null)
    try {
      const content = task.content || {}
      const questions = sa(content.questions)
      const response = Object.entries(answers).map(([qi, ans]) => ({ question_index: parseInt(qi), answer: ans }))
      if (response.length < questions.length) { setErr('Responda todas as perguntas.'); setLoading(false); return }
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

      setTab('result')

      const attemptId = attempt.id
      if (attemptId) {
        try {
          const corr = await generateCorrection(attemptId)
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

  // ── métricas do roadmap atual ──
  const available = getAvailable(topics, deps, completed)
  const totalLeaves = available.length
  const doneLeaves = available.filter(n => completed.includes(n.id)).length
  const roadmapPct = totalLeaves ? Math.round((doneLeaves / totalLeaves) * 100) : 0

  const username = profile?.username || email?.split('@')[0] || 'Jornada'
  const firstName = username.split(/[\s@_.-]+/)[0] || username

  const primaryGoal = goals[0] || null

  // carrega o roadmap da meta principal em segundo plano p/ exibir progresso no card
  useEffect(() => {
    if (!initDone) return
    if (!primaryGoal) return
    if (curGoal?.id === primaryGoal.id && topics.length) return
    let cancel = false
    ;(async () => {
      try {
        let roadmap
        try { roadmap = await getRoadmap(primaryGoal.id) }
        catch { roadmap = null }
        if (cancel || !roadmap || !sa(roadmap?.topics).length) return
        setCurGoal(primaryGoal)
        setTopics(sa(roadmap?.topics))
        setDeps(sa(roadmap?.dependencies))
        setCompleted(completedFromProgress(roadmap))
      } catch { /* ignore */ }
    })()
    return () => { cancel = true }
  }, [initDone, primaryGoal?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!initDone) return (
    <div style={center}>
      <GlobalStyles/>
      <MountainMark size={40} color="#6382FF" style={{ animation:'metaPulse 1.6s ease-in-out infinite' }}/>
      <div style={{ marginTop:14, fontWeight:700, color:'#8A8AA3', fontSize:13 }}>Preparando sua jornada…</div>
    </div>
  )

  // ── VIEWS ─────────────────────────────────────────────────

  // HUB — a tela principal
  if (tab === 'hub') {
    return (
      <AppFrame isDesktop={isDesktop} active={navActive} user={{ firstName, username, avatar: profile?.avatar_url }} onNavigate={handleNav} onLogout={handleLogout}>
        <GlobalStyles/>
        <div style={pageStyle}>
          <HeaderBar username={firstName} avatar={profile?.avatar_url} onLogout={() => setConfirmLogout(true)}/>

          {/* saudação — hero */}
          <div style={{ ...shellWide, paddingTop: 26 }}>
            <div style={heroCard}>
              <div style={heroGlow}/>
              <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between', gap:14 }}>
                <div style={{ minWidth:0 }}>
                  <div style={helloSmall}>Olá, {firstName}</div>
                  <div style={helloBig}>Bora continuar a subida?</div>
                </div>
                <div style={{ position:'relative' }}>
                  <Avatar size={58} url={profile?.avatar_url} name={firstName}/>
                  <div style={levelBadge}>{profile?.level||1}</div>
                </div>
              </div>
              {primaryGoal && (
                <div style={{ position:'relative', marginTop:18, display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ ...hudLabel, marginBottom:6 }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'60%' }}>{primaryGoal.title}</span>
                      <span>{roadmapPct}%</span>
                    </div>
                    <div style={hudBarTrack}>
                      <div style={{ ...hudBarFill, width:`${roadmapPct}%` }}/>
                      <div style={{ ...hudMarker, left:`calc(${roadmapPct}% - 5px)` }}><MountainMark size={9} color="#fff"/></div>
                    </div>
                  </div>
                  <button onClick={() => handleOpenGoal(primaryGoal)} style={heroBtn} aria-label="Continuar roadmap">
                    Continuar <ArrowRight size={15}/>
                  </button>
                </div>
              )}
            </div>

            {/* status rápido (streak / nível) — sem ranking */}
            <div style={statusStrip}>
              <StatusPill icon={<Target size={15}/>} value={goals.length} label="metas" color="#6382FF" bg="rgba(99,130,255,0.12)"/>
              <StatusPill icon={<Flag size={15}/>} value={profile?.level||1} label="nível" color="#F5C542" bg="rgba(245,197,66,0.12)"/>
              <StatusPill icon={<Sparkles size={15}/>} value={profile?.streak||0} label="sequência" color="#3ECF8E" bg="rgba(62,207,142,0.12)"/>
            </div>

            {/* ROADMAP — área principal */}
            <SectionLabel icon={<Map size={14}/>} text="Roadmap atual"/>
            <RoadmapCard
              goal={primaryGoal}
              totalLeaves={totalLeaves}
              doneLeaves={doneLeaves}
              pct={roadmapPct}
              onOpen={() => {
                if (primaryGoal && goals.length) {
                  handleOpenGoal(primaryGoal)
                } else {
                  setTab('newgoal')
                }
              }}
            />

            {!primaryGoal && <NewGoalCard input={input} setInput={setInput} onSend={handleSend} loading={loading}/>}

            {/* PERFIL / CONQUISTAS / CONFIG — grelha no desktop */}
            <div style={{ display:'grid', gap:4, gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', alignItems:'start' }}>
              <div>
                <SectionLabel icon={<User size={14}/>} text="Perfil"/>
                <ProfileCard
                  name={firstName}
                  avatar={profile?.avatar_url}
                  goalsCount={goals.length} level={profile?.level||1} xp={profile?.xp||0}
                  onOpen={() => setTab('perfil')}
                />
              </div>
              <div>
                <SectionLabel icon={<Trophy size={14}/>} text="Conquistas"/>
                <AchievementsSection cards={MOCK_ACHIEVEMENTS}/>
                <SectionLabel icon={<Settings size={14}/>} text="Configurações"/>
                <ConfigCard onOpen={() => setTab('config')}/>
              </div>
            </div>

            <div style={{ height: 8 }}/>
          </div>

          {!isDesktop && <BottomNav active="hub" onSelect={handleNav}/>}
          {confirmLogout && <ConfirmLogout onCancel={() => setConfirmLogout(false)} onConfirm={handleLogout}/>}
        </div>
      </AppFrame>
    )
  }

  // NOVA META (fluxo rápido)
  if (tab === 'newgoal') {
    return (
      <AppFrame isDesktop={isDesktop} active={navActive} user={{ firstName, username, avatar: profile?.avatar_url }} onNavigate={handleNav} onLogout={handleLogout}>
        <GlobalStyles/>
        <div style={pageStyle}>
          <SimpleTop title="Nova meta" onBack={() => setTab('hub')}/>
          <div style={{ ...shellWide, paddingTop: 26 }}>
            <div style={card}>
              <div style={cardTitle}>Qual montanha você quer escalar?</div>
              <div style={{ fontSize:12.5, color:'#8A8AA3', lineHeight:1.6, margin:'6px 0 16px' }}>
                Descreva um objetivo e sua trilha é gerada na hora.
              </div>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()} }}
                placeholder="Ex: Funções do segundo grau, Revolução Francesa..."
                rows={3} style={taDark} autoFocus/>
              {err && <ErrorBanner msg={err}/>}
              <button onClick={handleSend} disabled={!input.trim()||loading} style={{ ...btnDark, opacity:(!input.trim()||loading)?0.6:1 }}>
                {loading ? <><Spinner/> Traçando a trilha…</> : <>Gerar roadmap <ArrowRight size={16}/></>}
              </button>
              {loading && (
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:14, padding:'10px 14px', background:'rgba(99,130,255,0.08)', borderRadius:12 }}>
                  <div style={{ ...pulseDot, animationDelay:'0s' }}/>
                  <div style={{ ...pulseDot, animationDelay:'.2s' }}/>
                  <div style={{ ...pulseDot, animationDelay:'.4s' }}/>
                  <span style={{ fontSize:12, color:'#9AB4FF', fontWeight:700 }}>Definindo checkpoints da jornada…</span>
                </div>
              )}
            </div>
            {goals.length > 0 && (
              <div style={{ marginTop:24 }}>
                <SectionLabel icon={<Target size={14}/>} text="Suas metas"/>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {goals.slice(0,8).map(g => (
                    <div key={g.id} style={{ display:'flex', gap:8 }}>
                      <button onClick={() => handleOpenGoal(g)} style={{ ...goalBtn, flex:1 }}>
                        <span style={goalIconWrap}><MountainMark size={14} color="#6382FF"/></span>
                        <span style={{ flex:1 }}>{g.title}</span>
                        <ChevronRight size={15} color="#8A8AA3"/>
                      </button>
                      <button onClick={() => { setEditingGoal(g); setEditInput(g.title) }}
                        style={{ ...squareIconBtn, color:'#9AB4FF' }} aria-label="Editar"><Pencil size={15}/></button>
                      <button onClick={() => setDeletingGoal(g)}
                        style={{ ...squareIconBtn, color:'#F06A6A' }} aria-label="Excluir"><Trash2 size={15}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ height: 20 }}/>
          </div>
          {!isDesktop && <BottomNav active="hub" onSelect={handleNav}/>}
          {editingGoal && (
          <Overlay onClose={() => setEditingGoal(null)}>
            <h3 style={modalTitleDark}>Editar objetivo</h3>
            <textarea value={editInput} onChange={e => setEditInput(e.target.value)} rows={2} autoFocus style={taDark}/>
            {err && <ErrorBanner msg={err}/>}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button onClick={() => setEditingGoal(null)} style={btnGhostDark}>Cancelar</button>
              <button onClick={handleUpdateGoal} disabled={!editInput.trim()||loading} style={{ ...btnDark, flex:1, marginTop:0, opacity:(!editInput.trim()||loading)?0.6:1 }}>
                {loading ? <Spinner/> : 'Salvar'}
              </button>
            </div>
          </Overlay>
        )}
        {deletingGoal && (
          <Overlay onClose={() => setDeletingGoal(null)}>
            <h3 style={modalTitleDark}>Excluir objetivo</h3>
            <p style={{ color:'#8A8AA3', fontSize:14, lineHeight:1.6 }}>
              Tem certeza que deseja excluir <strong style={{ color:'#F5F4FF' }}>{deletingGoal.title}</strong>? Esta trilha e seu progresso serão perdidos.
            </p>
            {err && <ErrorBanner msg={err}/>}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button onClick={() => setDeletingGoal(null)} style={btnGhostDark}>Cancelar</button>
              <button onClick={() => handleDeleteGoal(deletingGoal)} disabled={loading} style={{ ...btnDark, flex:1, marginTop:0, background:'#F06A6A', boxShadow:'0 8px 20px rgba(240,106,106,0.35)', opacity:loading?0.6:1 }}>
                {loading ? <Spinner/> : 'Excluir'}
              </button>
            </div>
          </Overlay>
        )}
      </div>
      </AppFrame>
    )
  }

  // ROADMAP — a chegada: montanha imersiva
  if (tab === 'roadmap') {
    const parents = getParents(topics)
    const childrenOf = (parentId) => available.filter(t => t.parent_topic_id === parentId)
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

    const currentPhase = phases.find(p => p.current) || phases[0]
    const N = phases.length
    const slotH = 150
    const summitReserve = 210
    const containerH = 16 + N * slotH + summitReserve
    const anchor = (i) => {
      const up = N > 1 ? i / (N - 1) : 0
      const y = summitReserve + (N - 1 - i) * slotH
      const x = 50 + Math.sin(i * 1.7 + 0.4) * 24
      const scale = 1 - 0.42 * up
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
      <AppFrame isDesktop={isDesktop} active={navActive} user={{ firstName, username, avatar: profile?.avatar_url }} onNavigate={handleNav} onLogout={handleLogout}>
        <GlobalStyles/>
        <div style={mountainPage}>
          <div style={mountainHeader}>
            <button onClick={() => setTab('hub')} style={iconNavBtn} aria-label="Início"><ArrowLeft size={19}/></button>
            <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14, textAlign:'center', flex:1, padding:'0 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{curGoal?.title}</span>
            {!isDesktop && <button onClick={handleLogout} style={iconNavBtn} aria-label="Sair"><LogOut size={16}/></button>}
            {isDesktop && <span style={{ width:36 }}/>}
          </div>

          <div style={{ maxWidth: roadStage, margin:'0 auto', padding:'10px 16px 12px', position:'relative', zIndex:5 }}>
            <div style={hudLabel}>
              <span>PROGRESSO DA SUBIDA</span>
              <span>{doneLeaves}/{totalLeaves} · {roadmapPct}%</span>
            </div>
            <div style={hudBarTrack}><div style={{ ...hudBarFill, width:`${roadmapPct}%` }}/>
              <div style={{ ...hudMarker, left:`calc(${roadmapPct}% - 5px)` }}><MountainMark size={9} color="#fff"/></div>
            </div>
            {err && <ErrorBannerDark msg={err}/>}
          </div>

          {loading && (
            <div style={{ maxWidth: roadStage, margin:'16px auto 0', padding:'0 16px', position:'relative', zIndex:5 }}>
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
              <div style={{ position:'relative', width:'100%', height:containerH, maxWidth: roadStage, margin:'0 auto' }}>
                <MountainScene svgH={containerH} pathD={pathD}/>
                <div style={{ position:'absolute', left:'50%', top:anchor(N-1).y - 118, transform:'translateX(-50%)', zIndex:2 }}>
                  <SummitArt title={curGoal?.title} pct={roadmapPct}/>
                </div>
                {currentPhase && (
                  <div style={{ position:'absolute', left:`${anchor(phases.indexOf(currentPhase)).x}%`, top:anchor(phases.indexOf(currentPhase)).y + 34, transform:'translate(-50%,0)', zIndex:4 }}>
                    <UserMarker/>
                  </div>
                )}
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
                        onClick={() => { if (ph.locked) return; setSelPhase({ ...ph, theme: THEMES[themeIdx] }); setTab('phase') }}
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
      </AppFrame>
    )
  }

  // PHASE — um "lugar" temático com as lições do estágio
  if (tab === 'phase' && selPhase) {
    const ph = selPhase
    const theme = ph.theme || THEMES[0]
    return (
      <AppFrame isDesktop={isDesktop} active={navActive} user={{ firstName, username, avatar: profile?.avatar_url }} onNavigate={handleNav} onLogout={handleLogout}>
        <GlobalStyles/>
        <div style={{ minHeight:'100vh', background: theme.bg, color:'#F5F4FF', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', position:'relative', overflow:'hidden' }}>
          <ThemeDecor theme={theme}/>
          <div style={mountainHeader}>
            <button onClick={() => setTab('roadmap')} style={iconNavBtn} aria-label="Voltar"><ArrowLeft size={19}/></button>
            <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14, textAlign:'center', flex:1, padding:'0 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ph.parent.title}</span>
            {!isDesktop && <button onClick={() => setTab('hub')} style={iconNavBtn} aria-label="Início"><Home size={16}/></button>}
            {isDesktop && <span style={{ width:36 }}/>}
          </div>
          <div style={{ position:'relative', zIndex:3, maxWidth: contentStage, margin:'0 auto', padding:'26px 18px 60px' }}>
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
                <LessonRow key={n.id} n={n} done={completed.includes(n.id)} current={taskNode?.id===n.id} onClick={() => handleClimbLesson(n)} accent={theme.accent}/>
              ))}
            </div>
            {err && <ErrorBannerDark msg={err}/>}
          </div>
        </div>
      </AppFrame>
    )
  }

  // TASK
  if (tab === 'task' && task) {
    const content  = task.content || {}
    const questions = sa(content.questions)
    const title    = content.title || task.meta?.title || 'Tarefa'
    const desc     = content.description || task.meta?.description || ''
    return (
      <AppFrame isDesktop={isDesktop} active={navActive} user={{ firstName, username, avatar: profile?.avatar_url }} onNavigate={handleNav} onLogout={handleLogout}>
        <GlobalStyles/>
        <div style={pageStyle}>
          <div style={headerDark}>
            <button onClick={() => setTab('roadmap')} style={iconNavBtn} aria-label="Voltar"><ArrowLeft size={19}/></button>
            <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14, textAlign:'center', flex:1, padding:'0 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</span>
            <span style={{ width:36 }}/>
          </div>
          <div style={{ ...shellWide, paddingTop: 22 }}>
            <div style={taskProgressTrack}><div style={taskProgressFill}/></div>
            {desc && <p style={{ color:'#8A8AA3', fontSize:13.5, margin:'16px 0 20px', lineHeight:1.6 }}>{desc}</p>}
            {questions.map((q, qi) => (
              <div key={qi} style={questionCardDark}>
                {q.material && <div style={materialTagDark}>{q.material}</div>}
                <p style={{ color:'#F5F4FF', fontSize:15, marginBottom:14, lineHeight:1.6, fontWeight:600 }}>
                  <span style={{ color:'#9AB4FF' }}>{qi+1}.</span> {q.question || q.statement}
                </p>
                {sa(q.options || q.alternatives).map((opt, ai) => {
                  const sel = answers[qi] === ai
                  return (
                    <button key={ai} onClick={() => setAnswers(p => ({...p,[qi]:ai}))}
                      style={{ ...optionBtnDark, ...(sel?optionBtnSelDark:{}) }}>
                      <span style={{ ...optionKeyDark, ...(sel?optionKeySelDark:{}) }}>
                        {String.fromCharCode(65+ai)}
                      </span>
                      {opt}
                    </button>
                  )
                })}
              </div>
            ))}
            {err && <ErrorBanner msg={err}/>}
            <button onClick={handleSubmit} disabled={loading} style={{ ...btnDark, opacity:loading?0.6:1 }}>
              {loading ? <><Spinner/> Enviando…</> : <>Enviar resposta <ArrowRight size={16}/></>}
            </button>
          </div>
        </div>
      </AppFrame>
    )
  }

  // RESULT
  if (tab === 'result' && result) {
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
      <AppFrame isDesktop={isDesktop} active={navActive} user={{ firstName, username, avatar: profile?.avatar_url }} onNavigate={handleNav} onLogout={handleLogout}>
        <GlobalStyles/>
        <div style={pageStyle}>
          <div style={headerDark}>
            <button onClick={() => setTab('roadmap')} style={iconNavBtn} aria-label="Roadmap"><ArrowLeft size={19}/></button>
            <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14 }}>Resultado</span>
            <span style={{ width:36 }}/>
          </div>
          <div style={{ ...shellWide, paddingTop: 22 }}>
          <div style={{ ...resultCardDark, ...(mastered?{ border:`1px solid ${mc}55`, boxShadow:`0 16px 40px ${mc}22` }:{}) }}>
            {mastered && <div style={{ position:'absolute', inset:0, borderRadius:22, animation:'metaGlow 1.8s ease-in-out infinite', background:`radial-gradient(circle at 50% 20%, ${mc}22, transparent 70%)` }}/>}
            <svg width="128" height="128" viewBox="0 0 128 128" style={{ position:'relative' }}>
              <circle cx="64" cy="64" r="52" fill="none" stroke="#1E2747" strokeWidth="10"/>
              <circle cx="64" cy="64" r="52" fill="none" stroke={mc} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={ringCirc} strokeDashoffset={ringCirc - (ringCirc*pct/100)}
                transform="rotate(-90 64 64)" style={{ transition:'stroke-dashoffset .8s ease' }}/>
              <text x="64" y="60" textAnchor="middle" fontSize="26" fontWeight="800" fill="#F5F4FF">{pct}%</text>
              <text x="64" y="78" textAnchor="middle" fontSize="10" fontWeight="700" fill="#8A8AA3">ACERTOS</text>
            </svg>
            <div style={{ color:'#F5F4FF', fontSize:16, fontWeight:800, marginTop:10, position:'relative', display:'flex', alignItems:'center', gap:6, justifyContent:'center' }}>
              {mastered && <MountainMark size={16} color="#F5C542"/>}
              {mastered?'Checkpoint conquistado!':score>=0.4?'Bom esforço! Tente novamente para concluir.':'Continue tentando!'}
            </div>
          </div>
          {correction && (
            <div style={correctionCardDark}>
              <div style={correctionEyebrowDark}><Sparkles size={14}/> Feedback da jornada</div>
              {typeof correction === 'string' ? (
                <p style={{ color:'#E7E9F8', fontSize:14, lineHeight:1.7, whiteSpace:'pre-wrap', margin:0 }}>{correction}</p>
              ) : (
                <>
                  {correction.summary && <p style={{ color:'#E7E9F8', fontSize:14, lineHeight:1.7, marginBottom:10 }}>{correction.summary}</p>}
                  {sa(correction.feedback || correction.comments || correction.items).map((f, i) => (
                    <div key={i} style={feedbackItemDark}>
                      {typeof f === 'string' ? (
                        <p style={{ color:'#C7CBEA', fontSize:13, lineHeight:1.6, margin:0 }}>{f}</p>
                      ) : (
                        <>
                          {f.comment && <p style={{ color:'#C7CBEA', fontSize:13, lineHeight:1.6, margin:'0 0 4px' }}>{f.comment}</p>}
                          {f.correct === false && <p style={{ color:'#F08181', fontSize:12, lineHeight:1.5, margin:0, fontWeight:700 }}>Correta: {f.correct_answer ?? f.expected}</p>}
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
              <div key={i} style={{ ...reviewRowDark, ...(ok?reviewRowOkDark:reviewRowBadDark) }}>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                  {ok ? <Check size={15} color="#3ECF8E"/> : <X size={15} color="#F06A6A"/>}
                  <span style={{ color: ok?'#3ECF8E':'#F08181', fontWeight:800, fontSize:12.5 }}>Questão {i+1}</span>
                  {opts[sub] !== undefined && <span style={{ color:'#8A8AA3', fontSize:11.5, marginLeft:'auto' }}>Sua: {opts[sub]}</span>}
                </div>
                {!ok && opts[cor] && <p style={{ color:'#8A8AA3', fontSize:12, margin:'4px 0 0', lineHeight:1.5 }}>Correta: {opts[cor]}</p>}
                {item.explanation && <p style={{ color:'#8A8AA3', fontSize:12, margin:'4px 0 0', lineHeight:1.5, fontStyle:'italic' }}>{item.explanation}</p>}
              </div>
            )
          })}
          <div style={{ display:'flex', gap:10, marginTop:18 }}>
            <button onClick={() => { setTab('task'); setAnswers({}); setResult(null) }} style={btnGhostDark}>
              Tentar novamente
            </button>
            <button onClick={() => setTab('roadmap')} style={{ ...btnDark, flex:1, marginTop:0 }}>
              Próxima lição <ArrowRight size={16}/>
            </button>
          </div>
        </div>
        </div>
      </AppFrame>
    )
  }

  // PERFIL
  if (tab === 'perfil') {
    const level    = profile?.level || 1
    const xp       = profile?.xp    || 0
    const xpInLevel = xp % 100
    const xpNext   = 100
    const pct2     = Math.min(100, Math.round(xpInLevel / xpNext * 100))
    return (
      <AppFrame isDesktop={isDesktop} active={navActive} user={{ firstName, username, avatar: profile?.avatar_url }} onNavigate={handleNav} onLogout={handleLogout}>
        <GlobalStyles/>
        <div style={pageStyle}>
          <div style={headerDark}>
            <button onClick={() => setTab('hub')} style={iconNavBtn} aria-label="Início"><ArrowLeft size={19}/></button>
            <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14 }}>Perfil</span>
            {!isDesktop && <button onClick={() => setConfirmLogout(true)} style={iconNavBtn} aria-label="Sair"><LogOut size={16}/></button>}
            {isDesktop && <span style={{ width:36 }}/>}
          </div>
          <div style={{ ...shellWide, paddingTop: 26 }}>
            <div style={{ ...card, textAlign:'center', paddingTop:28 }}>
              <label style={{ position:'relative', cursor:'pointer', display:'inline-block' }}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" style={avatarImg}/>
                ) : (
                  <div style={avatarFallback}>{firstName[0]?.toUpperCase()||'?'}</div>
                )}
                <div style={levelBadge}>{level}</div>
                <div style={avatarEditBtn}><Pencil size={12}/></div>
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleAvatarUpload} style={{ display:'none' }}/>
              </label>
              <div style={{ fontSize:18, fontWeight:800, color:'#F5F4FF', marginTop:12 }}>{username}</div>
              <div style={{ fontSize:12.5, color:'#8A8AA3', marginTop:2 }}>{email}</div>
              <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:10 }}>
                <StatusPill icon={<Target size={14}/>} value={goals.length} label="metas" color="#6382FF" bg="rgba(99,130,255,0.12)"/>
                <StatusPill icon={<Flag size={14}/>} value={profile?.streak||0} label="sequência" color="#3ECF8E" bg="rgba(62,207,142,0.12)"/>
              </div>
              {err && <ErrorBanner msg={err}/>}
              <div style={{ marginTop:20, textAlign:'left' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, marginBottom:8 }}>
                  <span style={{ color:'#F5F4FF' }}>Nível {level}</span>
                  <span style={{ color:'#8A8AA3' }}>{xpInLevel} / {xpNext} XP</span>
                </div>
                <div style={trailBarTrack}>
                  <div style={{ ...trailBarFill, width:`${pct2}%`, background:'linear-gradient(90deg,#6382FF,#9AB4FF)' }}/>
                  <div style={{ ...xpMarker, left:`calc(${pct2}% - 8px)` }}><MountainMark size={10} color="#fff"/></div>
                </div>
                <div style={{ fontSize:11, color:'#8A8AA3', marginTop:6, textAlign:'right', fontWeight:700 }}>{Math.max(0,xpNext-xpInLevel)} XP para o nível {level+1}</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:16 }}>
              {[{l:'Nível',v:level,c:'#6382FF',bg:'rgba(99,130,255,0.12)'},{l:'XP total',v:xp,c:'#F5C542',bg:'rgba(245,197,66,0.12)'},{l:'Metas',v:goals.length,c:'#3ECF8E',bg:'rgba(62,207,142,0.12)'}].map(({l,v,c,bg}) => (
                <div key={l} style={statCardDark}>
                  <div style={{ ...statIconWrap, background:bg }}><MountainMark size={14} color={c}/></div>
                  <div style={{ fontSize:18, fontWeight:800, color:c, marginTop:8 }}>{v}</div>
                  <div style={{ fontSize:10, color:'#8A8AA3', marginTop:2, fontWeight:700 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          {!isDesktop && <BottomNav active="perfil" onSelect={handleNav}/>}
          {confirmLogout && <ConfirmLogout onCancel={() => setConfirmLogout(false)} onConfirm={handleLogout}/>}
        </div>
      </AppFrame>
    )
  }

  // CONQUISTAS — APENAS VISUAL / MOCK
  if (tab === 'conquistas') {
    return (
      <AppFrame isDesktop={isDesktop} active={navActive} user={{ firstName, username, avatar: profile?.avatar_url }} onNavigate={handleNav} onLogout={handleLogout}>
        <div style={pageStyle}>
          <GlobalStyles/>
          <div style={headerDark}>
            <button onClick={() => setTab('hub')} style={iconNavBtn} aria-label="Início"><ArrowLeft size={19}/></button>
            <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14 }}>Conquistas</span>
            <span style={{ width:36 }}/>
          </div>
          <div style={{ ...shellWide, paddingTop: 26 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
              <div style={{ width:44, height:44, borderRadius:14, background:'rgba(245,197,66,0.14)', display:'flex', alignItems:'center', justifyContent:'center', color:'#F5C542' }}>
                <Trophy size={22}/>
              </div>
              <div>
                <div style={{ fontSize:20, fontWeight:800, color:'#F5F4FF', letterSpacing:'-0.02em' }}>Conquistas</div>
                <div style={{ fontSize:12.5, color:'#8A8AA3' }}>Sua evolução ao longo da jornada</div>
              </div>
            </div>
            <AchievementsSection cards={MOCK_ACHIEVEMENTS} full/>
          <div style={{ marginTop:14, padding:'14px 16px', background:'rgba(154,180,255,0.06)', border:'1px solid rgba(154,180,255,0.12)', borderRadius:16, display:'flex', alignItems:'center', gap:10 }}>
            <Sparkles size={16} color="#9AB4FF"/>
            <span style={{ fontSize:12.5, color:'#9AB4FF', lineHeight:1.5 }}>
              O sistema de conquistas está em construção. Em breve, suas metas concluídas desbloquearão novas conquistas aqui.
            </span>
          </div>
          </div>
          {!isDesktop && <BottomNav active="conquistas" onSelect={handleNav}/>}
        </div>
      </AppFrame>
    )
  }

  // CONFIGURAÇÕES
  if (tab === 'config') {
    const rows = [
      { icon: User,  title: 'Perfil',            desc: 'Avatar, nome e e-mail' },
      { icon: Palette, title: 'Aparência',       desc: 'Tema e cores da interface' },
      { icon: Bell,    title: 'Notificações',    desc: 'Lembretes e avisos' },
      { icon: Smartphone, title: 'Preferências', desc: 'Idioma e experiência' },
      { icon: HelpCircle, title: 'Ajuda',        desc: 'Central de suporte' },
      { icon: ShieldCheck, title: 'Segurança',   desc: 'Sessão e privacidade' },
    ]
    return (
      <AppFrame isDesktop={isDesktop} active={navActive} user={{ firstName, username, avatar: profile?.avatar_url }} onNavigate={handleNav} onLogout={handleLogout}>
        <div style={pageStyle}>
          <GlobalStyles/>
          <div style={headerDark}>
            <button onClick={() => setTab('hub')} style={iconNavBtn} aria-label="Início"><ArrowLeft size={19}/></button>
            <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14 }}>Configurações</span>
            <span style={{ width:36 }}/>
          </div>
          <div style={{ ...shellWide, paddingTop: 26 }}>
            <div style={{ fontSize:20, fontWeight:800, color:'#F5F4FF', letterSpacing:'-0.02em', marginBottom:6 }}>Personalize sua experiência</div>
            <div style={{ fontSize:12.5, color:'#8A8AA3', marginBottom:20, lineHeight:1.6 }}>Ajuste seu perfil, aparência e preferências do Metapps.</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {rows.map((r, i) => {
                const Icon = r.icon
                return (
                  <button key={i} style={configRow} onClick={() => {}}>
                    <span style={{ width:40, height:40, borderRadius:12, background:'rgba(99,130,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icon size={18} color="#9AB4FF"/>
                    </span>
                    <span style={{ flex:1, textAlign:'left', minWidth:0 }}>
                      <span style={{ display:'block', fontSize:14, fontWeight:700, color:'#F5F4FF' }}>{r.title}</span>
                      <span style={{ display:'block', fontSize:12, color:'#8A8AA3', marginTop:1 }}>{r.desc}</span>
                    </span>
                    <ChevronRight size={16} color="#5A5F8A"/>
                  </button>
                )
              })}
            </div>
            <button onClick={() => setConfirmLogout(true)} style={{ ...btnGhostDark, marginTop:22 }}>
              <LogOut size={16}/> Sair da conta
            </button>
            <div style={{ textAlign:'center', fontSize:11, color:'#5A5F8A', marginTop:18 }}>Metapps · v1.0</div>
          </div>
          {!isDesktop && <BottomNav active="config" onSelect={handleNav}/>}
          {confirmLogout && <ConfirmLogout onCancel={() => setConfirmLogout(false)} onConfirm={handleLogout}/>}
        </div>
      </AppFrame>
    )
  }

  return <div style={center}><Spinner size={22}/></div>

  // ── NAVEGAÇÃO ──
  function handleNav(target) {
    if (target === 'hub') setTab('hub')
    else if (target === 'roadmap') {
      if (primaryGoal) handleOpenGoal(primaryGoal)
      else setTab('newgoal')
    }
    else if (target === 'perfil') setTab('perfil')
    else if (target === 'conquistas') setTab('conquistas')
    else if (target === 'config') setTab('config')
  }
}

// ─── COMPONENTES DO HUB ─────────────────────────────────────────

function HeaderBar({ username, avatar, onLogout }) {
  return (
    <div style={headerDark}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <MountainMark size={22} color="#F5C542"/>
        <span style={{ fontWeight:800, fontSize:16, color:'#f5f4ff', letterSpacing:'-0.02em' }}>Metapps</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <Avatar size={34} url={avatar} name={username}/>
        <button onClick={onLogout} style={iconNavBtn} aria-label="Sair"><LogOut size={16}/></button>
      </div>
    </div>
  )
}

function Avatar({ size, url, name }) {
  if (url) return <img src={url} alt="avatar" style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(154,180,255,0.35)', flexShrink:0 }}/>
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'linear-gradient(150deg,#6382FF,#9AB4FF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.42, fontWeight:800, color:'#fff', flexShrink:0 }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

function SectionLabel({ icon, text }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, fontWeight:800, letterSpacing:'0.7px', textTransform:'uppercase', color:'#8A8CA8', margin:'22px 4px 12px' }}>
      {icon}<span>{text}</span>
    </div>
  )
}

function StatusPill({ icon, value, label, color, bg }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', background:bg, borderRadius:12, color, flexShrink:0 }}>
      {icon}
      <span style={{ fontSize:14, fontWeight:800 }}>{value}</span>
      <span style={{ fontSize:12, color:'#B7B7CC', fontWeight:600 }}>{label}</span>
    </div>
  )
}

function RoadmapCard({ goal, totalLeaves, doneLeaves, pct, onOpen }) {
  const description = goal?.settings?.motivation
    || (goal ? 'Construa sua jornada de aprendizado, um passo por vez.' : 'Comece a construir sua jornada de aprendizado')
  return (
    <button onClick={onOpen} style={roadmapCardBtn} aria-label={goal ? `Abrir roadmap: ${goal.title}` : 'Criar primeira meta'}>
      <div className="roadmap-card" style={roadmapCard}>
        <div className="roadmap-card-inner" style={{ display:'flex', alignItems:'center', gap:14, width:'100%' }}>
          <div style={{ width:52, height:52, borderRadius:16, background:'linear-gradient(150deg,#6382FF,#9AB4FF)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:'0 12px 28px rgba(99,130,255,0.45)', flexShrink:0 }}>
            <Map size={26}/>
          </div>
          <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
            <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.5px', textTransform:'uppercase', color:'#9AB4FF', marginBottom:4 }}>Roadmap atual</div>
            {goal ? (
              <>
                <div style={{ fontSize:17, fontWeight:800, color:'#F5F4FF', letterSpacing:'-0.02em', lineHeight:1.25, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{goal.title}</div>
                <div style={{ fontSize:12, color:'#8A8AA3', marginTop:4, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{description}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize:17, fontWeight:800, color:'#F5F4FF', letterSpacing:'-0.02em', lineHeight:1.25 }}>Crie sua primeira meta</div>
                <div style={{ fontSize:12, color:'#8A8AA3', marginTop:4, lineHeight:1.5 }}>Descreva um objetivo e comece sua trilha</div>
              </>
            )}
          </div>
        </div>

        {goal && (
          <div className="roadmap-card-progress" style={{ marginTop:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, fontWeight:800, marginBottom:7 }}>
              <span style={{ color:'#F5F4FF' }}>{pct}% concluído</span>
              <span style={{ color:'#8A8AA3', fontWeight:700 }}>{doneLeaves} de {totalLeaves || '—'} etapas concluídas</span>
            </div>
            <div style={hudBarTrack}>
              <div style={{ ...hudBarFill, width:`${pct}%` }}/>
            </div>
          </div>
        )}

        <div className="roadmap-card-chevron" style={{ display:'flex', alignItems:'center', justifyContent:'center', marginTop:14 }}>
          <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:800, color:'#9AB4FF' }}>
            {goal ? 'Abrir roadmap' : 'Começar agora'}
            <span style={{ width:26, height:26, borderRadius:'50%', background:'rgba(154,180,255,0.14)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ChevronRight size={16}/>
            </span>
          </span>
        </div>
      </div>
    </button>
  )
}

function NewGoalCard({ input, setInput, onSend, loading }) {
  return (
    <div style={card}>
      <div style={{ fontSize:15, fontWeight:800, color:'#F5F4FF', letterSpacing:'-0.01em' }}>Qual montanha você quer escalar?</div>
      <div style={{ fontSize:12.5, color:'#8A8AA3', margin:'6px 0 14px', lineHeight:1.5 }}>Descreva um objetivo e sua trilha é gerada na hora.</div>
      <textarea value={input} onChange={e => setInput(e.target.value)} rows={2} placeholder="Ex: Funções do segundo grau, Revolução Francesa..." style={taDark}/>
      <button onClick={onSend} disabled={!input.trim()||loading} style={{ ...btnDark, opacity:(!input.trim()||loading)?0.6:1 }}>
        {loading ? <><Spinner/> Traçando a trilha…</> : <>Gerar roadmap <ArrowRight size={16}/></>}
      </button>
    </div>
  )
}

function ProfileCard({ name, avatar, goalsCount, level, xp, onOpen }) {
  return (
    <button onClick={onOpen} style={{ ...cardBtn, padding:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 18px', background:'none', borderRadius:22, cursor:'pointer' }}>
        <Avatar size={54} url={avatar} name={name}/>
        <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#F5F4FF', letterSpacing:'-0.02em' }}>{name}</div>
          <div style={{ fontSize:12.5, color:'#8A8AA3', marginTop:2 }}>{goalsCount} {goalsCount === 1 ? 'meta' : 'metas'} em andamento</div>
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <MiniBadge color="#F5C542">Nível {level}</MiniBadge>
            <MiniBadge color="#9AB4FF">{xp} XP</MiniBadge>
          </div>
        </div>
        <span style={{ width:34, height:34, borderRadius:'50%', background:'rgba(154,180,255,0.14)', display:'flex', alignItems:'center', justifyContent:'center', color:'#9AB4FF', flexShrink:0 }}>
          <ChevronRight size={18}/>
        </span>
      </div>
    </button>
  )
}

function MiniBadge({ children, color }) {
  return <span style={{ fontSize:10.5, fontWeight:800, color, background:'rgba(154,180,255,0.08)', padding:'3px 9px', borderRadius:99 }}>{children}</span>
}

function AchievementsSection({ cards, full }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns: full ? '1fr 1fr 1fr' : '1fr 1fr 1fr', gap:10 }}>
      {cards.map(a => {
        const Icon = a.icon
        return (
          <div key={a.id} style={achCard(a.unlocked, a.bg)}>
            <div style={{ width:40, height:40, borderRadius:12, background:a.bg, display:'flex', alignItems:'center', justifyContent:'center', color:a.unlocked?a.color:'#5A5F8A', margin:'0 auto', opacity:a.unlocked?1:0.4 }}>
              <Icon size={20}/>
            </div>
            <div style={{ fontSize:12.5, fontWeight:800, color: a.unlocked?'#F5F4FF':'#8A8CA8', marginTop:10, lineHeight:1.3 }}>{a.title}</div>
            <div style={{ fontSize:10.5, color:'#8A8AA3', marginTop:3, lineHeight:1.4 }}>{a.desc}</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginTop:9, fontSize:10, fontWeight:800, color: a.unlocked?'#3ECF8E':'#5A5F8A' }}>
              {a.unlocked ? <><Check size={11}/> Desbloqueada</> : <><Lock size={11}/> Em progresso</>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ConfigCard({ onOpen }) {
  return (
    <button onClick={onOpen} style={{ ...cardBtn, padding:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'18px', background:'none', borderRadius:22, cursor:'pointer' }}>
        <span style={{ width:44, height:44, borderRadius:13, background:'rgba(99,130,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', color:'#9AB4FF', flexShrink:0 }}>
          <Settings size={20}/>
        </span>
        <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#F5F4FF' }}>Configurações</div>
          <div style={{ fontSize:12.5, color:'#8A8AA3', marginTop:2 }}>Personalize sua experiência</div>
        </div>
        <ChevronRight size={17} color="#5A5F8A"/>
      </div>
    </button>
  )
}

function ErrorBanner({ msg }) {
  return <div style={errStyle}><span style={{ fontSize:14, fontWeight:900, marginRight:8 }}>!</span>{msg}</div>
}
function ErrorBannerDark({ msg }) {
  return <div style={errDark}><span style={{ fontSize:14, fontWeight:900, marginRight:8 }}>!</span>{msg}</div>
}

function Overlay({ children, onClose }) {
  return <div style={overlay} onClick={onClose}><div style={modalDark} onClick={e => e.stopPropagation()}>{children}</div></div>
}

function ConfirmLogout({ onCancel, onConfirm }) {
  return (
    <Overlay onClose={onCancel}>
      <h3 style={modalTitleDark}>Sair da conta?</h3>
      <p style={{ color:'#8A8AA3', fontSize:14, lineHeight:1.6 }}>Você precisará entrar novamente para continuar sua jornada.</p>
      <div style={{ display:'flex', gap:10, marginTop:16 }}>
        <button onClick={onCancel} style={btnGhostDark}>Cancelar</button>
        <button onClick={onConfirm} style={{ ...btnDark, flex:1, marginTop:0, background:'#F06A6A', boxShadow:'0 8px 20px rgba(240,106,106,0.35)' }}>Sair</button>
      </div>
    </Overlay>
  )
}

function BottomNav({ active, onSelect }) {
  const items = [
    { key: 'hub',        icon: Home,     label: 'Home' },
    { key: 'roadmap',    icon: Route,    label: 'Roadmap' },
    { key: 'perfil',     icon: User,     label: 'Perfil' },
    { key: 'conquistas', icon: Trophy,   label: 'Conquistas' },
    { key: 'config',     icon: Settings, label: 'Config' },
  ]
  return (
    <nav style={bottomNav}>
      <div style={bottomNavInner}>
        {items.map((it) => {
          const Icon = it.icon
          const isActive = it.key === active
          return (
            <button key={it.key} onClick={() => onSelect(it.key)} style={navItem} aria-current={isActive}>
              <span style={navIconWrap(isActive)}>
                <Icon size={20} strokeWidth={isActive ? 2.4 : 2}/>
              </span>
              <span style={navLabel(isActive)}>{it.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function SimpleTop({ title, onBack }) {
  return (
    <div style={headerDark}>
      <button onClick={onBack} style={iconNavBtn} aria-label="Voltar"><ArrowLeft size={19}/></button>
      <span style={{ fontWeight:800, color:'#f5f4ff', fontSize:14 }}>{title}</span>
      <span style={{ width:36 }}/>
    </div>
  )
}

// ─── componentes auxiliares (montanha / fases / temas) ─────────

const THEMES = [
  { name:'Caverna',  accent:'#3ECF8E', glow:'62,207,142',     bg:'linear-gradient(180deg,#0B1026 0%, #10203E 55%, #14355A 100%)' },
  { name:'Torre',    accent:'#6382FF', glow:'99,130,255',      bg:'linear-gradient(180deg,#0D1430 0%, #1A2450 55%, #2A2E66 100%)' },
  { name:'Ponte',    accent:'#9AB4FF', glow:'154,180,255',     bg:'linear-gradient(180deg,#0E1230 0%, #1C2548 55%, #2E3B63 100%)' },
  { name:'Ruínas',   accent:'#F5C542', glow:'245,197,66',      bg:'linear-gradient(180deg,#151030 0%, #2A1D3E 55%, #43305C 100%)' },
  { name:'Porto',    accent:'#7FD8FF', glow:'127,216,255',     bg:'linear-gradient(180deg,#0A1226 0%, #10304A 55%, #1A4A66 100%)' },
  { name:'Floresta', accent:'#38D99A', glow:'56,217,154',      bg:'linear-gradient(180deg,#0A2418 0%, #123B2B 55%, #1B5B40 100%)' },
]

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

function UserMarker() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', animation:'metaPulse 1.7s ease-in-out infinite' }}>
      <div style={{ width:16, height:16, borderRadius:'50%', background:'#F5F4FF', border:'3px solid #6382FF', boxShadow:'0 0 0 6px rgba(99,130,255,0.35), 0 0 18px rgba(99,130,255,0.8)' }}/>
      <div style={{ width:2, height:26, background:'rgba(245,244,255,0.5)' }}/>
    </div>
  )
}

function StageLandmark({ theme, state, title, count, onClick, disabled }) {
  const stateColor = state==='done' ? '#3ECF8E' : state==='current' ? theme.accent : '#5A5F8A'
  const lit = state !== 'locked'
  const glow = state==='current' ? `${theme.glow},0.55` : state==='done' ? '62,207,142,0.45' : '0,0,0,0'
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:'190px' }}>
      <button onClick={onClick} disabled={disabled} aria-label={title}
        style={{ position:'relative', background:'none', border:'none', padding:0, cursor:disabled?'not-allowed':'pointer', filter:`drop-shadow(0 8px 18px rgba(0,0,0,0.5)) ${lit?`drop-shadow(0 0 16px rgba(${glow}))`:''}`, opacity:disabled?0.7:1 }}>
        <svg width="190" height="120" viewBox="0 0 190 120">
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
          {state==='done' && <><Check size={11} color="#3ECF8E"/> {count.total}/{count.total}</>}
          {state==='current' && <><MountainMark size={11} color={theme.accent}/> {count.done}/{count.total} · aqui</>}
          {state==='locked' && <><Lock size={11}/> bloqueado</>}
        </div>
      </div>
    </div>
  )
}

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

function LessonRow({ n, done, current, onClick, accent }) {
  return (
    <button onClick={onClick} disabled={n.blocked}
      style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'14px 16px', borderRadius:16, cursor:n.blocked?'not-allowed':'pointer', fontFamily:'inherit', textAlign:'left', background: done?'rgba(62,207,142,0.14)':n.blocked?'rgba(245,244,255,0.04)':'rgba(245,244,255,0.08)', border: done?'1.5px solid rgba(62,207,142,0.5)':n.blocked?'1.5px solid rgba(245,244,255,0.08)':`1.5px solid ${accent}66`, boxShadow: current?`0 0 0 1px ${accent}99, 0 10px 26px rgba(0,0,0,0.3)`:undefined, opacity:n.blocked?0.6:1 }}>
      <div style={{ width:38, height:38, borderRadius:12, flexShrink:0, background: done?'rgba(62,207,142,0.25)':n.blocked?'rgba(245,244,255,0.06)':'rgba(245,244,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', color:done?'#3ECF8E':'#F5F4FF' }}>
        {done ? <Check size={16}/> : n.blocked ? <Lock size={14}/> : <MountainMark size={16} color="#F5F4FF"/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:800, color: n.blocked?'#8A8CAB':'#F5F4FF', lineHeight:1.3 }}>{n.title}</div>
        {n.description && <div style={{ fontSize:11, color:'rgba(245,244,255,0.55)', marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{n.description}</div>}
      </div>
      <ChevronRight size={16} color="#F5F4FF"/>
    </button>
  )
}

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
      <g fill="#ffffff" opacity="0.5">
        {[[20,30],[32,55],[50,22],[63,48],[78,30],[40,80],[85,70],[15,70]].map(([x,y])=>
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.5"/>
        )}
      </g>
      <polygon points={`0,${svgH*0.18} 22,${svgH*0.06} 40,${svgH*0.2} 62,${svgH*0.03} 82,${svgH*0.2} 100,${svgH*0.1} 100,100 0,100`} fill="#16213E" opacity="0.9"/>
      <polygon points={`0,${svgH*0.3} 18,${svgH*0.16} 38,${svgH*0.32} 58,${svgH*0.12} 80,${svgH*0.3} 100,${svgH*0.2} 100,100 0,100`} fill="#1B2A4E"/>
      <polygon points={`0,${svgH*0.45} 18,${svgH*0.3} 40,${svgH*0.48} 60,${svgH*0.26} 82,${svgH*0.46} 100,${svgH*0.34} 100,100 0,100`} fill="#22335C"/>
      <polygon points={`0,${svgH*0.6} 20,${svgH*0.46} 42,${svgH*0.62} 64,${svgH*0.42} 86,${svgH*0.6} 100,${svgH*0.5} 100,100 0,100`} fill="#2A3E6E"/>
      <polygon points={`0,${svgH*0.74} 22,${svgH*0.6} 44,${svgH*0.76} 68,${svgH*0.58} 90,${svgH*0.74} 100,${svgH*0.66} 100,100 0,100`} fill="#334983"/>
      <polygon points={`0,100 18,${svgH*0.72} 40,${svgH*0.88} 64,${svgH*0.7} 88,${svgH*0.9} 100,${svgH*0.78} 100,100`} fill="#3D568F"/>
      <rect x="0" y="0" width="100" height={svgH*0.4} fill="url(#fogGrad)"/>
      <path d={pathD} fill="none" stroke="#F5F4FF" strokeWidth="0.9" strokeLinecap="round" opacity="0.85"/>
      <path d={pathD} fill="none" stroke="#9AB4FF" strokeWidth="0.5" strokeDasharray="0.2 1" strokeLinecap="round" opacity="0.7"/>
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

function IconFlag() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5C542" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4"/><path d="M4 4h14l-3 4 3 4H4"/></svg> }

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
      @keyframes heroPulse { 0%,100% { opacity:0.55; transform: scale(1); } 50% { opacity:1; transform: scale(1.06); } }
      .roadmap-card { transition: transform .18s ease, box-shadow .18s ease; }
      .roadmap-card:hover, .roadmap-card:focus-visible { transform: translateY(-2px); box-shadow: 0 30px 70px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,130,255,0.16); }
    `}</style>
  )
}

// ─── CSS — tema escuro premium ──────────────────────────────────
const pageDark = { minHeight:'100vh', background:'#0B1026', color:'#F5F4FF', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', paddingBottom:96 }
const shell = { maxWidth:560, margin:'0 auto', padding:'0 18px' }
const center = { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', color:'#8A8AA3', fontSize:14, fontFamily:'Inter,sans-serif', background:'#0B1026' }

const headerDark = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', background:'rgba(11,16,38,0.9)', backdropFilter:'blur(10px)', position:'sticky', top:0, zIndex:10, borderBottom:'1px solid rgba(154,180,255,0.1)' }

const helloRow = { display:'flex', alignItems:'center', justifyContent:'space-between', gap:14 }
const helloSmall = { fontSize:13, color:'#9AB4FF', fontWeight:700 }
const helloBig = { fontSize:21, fontWeight:800, color:'#F5F4FF', letterSpacing:'-0.03em', marginTop:3, lineHeight:1.25 }

const statusStrip = { display:'flex', gap:8, marginTop:18, flexWrap:'wrap' }

const card = { background:'linear-gradient(180deg,#141B3A 0%, #111732 100%)', border:'1px solid rgba(154,180,255,0.12)', borderRadius:22, padding:18, boxShadow:'0 20px 50px rgba(0,0,0,0.35)' }
const cardBtn = { display:'block', width:'100%', background:'linear-gradient(180deg,#141B3A 0%, #111732 100%)', border:'1px solid rgba(154,180,255,0.12)', borderRadius:22, boxShadow:'0 20px 50px rgba(0,0,0,0.35)', cursor:'pointer', fontFamily:'inherit', transition:'transform .15s ease, box-shadow .15s ease', color:'#F5F4FF' }
const cardTitle = { fontSize:15, fontWeight:800, color:'#F5F4FF', letterSpacing:'-0.01em' }

const roadmapCardBtn = { display:'block', width:'100%', cursor:'pointer', fontFamily:'inherit', background:'none', border:'none', padding:0 }
const roadmapCard = { display:'flex', flexDirection:'column', justifyContent:'center', padding:22, borderRadius:24, background:'linear-gradient(150deg,rgba(99,130,255,0.18),rgba(11,16,38,0.4) 60%),linear-gradient(180deg,#18204A 0%,#121840 100%)', border:'1px solid rgba(154,180,255,0.22)', boxShadow:'0 26px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,130,255,0.08)', transition:'transform .18s ease, box-shadow .18s ease' }

const heroCard = { position:'relative', overflow:'hidden', padding:'26px 24px', borderRadius:26, background:'linear-gradient(160deg,#18204A 0%,#10163A 55%,#0D1330 100%)', border:'1px solid rgba(154,180,255,0.2)', boxShadow:'0 30px 70px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,130,255,0.08)' }
const heroGlow = { position:'absolute', width:420, height:420, borderRadius:'50%', top:-190, right:-90, background:'radial-gradient(circle,rgba(99,130,255,0.32),rgba(99,130,255,0.06) 55%,transparent 70%)', pointerEvents:'none', animation:'heroPulse 5s ease-in-out infinite' }
const heroBtn = { display:'flex', alignItems:'center', gap:7, flexShrink:0, padding:'13px 18px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#3ECF8E,#2BB97C)', color:'#04241A', fontSize:13.5, fontWeight:800, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 10px 26px rgba(62,207,142,0.35)' }

const taDark = { width:'100%', background:'#0D1330', border:'1.5px solid rgba(154,180,255,0.16)', borderRadius:14, color:'#F5F4FF', fontFamily:'inherit', fontSize:14, padding:'12px 14px', outline:'none', resize:'vertical', lineHeight:1.6, boxSizing:'border-box' }
const btnDark = { width:'100%', padding:'14px', border:'none', borderRadius:14, background:'linear-gradient(135deg,#6382FF,#7B9BFF)', color:'#fff', fontSize:14.5, fontWeight:800, cursor:'pointer', fontFamily:'inherit', marginTop:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 10px 26px rgba(99,130,255,0.35)' }
const btnGhostDark = { flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'14px', border:'1.5px solid rgba(154,180,255,0.2)', borderRadius:14, background:'transparent', color:'#9AB4FF', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }

const iconNavBtn = { width:36, height:36, borderRadius:10, border:'none', background:'rgba(255,255,255,0.08)', color:'#f5f4ff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }

const squareIconBtn = { width:40, padding:'8px 0', borderRadius:12, border:'1px solid rgba(154,180,255,0.16)', background:'#141B3A', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, fontSize:14 }
const goalBtn = { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 14px', borderRadius:14, border:'1px solid rgba(154,180,255,0.12)', background:'#141B3A', color:'#F5F4FF', fontSize:13.5, fontWeight:700, textAlign:'left', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 12px rgba(0,0,0,0.2)' }
const goalIconWrap = { width:26, height:26, borderRadius:8, background:'rgba(99,130,255,0.14)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }

const errStyle = { display:'flex', alignItems:'center', background:'rgba(240,106,106,0.12)', border:'1px solid rgba(240,106,106,0.3)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#FFB4B4', fontWeight:600, marginBottom:12, marginTop:10 }
const errDark = { display:'flex', alignItems:'center', background:'rgba(240,106,106,0.14)', border:'1px solid rgba(240,106,106,0.35)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#FFB4B4', fontWeight:600, marginBottom:12, marginTop:10 }

const overlay = { position:'fixed', inset:0, background:'rgba(4,7,20,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }
const modalDark = { width:'100%', maxWidth:440, background:'#121840', border:'1px solid rgba(154,180,255,0.16)', borderRadius:22, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,0.45)' }
const modalTitleDark = { color:'#F5F4FF', fontSize:17, fontWeight:800, marginBottom:14 }

const pulseDot = { width:6, height:6, borderRadius:'50%', background:'#6382FF', animation:'metaPulse 1s ease-in-out infinite' }

const trailBarTrack = { position:'relative', height:8, background:'rgba(154,180,255,0.14)', borderRadius:99, overflow:'hidden' }
const trailBarFill = { height:'100%', background:'linear-gradient(90deg,#3ECF8E,#6382FF)', borderRadius:99, transition:'width .6s ease' }
const xpMarker = { position:'absolute', top:-3, width:16, height:16, borderRadius:'50%', background:'#6382FF', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(99,130,255,0.5)' }

const taskProgressTrack = { height:8, background:'rgba(154,180,255,0.14)', borderRadius:99, overflow:'hidden', marginTop:4 }
const taskProgressFill = { height:'100%', width:'55%', background:'linear-gradient(90deg,#6382FF,#9AB4FF)', borderRadius:99 }

const questionCardDark = { background:'#141B3A', border:'1px solid rgba(154,180,255,0.12)', borderRadius:18, padding:18, marginBottom:14, boxShadow:'0 6px 18px rgba(0,0,0,0.3)' }
const materialTagDark = { fontSize:11, color:'#9AB4FF', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8, background:'rgba(99,130,255,0.12)', display:'inline-block', padding:'3px 10px', borderRadius:99 }

const optionBtnDark = { display:'flex', alignItems:'center', gap:12, width:'100%', padding:'13px 14px', borderRadius:14, border:'2px solid rgba(154,180,255,0.14)', background:'#0D1330', color:'#F5F4FF', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, textAlign:'left', marginBottom:8, transition:'all .15s' }
const optionBtnSelDark = { border:'2px solid #6382FF', background:'rgba(99,130,255,0.14)' }
const optionKeyDark = { width:26, height:26, borderRadius:8, background:'rgba(99,130,255,0.16)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11.5, fontWeight:800, color:'#9AB4FF', flexShrink:0 }
const optionKeySelDark = { background:'#6382FF', color:'#fff' }

const resultCardDark = { position:'relative', textAlign:'center', padding:'30px 20px', background:'#141B3A', border:'1px solid rgba(154,180,255,0.12)', borderRadius:22, marginBottom:20, boxShadow:'0 10px 30px rgba(0,0,0,0.3)', overflow:'hidden' }
const correctionCardDark = { background:'#141B3A', border:'1px solid rgba(154,180,255,0.14)', borderRadius:18, padding:18, marginBottom:18, boxShadow:'0 6px 18px rgba(0,0,0,0.3)' }
const correctionEyebrowDark = { display:'flex', alignItems:'center', gap:6, fontSize:11.5, fontWeight:800, letterSpacing:'0.6px', textTransform:'uppercase', color:'#9AB4FF', marginBottom:12 }
const feedbackItemDark = { padding:'10px 12px', borderRadius:10, background:'#0D1330', marginBottom:8 }
const reviewRowDark = { padding:'12px 14px', borderRadius:12, marginBottom:8, background:'#141B3A' }
const reviewRowOkDark = { border:'1px solid rgba(62,207,142,0.3)', background:'rgba(62,207,142,0.07)' }
const reviewRowBadDark = { border:'1px solid rgba(240,106,106,0.3)', background:'rgba(240,106,106,0.07)' }

const avatarImg = { width:64, height:64, borderRadius:'50%', objectFit:'cover', display:'block', border:'3px solid #1E2747', boxShadow:'0 4px 14px rgba(0,0,0,0.4)' }
const avatarFallback = { width:64, height:64, borderRadius:'50%', background:'linear-gradient(160deg,#6382FF,#9AB4FF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:800, color:'#fff' }
const levelBadge = { position:'absolute', bottom:-2, left:-6, width:24, height:24, borderRadius:8, background:'#F5C542', color:'#3A2E00', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(0,0,0,0.3)' }
const avatarEditBtn = { position:'absolute', bottom:-2, right:-6, width:22, height:22, borderRadius:'50%', background:'#0D1330', border:'1px solid rgba(154,180,255,0.2)', color:'#9AB4FF', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(0,0,0,0.3)' }

const statCardDark = { background:'#141B3A', border:'1px solid rgba(154,180,255,0.1)', borderRadius:16, padding:'14px 6px', textAlign:'center', boxShadow:'0 6px 16px rgba(0,0,0,0.25)' }
const statIconWrap = { width:28, height:28, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' }

const achCard = (unlocked, bg) => ({
  background: unlocked ? `radial-gradient(120% 90% at 50% 0%, ${bg}, #141B3A 62%)` : '#0E1330',
  border:'1px solid rgba(154,180,255,0.12)', borderRadius:18, padding:'16px 12px', textAlign:'center',
  boxShadow:'0 8px 20px rgba(0,0,0,0.2)', opacity: unlocked?1:0.9,
})

const configRow = { display:'flex', alignItems:'center', gap:12, width:'100%', padding:'13px 14px', borderRadius:16, border:'1px solid rgba(154,180,255,0.1)', background:'#141B3A', color:'#F5F4FF', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 12px rgba(0,0,0,0.15)', transition:'transform .12s ease' }

// ── estilos do roadmap-montanha (dark, imersivo) ──
const mountainPage = { minHeight:'100vh', background:'#0B1026', color:'#F5F4FF', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', position:'relative', overflow:'hidden' }
const mountainHeader = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', background:'rgba(11,16,38,0.85)', backdropFilter:'blur(10px)', position:'sticky', top:0, zIndex:10, borderBottom:'1px solid rgba(154,180,255,0.12)' }
const hudLabel = { display:'flex', justifyContent:'space-between', fontSize:11, color:'#9AB4FF', fontWeight:800, letterSpacing:'0.5px', marginBottom:8 }
const hudBarTrack = { position:'relative', height:8, background:'rgba(154,180,255,0.14)', borderRadius:99, overflow:'hidden' }
const hudBarFill = { height:'100%', background:'linear-gradient(90deg,#3ECF8E,#6382FF,#9AB4FF)', borderRadius:99, transition:'width .6s ease' }
const hudMarker = { position:'absolute', top:-3, width:16, height:16, borderRadius:'50%', background:'#6382FF', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(99,130,255,0.7)' }
const mountainScroll = { height:'calc(100vh - 112px)', overflowY:'auto', overflowX:'hidden', scrollBehavior:'smooth', WebkitOverflowScrolling:'touch', position:'relative' }
const loadingPanelDark = { display:'flex', flexDirection:'column', alignItems:'center', padding:'26px 0', background:'rgba(245,244,255,0.06)', border:'1px solid rgba(245,244,255,0.1)', borderRadius:20 }
const bottomNav = { position:'fixed', left:0, right:0, bottom:0, zIndex:50, background:'rgba(8,11,28,0.92)', backdropFilter:'blur(14px)', borderTop:'1px solid rgba(154,180,255,0.12)', padding:'8px 12px calc(8px + env(safe-area-inset-bottom, 0px))' }
const bottomNavInner = { maxWidth:560, margin:'0 auto', display:'flex', justifyContent:'space-around', alignItems:'center' }
const navItem = { background:'none', border:'none', padding:'6px 2px', cursor:'pointer', fontFamily:'inherit', display:'flex', flexDirection:'column', alignItems:'center', gap:3, minWidth:52, flex:1 }
const navIconWrap = (active) => ({
  width:44, height:30, borderRadius:99, display:'flex', alignItems:'center', justifyContent:'center',
  color: active ? '#fff' : '#5A5F8A',
  background: active ? 'linear-gradient(135deg,#6382FF,#7B9BFF)' : 'transparent',
  boxShadow: active ? '0 6px 18px rgba(99,130,255,0.4)' : 'none',
  transition:'all .2s ease',
})
const navLabel = (active) => ({ fontSize:10, fontWeight: active?'800':'600', color: active ? '#F5F4FF' : '#5A5F8A', transition:'color .2s ease' })

// ── gaveta lateral (desktop) — AppFrame embrulha as views e adiciona a drawer fixa ──
const drawerWidth = 272

function AppFrame({ isDesktop, active, user, onNavigate, onLogout, children }) {
  if (!isDesktop) return <>{children}</>
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0B1026' }}>
      <SideDrawer active={active} user={user} onNavigate={onNavigate} onLogout={onLogout}/>
      <div style={{ flex:1, minWidth:0, marginLeft:drawerWidth }}>
        {children}
      </div>
    </div>
  )
}

function SideDrawer({ active, user, onNavigate, onLogout }) {
  const items = [
    { id:'hub',         label:'Início',        icon: <Home size={19}/> },
    { id:'roadmap',     label:'Roadmap',       icon: <Route size={19}/> },
    { id:'perfil',      label:'Perfil',        icon: <img src={perfilIcon} alt="" style={drawerImgIcon}/> },
    { id:'conquistas',  label:'Conquistas',    icon: <img src={conquistaIcon} alt="" style={drawerImgIcon}/> },
    { id:'config',      label:'Configurações', icon: <img src={configIcon} alt="" style={drawerImgIcon}/> },
  ]
  const name = user?.firstName || user?.username || 'Jornada'
  const sub = user?.username && user?.username !== name ? `@${user.username}` : ''
  return (
    <aside style={{ position:'fixed', left:0, top:0, bottom:0, width:drawerWidth, zIndex:60, background:'#090D22', borderRight:'1px solid rgba(154,180,255,0.14)', display:'flex', flexDirection:'column', padding:'18px 14px', fontFamily:"'Inter',-apple-system,sans-serif" }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 8px 18px' }}>
        <img src={logoImg} alt="" style={{ width:30, height:30, borderRadius:9 }}/>
        <span style={{ fontWeight:800, color:'#F5F4FF', fontSize:15, letterSpacing:'-0.02em' }}>Metapps</span>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:12, padding:12, borderRadius:16, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(154,180,255,0.1)' }}>
        {user?.avatar ? (
          <img src={user.avatar} alt="" style={drawerAvatar}/>
        ) : (
          <div style={{ ...drawerAvatar, background:'linear-gradient(160deg,#6382FF,#9AB4FF)', color:'#fff', fontSize:16, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {(name[0]||'').toUpperCase()}
          </div>
        )}
        <div style={{ minWidth:0 }}>
          <div style={drawerName}>{name}</div>
          <div style={drawerSub}>{sub || 'Sua trilha de aprendizado'}</div>
        </div>
      </div>

      <nav style={{ display:'flex', flexDirection:'column', gap:4, marginTop:18, flex:1, overflowY:'auto', paddingRight:2 }}>
        {items.map(it => {
          const isActive = active === it.id
          return (
            <button key={it.id} onClick={() => onNavigate(it.id)} style={{ ...drawerItem, ...(isActive?drawerItemActive:{}) }}>
              <span style={drawerItemIcon}>{it.icon}</span>
              <span style={{ flex:1, textAlign:'left' }}>{it.label}</span>
              {isActive && <span style={{ width:6, height:6, borderRadius:'50%', background:'#7B9BFF', boxShadow:'0 0 8px rgba(123,155,255,0.8)' }}/>}
            </button>
          )
        })}
        <div style={{ margin:'6px 8px 4px', height:1, background:'rgba(154,180,255,0.1)' }}/>
        <button onClick={onLogout} style={drawerItem}>
          <span style={drawerItemIcon}><LogOut size={18} color="#F08181"/></span>
          <span style={{ flex:1, textAlign:'left', color:'#F08181' }}>Sair</span>
        </button>
      </nav>

      <div style={{ textAlign:'center', fontSize:10.5, fontWeight:700, color:'#5A5F8A', padding:'10px 0 2px', letterSpacing:'0.4px' }}>Metapps · v1.0</div>
    </aside>
  )
}

const drawerAvatar = { width:40, height:40, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'2px solid #1E2747' }
const drawerName = { color:'#F5F4FF', fontWeight:800, fontSize:13.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }
const drawerSub = { color:'#8A8AA3', fontSize:11, fontWeight:600, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }
const drawerImgIcon = { width:19, height:19, objectFit:'cover', borderRadius:5 }
const drawerItem = { display:'flex', alignItems:'center', gap:12, padding:'11px 12px', borderRadius:13, border:'none', background:'transparent', color:'#9AB4FF', fontSize:13.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .15s ease' }
const drawerItemActive = { background:'rgba(99,130,255,0.16)', color:'#F5F4FF', boxShadow:'inset 0 0 0 1px rgba(99,130,255,0.3)' }
const drawerItemIcon = { width:24, height:24, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }
