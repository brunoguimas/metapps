import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { register } from './api'
import logo from './assets/logo.png'

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

function PwField({ value, onChange, placeholder, autoComplete, invalid }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete}
        style={{ ...inp, paddingRight: 44, borderColor: invalid ? 'rgba(220,80,80,0.5)' : undefined }}
      />
      <button type="button" onClick={() => setShow(v => !v)} style={eyeBtn} aria-label="Mostrar senha">
        {show ? <EyeOff /> : <EyeOn />}
      </button>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--t2)', letterSpacing: '0.25px', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function Match({ pw, cpw }) {
  if (!cpw.length) return <div style={{ height: 14 }} />
  const ok = pw === cpw
  return <div style={{ fontSize: 11, marginTop: 6, color: ok ? '#6aaf6a' : '#e08080' }}>{ok ? 'Senhas conferem' : 'Senhas não conferem'}</div>
}

function mapError(raw) {
  if (!raw) return 'Algo deu errado. Tente novamente.'
  const m = raw.toLowerCase()
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) return 'Sem conexão com o servidor. Verifique se a API está rodando.'
  if (m.includes('invalid email or password') || m.includes('invalid credentials') || m.includes('password')) return 'E-mail ou senha incorretos.'
  if (m.includes('500') || m.includes('internal server')) return 'Erro interno no servidor. Tente novamente.'
  return raw || 'Algo deu errado. Tente novamente.'
}

