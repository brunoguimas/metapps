import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/* ─── Mascot SVG ─────────────────────────────────────────────────────────── */
function Mascot({ animate, size = 120 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ animation: animate ? 'mascotBob 2.8s ease-in-out infinite' : 'none', display: 'block' }}>
      {/* Body */}
      <ellipse cx="60" cy="75" rx="30" ry="24" fill="#4f7edd"/>
      {/* Head */}
      <circle cx="60" cy="46" r="26" fill="#4f7edd"/>
      {/* Eyes */}
      <ellipse cx="51" cy="43" rx="5" ry="6" fill="#fff"/>
      <ellipse cx="69" cy="43" rx="5" ry="6" fill="#fff"/>
      <circle cx="52" cy="44" r="3" fill="#1a1a2e"/>
      <circle cx="70" cy="44" r="3" fill="#1a1a2e"/>
      <circle cx="53.2" cy="42.8" r="1.2" fill="#fff"/>
      <circle cx="71.2" cy="42.8" r="1.2" fill="#fff"/>
      {/* Mouth — smile */}
      <path d="M52 52 Q60 58 68 52" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
      {/* Ears */}
      <ellipse cx="36" cy="42" rx="5" ry="7" fill="#3a6ccc"/>
      <ellipse cx="84" cy="42" rx="5" ry="7" fill="#3a6ccc"/>
      {/* Amber detail — scarf/collar */}
      <rect x="42" y="68" width="36" height="9" rx="4.5" fill="#d4924a"/>
      {/* Arms */}
      <ellipse cx="32" cy="76" rx="7" ry="5" fill="#4f7edd" transform="rotate(-20 32 76)"/>
      <ellipse cx="88" cy="76" rx="7" ry="5" fill="#4f7edd" transform="rotate(20 88 76)"/>
    </svg>
  )
}

/* ─── Speech bubble ──────────────────────────────────────────────────────── */
function Bubble({ children, visible }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 'calc(100% + 18px)',
      background: '#fff', borderRadius: 18, padding: '20px 24px',
      boxShadow: '0 8px 36px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)',
      minWidth: 280, maxWidth: 360, textAlign: 'center',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(10px)',
      transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.16,1,0.3,1)',
      zIndex: 10,
    }}>
      {children}
      {/* Tail */}
      <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '12px solid #fff', filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.05))' }} />
    </div>
  )
}

/* ─── Data ───────────────────────────────────────────────────────────────── */
const MAIN_SUBJECTS  = ['Matematica','Redacao','Ingles']
const MORE_SUBJECTS  = ['Fisica','Quimica','Historia','Portugues','Biologia','Economia','Filosofia','Programacao']
const TIMES          = [
  { id: '5',  label: '5 min',  desc: 'Sessao relampago' },
  { id: '10', label: '10 min', desc: 'Estudo rapido'    },
  { id: '15', label: '15 min', desc: 'Ritmo equilibrado'},
  { id: '30', label: '30 min', desc: 'Sessao completa'  },
]
const LEVELS         = [
  { id: 'iniciante',     label: 'Iniciante',     desc: 'Estou comecando do zero'   },
  { id: 'basico',        label: 'Basico',         desc: 'Conheco o basico do tema'  },
  { id: 'intermediario', label: 'Intermediario', desc: 'Tenho alguma experiencia'  },
  { id: 'avancado',      label: 'Avancado',      desc: 'Quero desafios complexos'  },
]

/* ─── Step titles ────────────────────────────────────────────────────────── */
const STEP_GREET = [
  'Oi! Vamos estudar hoje?',
  'Otima escolha! Quanto tempo voce tem?',
  'Perfeito! Qual seu nivel?',
]

