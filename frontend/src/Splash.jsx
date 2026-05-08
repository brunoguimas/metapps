import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from './assets/logo.png'

export default function Splash() {
  const navigate = useNavigate()
  const wrap = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => {
      if (wrap.current) {
        wrap.current.style.transition = 'opacity 0.5s ease'
        wrap.current.style.opacity = '0'
      }
      setTimeout(() => {
        navigate('/criar', { replace: true })
      }, 520)
    }, 5000)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div ref={wrap} style={s.wrap}>
      <div style={s.grain} />
      <div style={{ ...s.blob, width: 680, height: 680, background: '#1a3a8c', top: -260, left: -200 }} />
      <div style={{ ...s.blob, width: 440, height: 440, background: '#5b4fd4', opacity: 0.15, bottom: -110, right: -100 }} />
      <div style={{ ...s.blob, width: 280, height: 280, background: '#c4770a', opacity: 0.1, top: '45%', right: '20%' }} />
      <div style={{ position: 'relative', zIndex: 1, animation: 'sIn 0.85s cubic-bezier(0.34,1.4,0.64,1) both 0.04s' }}>
        <img src={logo} alt="MetaPPS" style={s.logo}
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
        <div style={{ display: 'none', ...s.fb }}>META<span style={{ color: '#7b9fd4' }}>PPS</span></div>
      </div>
      <style>{`@keyframes sIn{from{opacity:0;transform:scale(0.72)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

const s = {
  wrap: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse 90% 70% at 30% 40%, rgba(79,126,221,0.26) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 75% 70%, rgba(91,79,212,0.15) 0%, transparent 55%), linear-gradient(158deg,#08081c 0%,#0b0c26 55%,#07081a 100%)' },
  grain: { position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")` },
  blob: { position: 'absolute', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', opacity: 0.18 },
  logo: { width: 'min(400px, 80vw)', height: 'auto', display: 'block', filter: 'drop-shadow(0 24px 72px rgba(79,126,221,0.42)) drop-shadow(0 4px 16px rgba(0,0,0,0.6))' },
  fb: { fontSize: 'clamp(72px,20vw,110px)', fontWeight: 800, letterSpacing: '-4px', color: '#e8ecf2', textAlign: 'center' },
}