export default function Register() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [uname,   setUname]   = useState('')
  const [email,   setEmail]   = useState('')
  const [pw,      setPw]      = useState('')
  const [cpw,     setCpw]     = useState('')
  const [terms,   setTerms]   = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  function go(path) { setLeaving(true); setTimeout(() => navigate(path), 240) }
  function clrErr() { setError('') }

  async function handleSubmit(e) {
    e.preventDefault(); setError('')
    if (!uname.trim() || !email.trim() || !pw || !cpw) { setError('Preencha todos os campos.'); return }
    if (pw.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    if (pw !== cpw)    { setError('As senhas não conferem.'); return }
    if (!terms)        { setError('Aceite os Termos de Serviço para continuar.'); return }
    setLoading(true)
    try {
      await register(uname.trim(), email.trim(), pw)
      go(`/verify-email?email=${encodeURIComponent(email.trim())}`)
    } catch (err) {
      const mapped = mapError(err.message)
      if (mapped === '__FETCH__') { go('/404'); return }
      if (mapped === '__500__')   { go('/500'); return }
      setError(mapped)
    } finally { setLoading(false) }
  }

  const formAnim = { animation: leaving ? 'fOut 0.24s ease-in forwards' : 'fIn 0.6s var(--ease) both' }

  function openTermos(hash = '') {
    window.open('/src/pages/Termos.html' + hash, '_blank')
  }

  const FormBody = (
    <>
      <h1 style={title}>Criar conta</h1>
      <p style={sub}>Comece a acompanhar suas metas hoje.</p>
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Nome de usuário">
          <input type="text" placeholder="seunome" autoComplete="username"
            style={inp} value={uname} onChange={e => { setUname(e.target.value); clrErr() }} />
        </Field>
        <Field label="E-mail">
          <input type="email" placeholder="voce@email.com" autoComplete="email"
            style={inp} value={email} onChange={e => { setEmail(e.target.value); clrErr() }} />
        </Field>
        <Field label="Senha">
          <PwField value={pw} onChange={e => { setPw(e.target.value); clrErr() }}
            placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
        </Field>
        <Field label="Confirmar senha">
          <PwField value={cpw} onChange={e => { setCpw(e.target.value); clrErr() }}
            placeholder="Repita a senha" autoComplete="new-password"
            invalid={cpw.length > 0 && pw !== cpw} />
          <Match pw={pw} cpw={cpw} />
        </Field>

        {error && <div style={errBox}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0 16px' }}>
          <input type="checkbox" id="tc" checked={terms} onChange={e => setTerms(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0, width: 15, height: 15, accentColor: 'var(--blue)', cursor: 'pointer' }} />
          <label htmlFor="tc" style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.55, cursor: 'pointer' }}>
            Li e concordo com os{' '}
            <span onClick={() => openTermos()} style={termsLink}>Termos de Serviço</span>
            {' '}e a{' '}
            <span onClick={() => openTermos('#privacidade')} style={termsLink}>Política de Privacidade</span>
          </label>
        </div>

        <button type="submit" disabled={loading} style={{ ...btnMain, opacity: loading ? 0.55 : 1 }}>
          {loading ? <><Spin /> Criando conta…</> : 'Criar conta'}
        </button>
      </form>
      <p style={footNote}>
        Já tem conta?{' '}
        <a href="#" style={linkStyle} onClick={e => { e.preventDefault(); go('/login') }}>Entrar</a>
      </p>
    </>
  )

  return (
    <div style={split}>

      {/* LEFT desktop */}
      {!isMobile && (
        <div style={leftPanel}>
          <div style={grain} />
          <div style={gradSep} />
          <div style={{ ...blobEl, width: 500, height: 500, background: '#c4844a', opacity: 0.13, top: -110, right: -90, animation: 'blobC 13s ease-in-out infinite alternate' }} />
          <div style={{ ...blobEl, width: 460, height: 460, background: '#2a55cc', opacity: 0.18, bottom: -100, left: -80, animation: 'blobD 15s ease-in-out infinite alternate' }} />
          <div style={{ position: 'relative', zIndex: 2, animation: 'lgIn 1s var(--ease) both 0.1s' }}>
            <img src={logo} alt="MetaPPS" style={logoDesktop}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
            <div style={{ display: 'none', fontSize: 'clamp(52px,7vw,80px)', fontWeight: 800, letterSpacing: '-2px', color: 'var(--t1)', textAlign: 'center' }}>
              META<span style={{ color: 'var(--accent)' }}>PPS</span>
            </div>
          </div>
          {/* No bottom wordmark */}
        </div>
      )}

      {/* RIGHT */}
      <div style={isMobile ? mobilePage : rightPanel}>
        {isMobile ? (
          <div style={mobileWrap}>
            <div style={{ textAlign: 'center', marginBottom: 28, animation: 'lgIn 0.7s var(--ease) both' }}>
              <img src={logo} alt="MetaPPS" style={mobileLogo}
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
              <div style={{ display: 'none', fontSize: 52, fontWeight: 800, letterSpacing: '-2px', color: 'var(--t1)' }}>
                META<span style={{ color: 'var(--accent)' }}>PPS</span>
              </div>
            </div>
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
    radial-gradient(ellipse 85% 65% at 72% 32%, rgba(212,146,74,0.18) 0%, transparent 58%),
    radial-gradient(ellipse 80% 65% at 20% 72%, rgba(79,126,221,0.22) 0%, transparent 58%),
    radial-gradient(ellipse 55% 50% at 52% 8%, rgba(108,143,212,0.1) 0%, transparent 48%),
    linear-gradient(158deg, #09091a 0%, #0b0f22 55%, #07081a 100%)`,
}
const grain      = {
  position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.76' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
}
const gradSep    = {
  position: 'absolute', right: 0, top: 0,
  width: 180, height: '100%', zIndex: 3, pointerEvents: 'none',
  background: 'linear-gradient(90deg, transparent 0%, rgba(17,21,32,0.6) 50%, #111520 100%)',
}
const blobEl     = { position: 'absolute', borderRadius: '50%', filter: 'blur(95px)', pointerEvents: 'none', zIndex: 0 }
const logoDesktop = {
  width: 'min(380px, 44vw)', height: 'auto', display: 'block',
  filter: 'drop-shadow(0 20px 64px rgba(79,126,221,0.3)) drop-shadow(0 4px 14px rgba(0,0,0,0.5))',
}
const rightPanel = {
  flex: '0 0 42%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '32px 56px', overflowY: 'auto', position: 'relative',
  backgroundColor: '#111520',
  backgroundImage: `repeating-linear-gradient(-55deg, transparent, transparent 28px, rgba(108,143,212,0.018) 28px, rgba(108,143,212,0.018) 29px)`,
}
const mobilePage = {
  flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  minHeight: '100vh', padding: '48px 20px 40px', overflowY: 'auto',
  background: `
    radial-gradient(ellipse 85% 60% at 80% 10%, rgba(212,146,74,0.12) 0%, transparent 55%),
    radial-gradient(ellipse 75% 55% at 15% 85%, rgba(79,126,221,0.18) 0%, transparent 52%),
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
const title      = { fontSize: 22, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.45px', marginBottom: 5 }
const sub        = { fontSize: 13, color: 'var(--t2)', lineHeight: 1.55, marginBottom: 22 }
const inp        = {
  width: '100%', background: 'var(--ibg)', border: '1px solid var(--ib)',
  borderRadius: 'var(--r)', color: 'var(--t1)',
  fontFamily: "'Inter', -apple-system, sans-serif",
  fontSize: 14, padding: '11px 14px', outline: 'none',
  transition: 'border-color .15s, box-shadow .15s, background .15s',
  WebkitAppearance: 'none', appearance: 'none',
}
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
const termsLink  = { color: 'var(--blue)', fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }
const footNote   = { fontSize: 13, color: 'var(--t2)', textAlign: 'center', marginTop: 18 }
const linkStyle  = { color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }