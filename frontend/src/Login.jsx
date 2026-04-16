import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login, loginWithGoogle } from './api'
import logo from './assets/logo.png'

/* ── Icons ── */
const EyeOn = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
)
const EyeOff = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)
const Spin = () => (
  <svg style={{ animation: 'spin .7s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
    <circle cx="12" cy="12" r="10" strokeOpacity=".22" /><path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
)
const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h12.7c-.5 2.8-2.2 5.1-4.6 6.7v5.5h7.4c4.3-4 6.8-9.9 6.8-16.4z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.5c-2.2 1.4-4.9 2.2-8.5 2.2-6.5 0-12-4.4-14-10.3H2.4v5.7C6.4 42.8 14.6 48 24 48z" />
    <path fill="#FBBC05" d="M10 28.6A14.9 14.9 0 0 1 10 24c0-1.6.3-3.1.7-4.6v-5.7H2.4A24 24 0 0 0 0 24c0 3.9.9 7.6 2.4 10.9L10 28.6z" />
    <path fill="#EA4335" d="M24 9.5c3.6 0 6.9 1.2 9.4 3.6l7-7C36.3 2.4 30.6 0 24 0 14.6 0 6.4 5.2 2.4 13.1l7.6 5.7C12 12.9 17.5 9.5 24 9.5z" />
  </svg>
)

/* ── Password field — ONE eye icon, no browser native ── */
function PwField({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete}
        style={{ ...inp, paddingRight: 44 }}
        /* Kill ALL browser native password icons */
        onFocus={e => {
          e.target.style.setProperty('--webkit-credentials-auto-fill-button', 'none')
        }}
      />
      <button type="button" onClick={() => setShow(v => !v)} style={eyeBtn} aria-label="Mostrar senha">
        {show ? <EyeOff /> : <EyeOn />}
      </button>
    </div>
  )
}

function Field({ label, right, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={lbl}>{label}</label>
        {right}
      </div>
      {children}
    </div>
  )
}

/* ── Error message mapping ── */
function mapError(raw) {
  if (!raw) return 'Algo deu errado. Tente novamente.'
  const m = raw.toLowerCase()
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) return 'Sem conexão com o servidor. Verifique se a API está rodando.'
  if (m.includes('invalid email or password') || m.includes('invalid credentials') || m.includes('password')) return 'E-mail ou senha incorretos.'
  if (m.includes('500') || m.includes('internal server')) return 'Erro interno no servidor. Tente novamente.'
  return raw || 'Algo deu errado. Tente novamente.'
}

