import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from './assets/logo.png'

export default function EmailVerified() {
  const navigate = useNavigate()

  useEffect(() => {
    // After 2.5s auto-navigate to login
    const t = setTimeout(() => navigate('/login', { replace: true }), 2500)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div style={page}>
      <div style={card}>
        <img src={logo} alt="MetaPPS" style={logoStyle}
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
        <div style={{ display: 'none', fontSize: 22, fontWeight: 800, letterSpacing: '-0.8px', color: '#111827', marginBottom: 28 }}>
          META<span style={{ color: '#4f7edd' }}>PPS</span>
        </div>

        {/* Check icon */}
        <div style={icoWrap}>
          <svg width="26" height="26" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="#bbf7d0" strokeWidth="1.5" />
            <path d="M8 12l3 3 5-5" />
          </svg>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px', marginBottom: 8 }}>
          E-mail verificado!
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 28 }}>
          Sua conta foi ativada com sucesso. Redirecionando para o login…
        </p>

        <button onClick={() => navigate('/login', { replace: true })} style={btn}>
          Ir para o login agora
        </button>
      </div>
    </div>
  )
}

const page = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6f8', padding: '32px 20px' }
const card = { width: '100%', maxWidth: 400, textAlign: 'center', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '48px 40px 44px', boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06)', animation: 'fadeIn 0.5s ease both' }
const logoStyle = { height: 40, width: 'auto', display: 'block', margin: '0 auto 32px' }
const icoWrap = { width: 56, height: 56, margin: '0 auto 20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const btn = { width: '100%', padding: 11, border: 'none', borderRadius: 8, fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 14, fontWeight: 600, background: '#4f7edd', color: '#fff', cursor: 'pointer', transition: 'background .15s' }