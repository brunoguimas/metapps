import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import icon from './assets/icon.svg'
import logoImg from './assets/logo.svg'
import AuthModal from './AuthModal'

/* =========================================================
   REVEAL
   ========================================================= */

function useReveal(threshold = 0.12) {
  const ref = useRef(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    const el = ref.current

    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true)
          obs.disconnect()
        }
      },
      { threshold }
    )

    obs.observe(el)

    return () => obs.disconnect()
  }, [threshold])

  return [ref, on]
}

function Reveal({ children, delay = 0, style: custom }) {
  const [ref, on] = useReveal()

  return (
    <div
      ref={ref}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? 'translateY(0)' : 'translateY(28px)',
        transition: `
          opacity 0.65s ease ${delay}ms,
          transform 0.65s ease ${delay}ms
        `,
        ...custom
      }}
    >
      {children}
    </div>
  )
}

/* =========================================================
   LOGO ANIMADA
   ========================================================= */

function AnimatedLogo() {
  const [hover, setHover] = useState(false)
  const [wobble, setWobble] = useState(false)

  function handleEnter() {
    setHover(true)
    setWobble(true)

    setTimeout(() => {
      setWobble(false)
    }, 600)
  }

  return (
    <div
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-block',
        cursor: 'pointer',
        transform: wobble
          ? 'rotate(-4deg) scale(1.04)'
          : hover
            ? 'rotate(2deg) scale(1.02)'
            : 'rotate(0deg) scale(1)',
        transition: wobble
          ? 'transform 0.15s cubic-bezier(0.34,1.8,0.64,1)'
          : 'transform 0.4s cubic-bezier(0.34,1.4,0.64,1)',
        filter: hover
          ? 'drop-shadow(0 16px 35px rgba(99,130,255,0.28))'
          : 'drop-shadow(0 8px 22px rgba(0,0,0,0.18))'
      }}
    >
      <img
        src={logoImg}
        alt="Metapps"
        style={{
          width: 'min(230px, 55vw)',
          height: 'auto',
          display: 'block'
        }}
        onError={e => {
          e.currentTarget.style.display = 'none'
        }}
      />
    </div>
  )
}

/* =========================================================
   ILUSTRAÇÃO PRINCIPAL
   ========================================================= */

