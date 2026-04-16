import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from './assets/logo.png'

export default function Splash() {
  const navigate = useNavigate()
  const ref = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => {
      if (ref.current) {
        ref.current.style.opacity = '0'
        ref.current.style.transition = 'opacity 0.65s ease'
        setTimeout(() => navigate('/sobre', { replace: true }), 680)
      }
    }, 1900)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div ref={ref} style={s.wrap}>
      <div style={s.grain} />
      <div style={{ ...s.blob, width: 540, height: 540, background: '#2a55cc', opacity: 0.18, top: -120, left: -100, animation: 'blobA 12s ease-in-out infinite alternate' }} />
      <div style={{ ...s.blob, width: 340, height: 340, background: '#c4844a', opacity: 0.1, bottom: -70, right: -50, animation: 'blobB 14s ease-in-out infinite alternate' }} />
      <div style={{ position: 'relative', zIndex: 1, animation: 'popIn 0.75s cubic-bezier(0.34,1.45,0.64,1) both 0.08s' }}>
        <img src={logo} alt="MetaPPS" style={s.img}
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
        <div style={{ display: 'none', ...s.fallback }}>META<span style={{ color: '#7b9fd4' }}>PPS</span></div>
      </div>
    </div>
  )
}

const s = {
  wrap: {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: `
      radial-gradient(ellipse 85% 65% at 28% 38%, rgba(79,126,221,0.28) 0%, transparent 62%),
      radial-gradient(ellipse 65% 55% at 78% 72%, rgba(108,143,212,0.14) 0%, transparent 55%),
      linear-gradient(158deg, #0a0c18 0%, #0d1020 55%, #080a14 100%)`,
  },
  grain: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
  },
  blob: { position: 'absolute', borderRadius: '50%', filter: 'blur(95px)', pointerEvents: 'none' },
  img: {
    width: 'min(200px, 52vw)', height: 'auto', display: 'block',
    filter: 'drop-shadow(0 14px 48px rgba(79,126,221,0.3)) drop-shadow(0 3px 10px rgba(0,0,0,0.35))',
  },
  fallback: {
    fontSize: 'clamp(44px, 12vw, 72px)', fontWeight: 800, letterSpacing: '-2px', color: '#e8ecf2',
  },
}