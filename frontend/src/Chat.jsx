import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { submitAttempt } from './api'

const Spin = () => <svg style={{ animation:'spin .7s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10" strokeOpacity=".22"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>

export default function Chat() {
  const { state } = useLocation()
  const navigate  = useNavigate()
  const task      = state?.task

  const [answers, setAnswers]   = useState({})   // quiz: { 0: 2, 1: 0 }
  const [essay,   setEssay]     = useState('')    // essay: string
  const [result,  setResult]    = useState(null)
  const [err,     setErr]       = useState('')
  const [load,    setLoad]      = useState(false)

  if (!task) return (
    <div style={{ ...page, alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <p style={{ color:'rgba(226,232,240,0.4)', marginBottom:16 }}>Nenhuma tarefa encontrada.</p>
        <button onClick={() => navigate('/criar')} style={btnMain}>Criar tarefa</button>
      </div>
    </div>
  )

  const isQuiz  = task.type === 'quiz'
  const content = task.content
  const meta    = task.meta

  async function handleSubmit() {
    setErr(''); setLoad(true)
    try {
      let response
      if (isQuiz) {
        response = Object.entries(answers).map(([qi, ans]) => ({
          question_index: parseInt(qi),
          answer: ans,
        }))
        if (response.length < content.questions.length) {
          setErr('Responda todas as perguntas antes de enviar.'); setLoad(false); return
        }
      } else {
        if (!essay.trim() || essay.trim().split(/\s+/).length < (content.min_words || 0)) {
          setErr(`Mínimo de ${content.min_words} palavras.`); setLoad(false); return
        }
        response = essay.trim()
      }

      const data = await submitAttempt(task.id, task.type, response)
      setResult(data)
    } catch(er) { setErr(er.message) }
    finally { setLoad(false) }
  }

  // Tela de resultado
  if (result) {
    const attempt  = result.task_attempt
    const score    = attempt.score
    const evalData = attempt.task_evaluation
    let evaluation = null
    try { evaluation = typeof evalData === 'string' ? JSON.parse(evalData) : evalData } catch(_) {}

    return (
      <div style={page}>
        <div style={container}>
          <div style={resultHeader}>
            <div style={{ fontSize:48, marginBottom:8 }}>{score >= 0.7 ? '🎉' : score >= 0.4 ? '💪' : '📚'}</div>
            <h2 style={htitle}>
              {score >= 0.7 ? 'Muito bem!' : score >= 0.4 ? 'Bom esforço!' : 'Continue praticando!'}
            </h2>
            <div style={scoreBadge}>
              <span style={{ fontSize:32, fontWeight:800, color: score >= 0.7 ? '#6aaf6a' : score >= 0.4 ? '#c4a44a' : '#e08080' }}>
                {Math.round((score||0)*100)}%
              </span>
              <span style={{ fontSize:13, color:'rgba(226,232,240,0.4)' }}>de acertos</span>
            </div>
          </div>

          {/* Feedback quiz */}
          {isQuiz && evaluation?.items && (
            <div style={feedbackList}>
              {evaluation.items.map((item, i) => (
                <div key={i} style={{ ...feedbackCard, borderColor: item.correct ? 'rgba(106,175,106,0.2)' : 'rgba(220,80,80,0.2)', background: item.correct ? 'rgba(106,175,106,0.04)' : 'rgba(220,80,80,0.04)' }}>
                  <div style={feedbackTop}>
                    <span style={{ fontSize:13, color: item.correct ? '#6aaf6a' : '#e08080', fontWeight:700 }}>
                      {item.correct ? '✓' : '✗'} Questão {i+1}
                    </span>
                    <span style={{ fontSize:12, color:'rgba(226,232,240,0.3)' }}>
                      Sua resposta: {content.questions[i]?.alternatives?.[item.submitted_answer] || item.submitted_answer}
                    </span>
                  </div>
                  {!item.correct && (
                    <p style={{ fontSize:12, color:'rgba(226,232,240,0.5)', marginTop:6, lineHeight:1.5 }}>
                      Correta: {content.questions[i]?.alternatives?.[item.correct_answer]}
                    </p>
                  )}
                  {item.explanation && (
                    <p style={{ fontSize:12, color:'rgba(226,232,240,0.4)', marginTop:4, lineHeight:1.5, fontStyle:'italic' }}>
                      {item.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display:'flex', gap:10, marginTop:24 }}>
            <button onClick={() => navigate('/criar')} style={{ ...btnMain, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)' }}>
              Nova tarefa
            </button>
            <button onClick={() => { setResult(null); setAnswers({}); setEssay('') }} style={btnMain}>
              Tentar novamente
            </button>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // Tela da tarefa
  return (
    <div style={page}>
      <div style={container}>
        {/* Header da task */}
        <div style={taskHeader}>
          <span style={typeBadge}>{isQuiz ? '📝 Quiz' : '✍️ Dissertação'}</span>
          <h1 style={htitle}>{meta.title}</h1>
          <p style={hsub}>{meta.description}</p>
          {meta.expectations && (
            <p style={expectations}>🎯 {meta.expectations}</p>
          )}
        </div>

        {/* Quiz */}
        {isQuiz && content.questions?.map((q, qi) => (
          <div key={qi} style={questionCard}>
            <p style={questionText}><span style={qNum}>{qi+1}.</span> {q.statement}</p>
            {q.material?.filter(m=>m.type==='text').map((m,mi) => (
              <p key={mi} style={materialText}>{m.data}</p>
            ))}
            <div style={altList}>
              {q.alternatives.map((alt, ai) => (
                <button key={ai} onClick={() => setAnswers(prev => ({...prev, [qi]: ai}))}
                  style={{ ...altBtn,
                    borderColor: answers[qi]===ai ? '#4f7edd' : 'rgba(255,255,255,0.07)',
                    background:  answers[qi]===ai ? 'rgba(79,126,221,0.1)' : 'rgba(255,255,255,0.02)',
                    color:       answers[qi]===ai ? '#c8d8f8' : 'rgba(226,232,240,0.6)',
                  }}>
                  <span style={altLetter}>{String.fromCharCode(65+ai)}</span>
                  {alt}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Essay */}
        {!isQuiz && (
          <div style={questionCard}>
            {content.material?.filter(m=>m.type==='text').map((m,mi) => (
              <p key={mi} style={materialText}>{m.data}</p>
            ))}
            <p style={questionText}>{content.instructions}</p>
            <p style={{ fontSize:12, color:'rgba(226,232,240,0.3)', marginBottom:10 }}>
              {content.min_words}–{content.max_words} palavras
            </p>
            <textarea
              value={essay} onChange={e=>{setEssay(e.target.value);setErr('')}}
              placeholder="Escreva sua resposta aqui…"
              rows={10}
              style={{ ...inp, resize:'vertical', lineHeight:1.6 }}
            />
            <p style={{ fontSize:12, color:'rgba(226,232,240,0.3)', marginTop:6 }}>
              {essay.trim() ? essay.trim().split(/\s+/).length : 0} palavras
            </p>
          </div>
        )}

        {err && <div style={errBox}>{err}</div>}

        <button onClick={handleSubmit} disabled={load} style={{ ...btnMain, opacity:load?.6:1, fontSize:15, padding:'14px 0', background:'linear-gradient(135deg,#4f7edd,#7b5ef8)' }}>
          {load ? <><Spin /> Enviando…</> : 'Enviar resposta'}
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const page        = { minHeight:'100vh', background:'linear-gradient(158deg,#080c14 0%,#0c1220 55%,#080c14 100%)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'48px 20px', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased' }
const container   = { width:'100%', maxWidth:680 }
const taskHeader  = { marginBottom:32, paddingBottom:24, borderBottom:'1px solid rgba(255,255,255,0.06)' }
const typeBadge   = { fontSize:12, fontWeight:600, color:'#4f7edd', background:'rgba(79,126,221,0.1)', border:'1px solid rgba(79,126,221,0.2)', borderRadius:20, padding:'3px 10px', display:'inline-block', marginBottom:12 }
const htitle      = { fontSize:24, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.4px', marginBottom:8 }
const hsub        = { fontSize:14, color:'rgba(226,232,240,0.5)', lineHeight:1.65, marginBottom:8 }
const expectations = { fontSize:13, color:'rgba(226,232,240,0.4)', lineHeight:1.6, padding:'10px 14px', background:'rgba(255,255,255,0.02)', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)', marginTop:8 }
const questionCard = { background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'20px', marginBottom:14 }
const questionText = { fontSize:15, color:'#e2e8f0', lineHeight:1.65, marginBottom:14 }
const qNum        = { fontWeight:700, color:'#4f7edd', marginRight:6 }
const materialText = { fontSize:13, color:'rgba(226,232,240,0.5)', lineHeight:1.65, marginBottom:12, fontStyle:'italic', padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:6 }
const altList     = { display:'flex', flexDirection:'column', gap:8 }
const altBtn      = { textAlign:'left', padding:'11px 14px', borderRadius:8, border:'1.5px solid', cursor:'pointer', fontSize:14, fontWeight:500, display:'flex', alignItems:'center', gap:10, transition:'all .15s', fontFamily:"'Inter',-apple-system,sans-serif" }
const altLetter   = { width:22, height:22, borderRadius:4, background:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0, color:'rgba(226,232,240,0.5)' }
const inp         = { width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, color:'#e2e8f0', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, padding:'11px 13px', outline:'none', boxSizing:'border-box' }
const errBox      = { background:'rgba(220,60,60,0.08)', border:'1px solid rgba(220,60,60,0.15)', borderRadius:6, padding:'9px 13px', fontSize:13, fontWeight:500, color:'#e08080', lineHeight:1.45, marginBottom:13 }
const btnMain     = { width:'100%', padding:13, border:'none', borderRadius:8, fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#4f7edd', color:'#fff', transition:'all .2s', marginTop:8 }
const resultHeader = { textAlign:'center', marginBottom:28, padding:'28px 20px', background:'rgba(255,255,255,0.02)', borderRadius:14, border:'1px solid rgba(255,255,255,0.06)' }
const scoreBadge  = { display:'flex', flexDirection:'column', alignItems:'center', gap:2, marginTop:8 }
const feedbackList = { display:'flex', flexDirection:'column', gap:10 }
const feedbackCard = { borderRadius:10, border:'1px solid', padding:'14px 16px' }
const feedbackTop  = { display:'flex', justifyContent:'space-between', alignItems:'center' }