function StudyHeroIllustration({ mob }) {
  return (
    <svg
      viewBox="0 0 700 650"
      role="img"
      aria-label="Ilustração de uma trilha de estudos do Metapps"
      style={{
        width: mob ? 'min(94vw, 560px)' : 'min(52vw, 700px)',
        height: 'auto',
        overflow: 'visible',
        display: 'block'
      }}
    >
      <path
        d="M90 530 C80 270 220 70 470 60 C585 55 650 110 665 190"
        fill="none"
        stroke="rgba(154,180,255,0.25)"
        strokeWidth="2"
        strokeDasharray="10 13"
      />

      <path
        d="M25 455 C110 540 180 555 270 535 C390 507 425 410 530 390 C600 377 650 400 684 432"
        fill="none"
        stroke="rgba(62,207,142,0.22)"
        strokeWidth="2"
        strokeDasharray="5 12"
      />

      <path
        d="M125 155 C185 105 255 88 330 95"
        fill="none"
        stroke="rgba(245,197,66,0.35)"
        strokeWidth="2"
        strokeDasharray="4 9"
      />

      <g
        fill="none"
        stroke="#9ab4ff"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M102 175 v18 M93 184 h18" />
        <path d="M584 280 v20 M574 290 h20" />
        <path d="M630 125 v14 M623 132 h14" />
      </g>

      <circle
        cx="76"
        cy="350"
        r="5"
        fill="#3ecf8e"
        opacity="0.8"
      />

      <circle
        cx="600"
        cy="485"
        r="5"
        fill="#f5c542"
        opacity="0.9"
      />

      <circle
        cx="155"
        cy="115"
        r="4"
        fill="#f06a6a"
        opacity="0.85"
      />

      <ellipse
        cx="420"
        cy="295"
        rx="195"
        ry="78"
        transform="rotate(-18 420 295)"
        fill="none"
        stroke="rgba(154,180,255,0.2)"
        strokeWidth="2"
      />

      <path
        d="M85 575
           C130 548 170 552 205 530
           C240 508 245 470 275 448
           C305 425 338 438 355 408
           C372 378 370 340 400 316
           C425 296 454 300 470 268
           C490 229 487 190 520 165"
        fill="none"
        stroke="#f5f4ff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M95 576
           C150 575 180 570 220 555
           C270 535 280 500 310 475
           C342 448 380 456 405 425
           C435 388 425 348 460 323
           C500 295 535 308 560 280"
        fill="none"
        stroke="rgba(154,180,255,0.3)"
        strokeWidth="2"
        strokeDasharray="5 9"
      />

      <g>
        <circle
          cx="205"
          cy="530"
          r="15"
          fill="#1a1a2e"
          stroke="#6382ff"
          strokeWidth="4"
        />

        <circle
          cx="275"
          cy="448"
          r="15"
          fill="#1a1a2e"
          stroke="#3ecf8e"
          strokeWidth="4"
        />

        <circle
          cx="355"
          cy="408"
          r="15"
          fill="#1a1a2e"
          stroke="#f5c542"
          strokeWidth="4"
        />

        <circle
          cx="470"
          cy="268"
          r="15"
          fill="#1a1a2e"
          stroke="#f06a6a"
          strokeWidth="4"
        />

        <circle
          cx="520"
          cy="165"
          r="18"
          fill="#6382ff"
          stroke="#f5f4ff"
          strokeWidth="4"
        />

        <path
          d="M514 165 l5 5 l10 -12"
          fill="none"
          stroke="#f5f4ff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <g transform="translate(75 420) rotate(-8)">
        <path
          d="M0 20 Q50 0 100 20 V115 Q50 95 0 115 Z"
          fill="#f5f4ff"
          stroke="#1a1a2e"
          strokeWidth="4"
        />

        <path
          d="M100 20 Q150 0 200 20 V115 Q150 95 100 115 Z"
          fill="#eeeeff"
          stroke="#1a1a2e"
          strokeWidth="4"
        />

        <path
          d="M100 20 V115"
          stroke="#6382ff"
          strokeWidth="3"
        />

        <path
          d="M24 45 Q55 35 82 46"
          fill="none"
          stroke="#6382ff"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <path
          d="M118 45 Q150 35 177 46"
          fill="none"
          stroke="#3ecf8e"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <path
          d="M24 66 Q55 56 82 67"
          fill="none"
          stroke="#6b6b8a"
          strokeWidth="2"
          strokeLinecap="round"
        />

        <path
          d="M118 66 Q150 56 177 67"
          fill="none"
          stroke="#6b6b8a"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      <g transform="translate(510 360)">
        <path
          d="M25 0 H105 L95 55 Q65 80 35 55 Z"
          fill="#f5c542"
          stroke="#1a1a2e"
          strokeWidth="4"
        />

        <path
          d="M25 12 H3 Q2 42 35 45"
          fill="none"
          stroke="#f5f4ff"
          strokeWidth="6"
          strokeLinecap="round"
        />

        <path
          d="M105 12 H127 Q128 42 95 45"
          fill="none"
          stroke="#f5f4ff"
          strokeWidth="6"
          strokeLinecap="round"
        />

        <path
          d="M65 80 V108"
          stroke="#f5f4ff"
          strokeWidth="7"
          strokeLinecap="round"
        />

        <path
          d="M38 110 H92"
          stroke="#6382ff"
          strokeWidth="8"
          strokeLinecap="round"
        />

        <path
          d="M65 17 V42"
          stroke="#1a1a2e"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <path
          d="M53 29 H77"
          stroke="#1a1a2e"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>

      <g transform="translate(480 90) rotate(7)">
        <rect
          x="0"
          y="0"
          width="125"
          height="78"
          rx="22"
          fill="#f5f4ff"
          stroke="#1a1a2e"
          strokeWidth="4"
        />

        <path
          d="M28 78 L22 101 L49 78"
          fill="#f5f4ff"
          stroke="#1a1a2e"
          strokeWidth="4"
          strokeLinejoin="round"
        />

        <circle cx="34" cy="38" r="6" fill="#6382ff" />
        <circle cx="62" cy="38" r="6" fill="#3ecf8e" />
        <circle cx="90" cy="38" r="6" fill="#f5c542" />
      </g>

      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M115 275 h70 M150 245 v60"
          stroke="#6382ff"
          strokeWidth="3"
        />

        <path
          d="M570 520 l20 -22 l22 22"
          stroke="#3ecf8e"
          strokeWidth="3"
        />

        <circle
          cx="120"
          cy="315"
          r="14"
          stroke="#f06a6a"
          strokeWidth="3"
        />

        <path
          d="M123 306 l-8 10 l10 10"
          stroke="#f06a6a"
          strokeWidth="2"
        />
      </g>

      <g transform="translate(585 550) rotate(-12)">
        <path
          d="M0 0 L70 12 L43 72 L-12 47 Z"
          fill="#f5f4ff"
          stroke="#1a1a2e"
          strokeWidth="4"
        />

        <path
          d="M4 7 L43 72"
          stroke="#6382ff"
          strokeWidth="2"
        />

        <path
          d="M18 25 L53 31"
          stroke="#6b6b8a"
          strokeWidth="2"
        />

        <path
          d="M12 38 L45 44"
          stroke="#6b6b8a"
          strokeWidth="2"
        />
      </g>

      <g transform="translate(300 210)">
        <ellipse
          cx="88"
          cy="105"
          rx="120"
          ry="43"
          transform="rotate(-18 88 105)"
          fill="none"
          stroke="#6382ff"
          strokeWidth="3"
          opacity="0.8"
        />

        <circle
          cx="88"
          cy="105"
          r="78"
          fill="rgba(99,130,255,0.08)"
          stroke="rgba(245,244,255,0.15)"
          strokeWidth="2"
        />

        <image
          href={icon}
          x="18"
          y="35"
          width="140"
          height="140"
          preserveAspectRatio="xMidYMid meet"
        />
      </g>

      <circle
        cx="552"
        cy="218"
        r="8"
        fill="#f06a6a"
        stroke="#f5f4ff"
        strokeWidth="3"
      />
    </svg>
  )
}

/* =========================================================
   LANDPAGE
   ========================================================= */

export default function Landpage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [width, setWidth] = useState(
    typeof window !== 'undefined'
      ? window.innerWidth
      : 1280
  )

  const mob = width < 768
  const tablet = width >= 768 && width < 1100
  const compact = width < 1200
  const large = width >= 1600

  // ── controla o AuthModal (login / registro / esqueci a senha) ──
  const [authMode, setAuthMode] = useState(null) // null | 'login' | 'register' | 'forgot'

  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.body.style.height = 'auto'
    document.title = 'Metapps'

    const favicon = document.querySelector(
      "link[rel*='icon']"
    )

    if (favicon) {
      favicon.href = icon
    } else {
      const link = document.createElement('link')
      link.rel = 'icon'
      link.href = icon
      document.head.appendChild(link)
    }

    return () => {
      document.body.style.overflow = ''
      document.body.style.height = ''
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      setWidth(window.innerWidth)
    }

    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Links antigos (/auth/login, /auth/register, /forgot-password) caem
  // em "/" com ?auth=login|register|forgot — abrimos o modal certo.
  useEffect(() => {
    const authParam = searchParams.get('auth')
    if (authParam === 'login' || authParam === 'register' || authParam === 'forgot') {
      setAuthMode(authParam)
    }
  }, [searchParams])

  /* =======================================================
     NAVEGAÇÃO
     ======================================================= */

  const goToRegister = () => setAuthMode('register')
  const goToLogin = () => setAuthMode('login')
  const goToHome = () => navigate('/')

  const closeAuth = () => {
    setAuthMode(null)
    if (searchParams.get('auth')) {
      const next = new URLSearchParams(searchParams)
      next.delete('auth')
      setSearchParams(next, { replace: true })
    }
  }

  const goToSupport = () => {
    window.location.href =
      'mailto:belugaforever2022@gmail.com'
  }

  const scrollTo = id => {
    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
  }

  const openTerms = () => {
    window.open('/src/pages/Termos.html', '_blank')
  }

  const openPrivacy = () => {
    window.open(
      '/src/pages/Termos.html#privacidade',
      '_blank'
    )
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        fontFamily: "'Inter', -apple-system, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        background: '#f5f4ff',
        color: '#1a1a2e',
        overflowX: 'hidden'
      }}
    >
      {/* ===================================================
          NAVBAR
          =================================================== */}

      <nav
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'transparent'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1280,
            margin: '0 auto',
            padding: mob
              ? '18px 18px'
              : tablet
                ? '22px 28px'
                : compact
                  ? '24px 32px'
                  : '24px 42px',
            minHeight: mob ? 70 : 78,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: mob ? 8 : 20
          }}
        >
          {/* Logo */}

          <img
            src={logoImg}
            alt="Metapps"
            onClick={goToHome}
            onError={e => {
              e.currentTarget.style.display = 'none'
            }}
            style={{
              width: mob
                ? 'clamp(100px, 29vw, 118px)'
                : tablet
                  ? 125
                  : 140,
              maxWidth: '100%',
              height: 'auto',
              cursor: 'pointer',
              filter: 'brightness(0) invert(1)',
              transition: 'transform 0.2s ease',
              flexShrink: 0
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform =
                'scale(1.03)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform =
                'scale(1)'
            }}
          />

          {/* Menu desktop */}

          {!mob && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: tablet ? 0 : 8,
                maxWidth: '45%',
                overflow: 'hidden'
              }}
            >
              <button
                type="button"
                onClick={() => scrollTo('inicio')}
                style={{
                  ...heroNavLink,
                  padding: tablet
                    ? '8px 9px'
                    : '9px 15px'
                }}
              >
                Home
              </button>

              <button
                type="button"
                onClick={() => scrollTo('roadmap')}
                style={{
                  ...heroNavLink,
                  padding: tablet
                    ? '8px 9px'
                    : '9px 15px'
                }}
              >
                Roadmap
              </button>

              <button
                type="button"
                onClick={() => scrollTo('aprendizado')}
                style={{
                  ...heroNavLink,
                  padding: tablet
                    ? '8px 9px'
                    : '9px 15px'
                }}
              >
                Aprendizado
              </button>

              <button
                type="button"
                onClick={() => scrollTo('contato')}
                style={{
                  ...heroNavLink,
                  padding: tablet
                    ? '8px 9px'
                    : '9px 15px'
                }}
              >
                Contato
              </button>
            </div>
          )}

          {/* Ações */}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: mob ? 3 : tablet ? 4 : 8,
              marginLeft: 'auto',
              flexShrink: 0
            }}
          >
            <button
              type="button"
              onClick={goToLogin}
              style={{
                ...heroSignIn,
                padding: mob
                  ? '9px 8px'
                  : tablet
                    ? '9px 10px'
                    : '10px 15px',
                fontSize: mob ? 12 : 13
              }}
            >
              Entrar
            </button>

            <button
              type="button"
              onClick={goToRegister}
              style={{
                ...heroNavCta,
                padding: mob
                  ? '10px 12px'
                  : tablet
                    ? '10px 15px'
                    : '11px 20px',
                fontSize: mob ? 12 : 13
              }}
            >
              Começar
            </button>
          </div>
        </div>
      </nav>

      {/* ===================================================
          HERO
          =================================================== */}

      <section
        id="inicio"
        style={{
          position: 'relative',
          minHeight: mob
            ? 'auto'
            : tablet
              ? 'auto'
              : 'min(860px, 100vh)',
          background: '#1a1a2e',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {/* Decoração de fundo */}

        <div
          style={{
            position: 'absolute',
            width: mob
              ? 340
              : tablet
                ? 480
                : 600,
            height: mob
              ? 340
              : tablet
                ? 480
                : 600,
            borderRadius: '50%',
            background: 'rgba(99,130,255,0.07)',
            filter: 'blur(2px)',
            top: mob ? -180 : -300,
            right: mob ? -150 : -180,
            pointerEvents: 'none'
          }}
        />

        <div
          style={{
            position: 'absolute',
            width: mob ? 280 : 420,
            height: mob ? 280 : 420,
            borderRadius: '50%',
            border:
              '1px dashed rgba(154,180,255,0.16)',
            bottom: mob ? -180 : -250,
            left: mob ? -150 : -130,
            pointerEvents: 'none'
          }}
        />

        <div
          style={{
            position: 'absolute',
            width: mob ? 180 : 240,
            height: mob ? 180 : 240,
            borderRadius: '50%',
            border:
              '1px dashed rgba(62,207,142,0.12)',
            top: mob ? 130 : 150,
            right: mob ? -60 : 180,
            pointerEvents: 'none'
          }}
        />

        {/* Pequenos pontos */}

        <div
          style={{
            position: 'absolute',
            top: '28%',
            left: mob ? '8%' : '6%',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#6382ff',
            opacity: 0.8
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: '18%',
            right: mob ? '8%' : '8%',
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: '#f5c542',
            opacity: 0.8
          }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: '17%',
            left: '48%',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#3ecf8e'
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: '48%',
            left: '3%',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#f06a6a'
          }}
        />

        {/* Conteúdo */}

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            maxWidth: 1320,
            margin: '0 auto',
            padding: mob
              ? '115px 18px 70px'
              : tablet
                ? '125px 30px 75px'
                : compact
                  ? '130px 36px 80px'
                  : '130px 48px 85px'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mob
                ? '1fr'
                : tablet
                  ? '0.95fr 1.05fr'
                  : 'minmax(0, 0.88fr) minmax(0, 1.12fr)',
              alignItems: 'center',
              gap: mob
                ? 45
                : tablet
                  ? 25
                  : large
                    ? 55
                    : 30
            }}
          >
            {/* Texto */}

            <Reveal>
              <div
                style={{
                  width: '100%',
                  maxWidth: 610,
                  textAlign: mob ? 'center' : 'left',
                  margin: mob ? '0 auto' : 0
                }}
              >
                <h1
                  style={{
                    fontSize: mob
                      ? 'clamp(40px, 11vw, 62px)'
                      : tablet
                        ? 'clamp(48px, 6vw, 68px)'
                        : 'clamp(58px, 6vw, 86px)',
                    fontWeight: 900,
                    letterSpacing: '-0.055em',
                    lineHeight: 0.98,
                    color: '#f5f4ff',
                    marginBottom: mob ? 21 : 26
                  }}
                >
                  Seus estudos,
                  <br />
                  <span
                    style={{
                      color: '#6382ff'
                    }}
                  >
                    do seu jeito.
                  </span>
                </h1>

                <p
                  style={{
                    width: '100%',
                    maxWidth: 535,
                    margin: mob
                      ? '0 auto 30px'
                      : '0 0 34px',
                    fontSize: mob
                      ? 'clamp(15px, 3.8vw, 16px)'
                      : tablet
                        ? 16
                        : 18,
                    lineHeight: 1.7,
                    color:
                      'rgba(245,244,255,0.62)'
                  }}
                >
                  O Metapps transforma qualquer assunto
                  em uma trilha de aprendizado personalizada.
                  A inteligência artificial cria atividades
                  no seu nível e acompanha sua evolução.
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: mob
                      ? 'center'
                      : 'flex-start',
                    flexWrap: 'wrap',
                    gap: 12
                  }}
                >
                  <button
                    type="button"
                    onClick={goToRegister}
                    style={{
                      ...heroMainCta,
                      padding: mob
                        ? '14px 19px'
                        : '15px 22px',
                      fontSize: mob ? 13 : 14
                    }}
                  >
                    Começar agora
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      scrollTo('roadmap')
                    }
                    style={{
                      ...heroSecondaryCta,
                      padding: mob
                        ? '13px 17px'
                        : '14px 20px',
                      fontSize: mob ? 13 : 14
                    }}
                  >
                    Como funciona
                  </button>
                </div>
              </div>
            </Reveal>

            {/* Ilustração */}

            <Reveal
              delay={120}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minWidth: 0,
                width: '100%'
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: tablet ? 580 : 700,
                  display: 'flex',
                  justifyContent: 'center',
                  margin: '0 auto'
                }}
              >
                <StudyHeroIllustration mob={mob} />

                {/* Badge flutuante */}

                <div
                  style={{
                    position: 'absolute',
                    right: tablet ? '0%' : '1%',
                    bottom: tablet ? '7%' : '8%',
                    display:
                      mob || tablet
                        ? 'none'
                        : 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 15px',
                    borderRadius: 14,
                    background:
                      'rgba(245,244,255,0.96)',
                    boxShadow:
                      '0 18px 45px rgba(0,0,0,0.22)',
                    transform: 'rotate(3deg)'
                  }}
                >
                  <div
                    style={{
                      width: 31,
                      height: 31,
                      borderRadius: 9,
                      background:
                        'rgba(62,207,142,0.14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <span
                      style={{
                        color: '#3ecf8e',
                        fontWeight: 900
                      }}
                    >
                      ✓
                    </span>
                  </div>

                  <div>
                    <div
                      style={{
                        color: '#1a1a2e',
                        fontSize: 11,
                        fontWeight: 800
                      }}
                    >
                      Progresso
                    </div>

                    <div
                      style={{
                        color: '#6b6b8a',
                        fontSize: 10
                      }}
                    >
                      Trilha atualizada
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Wave inferior */}

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -1,
            lineHeight: 0,
            zIndex: 3
          }}
        >
          <svg
            viewBox="0 0 1440 90"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              width: '100%',
              height: mob ? 55 : 90,
              display: 'block'
            }}
            preserveAspectRatio="none"
          >
            <path
              d="M0 50 C260 5 430 80 710 45 C1010 8 1180 75 1440 30 L1440 90 L0 90 Z"
              fill="#f5f4ff"
            />
          </svg>
        </div>
      </section>

      {/* ===================================================
          ROADMAP PERSONALIZADO
          =================================================== */}

      <section
        id="roadmap"
        style={{
          position: 'relative',
          background: '#f5f4ff',
          padding: mob
            ? '75px 18px'
            : tablet
              ? '95px 30px'
              : compact
                ? '110px 36px'
                : '125px 42px'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1180,
            margin: '0 auto'
          }}
        >
          <Reveal>
            <div
              style={{
                textAlign: 'center',
                maxWidth: 760,
                margin: '0 auto 55px'
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#6382ff',
                  marginBottom: 14
                }}
              >
                Roadmap personalizado
              </p>

              <h2
                style={{
                  fontSize: mob
                    ? 'clamp(32px, 9vw, 40px)'
                    : tablet
                      ? 42
                      : 'clamp(42px, 5vw, 62px)',
                  fontWeight: 900,
                  letterSpacing: '-0.05em',
                  lineHeight: 1,
                  color: '#1a1a2e',
                  marginBottom: 22
                }}
              >
                Um caminho criado
                <br />
                <span
                  style={{
                    color: '#6382ff'
                  }}
                >
                  para você aprender.
                </span>
              </h2>

              <p
                style={{
                  fontSize: mob ? 15 : 16,
                  color: '#6b6b8a',
                  lineHeight: 1.75,
                  maxWidth: 680,
                  margin: '0 auto'
                }}
              >
                Em vez de seguir um conteúdo pronto, você
                define o que quer aprender e a inteligência
                artificial transforma esse objetivo em um
                <strong style={{ color: '#1a1a2e' }}>
                  {' '}roadmap completo e personalizado.
                </strong>
              </p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: mob
                  ? '1fr'
                  : tablet
                    ? '0.9fr 1.1fr'
                    : '1fr 1fr',
                alignItems: 'center',
                gap: mob
                  ? 38
                  : tablet
                    ? 45
                    : large
                      ? 95
                      : 80
              }}
            >
              {/* Texto */}

              <div
                style={{
                  minWidth: 0
                }}
              >
                <p
                  style={{
                    fontSize: mob ? 15 : 16,
                    color: '#6b6b8a',
                    lineHeight: 1.85,
                    marginBottom: 24
                  }}
                >
                  Você escolhe o assunto, o objetivo e o
                  nível que deseja alcançar. A partir disso,
                  a IA organiza uma sequência lógica de
                  <strong style={{ color: '#1a1a2e' }}>
                    {' '}tópicos e subtópicos
                  </strong>
                  {' '}que fazem sentido para a sua jornada.
                </p>

                <p
                  style={{
                    fontSize: mob ? 15 : 16,
                    color: '#6b6b8a',
                    lineHeight: 1.85
                  }}
                >
                  Assim, cada etapa prepara você para a
                  próxima. O roadmap não é apenas uma lista
                  de conteúdos, mas uma estrutura pensada
                  para tornar o aprendizado mais claro,
                  organizado e eficiente.
                </p>
              </div>

              {/* Visual do roadmap */}

              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  minWidth: 0,
                  background: '#ffffff',
                  borderRadius: mob ? 22 : 26,
                  padding: mob
                    ? 19
                    : tablet
                      ? 24
                      : 30,
                  border:
                    '1px solid rgba(99,130,255,0.10)',
                  boxShadow:
                    '0 20px 55px rgba(26,26,46,0.08)',
                  transform: mob || tablet
                    ? 'none'
                    : 'rotate(1deg)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 25
                  }}
                >
                  <div
                    style={{
                      minWidth: 0
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: '#6382ff',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        marginBottom: 5
                      }}
                    >
                      Meu roadmap
                    </div>

                    <div
                      style={{
                        fontSize: mob
                          ? 17
                          : tablet
                            ? 18
                            : 20,
                        fontWeight: 900,
                        color: '#1a1a2e',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.2
                      }}
                    >
                      Desenvolvimento Web
                    </div>
                  </div>

                  <div
                    style={{
                      width: mob ? 38 : 42,
                      height: mob ? 38 : 42,
                      borderRadius: 13,
                      background: '#1a1a2e',
                      color: '#f5f4ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      flexShrink: 0
                    }}
                  >
                    ↗
                  </div>
                </div>

                {[
                  {
                    title: 'Fundamentos',
                    items: [
                      'HTML e estrutura',
                      'CSS e estilização',
                      'JavaScript básico'
                    ],
                    color: '#6382ff'
                  },
                  {
                    title: 'Frontend',
                    items: [
                      'React',
                      'Componentes',
                      'Estado e eventos'
                    ],
                    color: '#3ecf8e'
                  },
                  {
                    title: 'Projetos',
                    items: [
                      'APIs',
                      'Aplicações completas',
                      'Projeto final'
                    ],
                    color: '#f5c542'
                  }
                ].map((topic, index) => (
                  <div
                    key={topic.title}
                    style={{
                      display: 'flex',
                      gap: mob ? 11 : 15,
                      marginBottom:
                        index === 2 ? 0 : 18,
                      minWidth: 0
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flexShrink: 0
                      }}
                    >
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: topic.color,
                          boxShadow:
                            `0 0 0 5px ${topic.color}15`,
                          flexShrink: 0,
                          marginTop: 3
                        }}
                      />

                      {index !== 2 && (
                        <div
                          style={{
                            width: 2,
                            flex: 1,
                            minHeight: 42,
                            marginTop: 5,
                            background:
                              'rgba(99,130,255,0.12)'
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        paddingBottom:
                          index === 2 ? 0 : 2,
                        minWidth: 0
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 850,
                          color: '#1a1a2e',
                          marginBottom: 7
                        }}
                      >
                        {topic.title}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 7
                        }}
                      >
                        {topic.items.map(item => (
                          <span
                            key={item}
                            style={{
                              padding: '6px 9px',
                              borderRadius: 8,
                              background:
                                `${topic.color}10`,
                              color: '#6b6b8a',
                              fontSize: mob ? 10 : 11,
                              fontWeight: 650
                            }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================================================
          WAVE
          =================================================== */}

      <div
        style={{
          background: '#f5f4ff',
          lineHeight: 0
        }}
      >
        <svg
          viewBox="0 0 1440 100"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: '100%',
            height: mob ? 60 : 100,
            display: 'block'
          }}
          preserveAspectRatio="none"
        >
          <path
            d="M0 60 C300 10 430 90 720 48 C1000 8 1200 80 1440 35 L1440 100 L0 100 Z"
            fill="#1a1a2e"
          />
        </svg>
      </div>

      {/* ===================================================
          ADAPTAÇÃO INTELIGENTE
          =================================================== */}

      <section
        id="aprendizado"
        style={{
          position: 'relative',
          background: '#1a1a2e',
          padding: mob
            ? '78px 18px'
            : tablet
              ? '100px 30px'
              : compact
                ? '120px 36px'
                : '135px 42px'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1180,
            margin: '0 auto'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mob
                ? '1fr'
                : tablet
                  ? '1fr 1fr'
                  : '0.9fr 1.1fr',
              alignItems: 'center',
              gap: mob
                ? 48
                : tablet
                  ? 45
                  : large
                    ? 110
                    : 100
            }}
          >
            {/* Texto */}

            <Reveal>
              <div
                style={{
                  minWidth: 0
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: '#9ab4ff',
                    marginBottom: 14
                  }}
                >
                  Roadmap adaptativo
                </p>

                <h2
                  style={{
                    fontSize: mob
                      ? 'clamp(34px, 9vw, 42px)'
                      : tablet
                        ? 42
                        : 'clamp(42px, 4.5vw, 58px)',
                    fontWeight: 900,
                    letterSpacing: '-0.05em',
                    lineHeight: 1.02,
                    color: '#f5f4ff',
                    marginBottom: 22
                  }}
                >
                  O roadmap aprende
                  <br />
                  <span
                    style={{
                      color: '#6382ff'
                    }}
                  >
                    com você.
                  </span>
                </h2>

                <p
                  style={{
                    fontSize: mob ? 15 : 16,
                    color:
                      'rgba(245,244,255,0.58)',
                    lineHeight: 1.8,
                    marginBottom: 34,
                    maxWidth: 500
                  }}
                >
                  Conforme você avança, o Metapps observa
                  seu desempenho e pode ajustar a jornada.
                  Tópicos podem ganhar novas etapas,
                  atividades podem mudar de dificuldade e
                  o roadmap acompanha a sua evolução.
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20
                  }}
                >
                  {[
                    {
                      label:
                        'Roadmap baseado no seu objetivo',
                      desc:
                        'A jornada começa a partir do que você quer alcançar.',
                      color: '#6382ff'
                    },
                    {
                      label:
                        'Tópicos e subtópicos ajustados',
                      desc:
                        'A estrutura pode acompanhar seu nível e seu progresso.',
                      color: '#3ecf8e'
                    },
                    {
                      label:
                        'Evolução guiada pelo desempenho',
                      desc:
                        'Seus resultados ajudam a definir os próximos passos.',
                      color: '#f5c542'
                    }
                  ].map(
                    ({
                      label,
                      desc,
                      color
                    }) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          alignItems:
                            'flex-start',
                          gap: 13
                        }}
                      >
                        <div
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            background: color,
                            marginTop: 6,
                            flexShrink: 0,
                            boxShadow:
                              `0 0 0 5px ${color}12`
                          }}
                        />

                        <div
                          style={{
                            minWidth: 0
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: '#f5f4ff',
                              marginBottom: 3
                            }}
                          >
                            {label}
                          </div>

                          <div
                            style={{
                              fontSize: 13,
                              color:
                                'rgba(245,244,255,0.42)',
                              lineHeight: 1.5
                            }}
                          >
                            {desc}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </Reveal>

            {/* Preview */}

            <Reveal delay={100}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  minWidth: 0
                }}
              >
                {/* órbita decorativa */}

                <div
                  style={{
                    position: 'absolute',
                    width: '90%',
                    height: '90%',
                    border:
                      '1px dashed rgba(154,180,255,0.15)',
                    borderRadius: '50%',
                    left: '5%',
                    top: '5%',
                    transform:
                      'rotate(-12deg)',
                    pointerEvents: 'none'
                  }}
                />

                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    minWidth: 0,
                    background: '#f5f4ff',
                    borderRadius: mob ? 22 : 28,
                    padding: mob
                      ? 18
                      : tablet
                        ? 22
                        : 28,
                    boxShadow:
                      '0 30px 80px rgba(0,0,0,0.28)',
                    transform:
                      mob || tablet
                        ? 'none'
                        : 'rotate(1.5deg)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 22
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#6382ff',
                          letterSpacing:
                            '0.08em',
                          textTransform:
                            'uppercase',
                          marginBottom: 5
                        }}
                      >
                        Minha trilha
                      </div>

                      <div
                        style={{
                          fontSize: mob
                            ? 17
                            : tablet
                              ? 18
                              : 20,
                          fontWeight: 900,
                          color: '#1a1a2e',
                          letterSpacing:
                            '-0.03em',
                          lineHeight: 1.2
                        }}
                      >
                        Aprendizado atual
                      </div>
                    </div>

                    <div
                      style={{
                        width: mob ? 39 : 43,
                        height: mob ? 39 : 43,
                        borderRadius: 14,
                        background:
                          '#1a1a2e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent:
                          'center',
                        color: '#f5f4ff',
                        fontWeight: 900,
                        flexShrink: 0
                      }}
                    >
                      ↗
                    </div>
                  </div>

                  {/* Barra geral */}

                  <div
                    style={{
                      padding: mob ? 13 : 16,
                      borderRadius: 17,
                      background: '#ffffff',
                      border:
                        '1px solid rgba(99,130,255,0.09)',
                      marginBottom: 12
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent:
                          'space-between',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 10
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#1a1a2e'
                        }}
                      >
                        Progresso da trilha
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: '#6382ff'
                        }}
                      >
                        68%
                      </span>
                    </div>

                    <div
                      style={{
                        height: 7,
                        borderRadius: 99,
                        background:
                          'rgba(99,130,255,0.10)',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: '68%',
                          height: '100%',
                          borderRadius: 99,
                          background:
                            '#6382ff'
                        }}
                      />
                    </div>
                  </div>

                  {/* Atividades */}

                  {[
                    {
                      subject:
                        'Matemática',
                      desc:
                        'Equações do 2º grau',
                      pct: 80,
                      color: '#6382ff'
                    },
                    {
                      subject:
                        'Inglês',
                      desc:
                        'Past perfect tense',
                      pct: 45,
                      color: '#f5c542'
                    },
                    {
                      subject:
                        'Programação',
                      desc:
                        'Busca binária',
                      pct: 100,
                      color: '#3ecf8e'
                    }
                  ].map(
                    ({
                      subject,
                      desc,
                      pct,
                      color
                    }) => (
                      <div
                        key={subject}
                        style={{
                          padding:
                            mob
                              ? '13px 13px'
                              : '15px 16px',
                          borderRadius: 17,
                          background:
                            '#ffffff',
                          border:
                            '1px solid rgba(99,130,255,0.09)',
                          marginBottom: 10
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent:
                              'space-between',
                            gap: 10,
                            marginBottom: 6
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color
                            }}
                          >
                            {subject}
                          </span>

                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color:
                                pct === 100
                                  ? '#3ecf8e'
                                  : '#6b6b8a',
                              flexShrink: 0
                            }}
                          >
                            {pct}%
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#1a1a2e',
                            marginBottom: 9,
                            lineHeight: 1.4
                          }}
                        >
                          {desc}
                        </div>

                        <div
                          style={{
                            height: 4,
                            background:
                              'rgba(26,26,46,0.07)',
                            borderRadius: 99,
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: color,
                              borderRadius: 99
                            }}
                          />
                        </div>
                      </div>
                    )
                  )}

                  {/* Badge IA */}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent:
                        'space-between',
                      gap: 10,
                      marginTop: 17,
                      paddingTop: 17,
                      borderTop:
                        '1px solid rgba(26,26,46,0.08)'
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: '#6b6b8a'
                      }}
                    >
                      Próxima atividade gerada
                    </span>

                    <span
                      style={{
                        padding:
                          '5px 9px',
                        borderRadius: 99,
                        background:
                          'rgba(62,207,142,0.12)',
                        color: '#2aa86f',
                        fontSize: 10,
                        fontWeight: 800,
                        flexShrink: 0
                      }}
                    >
                      IA ATIVA
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===================================================
          WAVE
          =================================================== */}

      <div
        style={{
          background: '#1a1a2e',
          lineHeight: 0
        }}
      >
        <svg
          viewBox="0 0 1440 100"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: '100%',
            height: mob ? 60 : 100,
            display: 'block'
          }}
          preserveAspectRatio="none"
        >
          <path
            d="M0 45 C260 90 500 5 740 52 C990 100 1190 15 1440 55 L1440 100 L0 100 Z"
            fill="#eeeeff"
          />
        </svg>
      </div>

      {/* ===================================================
          CTA FINAL
          =================================================== */}

      <section
        style={{
          position: 'relative',
          background: '#eeeeff',
          padding: mob
            ? '25px 18px 75px'
            : tablet
              ? '35px 30px 95px'
              : compact
                ? '40px 36px 110px'
                : '40px 42px 125px'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1180,
            margin: '0 auto'
          }}
        >
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              borderRadius: mob ? 23 : 34,
              background: '#1a1a2e',
              padding: mob
                ? '55px 20px'
                : tablet
                  ? '70px 35px'
                  : '85px 50px',
              textAlign: 'center'
            }}
          >
            {/* Decoração */}

            <div
              style={{
                position: 'absolute',
                width: mob ? 250 : 330,
                height: mob ? 250 : 330,
                borderRadius: '50%',
                border:
                  '1px dashed rgba(154,180,255,0.16)',
                left: mob ? -140 : -160,
                bottom: mob ? -140 : -170
              }}
            />

            <div
              style={{
                position: 'absolute',
                width: mob ? 210 : 260,
                height: mob ? 210 : 260,
                borderRadius: '50%',
                border:
                  '1px dashed rgba(62,207,142,0.13)',
                right: mob ? -110 : -110,
                top: mob ? -110 : -140
              }}
            />

            <div
              style={{
                position: 'absolute',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#f5c542',
                right: '18%',
                top: '25%'
              }}
            />

            <div
              style={{
                position: 'absolute',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#3ecf8e',
                left: '19%',
                bottom: '27%'
              }}
            />

            <Reveal>
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  width: '100%'
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.16em',
                    textTransform:
                      'uppercase',
                    color: '#9ab4ff',
                    marginBottom: 14
                  }}
                >
                  Sua próxima etapa
                </p>

                <h2
                  style={{
                    fontSize: mob
                      ? 'clamp(32px, 9vw, 42px)'
                      : tablet
                        ? 45
                        : 'clamp(45px, 5vw, 64px)',
                    fontWeight: 900,
                    letterSpacing: '-0.05em',
                    lineHeight: 1,
                    color: '#f5f4ff',
                    marginBottom: 19
                  }}
                >
                  Pronto para começar?
                </h2>

                <p
                  style={{
                    maxWidth: 560,
                    margin: '0 auto 30px',
                    fontSize: mob ? 14 : 15,
                    color:
                      'rgba(245,244,255,0.5)',
                    lineHeight: 1.75
                  }}
                >
                  Crie sua conta e descubra uma nova
                  forma de estudar, com uma trilha
                  construída para acompanhar você.
                </p>

                <button
                  type="button"
                  onClick={goToRegister}
                  style={{
                    ...finalCta,
                    padding: mob
                      ? '14px 20px'
                      : '15px 24px',
                    fontSize: mob ? 13 : 14
                  }}
                >
                  Começar agora
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===================================================
          FOOTER
          =================================================== */}

      <footer
        id="contato"
        style={{
          background: '#13152a',
          padding: mob
            ? '50px 18px 25px'
            : tablet
              ? '60px 30px 28px'
              : '65px 42px 30px',
          borderTop:
            '1px solid rgba(255,255,255,0.05)'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1180,
            margin: '0 auto'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mob
                ? '1fr'
                : tablet
                  ? '1fr 1fr'
                  : '2fr 1fr 1fr 1fr',
              gap: mob
                ? 35
                : tablet
                  ? 40
                  : 60,
              marginBottom: 50
            }}
          >
            {/* Marca */}

            <div
              style={{
                minWidth: 0
              }}
            >
              <img
                src={logoImg}
                alt="Metapps"
                style={{
                  width: 125,
                  maxWidth: '70vw',
                  height: 'auto',
                  marginBottom: 16,
                  opacity: 0.7,
                  filter:
                    'brightness(0) invert(1)'
                }}
                onError={e => {
                  e.currentTarget.style.display =
                    'none'
                }}
              />

              <p
                style={{
                  fontSize: 13,
                  color:
                    'rgba(245,244,255,0.38)',
                  lineHeight: 1.7,
                  maxWidth: 260
                }}
              >
                Aprendizado personalizado com
                inteligência artificial.
              </p>
            </div>

            {/* Produto */}

            <div
              style={{
                minWidth: 0
              }}
            >
              <div style={footerTitle}>
                Produto
              </div>

              <div style={footerLinks}>
                <span
                  onClick={() =>
                    scrollTo('roadmap')
                  }
                  style={footerLink}
                >
                  Roadmap
                </span>

                <span
                  onClick={() =>
                    scrollTo('aprendizado')
                  }
                  style={footerLink}
                >
                  Aprendizado
                </span>

                <span
                  onClick={goToRegister}
                  style={footerLink}
                >
                  Criar conta
                </span>

                <span
                  onClick={goToLogin}
                  style={footerLink}
                >
                  Entrar
                </span>
              </div>
            </div>

            {/* Suporte */}

            <div
              style={{
                minWidth: 0
              }}
            >
              <div style={footerTitle}>
                Suporte
              </div>

              <div style={footerLinks}>
                <span
                  onClick={goToSupport}
                  style={footerLink}
                >
                  Fale conosco
                </span>

                <span
                  onClick={goToSupport}
                  style={{
                    ...footerLink,
                    overflowWrap: 'anywhere'
                  }}
                >
                  belugaforever2022@gmail.com
                </span>
              </div>
            </div>

            {/* Legal */}

            <div
              style={{
                minWidth: 0
              }}
            >
              <div style={footerTitle}>
                Legal
              </div>

              <div style={footerLinks}>
                <span
                  onClick={openTerms}
                  style={footerLink}
                >
                  Termos de uso
                </span>

                <span
                  onClick={openPrivacy}
                  style={footerLink}
                >
                  Privacidade
                </span>
              </div>
            </div>
          </div>

          {/* Bottom */}

          <div
            style={{
              borderTop:
                '1px solid rgba(255,255,255,0.06)',
              paddingTop: 22,
              display: 'flex',
              justifyContent:
                mob
                  ? 'center'
                  : 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              textAlign: mob
                ? 'center'
                : 'left'
            }}
          >
            <span
              style={{
                fontSize: 11,
                color:
                  'rgba(245,244,255,0.22)'
              }}
            >
              © 2026 Metapps — Projeto acadêmico
              (TCC)
            </span>

            <span
              style={{
                fontSize: 11,
                color:
                  'rgba(245,244,255,0.22)'
              }}
            >
              Todos os direitos reservados
            </span>
          </div>
        </div>
      </footer>

      {/* ===================================================
          MODAL DE LOGIN / REGISTRO / ESQUECI A SENHA
          =================================================== */}

      <AuthModal
        mode={authMode}
        onClose={closeAuth}
        onSwitchMode={setAuthMode}
        onLoginSuccess={() => navigate('/home')}
      />

      {/* ===================================================
          CSS GLOBAL
          =================================================== */}

      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html {
          scroll-behavior: smooth;
          overflow-x: hidden;
          width: 100%;
        }

        body {
          overflow-x: hidden;
          overflow-y: auto;
          background: #f5f4ff;
          width: 100%;
          max-width: 100%;
        }

        #root {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        img,
        svg {
          max-width: 100%;
        }

        button {
          font-family: 'Inter', -apple-system, sans-serif;
        }

        button:hover {
          opacity: 0.9;
        }

        button:active {
          transform: scale(0.97);
        }

        ::selection {
          background: #6382ff;
          color: #f5f4ff;
        }

        @media (max-width: 767px) {
          button {
            -webkit-tap-highlight-color: transparent;
          }

          html {
            font-size: 16px;
          }
        }

        @media (min-width: 768px) and (max-width: 1099px) {
          section {
            scroll-margin-top: 20px;
          }
        }

        @media (min-width: 1100px) {
          section {
            scroll-margin-top: 30px;
          }
        }

        @media (max-height: 700px) and (min-width: 768px) {
          #inicio > div:nth-last-child(1) {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}

/* =========================================================
   ESTILOS
   ========================================================= */

const heroNavLink = {
  padding: '9px 15px',
  borderRadius: 9,
  border: 'none',
  background: 'transparent',
  color: 'rgba(245,244,255,0.72)',
  fontSize: 13,
  fontWeight: 650,
  cursor: 'pointer',
  transition:
    'background 0.2s ease, color 0.2s ease',
  whiteSpace: 'nowrap'
}

const heroSignIn = {
  padding: '10px 15px',
  borderRadius: 9,
  border: 'none',
  background: 'transparent',
  color: '#f5f4ff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
}

const heroNavCta = {
  padding: '11px 20px',
  borderRadius: 9,
  border: 'none',
  background: '#f5f4ff',
  color: '#1a1a2e',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  boxShadow:
    '0 8px 25px rgba(0,0,0,0.14)'
}

const heroMainCta = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '15px 22px',
  borderRadius: 11,
  border: 'none',
  background: '#6382ff',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 800,
  cursor: 'pointer',
  transition:
    'transform 0.2s ease',
  whiteSpace: 'nowrap'
}

const heroSecondaryCta = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '14px 20px',
  borderRadius: 11,
  border:
    '1px solid rgba(245,244,255,0.16)',
  background:
    'rgba(245,244,255,0.04)',
  color: '#f5f4ff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
}

const finalCta = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '15px 24px',
  borderRadius: 11,
  border: 'none',
  background: '#f06a6a',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
}

const footerTitle = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(245,244,255,0.25)',
  marginBottom: 17
}

const footerLinks = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12
}

const footerLink = {
  fontSize: 13,
  color: 'rgba(245,244,255,0.46)',
  cursor: 'pointer',
  transition: 'color 0.15s',
  userSelect: 'none',
  lineHeight: 1.45
}