export default function Login() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [leaving,  setLeaving]  = useState(false)

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  function go(path) { setLeaving(true); setTimeout(() => navigate(path), 240) }

  async function handleSubmit(e) {
    e.preventDefault(); setError('')
    if (!email.trim() || !password) { setError('Preencha todos os campos.'); return }
    setLoading(true)
    try {
      await login(email.trim(), password)
      go('/home')
    } catch (err) {
      const mapped = mapError(err.message)
      if (mapped === '__FETCH__') { go('/404'); return }
      if (mapped === '__500__')   { go('/500'); return }
      setError(mapped)
    } finally { setLoading(false) }
  }

  const formAnim = { animation: leaving ? 'fOut 0.24s ease-in forwards' : 'fIn 0.6s var(--ease) both' }

  const FormBody = (
    <>
      <h1 style={title}>Bem-vindo de volta</h1>
      <p style={sub}>Entre com sua conta para continuar.</p>

      <form onSubmit={handleSubmit} noValidate>
        <Field label="E-mail">
          <input type="email" placeholder="voce@email.com" autoComplete="email"
            style={inp} value={email} onChange={e => { setEmail(e.target.value); setError('') }} />
        </Field>

        <Field
          label="Senha"
          right={<Link to="/forgot-password" style={forgotStyle}>Esqueci a senha</Link>}
        >
          <PwField value={password} onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Sua senha" autoComplete="current-password" />
        </Field>

        {error && <div style={errBox}>{error}</div>}

        <button type="submit" disabled={loading} style={{ ...btnMain, marginTop: 4, opacity: loading ? 0.55 : 1 }}>
          {loading ? <><Spin /> Entrando…</> : 'Entrar'}
        </button>
      </form>

      <div style={orRow}><span style={orLine} /><span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 500 }}>ou</span><span style={orLine} /></div>

      <button onClick={loginWithGoogle} style={btnGhost}>
        <GoogleIcon /> Continuar com Google
      </button>

      <p style={footNote}>
        Sem conta?{' '}
        <a href="#" style={linkStyle} onClick={e => { e.preventDefault(); go('/register') }}>Criar conta</a>
      </p>
    </>
  )

  return (
    <div style={split}>

      {/* ── LEFT PANEL desktop ── */}
      {!isMobile && (
        <div style={leftPanel}>
          <div style={grain} />
          {/* Gradient fade separator — blends left into right */}
          <div style={gradSep} />
          <div style={{ ...blobEl, width: 580, height: 580, background: '#2a55cc', opacity: 0.18, top: -130, left: -110, animation: 'blobA 13s ease-in-out infinite alternate' }} />
          <div style={{ ...blobEl, width: 360, height: 360, background: '#c4844a', opacity: 0.1, bottom: -80, right: 0, animation: 'blobB 15s ease-in-out infinite alternate' }} />
          <div style={{ ...blobEl, width: 260, height: 260, background: '#4f7edd', opacity: 0.07, top: '44%', left: '54%', animation: 'blobA 20s ease-in-out infinite alternate-reverse' }} />
          <div style={{ position: 'relative', zIndex: 2, animation: 'lgIn 1s var(--ease) both 0.1s' }}>
            <img src={logo} alt="MetaPPS" style={logoDesktop}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
            <div style={{ display: 'none', fontSize: 'clamp(52px,7vw,80px)', fontWeight: 800, letterSpacing: '-2px', color: 'var(--t1)', textAlign: 'center' }}>
              META<span style={{ color: 'var(--accent)' }}>PPS</span>
            </div>
          </div>
          {/* No bottom wordmark — removed as requested */}
        </div>
      )}

      {/* ── RIGHT PANEL ── */}
      <div style={isMobile ? mobilePage : rightPanel}>
        {isMobile ? (
          /* Mobile: big logo top + card below */
          <div style={mobileWrap}>
            {/* Big logo on mobile */}
            <div style={{ textAlign: 'center', marginBottom: 28, animation: 'lgIn 0.7s var(--ease) both' }}>
              <img src={logo} alt="MetaPPS" style={mobileLogo}
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
              <div style={{ display: 'none', fontSize: 52, fontWeight: 800, letterSpacing: '-2px', color: 'var(--t1)' }}>
                META<span style={{ color: 'var(--accent)' }}>PPS</span>
              </div>
            </div>
            {/* Card */}
            <div style={{ ...mobileCard, ...formAnim }}>{FormBody}</div>
          </div>
        ) : (
          <div style={{ ...fbox, ...formAnim }}>{FormBody}</div>
        )}
      </div>
    </div>
  )
}

/* ── Styles ── */
const split      = { display: 'flex', height: '100vh', overflow: 'hidden' }

const leftPanel  = {
  flex: '0 0 58%', position: 'relative', overflow: 'hidden',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: `
    radial-gradient(ellipse 95% 75% at 25% 40%, rgba(79,126,221,0.28) 0%, transparent 62%),
    radial-gradient(ellipse 70% 60% at 80% 75%, rgba(108,143,212,0.14) 0%, transparent 55%),
    radial-gradient(ellipse 55% 50% at 58% 6%, rgba(212,146,74,0.09) 0%, transparent 48%),
    linear-gradient(158deg, #09091a 0%, #0b0f22 55%, #07081a 100%)`,
}

const grain      = {
  position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.76' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
}

/* Wide gradient fade — left panel color dissolves into right panel color */
const gradSep    = {
  position: 'absolute', right: 0, top: 0,
  width: 180, height: '100%', zIndex: 3, pointerEvents: 'none',
  background: 'linear-gradient(90deg, transparent 0%, rgba(17,21,32,0.6) 50%, #111520 100%)',
}