export default function Criacao() {
  const navigate = useNavigate()

  // Mascot enter animation
  const [mascotIn, setMascotIn] = useState(false)
  const [bubbleIn, setBubbleIn] = useState(false)

  // Flow state
  const [step,     setStep]     = useState(0)     // 0=subject, 1=time, 2=level
  const [subject,  setSubject]  = useState('')
  const [showMore, setShowMore] = useState(false)
  const [custom,   setCustom]   = useState('')
  const [time,     setTime]     = useState('')
  const [level,    setLevel]    = useState('')

  // Content anim
  const [contentKey, setContentKey] = useState(0)  // bump to re-trigger anim
  const [entering,   setEntering]   = useState(false) // final enter-screen anim

  useEffect(() => {
    const t1 = setTimeout(() => setMascotIn(true), 100)
    const t2 = setTimeout(() => setBubbleIn(true), 600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  function advanceTo(s) {
    setBubbleIn(false)
    setTimeout(() => {
      setStep(s)
      setContentKey(k => k + 1)
      setBubbleIn(true)
    }, 320)
  }

  function selectSubject(s) {
    setSubject(s); setShowMore(false)
    setTimeout(() => advanceTo(1), 200)
  }

  function selectTime(t) {
    setTime(t)
    setTimeout(() => advanceTo(2), 200)
  }

  function startStudy() {
    if (!level) return
    // Enter-screen animation then navigate
    setEntering(true)
    setTimeout(() => {
      const topic = subject === 'Outro' ? custom.trim() : subject
      navigate(`/chat?topic=${encodeURIComponent(topic)}&time=${time}&level=${level}`)
    }, 900)
  }

  const subjectForDisplay = subject || '…'
  const canStart = step === 2 && !!level

  return (
    <div style={{
      ...page,
      ...(entering ? { animation: 'enterScreen 0.9s cubic-bezier(0.7,0,1,1) forwards' } : {}),
    }}>
      {/* Background blobs */}
      <div style={{ ...blobEl, width:600, height:600, background:'#1a3a8c', top:-200, left:-180 }} />
      <div style={{ ...blobEl, width:420, height:420, background:'#c4770a', opacity:.12, bottom:-120, right:-80 }} />
      <div style={{ ...blobEl, width:260, height:260, background:'#5b4fd4', opacity:.09, top:'42%', right:'18%' }} />

      {/* Mascot + Bubble */}
      <div style={{ position: 'relative', marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
        {/* Speech bubble */}
        <div style={{ position: 'relative' }}>
          <Bubble visible={bubbleIn}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: step === 0 ? 16 : 12 }}>
              {STEP_GREET[step]}
            </p>

            {/* ─ STEP 0: Subject ─ */}
            {step === 0 && (
              <div key={`s${contentKey}`} style={contentAnim}>
                <div style={subGrid}>
                  {MAIN_SUBJECTS.map(s => (
                    <button key={s} onClick={() => selectSubject(s)} style={{
                      ...subBtn,
                      background: subject === s ? '#4f7edd' : '#f0f7ff',
                      color: subject === s ? '#fff' : '#1a1a2e',
                      borderColor: subject === s ? '#4f7edd' : '#d4eaff',
                    }}>{s}</button>
                  ))}
                  <button onClick={() => setShowMore(v => !v)} style={{ ...subBtn, background: showMore ? '#fff8f0' : '#f0f7ff', color: '#d4924a', borderColor: showMore ? '#d4924a' : '#d4eaff', gridColumn: 'span 1' }}>
                    {showMore ? 'Menos' : 'Mais'}
                  </button>
                </div>
                {showMore && (
                  <div style={{ ...subGrid, marginTop: 8 }}>
                    {MORE_SUBJECTS.map(s => (
                      <button key={s} onClick={() => selectSubject(s)} style={{
                        ...subBtn, fontSize: 12,
                        background: subject === s ? '#4f7edd' : '#f9fafb',
                        color: subject === s ? '#fff' : '#555',
                        borderColor: subject === s ? '#4f7edd' : '#e5e7eb',
                      }}>{s}</button>
                    ))}
                    <button onClick={() => { setSubject('Outro'); setShowMore(false) }} style={{ ...subBtn, fontSize: 12, background: '#f9fafb', color: '#555', borderColor: '#e5e7eb', gridColumn: 'span 2' }}>
                      Outro assunto
                    </button>
                  </div>
                )}
                {subject === 'Outro' && (
                  <input autoFocus type="text" placeholder="Qual assunto?" value={custom}
                    onChange={e => setCustom(e.target.value)} style={customInp} />
                )}
                {subject && subject !== 'Outro' && (
                  <button onClick={() => advanceTo(1)} style={{ ...nextBtn, marginTop: 14 }}>Continuar →</button>
                )}
                {subject === 'Outro' && custom.trim().length > 1 && (
                  <button onClick={() => advanceTo(1)} style={{ ...nextBtn, marginTop: 10 }}>Continuar →</button>
                )}
              </div>
            )}

            {/* ─ STEP 1: Time ─ */}
            {step === 1 && (
              <div key={`t${contentKey}`} style={contentAnim}>
                <div style={timeGrid}>
                  {TIMES.map(t => (
                    <button key={t.id} onClick={() => selectTime(t.id)} style={{
                      ...timeBtn,
                      background: time === t.id ? '#4f7edd' : '#f0f7ff',
                      color: time === t.id ? '#fff' : '#1a1a2e',
                      borderColor: time === t.id ? '#4f7edd' : '#d4eaff',
                    }}>
                      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.5px' }}>{t.label}</div>
                      <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─ STEP 2: Level ─ */}
            {step === 2 && (
              <div key={`l${contentKey}`} style={contentAnim}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {LEVELS.map(lv => (
                    <button key={lv.id} onClick={() => setLevel(lv.id)} style={{
                      ...levelBtn,
                      background: level === lv.id ? '#4f7edd' : '#f0f7ff',
                      color: level === lv.id ? '#fff' : '#1a1a2e',
                      borderColor: level === lv.id ? '#4f7edd' : '#d4eaff',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{lv.label}</div>
                      <div style={{ fontSize: 11, opacity: level === lv.id ? 0.8 : 0.5 }}>{lv.desc}</div>
                    </button>
                  ))}
                </div>
                {canStart && (
                  <button onClick={startStudy} style={startBtn}>
                    Comecar estudos
                  </button>
                )}
              </div>
            )}
          </Bubble>

          {/* Mascot */}
          <div style={{ opacity: mascotIn ? 1 : 0, transform: mascotIn ? 'translateY(0)' : 'translateY(30px)', transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.34,1.3,0.64,1)' }}>
            <Mascot animate={mascotIn} size={110} />
          </div>
        </div>
      </div>

      {/* Step dots */}
      <div style={stepDots}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 99, background: i <= step ? '#4f7edd' : 'rgba(255,255,255,0.15)', transition: 'all 0.3s ease' }} />
        ))}
      </div>

      {/* Summary */}
      {step > 0 && (
        <div style={summary}>
          {subject && <span style={pill}>{subject === 'Outro' ? custom : subject}</span>}
          {time    && <span style={pill}>{TIMES.find(t=>t.id===time)?.label}</span>}
          {level   && <span style={pill}>{LEVELS.find(l=>l.id===level)?.label}</span>}
        </div>
      )}

      <style>{`
        @keyframes mascotBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes stepIn    { from{opacity:0;transform:translateY(12px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes enterScreen {
          0%   { transform:scale(1); opacity:1 }
          30%  { transform:scale(1.08); opacity:1 }
          100% { transform:scale(0) translateY(-50%); opacity:0 }
        }
      `}</style>
    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const page       = { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 20px', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', position:'relative', overflow:'hidden',
  background:'radial-gradient(ellipse 85% 65% at 25% 35%, rgba(79,126,221,0.22) 0%, transparent 58%), radial-gradient(ellipse 65% 55% at 78% 72%, rgba(212,146,74,0.16) 0%, transparent 52%), linear-gradient(158deg,#08091a 0%,#0b0d22 55%,#07081a 100%)' }
const blobEl     = { position:'absolute', borderRadius:'50%', filter:'blur(100px)', pointerEvents:'none', opacity:0.18 }
const contentAnim = { animation:'stepIn 0.4s cubic-bezier(0.16,1,0.3,1) both' }

/* Bubble internals */
const subGrid    = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }
const subBtn     = { padding:'10px 8px', borderRadius:10, border:'1.5px solid', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }
const customInp  = { width:'100%', marginTop:10, padding:'10px 12px', border:'1.5px solid #d4eaff', borderRadius:9, fontSize:13, outline:'none', fontFamily:'inherit', color:'#1a1a2e', transition:'border-color .15s' }
const nextBtn    = { width:'100%', padding:'10px', borderRadius:9, border:'none', background:'#4f7edd', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 10px rgba(79,126,221,0.35)', transition:'all .15s' }
const timeGrid   = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }
const timeBtn    = { padding:'13px 8px', borderRadius:10, border:'1.5px solid', cursor:'pointer', fontFamily:'inherit', transition:'all .15s', textAlign:'center' }
const levelBtn   = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderRadius:10, border:'1.5px solid', cursor:'pointer', fontFamily:'inherit', transition:'all .15s', textAlign:'left', width:'100%' }
const startBtn   = { width:'100%', marginTop:14, padding:'11px', borderRadius:9, border:'none', background:'linear-gradient(120deg,#4f7edd,#3a6ccc)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 3px 14px rgba(79,126,221,0.45)', transition:'all .15s' }

const stepDots   = { display:'flex', gap:7, marginTop:16 }
const summary    = { display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginTop:12 }
const pill       = { background:'rgba(79,126,221,0.15)', border:'1px solid rgba(79,126,221,0.28)', borderRadius:99, padding:'3px 12px', fontSize:12, fontWeight:600, color:'#7bb3f0' }