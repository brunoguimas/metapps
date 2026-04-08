import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import logo from './assets/logo.png'

const API_URL  = import.meta.env.VITE_API_URL || 'http://localhost:8080'
const COOLDOWN = 30

const Spinner = () => (
  <svg style={{ animation: 'spin .7s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
    <circle cx="12" cy="12" r="10" strokeOpacity=".22" /><path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
)

export default function VerifyEmail() {
  const navigate     = useNavigate()
  const [params]     = useSearchParams()
  const email        = params.get('email') || ''

  const [leaving,  setLeaving]  = useState(false)
  const [sending,  setSending]  = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [toast,    setToast]    = useState(false)
  const ivRef = useRef(null)

  useEffect(() => () => { if (ivRef.current) clearInterval(ivRef.current) }, [])

  function go(path) { setLeaving(true); setTimeout(() => navigate(path), 240) }

  async function resend() {
    if (cooldown > 0 || sending) return
    setSending(true)
    try {
      await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch (_) {}
    setSending(false)
    setToast(true)
    setTimeout(() => setToast(false), 3000)
    setCooldown(COOLDOWN)
    ivRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(ivRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const disabled = cooldown > 0 || sending

  return (
    <div style={page}>
      <div style={grain} />
      <div style={{ ...blobS, width: 440, height: 440, background: '#2a55aa', opacity: 0.13, top: -100, left: -80, animation: 'blobA 14s ease-in-out infinite alternate' }} />
      <div style={{ ...blobS, width: 320, height: 320, background: '#aa7230', opacity: 0.09, bottom: -70, right: -60, animation: 'blobB 16s ease-in-out infinite alternate' }} />

      <div style={{ ...card, animation: leaving ? 'cOut 0.24s ease-in forwards' : 'cIn 0.6s var(--ease) both' }}>

        <img src={logo} alt="MetaPPS" style={logoImg}
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
        <div style={{ display: 'none', fontSize: 26, fontWeight: 800, letterSpacing: '-1px', color: 'var(--t1)', marginBottom: 36 }}>
          META<span style={{ color: 'var(--accent)' }}>PPS</span>
        </div>

        {/* Envelope icon */}
        <div style={ico}>
          <svg width="22" height="22" fill="none" stroke="rgba(172,196,232,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect x="2" y="4" width="20" height="16" rx="1.5" />
            <path d="M2 4l10 9 10-9" />
          </svg>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.3px', marginBottom: 8 }}>
          Verifique seu e-mail
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.6 }}>
          Enviamos um link de acesso para
        </p>
        <div style={chip}>{email || 'seu@email.com'}</div>

        <div style={info}>
          Acesse sua caixa de entrada e clique no link para ativar sua conta.
          O link expira em 24 horas. Verifique também a pasta de spam.
        </div>

        <button onClick={resend} disabled={disabled} style={{ ...btnMain, opacity: disabled ? 0.48 : 1, cursor: disabled ? 'not-allowed' : 'pointer', marginBottom: 10 }}>
          {sending ? <><Spinner /> Enviando…</> : cooldown > 0 ? `Reenviar e-mail (${cooldown}s)` : 'Reenviar e-mail'}
        </button>

        <button onClick={() => go('/login')} style={btnGhost}>
          Voltar para o login
        </button>

        <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 18 }}>
          Não recebeu?{' '}
          <span onClick={disabled ? undefined : resend}
            style={{ color: disabled ? 'var(--t3)' : 'var(--blue)', fontWeight: 500, cursor: disabled ? 'default' : 'pointer' }}>
            Clique para reenviar
          </span>
        </p>
      </div>

      {/* Toast */}
      <div style={{ ...toastS, transform: toast ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(70px)' }}>
        E-mail reenviado com sucesso.
      </div>
    </div>
  )
}

const page = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: '100vh', padding: '32px 20px',
  background: `
    radial-gradient(ellipse 80% 60% at 15% 18%, rgba(79,126,221,0.18) 0%, transparent 55%),
    radial-gradient(ellipse 65% 55% at 85% 82%, rgba(108,143,212,0.12) 0%, transparent 52%),
    linear-gradient(155deg, #06091a 0%, #0d1530 52%, #050817 100%)`,
}
const grain = {
  position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E")`,
}
const blobS  = { position: 'fixed', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }
const card   = {
  position: 'relative', zIndex: 1,
  width: '100%', maxWidth: 400, textAlign: 'center',
  background: 'rgba(255,255,255,0.028)',
  border: '1px solid rgba(255,255,255,0.065)',
  borderRadius: 12, padding: '52px 48px 48px',
}
const logoImg = { height: 58, width: 'auto', display: 'block', margin: '0 auto 36px', filter: 'brightness(1.04) drop-shadow(0 6px 20px rgba(79,126,221,0.2))' }
const ico    = {
  width: 52, height: 52, margin: '0 auto 22px',
  background: 'rgba(79,126,221,0.09)', border: '1px solid rgba(79,126,221,0.18)',
  borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const chip   = {
  display: 'inline-block',
  background: 'rgba(255,255,255,0.052)', border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 99, padding: '5px 18px',
  fontSize: 13.5, fontWeight: 600, color: 'var(--t1)',
  wordBreak: 'break-all', margin: '13px 0 20px',
}
const info   = {
  background: 'rgba(79,126,221,0.07)', border: '1px solid rgba(79,126,221,0.16)',
  borderRadius: 8, padding: '12px 16px',
  fontSize: 13, color: 'rgba(172,196,232,0.82)',
  lineHeight: 1.6, textAlign: 'left', marginBottom: 28,
}
const btnMain = {
  width: '100%', padding: 12, border: 'none', borderRadius: 8,
  fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 14, fontWeight: 600,
  background: 'var(--blue)', color: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,.5), 0 4px 18px rgba(79,126,221,.28)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  transition: 'background .15s, opacity .15s',
}
const btnGhost = {
  width: '100%', padding: 12, borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,.048)', color: 'var(--t1)',
  fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 13.5, fontWeight: 600,
  cursor: 'pointer', transition: 'background .15s',
}
const toastS = {
  position: 'fixed', bottom: 28, left: '50%',
  background: '#1a2236', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, padding: '11px 20px',
  fontSize: 13.5, fontWeight: 500, color: 'var(--t1)',
  boxShadow: '0 4px 24px rgba(0,0,0,.45)',
  whiteSpace: 'nowrap', zIndex: 100,
  transition: 'transform 0.32s var(--ease)',
}