const blobEl     = { position: 'absolute', borderRadius: '50%', filter: 'blur(95px)', pointerEvents: 'none', zIndex: 0 }

const logoDesktop = {
  width: 'min(380px, 44vw)', height: 'auto', display: 'block',
  filter: 'drop-shadow(0 20px 64px rgba(79,126,221,0.32)) drop-shadow(0 4px 14px rgba(0,0,0,0.5))',
}

const rightPanel = {
  flex: '0 0 42%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '48px 56px', overflowY: 'auto', position: 'relative',
  backgroundColor: '#111520',
  backgroundImage: `repeating-linear-gradient(-55deg, transparent, transparent 28px, rgba(108,143,212,0.018) 28px, rgba(108,143,212,0.018) 29px)`,
}

const mobilePage = {
  flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  minHeight: '100vh', padding: '48px 20px 40px', overflowY: 'auto',
  background: `
    radial-gradient(ellipse 90% 60% at 20% 10%, rgba(79,126,221,0.18) 0%, transparent 55%),
    radial-gradient(ellipse 70% 55% at 80% 85%, rgba(108,143,212,0.12) 0%, transparent 52%),
    linear-gradient(158deg, #0a0a14 0%, #0d0e1e 55%, #090a14 100%)`,
}

const mobileWrap = { width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column' }

const mobileLogo = {
  width: 'min(200px, 60vw)', height: 'auto', display: 'block', margin: '0 auto',
  filter: 'drop-shadow(0 10px 36px rgba(79,126,221,0.28)) drop-shadow(0 2px 8px rgba(0,0,0,0.4))',
}

const mobileCard = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 14, padding: '32px 28px 28px',
}

const fbox       = { width: '100%', maxWidth: 320 }
const title      = { fontSize: 23, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.45px', lineHeight: 1.2, marginBottom: 6 }
const sub        = { fontSize: 13, color: 'var(--t2)', lineHeight: 1.55, marginBottom: 28 }
const lbl        = { fontSize: 12, fontWeight: 600, color: 'var(--t2)', letterSpacing: '0.25px' }
const forgotStyle = { fontSize: 12, fontWeight: 500, color: 'var(--blue)', textDecoration: 'none', letterSpacing: '0.1px' }

const inp        = {
  width: '100%', background: 'var(--ibg)', border: '1px solid var(--ib)',
  borderRadius: 'var(--r)', color: 'var(--t1)',
  fontFamily: "'Inter', -apple-system, sans-serif",
  fontSize: 14, padding: '11px 14px', outline: 'none',
  transition: 'border-color .15s, box-shadow .15s, background .15s',
  WebkitAppearance: 'none', appearance: 'none',
}

/* Suppress browser native eye/password icons globally via input style */
const eyeBtn     = {
  position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer', padding: 5,
  color: 'var(--t3)', display: 'flex', alignItems: 'center', borderRadius: 4, zIndex: 2,
}

const errBox     = {
  background: 'var(--err-bg)', border: '1px solid var(--err-brd)',
  borderRadius: 6, padding: '9px 13px', fontSize: 13, fontWeight: 500,
  color: 'var(--err-t)', lineHeight: 1.45, marginBottom: 14,
}
const btnMain    = {
  width: '100%', padding: 12, border: 'none', borderRadius: 'var(--r)',
  fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 14, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  background: 'var(--blue)', color: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,.5), 0 4px 18px rgba(79,126,221,.28)',
  transition: 'background .15s',
}
const btnGhost   = {
  width: '100%', padding: 12, borderRadius: 'var(--r)',
  border: '1px solid var(--ib)', background: 'rgba(255,255,255,.048)',
  fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 13.5, fontWeight: 600,
  color: 'var(--t1)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  transition: 'background .15s',
}
const orRow      = { display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }
const orLine     = { flex: 1, height: 1, background: 'var(--sep)', display: 'block' }
const footNote   = { fontSize: 13, color: 'var(--t2)', textAlign: 'center', marginTop: 18 }
const linkStyle  = { color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }