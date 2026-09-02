import React, { useState, useEffect } from 'react'
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

// nós folha = tópicos cujo id NÃO aparece como parent_topic_id de nenhum
// outro tópico. Cobre tanto subtópicos normais quanto o caso raro de um
// tópico principal sem nenhum subtópico (que aí vira "folha" ele mesmo).
function getLeafTopics(topics) {
  const parentIds = new Set(sa(topics).map(t => t.parent_topic_id).filter(Boolean))
  return sa(topics).filter(t => !parentIds.has(t.id))
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
  const [corrLoading, setCorrLoading] = useState(false)

  // ── inicialização ──
  useEffect(() => {
    async function init() {
      try { await refreshSession() } catch { navigate('/auth/login'); return }
      try {
        const user = await getMe()
        setEmail(user?.email || '')
      } catch { navigate('/auth/login'); return }
      try { setProfile(await getProfile()) } catch(_) {}
      try { setGoals(await listGoals()) } catch(_) {}
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
      } catch(_) {
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
        } catch(_) {}
      }

      if (mastered) {
        const xpGain = Math.round((taskNode?.weight || 1) * 10)
        if (xpGain > 0) {
          try {
            const updatedProfile = await addXP(xpGain)
            if (updatedProfile) setProfile(updatedProfile)
          } catch(_) {}
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

  if (!initDone) return <div style={center}>Carregando…</div>

  // ── VIEWS ─────────────────────────────────────────────────

  // HOME
  if (view === 'home') return (
    <div style={page}>
      <div style={header}>
        <span style={{ fontWeight:800, fontSize:16, color:'#f0f2ff' }}>Metapps</span>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setView('profile')} style={navBtn}>Perfil</button>
          <button onClick={handleLogout} style={navBtn}>Sair</button>
        </div>
      </div>

      <div style={box}>
        <h2 style={h2}>O que você quer aprender?</h2>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()} }}
          placeholder="Ex: Funções do segundo grau, Revolução Francesa..."
          rows={3} style={ta}/>
        {err && <div style={errStyle}>{err}</div>}
        <button onClick={handleSend} disabled={!input.trim()||loading} style={btn}>
          {loading ? 'Gerando…' : 'Gerar roadmap'}
        </button>

        {goals.length > 0 && (
          <div style={{ marginTop:28 }}>
            <div style={label}>Objetivos anteriores</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {goals.slice(0,8).map(g => (
                <div key={g.id} style={{ display:'flex', gap:6 }}>
                  <button onClick={() => handleOpenGoal(g)} style={{ ...goalBtn, flex:1 }}>
                    {g.title}
                  </button>
                  <button onClick={() => { setEditingGoal(g); setEditInput(g.title) }}
                    style={{ ...goalBtn, width:36, padding:'8px 0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                    ✎
                  </button>
                  <button onClick={() => setDeletingGoal(g)}
                    style={{ ...goalBtn, width:36, padding:'8px 0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#f06a6a', flexShrink:0 }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ROADMAP
  if (view === 'roadmap') {
    const available = getAvailable(topics, deps, completed)
    const parents = getParents(topics)
    const childrenOf = (parentId) => available.filter(t => t.parent_topic_id === parentId)
    // tópicos principais sem parent que também são folha (sem subtópicos)
    const orphanLeaves = available.filter(t => !t.parent_topic_id)

    return (
      <div style={page}>
        <div style={header}>
          <button onClick={() => setView('home')} style={navBtn}>← Início</button>
          <span style={{ fontWeight:700, color:'#f0f2ff', fontSize:15 }}>{curGoal?.title}</span>
          <button onClick={handleLogout} style={navBtn}>Sair</button>
        </div>

        <div style={{ ...box, maxWidth:520 }}>
          <p style={{ color:'#7b82a0', fontSize:13, marginBottom:20 }}>
            Clique uma vez para selecionar · clique duas vezes para gerar tarefa
          </p>

          {loading && <div style={center}>Carregando…</div>}
          {err && <div style={errStyle}>{err}</div>}

          {!loading && available.length === 0 && (
            <div style={{ color:'#7b82a0', textAlign:'center', padding:20 }}>
              Nenhum tópico disponível.
            </div>
          )}

          {!loading && parents.map(parent => {
            const children = childrenOf(parent.id)
            if (children.length === 0) return null
            return (
              <div key={parent.id} style={{ marginBottom:32 }}>
                <div style={sectionHeader}>{parent.title}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {children.map((n, i) => (
                    <div key={n.id} style={{ display:'flex', justifyContent: i%2===0 ? 'flex-start' : 'flex-end' }}>
                      <NodeCard n={n} sel={selNode?.id===n.id} done={completed.includes(n.id)} onClick={() => handleNodeClick(n)} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {!loading && orphanLeaves.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {orphanLeaves.map((n, i) => (
                <div key={n.id} style={{ display:'flex', justifyContent: i%2===0 ? 'flex-start' : 'flex-end' }}>
                  <NodeCard n={n} sel={selNode?.id===n.id} done={completed.includes(n.id)} onClick={() => handleNodeClick(n)} />
                </div>
              ))}
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

    return (
      <div style={page}>
        <div style={header}>
          <button onClick={() => setView('roadmap')} style={navBtn}>← Voltar</button>
          <span style={{ fontWeight:700, color:'#f0f2ff' }}>{title}</span>
          <div/>
        </div>

        <div style={box}>
          {desc && <p style={{ color:'#7b82a0', fontSize:14, marginBottom:20, lineHeight:1.6 }}>{desc}</p>}

          {isQuiz && questions.map((q, qi) => (
            <div key={qi} style={{ background:'#181b26', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:18, marginBottom:12 }}>
              {q.material && <div style={{ fontSize:11, color:'#9ab4ff', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{q.material}</div>}
              <p style={{ color:'#f0f2ff', fontSize:15, marginBottom:12, lineHeight:1.6 }}>
                <strong style={{ color:'#6382ff' }}>{qi+1}.</strong> {q.question || q.statement}
              </p>
              {sa(q.options || q.alternatives).map((opt, ai) => {
                const sel = answers[qi] === ai
                return (
                  <button key={ai} onClick={() => setAnswers(p => ({...p,[qi]:ai}))}
                    style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', borderRadius:8, border:`1.5px solid ${sel?'#6382ff':'rgba(255,255,255,0.07)'}`, background:sel?'rgba(99,130,255,0.1)':'transparent', color:sel?'#f0f2ff':'#7b82a0', cursor:'pointer', fontFamily:'inherit', fontSize:14, textAlign:'left', marginBottom:6, transition:'all .15s' }}>
                    <span style={{ width:22, height:22, borderRadius:5, background:sel?'#6382ff':'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:sel?'#fff':'#7b82a0', flexShrink:0 }}>
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
              <p style={{ color:'#f0f2ff', fontSize:15, marginBottom:10, lineHeight:1.6 }}>{content.instructions}</p>
              <p style={{ color:'#7b82a0', fontSize:12, marginBottom:8 }}>{content.min_words}–{content.max_words} palavras</p>
              <textarea value={essay} onChange={e=>{setEssay(e.target.value);setErr('')}}
                placeholder="Escreva sua resposta aqui…" rows={12}
                style={{ ...ta, marginBottom:4 }}/>
              <p style={{ color:'#7b82a0', fontSize:12 }}>{essay.trim()?essay.trim().split(/\s+/).filter(Boolean).length:0} palavras</p>
            </div>
          )}

          {err && <div style={errStyle}>{err}</div>}
          <button onClick={handleSubmit} disabled={loading} style={{ ...btn, opacity:loading?0.6:1 }}>
            {loading ? 'Enviando…' : 'Enviar resposta'}
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
    const mc       = score>=0.7 ? '#3ecf8e' : score>=0.4 ? '#f5c542' : '#f06a6a'
    let ev = null
    try { ev = typeof attempt.task_evaluation==='string' ? JSON.parse(attempt.task_evaluation) : attempt.task_evaluation } catch(_) {}
    const content   = task?.content || {}
    const questions = sa(content.questions)
    const requiredMastery = taskNode?.required_mastery ?? 0.7
    const mastered = score >= requiredMastery

    return (
      <div style={page}>
        <div style={header}>
          <button onClick={() => setView('roadmap')} style={navBtn}>← Roadmap</button>
          <span style={{ fontWeight:700, color:'#f0f2ff' }}>Resultado</span>
          <div/>
        </div>

        <div style={box}>
          <div style={{ textAlign:'center', padding:'28px 20px', background:'#181b26', borderRadius:14, border:`1px solid ${mc}44`, marginBottom:20 }}>
            <div style={{ fontSize:52, fontWeight:900, color:mc }}>{pct}%</div>
            <div style={{ color:'#7b82a0', fontSize:14, marginTop:4 }}>de acertos</div>
            <div style={{ color:'#f0f2ff', fontSize:18, fontWeight:800, marginTop:8 }}>
              {mastered?'Excelente! Tópico concluído.':score>=0.4?'Bom esforço! Tente novamente para concluir.':'Continue tentando!'}
            </div>
          </div>

          {ev?.items && sa(ev.items).map((item, i) => {
            const q    = questions[i] || {}
            const opts = sa(q.options || q.alternatives)
            const ok   = item.correct || item.is_correct || false
            const sub  = item.submitted_answer ?? item.selected_answer ?? item.answer
            const cor  = item.correct_answer   ?? item.expected_answer
            return (
              <div key={i} style={{ padding:'12px 14px', borderRadius:10, border:`1px solid ${ok?'rgba(62,207,142,0.2)':'rgba(240,106,106,0.2)'}`, background:ok?'rgba(62,207,142,0.04)':'rgba(240,106,106,0.04)', marginBottom:8 }}>
                <div style={{ display:'flex', gap:8, marginBottom:4 }}>
                  <span style={{ color:ok?'#3ecf8e':'#f06a6a', fontWeight:700, fontSize:13 }}>{ok?'✓':'✗'} Q{i+1}</span>
                  {opts[sub] && <span style={{ color:'#7b82a0', fontSize:12, marginLeft:'auto' }}>Sua: {opts[sub]}</span>}
                </div>
                {!ok && opts[cor] && <p style={{ color:'#7b82a0', fontSize:12, margin:'4px 0 0', lineHeight:1.5 }}>Correta: {opts[cor]}</p>}
                {item.explanation && <p style={{ color:'#7b82a0', fontSize:12, margin:'4px 0 0', lineHeight:1.5, fontStyle:'italic' }}>{item.explanation}</p>}
              </div>
            )
          })}

          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <button onClick={() => { setView('task'); setAnswers({}); setEssay(''); setResult(null) }} style={{ ...btn, flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }}>
              Tentar novamente
            </button>
            <button onClick={() => setView('roadmap')} style={{ ...btn, flex:1 }}>
              Próxima lição
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
    const xpNext   = level * 100
    const pct      = Math.min(100, Math.round((xp % xpNext) / xpNext * 100))
    const username = profile?.username || email?.split('@')[0] || 'Usuário'
    return (
      <div style={page}>
        <div style={header}>
          <button onClick={() => setView('home')} style={navBtn}>← Início</button>
          <span style={{ fontWeight:700, color:'#f0f2ff' }}>Perfil</span>
          <button onClick={handleLogout} style={navBtn}>Sair</button>
        </div>
        <div style={box}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:'#6382ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800, color:'#fff' }}>
              {username[0]?.toUpperCase()||'?'}
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:'#f0f2ff' }}>{username}</div>
              <div style={{ fontSize:13, color:'#7b82a0' }}>{email}</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
            {[{l:'Nível',v:level,c:'#6382ff'},{l:'XP',v:xp,c:'#f5c542'},{l:'Próximo',v:`${Math.max(0,xpNext-xp)} XP`,c:'#3ecf8e'}].map(({l,v,c}) => (
              <div key={l} style={{ padding:12, borderRadius:10, background:'#181b26', border:'1px solid rgba(255,255,255,0.07)', textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
                <div style={{ fontSize:11, color:'#7b82a0', marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ height:6, background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', background:'#6382ff', borderRadius:99, transition:'width .5s' }}/>
          </div>
          <div style={{ fontSize:12, color:'#7b82a0', marginTop:6, textAlign:'right' }}>{pct}% para o nível {level+1}</div>
        </div>
      </div>
    )
  }

  return <div style={center}>Carregando…</div>
}

// ─── componentes auxiliares ─────────────────────────────────
function NodeCard({ n, sel, done, onClick }) {
  return (
    <button onClick={onClick} disabled={n.blocked}
      style={{ width:220, padding:'14px 16px', borderRadius:12, border:`2px solid ${done?'#3ecf8e':sel?'#6382ff':n.blocked?'rgba(255,255,255,0.06)':'rgba(99,130,255,0.2)'}`, background:done?'rgba(62,207,142,0.08)':sel?'rgba(99,130,255,0.12)':n.blocked?'rgba(255,255,255,0.02)':'rgba(99,130,255,0.05)', color:n.blocked?'#7b82a0':'#f0f2ff', cursor:n.blocked?'not-allowed':'pointer', fontFamily:'inherit', textAlign:'left', opacity:n.blocked?0.5:1, transition:'all .2s' }}>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>{n.title}</div>
      {n.description && <div style={{ fontSize:11, color:'#7b82a0', lineHeight:1.4 }}>{n.description.slice(0,80)}{n.description.length>80?'…':''}</div>}
      {n.blocked && <div style={{ fontSize:11, color:'#f06a6a', marginTop:6 }}>🔒 Bloqueado</div>}
      {sel && <div style={{ fontSize:11, color:'#6382ff', marginTop:6, fontWeight:700 }}>Clique novamente para gerar tarefa</div>}
      {done && <div style={{ fontSize:11, color:'#3ecf8e', marginTop:6 }}>✓ Concluído</div>}
    </button>
  )
}

// ─── CSS ──────────────────────────────────────────────────────
const page    = { minHeight:'100vh', background:'#0f1117', color:'#f0f2ff', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased' }
const header  = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'#0f1117', position:'sticky', top:0, zIndex:10 }
const box     = { maxWidth:600, margin:'0 auto', padding:'32px 20px' }
const center  = { display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#7b82a0', fontSize:14, fontFamily:'Inter,sans-serif' }
const h2      = { fontSize:24, fontWeight:900, color:'#f0f2ff', letterSpacing:'-0.04em', marginBottom:16 }
const ta      = { width:'100%', background:'rgba(255,255,255,0.04)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:10, color:'#f0f2ff', fontFamily:'inherit', fontSize:14, padding:'12px 14px', outline:'none', resize:'vertical', lineHeight:1.6, boxSizing:'border-box' }
const btn     = { width:'100%', padding:'13px', border:'none', borderRadius:10, background:'#6382ff', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginTop:12 }
const navBtn  = { padding:'7px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#7b82a0', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }
const goalBtn = { width:'100%', padding:'12px 16px', borderRadius:10, border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.03)', color:'#7b82a0', fontSize:14, fontWeight:500, textAlign:'left', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }
const label   = { fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'rgba(255,255,255,0.2)', marginBottom:10 }
const sectionHeader = { fontSize:13, fontWeight:800, letterSpacing:'0.5px', textTransform:'uppercase', color:'#9ab4ff', marginBottom:14, paddingBottom:8, borderBottom:'1px solid rgba(255,255,255,0.07)' }
const errStyle = { background:'rgba(240,106,106,0.08)', border:'1px solid rgba(240,106,106,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#f06a6a', marginBottom:12, marginTop:8 }