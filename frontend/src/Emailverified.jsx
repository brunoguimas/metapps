import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function EmailVerified() {
  const navigate = useNavigate()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const t = setTimeout(() => navigate('/criar', { replace: true }), 2400)
    return () => clearTimeout(t)
  }, [navigate]) // eslint-disable-line

  return (
    <div style={page}>
      <div style={bg1} /><div style={bg2} />
      <div style={card}>
        <div style={ring}>
          <svg width="30" height="30" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 style={h1}>E-mail verificado!</h1>
        <p style={desc}>Sua conta está ativa. Preparando tudo pra você…</p>
        <div style={dots}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'rgba(79,126,221,0.55)', animation:`dot 1.4s ease-in-out ${i*0.22}s infinite` }} />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes dot{0%,80%,100%{transform:scale(0.55);opacity:0.3}40%{transform:scale(1);opacity:1}}
        @keyframes pop{from{opacity:0;transform:scale(0.84)}to{opacity:1;transform:scale(1)}}
      `}</style>
    </div>
  )
}

/* 60% Azul, 30% Âmbar, 10% Roxo */
const page = { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
  background:`
    radial-gradient(ellipse 80% 60% at 20% 20%, rgba(79,126,221,0.35) 0%, transparent 55%),
    radial-gradient(ellipse 70% 55% at 80% 80%, rgba(212,146,74,0.25) 0%, transparent 52%),
    radial-gradient(ellipse 50% 45% at 55% 50%, rgba(91,79,212,0.12) 0%, transparent 48%),
    linear-gradient(145deg,#07091a 0%,#0c1128 50%,#09080f 100%)`,
  fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', padding:'32px 20px', position:'relative', overflow:'hidden' }
const bg1  = { position:'absolute', width:600, height:600, borderRadius:'50%', filter:'blur(120px)', background:'#1a3a8c', top:-200, left:-180, opacity:0.22 }
const bg2  = { position:'absolute', width:420, height:420, borderRadius:'50%', filter:'blur(110px)', background:'#c4770a', opacity:0.15, bottom:-120, right:-100 }
const card = { position:'relative', zIndex:1, textAlign:'center', maxWidth:360, animation:'pop 0.6s cubic-bezier(0.34,1.3,0.64,1) both' }
const ring = { width:66, height:66, borderRadius:'50%', background:'linear-gradient(135deg,#4f7edd 0%,#3a6ccc 100%)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', boxShadow:'0 6px 28px rgba(79,126,221,0.5)' }
const h1   = { fontSize:28, fontWeight:800, color:'#e8ecf2', letterSpacing:'-0.6px', marginBottom:10 }
const desc = { fontSize:15, color:'rgba(232,236,242,0.5)', lineHeight:1.65, marginBottom:28 }
const dots = { display:'flex', gap:8, justifyContent:'center' }