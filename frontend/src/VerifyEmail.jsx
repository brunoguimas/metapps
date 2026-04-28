import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const [p]      = useSearchParams()
  const email    = p.get('email') || ''
  const [cd, setCd]     = useState(0)
  const [sent, setSent] = useState(false)
  const iv = useRef(null)
  useEffect(() => () => { if (iv.current) clearInterval(iv.current) }, [])

  // Auto redirect to /criar after 3 minutes — user will click link in email
  // which hits /email-verified and goes to /criar directly
  // This page is just informational — no timer redirect needed

  async function resend() {
    if (cd > 0) return
    try {
      await fetch(`${API}/auth/resend-verification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch (_) {}
    setSent(true); setTimeout(() => setSent(false), 3000)
    setCd(30)
    iv.current = setInterval(() => setCd(x => {
      if (x <= 1) { clearInterval(iv.current); return 0 }
      return x - 1
    }), 1000)
  }

  return (
    <div style={page}>
      <div style={{ ...blob, width:500, height:500, background:'#1a2e8c', top:-160, left:-140 }} />
      <div style={{ ...blob, width:340, height:340, background:'#6b3fc4', opacity:.14, bottom:-90, right:-80 }} />

      <div style={card}>
        <div style={wm}>META<span style={{ color:'#9b85f5' }}>PPS</span></div>

        <div style={ico}>
          <svg width="24" height="24" fill="none" stroke="rgba(155,133,245,0.8)" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M2 4l10 9 10-9" />
          </svg>
        </div>

        <h1 style={h1}>Verifique seu e-mail</h1>
        <p style={desc}>
          Enviamos um link para{' '}
          <strong style={{ color:'#c4b8f8', fontWeight:600 }}>{email || 'seu@email.com'}</strong>.
          <br />Clique no link para ativar sua conta e comecar a estudar.
        </p>

        <button onClick={() => navigate('/login')} style={btn}>Ir para o login</button>

        <p style={resendTxt}>
          Nao recebeu?{' '}
          <span onClick={cd > 0 ? undefined : resend}
            style={{ color: cd > 0 ? '#2e3649' : '#9b85f5', fontWeight:600, cursor: cd > 0 ? 'default' : 'pointer' }}>
            {cd > 0 ? `Reenviar em ${cd}s` : 'Reenviar e-mail'}
          </span>
        </p>
        {sent && <p style={{ fontSize:12, color:'#6aaf6a', marginTop:8, textAlign:'center' }}>Reenviado!</p>}
      </div>

      <style>{`@keyframes cIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

const page    = { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'radial-gradient(ellipse 80% 60% at 25% 30%, rgba(107,79,196,0.2) 0%, transparent 55%), linear-gradient(158deg,#08091e 0%,#0c0e28 55%,#07081c 100%)', padding:'32px 20px', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', position:'relative', overflow:'hidden' }
const blob    = { position:'absolute', borderRadius:'50%', filter:'blur(100px)', pointerEvents:'none', opacity:0.18 }
const card    = { position:'relative', zIndex:1, width:'100%', maxWidth:360, textAlign:'center', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'44px 32px 36px', animation:'cIn 0.45s ease both' }
const wm      = { fontSize:22, fontWeight:800, letterSpacing:'-0.7px', color:'#e8ecf2', marginBottom:28 }
const ico     = { width:52, height:52, margin:'0 auto 20px', background:'rgba(107,79,196,0.1)', border:'1px solid rgba(155,133,245,0.25)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center' }
const h1      = { fontSize:20, fontWeight:700, color:'#e8ecf2', letterSpacing:'-0.3px', marginBottom:12 }
const desc    = { fontSize:14, color:'#6e7a92', lineHeight:1.65, marginBottom:28 }
const btn     = { width:'100%', padding:13, border:'none', borderRadius:10, fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, fontWeight:600, background:'linear-gradient(120deg,#6b4fd4 0%,#4f7edd 100%)', color:'#fff', cursor:'pointer', boxShadow:'0 2px 14px rgba(107,79,212,0.38)', transition:'opacity .15s' }
const resendTxt = { fontSize:13, color:'#3e4760', marginTop:20 }