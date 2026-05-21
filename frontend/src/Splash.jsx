import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import animacaoVideo from './assets/animacao.mp4'

const CORES = {
  bg1: '#14182b',
  bg2: '#212842',
}

export default function Splash() {
  const navigate = useNavigate()
  const wrapRef = useRef(null)
  const videoRef = useRef(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleEnded = () => fadeOutAndNavigate()
    const fallbackTimer = setTimeout(() => fadeOutAndNavigate(), 7000)

    video.addEventListener('ended', handleEnded)
    return () => {
      video.removeEventListener('ended', handleEnded)
      clearTimeout(fallbackTimer)
    }
  }, [navigate])

  function fadeOutAndNavigate() {
    if (wrapRef.current) {
      wrapRef.current.style.transition = 'opacity 0.6s ease'
      wrapRef.current.style.opacity = '0'
    }
    setTimeout(() => navigate('/home', { replace: true }), 600)
  }

  return (
    <div ref={wrapRef} style={s.wrap}>
      <video
        ref={videoRef}
        src={animacaoVideo}
        style={{
          ...s.video,
          objectFit: isMobile ? 'contain' : 'cover',   // sem cortes no mobile
        }}
        autoPlay
        playsInline
        muted
        preload="auto"
        onError={() => fadeOutAndNavigate()}
      />
      <div style={s.blob1} />
      <div style={s.blob2} />
      <div style={s.blob3} />
      <style>{blobAnimationStyle}</style>
    </div>
  )
}

const s = {
  wrap: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    overflow: 'hidden',
    background: `linear-gradient(180deg, ${CORES.bg1} 0%, ${CORES.bg2} 55%, ${CORES.bg1} 100%)`,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  blob1: {
    position: 'absolute',
    width: 640,
    height: 640,
    background: '#5d6b8e',
    borderRadius: '50%',
    filter: 'blur(110px)',
    opacity: 0.06,
    top: -220,
    left: -180,
    pointerEvents: 'none',
    zIndex: 2,
    animation: 'floatBlob 12s ease-in-out infinite',
  },
  blob2: {
    position: 'absolute',
    width: 400,
    height: 400,
    background: '#27187e',
    borderRadius: '50%',
    filter: 'blur(90px)',
    opacity: 0.05,
    bottom: -120,
    right: -60,
    pointerEvents: 'none',
    zIndex: 2,
    animation: 'floatBlob 16s ease-in-out infinite 1.5s',
  },
  blob3: {
    position: 'absolute',
    width: 260,
    height: 260,
    background: '#a8a6c8',
    borderRadius: '50%',
    filter: 'blur(70px)',
    opacity: 0.04,
    top: '42%',
    right: '18%',
    pointerEvents: 'none',
    zIndex: 2,
    animation: 'floatBlob 10s ease-in-out infinite 3s',
  },
}

const blobAnimationStyle = `
  @keyframes floatBlob {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-20px, 15px) scale(1.02); }
  }
`