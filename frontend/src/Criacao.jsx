import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listGoals, createGoal, generateTask } from './api'

const MATERIAS = [
  'Matemática', 'Português', 'História', 'Geografia',
  'Ciências', 'Física', 'Química', 'Biologia', 'Inglês', 'Filosofia'
]
const NIVEIS = ['facil', 'medio', 'dificil']
const NIVEL_LABEL = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' }
const NIVEL_COLOR = { facil: '#6aaf6a', medio: '#c4a44a', dificil: '#e08080' }

const Spin = () => <svg style={{ animation:'spin .7s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10" strokeOpacity=".22"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>

export default function Criacao() {
  const navigate = useNavigate()
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
    listGoals()
      .then(g => { setGoals(g || []); if (!g?.length) setShowNew(true) })
      .catch(() => setShowNew(true))
      .finally(() => setLoadGoals(false))
  }, [])

  function toggleMateria(m) {
    setDiffs(prev => {
      if (prev[m]) { const n = {...prev}; delete n[m]; return n }
      return { ...prev, [m]: 'medio' }
    })
  }

  function setNivel(m, n) {
    setDiffs(prev => ({ ...prev, [m]: n }))
  }

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
    } catch(er) { setErr(er.message) }
    finally { setLoadCreate(false) }
  }

  async function handleGenerate() {
    if (!selectedGoal) return
    setErr(''); setLoadGen(true)
    try {
      const task = await generateTask(selectedGoal.id)
      navigate('/chat', { state: { task } })
    } catch(er) { setErr(er.message) }
    finally { setLoadGen(false) }
  }

  return (
    <div style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={htitle}>Nova Tarefa</h1>
          <p style={hsub}>Escolha um objetivo ou crie um novo para gerar sua tarefa com IA.</p>
        </div>

        {/* Goals existentes */}
        {!loadGoals && goals.length > 0 && (
          <div style={section}>
            <div style={sectionHead}>
              <span style={sectionLabel}>Seus objetivos</span>
              <button onClick={() => { setShowNew(v=>!v); setErr('') }} style={btnOutline}>
                {showNew ? 'Cancelar' : '+ Novo objetivo'}
              </button>
            </div>
            <div style={goalGrid}>
              {goals.map(g => (
                <button key={g.id} onClick={() => { setSelected(g); setShowNew(false); setErr('') }}
                  style={{ ...goalCard, borderColor: selectedGoal?.id === g.id ? '#4f7edd' : 'rgba(255,255,255,0.07)', background: selectedGoal?.id === g.id ? 'rgba(79,126,221,0.08)' : 'rgba(255,255,255,0.02)' }}>
                  <span style={goalTitle}>{g.title}</span>
                  <div style={goalDiffs}>
                    {Object.entries(g.difficulties||{}).map(([m, n]) => (
                      <span key={m} style={{ ...diffBadge, color: NIVEL_COLOR[n]||'#aaa', borderColor: NIVEL_COLOR[n]||'#aaa' }}>
                        {m} · {NIVEL_LABEL[n]||n}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {loadGoals && <div style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', padding:40 }}>Carregando objetivos…</div>}

        {/* Formulário novo goal */}
        {showNew && (
          <form onSubmit={handleCreate} style={newGoalForm}>
            <div style={sectionLabel}>Novo objetivo</div>
            <input
              type="text" placeholder="Ex: Passar no ENEM" value={title}
              onChange={e=>{setTitle(e.target.value);setErr('')}}
              style={inp} />
            <div style={sectionLabel2}>Matérias e dificuldades</div>
            <div style={materiaGrid}>
              {MATERIAS.map(m => {
                const sel = diffs[m]
                return (
                  <div key={m} style={{ ...materiaCard, borderColor: sel ? '#4f7edd' : 'rgba(255,255,255,0.07)', background: sel ? 'rgba(79,126,221,0.06)' : 'rgba(255,255,255,0.02)' }}>
                    <div style={materiaTop} onClick={() => toggleMateria(m)}>
                      <span style={{ fontSize:13, color: sel ? '#c8d8f8' : 'rgba(226,232,240,0.5)', fontWeight:500 }}>{m}</span>
                      <div style={{ ...checkbox, borderColor: sel ? '#4f7edd' : 'rgba(255,255,255,0.15)', background: sel ? '#4f7edd' : 'transparent' }}>
                        {sel && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                      </div>
                    </div>
                    {sel && (
                      <div style={nivelRow}>
                        {NIVEIS.map(n => (
                          <button key={n} type="button" onClick={() => setNivel(m, n)}
                            style={{ ...nivelBtn, background: sel===n ? NIVEL_COLOR[n]+'22' : 'transparent', color: sel===n ? NIVEL_COLOR[n] : 'rgba(255,255,255,0.3)', borderColor: sel===n ? NIVEL_COLOR[n] : 'rgba(255,255,255,0.08)' }}>
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
            <button type="submit" disabled={loadCreate} style={{ ...btnMain, opacity:loadCreate?.6:1 }}>
              {loadCreate ? <><Spin /> Criando…</> : 'Criar objetivo'}
            </button>
          </form>
        )}

        {/* Botão gerar */}
        {selectedGoal && !showNew && (
          <div style={{ marginTop:28 }}>
            {err && <div style={{ ...errBox, marginBottom:14 }}>{err}</div>}
            <div style={selectedInfo}>
              <span style={{ fontSize:13, color:'rgba(226,232,240,0.5)' }}>Objetivo selecionado:</span>
              <span style={{ fontSize:14, fontWeight:600, color:'#c8d8f8' }}>{selectedGoal.title}</span>
            </div>
            <button onClick={handleGenerate} disabled={loadGen} style={{ ...btnMain, background: loadGen ? 'rgba(79,126,221,0.5)' : 'linear-gradient(135deg,#4f7edd,#7b5ef8)', fontSize:15, padding:'14px 0' }}>
              {loadGen ? <><Spin /> A IA está gerando sua tarefa…</> : '✦ Gerar tarefa com IA'}
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const page      = { minHeight:'100vh', background:'linear-gradient(158deg,#080c14 0%,#0c1220 55%,#080c14 100%)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'48px 20px', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased' }
const container = { width:'100%', maxWidth:660 }
const header    = { marginBottom:32 }
const htitle    = { fontSize:26, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.5px', marginBottom:6 }
const hsub      = { fontSize:14, color:'rgba(226,232,240,0.4)', lineHeight:1.6 }
const section   = { marginBottom:28 }
const sectionHead = { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }
const sectionLabel  = { fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'rgba(226,232,240,0.3)' }
const sectionLabel2 = { fontSize:11, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'rgba(226,232,240,0.3)', margin:'16px 0 10px' }
const goalGrid  = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }
const goalCard  = { textAlign:'left', padding:'14px 16px', borderRadius:10, border:'1.5px solid', cursor:'pointer', transition:'all .15s', display:'flex', flexDirection:'column', gap:8, background:'none' }
const goalTitle = { fontSize:14, fontWeight:600, color:'#e2e8f0' }
const goalDiffs = { display:'flex', flexWrap:'wrap', gap:5 }
const diffBadge = { fontSize:11, fontWeight:500, padding:'2px 8px', borderRadius:20, border:'1px solid', background:'transparent' }
const newGoalForm = { background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:'22px 20px', display:'flex', flexDirection:'column', gap:0 }
const materiaGrid = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, margin:'4px 0 16px' }
const materiaCard = { borderRadius:8, border:'1.5px solid', padding:'10px 12px', cursor:'pointer', transition:'all .15s' }
const materiaTop  = { display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }
const checkbox    = { width:16, height:16, borderRadius:4, border:'1.5px solid', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }
const nivelRow    = { display:'flex', gap:5, marginTop:8 }
const nivelBtn    = { flex:1, fontSize:11, fontWeight:600, padding:'4px 0', borderRadius:5, border:'1px solid', cursor:'pointer', transition:'all .15s', fontFamily:"'Inter',-apple-system,sans-serif" }
const selectedInfo = { display:'flex', flexDirection:'column', gap:3, marginBottom:14, padding:'12px 16px', background:'rgba(79,126,221,0.06)', borderRadius:8, border:'1px solid rgba(79,126,221,0.15)' }
const inp       = { width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, color:'#e2e8f0', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, padding:'11px 13px', outline:'none', marginBottom:4, boxSizing:'border-box' }
const errBox    = { background:'rgba(220,60,60,0.08)', border:'1px solid rgba(220,60,60,0.15)', borderRadius:6, padding:'9px 13px', fontSize:13, fontWeight:500, color:'#e08080', lineHeight:1.45, marginBottom:13 }
const btnMain   = { width:'100%', padding:13, border:'none', borderRadius:8, fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#4f7edd', color:'#fff', transition:'all .2s', marginTop:4 }
const btnOutline = { padding:'6px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(226,232,240,0.5)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',-apple-system,sans-serif" }