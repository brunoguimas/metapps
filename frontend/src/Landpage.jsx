import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import icon from './assets/icon.svg'
import logoImg from './assets/icon.svg'

function useReveal(threshold = 0.12) {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setOn(true); obs.disconnect() } },
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
    <div ref={ref} style={{
      opacity: on ? 1 : 0,
      transform: on ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      ...custom
    }}>
      {children}
    </div>
  )
}

function AnimatedLogo() {
  const [hover, setHover] = useState(false)
  const [wobble, setWobble] = useState(false)

  function handleEnter() {
    setHover(true)
    setWobble(true)
    setTimeout(() => setWobble(false), 600)
  }

  return (
    <div
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-block',
        cursor: 'pointer',
        transform: wobble
          ? 'rotate(-8deg) scale(1.08)'
          : hover
          ? 'rotate(4deg) scale(1.04)'
          : 'rotate(0deg) scale(1)',
        transition: wobble
          ? 'transform 0.15s cubic-bezier(0.34,1.8,0.64,1)'
          : 'transform 0.4s cubic-bezier(0.34,1.4,0.64,1)',
        filter: hover
          ? 'drop-shadow(0 12px 32px rgba(99,130,255,0.25))'
          : 'drop-shadow(0 6px 16px rgba(0,0,0,0.1))',
      }}
    >
      <img
        src={logoImg}
        alt="Metapps"
        style={{ width: 'min(280px, 60vw)', height: 'auto', display: 'block' }}
        onError={e => e.target.style.display = 'none'}
      />
    </div>
  )
}

export default function Landpage() {
  const navigate = useNavigate()
  const [mob, setMob] = useState(window.innerWidth < 768)

  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.body.style.height = 'auto'
    document.title = 'Metapps'
    const favicon = document.querySelector("link[rel*='icon']")
    if (favicon) favicon.href = icon
    else { const l = document.createElement('link'); l.rel = 'icon'; l.href = icon; document.head.appendChild(l) }
    return () => { document.body.style.overflow = ''; document.body.style.height = '' }
  }, [])

  useEffect(() => {
    const onResize = () => setMob(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const goToRegister = () => navigate('/auth/register')
  const goToLogin = () => navigate('/auth/login')
  const goToHome = () => navigate('/')
  const goToSupport = () => window.location.href = 'mailto:metapps@gmail.com'
  const openTerms = () => window.open('/src/pages/Termos.html', '_blank')
  const openPrivacy = () => window.open('/src/pages/Termos.html#privacidade', '_blank')

  return (
    <div style={{ width: '100%', fontFamily: "'Inter',-apple-system,sans-serif", WebkitFontSmoothing: 'antialiased', background: '#f5f4ff', color: '#1a1a2e', overflowX: 'hidden' }}>

      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(245,244,255,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(99,130,255,0.1)'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 28px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img 
            src={icon} 
            alt="Metapps" 
            style={{ height: 28, width: 'auto', cursor: 'pointer' }} 
            onClick={goToHome} 
            onError={e => e.target.style.display = 'none'} 
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={goToSupport} style={navLink} type="button">Suporte</button>
            <button onClick={goToLogin} style={navLink} type="button">Entrar</button>
            <button onClick={goToRegister} style={navCta} type="button">Começar</button>
          </div>
        </div>
      </nav>

      <section style={{ paddingTop: mob ? 72 : 100, paddingBottom: mob ? 60 : 80, background: '#f5f4ff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ display: 'flex', flexDirection: mob ? 'column' : 'row', alignItems: 'center', gap: mob ? 48 : 80 }}>
            <div style={{ flex: 1, textAlign: mob ? 'center' : 'left' }}>
              <h1 style={{
                fontSize: mob ? 'clamp(36px,10vw,52px)' : 'clamp(44px,6vw,64px)',
                fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05,
                marginBottom: 20, color: '#1a1a2e'
              }}>
                Seus estudos,{' '}
                <span style={{ color: '#6382ff' }}>do seu jeito.</span>
              </h1>
              <p style={{ fontSize: mob ? 16 : 19, color: '#6b6b8a', lineHeight: 1.7, marginBottom: 36, maxWidth: 460 }}>
                O Metapps cria atividades personalizadas usando inteligência artificial — no seu ritmo, no seu nível, em qualquer assunto.
              </p>
              <button onClick={goToRegister} style={btnExperiment} type="button">
                Experimente o Metapps
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <AnimatedLogo />
            </div>
          </div>
        </div>
      </section>

      <div style={{ background: '#f5f4ff', lineHeight: 0 }}>
        <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#1a1a2e" />
        </svg>
      </div>

      <section style={{ background: '#1a1a2e', padding: mob ? '70px 16px' : '100px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#9ab4ff', marginBottom: 12, textAlign: 'center' }}>Como funciona</p>
            <h2 style={{ fontSize: mob ? 32 : 48, fontWeight: 900, letterSpacing: '-0.03em', color: '#f5f4ff', textAlign: 'center', marginBottom: 60 }}>Três passos simples.</h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr 1fr', gap: 24 }}>
            {[
              { num: '01', title: 'Escolha o tema', desc: 'Diga o que quer aprender — qualquer matéria, do básico ao avançado.', color: '#6382ff' },
              { num: '02', title: 'A IA gera a tarefa', desc: 'Roadmaps únicos criados em segundos, adaptados para você.', color: '#3ecf8e' },
              { num: '03', title: 'Pratique e evolua', desc: 'Complete, receba feedback e acompanhe seu progresso em tempo real.', color: '#f5c542' },
            ].map(({ num, title, desc, color }, i) => (
              <Reveal key={num} delay={i * 80}>
                <div
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = '' }}
                  style={{ padding: 28, borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', height: '100%', transition: 'all 0.2s' }}>
                  <div style={{ fontSize: 40, fontWeight: 900, color, marginBottom: 16, letterSpacing: '-0.04em', opacity: 0.6 }}>{num}</div>
                  <h3 style={{ fontSize: 19, fontWeight: 800, color: '#f5f4ff', marginBottom: 10 }}>{title}</h3>
                  <p style={{ fontSize: 15, color: 'rgba(245,244,255,0.55)', lineHeight: 1.7 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── WAVE invertida ── */}
      <div style={{ background: '#1a1a2e', lineHeight: 0 }}>
        <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
          <path d="M0,40 C360,0 1080,80 1440,40 L1440,80 L0,80 Z" fill="#f5f4ff" />
        </svg>
      </div>

      {/* ── PERSONALIZAÇÃO ── */}
      <section style={{ background: '#f5f4ff', padding: mob ? '70px 16px' : '100px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: mob ? 52 : 100, alignItems: 'center' }}>
            <Reveal>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6382ff', marginBottom: 12 }}>Adaptação inteligente</p>
                <h2 style={{ fontSize: mob ? 32 : 44, fontWeight: 900, letterSpacing: '-0.03em', color: '#1a1a2e', lineHeight: 1.1, marginBottom: 20 }}>A IA aprende<br />com você.</h2>
                <p style={{ fontSize: 16, color: '#6b6b8a', lineHeight: 1.75, marginBottom: 32 }}>
                  Quanto mais você pratica, mais precisa fica a geração de tarefas. O sistema ajusta a dificuldade automaticamente com base no seu desempenho real.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'Questionário inicial', desc: 'Calibre a IA com seu nível e interesses.', color: '#6382ff' },
                    { label: 'Geração sob medida', desc: 'Exercícios únicos criados para o seu perfil.', color: '#3ecf8e' },
                    { label: 'Feedback imediato', desc: 'Correção detalhada após cada resposta.', color: '#f5c542' },
                  ].map(({ label, desc, color }) => (
                    <div key={label} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 7, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 14, color: '#6b6b8a', lineHeight: 1.6 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div style={{ background: '#1a1a2e', borderRadius: 20, padding: 28, boxShadow: '0 20px 60px rgba(26,26,46,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f5f4ff' }}>Suas atividades</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 99, background: 'rgba(99,130,255,0.15)', color: '#9ab4ff' }}>Hoje</span>
                </div>
                {[
                  { subject: 'Matemática', pct: 80, color: '#6382ff', desc: 'Equações do 2º grau' },
                  { subject: 'Inglês', pct: 45, color: '#f5c542', desc: 'Past perfect tense' },
                  { subject: 'Programação', pct: 100, color: '#3ecf8e', desc: 'Busca binária em Python', done: true },
                ].map(({ subject, pct, color, desc, done }) => (
                  <div key={subject} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{subject}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#3ecf8e' : 'rgba(245,244,255,0.4)' }}>{pct}%</span>
                    </div>
                    <div style={{ fontSize: 13, color: done ? 'rgba(245,244,255,0.35)' : '#f5f4ff', textDecoration: done ? 'line-through' : 'none', marginBottom: 8 }}>{desc}</div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── RECURSOS ── */}
      <section style={{ background: '#eeeeff', padding: mob ? '70px 16px' : '100px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Reveal>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6382ff', marginBottom: 12, textAlign: 'center' }}>Recursos</p>
            <h2 style={{ fontSize: mob ? 32 : 44, fontWeight: 900, letterSpacing: '-0.03em', color: '#1a1a2e', textAlign: 'center', marginBottom: 52 }}>Tudo que você precisa.</h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr 1fr', gap: 20 }}>
            {[
              { title: 'Assuntos ilimitados', desc: 'Matemática, inglês, programação, história — qualquer tema, sem restrições.', color: '#6382ff' },
              { title: 'Geração instantânea', desc: 'Cada atividade criada em segundos, única e personalizada para você.', color: '#3ecf8e' },
              { title: 'Feedback com IA', desc: 'Correções detalhadas e explicações geradas pela IA após cada resposta.', color: '#f5c542' },
              { title: 'Disponível 24/7', desc: 'Acesse de qualquer lugar, a qualquer hora, no celular ou computador.', color: '#f06a6a' },
              { title: 'Sem conteúdo fixo', desc: 'Nada de apostilas prontas. Tudo gerado na hora, sempre diferente.', color: '#6382ff' },
              { title: 'Progresso claro', desc: 'Acompanhe sua evolução com métricas e histórico de desempenho.', color: '#3ecf8e' },
            ].map(({ title, desc, color }, i) => (
              <Reveal key={i} delay={i * 40}>
                <div
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(26,26,46,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 16px rgba(26,26,46,0.06)' }}
                  style={{ padding: 26, borderRadius: 16, background: '#fff', border: '1.5px solid rgba(99,130,255,0.1)', height: '100%', boxShadow: '0 2px 16px rgba(26,26,46,0.06)', transition: 'all 0.2s' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e', marginBottom: 8 }}>{title}</h4>
                  <p style={{ fontSize: 14, color: '#6b6b8a', lineHeight: 1.7 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── WAVE antes do CTA ── */}
      <div style={{ background: '#eeeeff', lineHeight: 0 }}>
        <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
          <path d="M0,20 C480,80 960,0 1440,50 L1440,80 L0,80 Z" fill="#1a1a2e" />
        </svg>
      </div>

      {/* ── CTA FINAL ── */}
      <section style={{ background: '#1a1a2e', padding: mob ? '80px 16px 100px' : '100px 28px 140px', textAlign: 'center' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ fontSize: mob ? 36 : 52, fontWeight: 900, letterSpacing: '-0.03em', color: '#f5f4ff', lineHeight: 1.05, marginBottom: 18 }}>
              Pronto para começar?
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(245,244,255,0.5)', marginBottom: 36, lineHeight: 1.7 }}>
              Crie sua conta e descubra como a inteligência artificial pode transformar seus estudos.
            </p>
            <button onClick={goToRegister} style={btnCtaFinal} type="button">
              Começar
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#13152a', padding: '52px 28px 32px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '2fr 1fr 1fr 1fr', gap: mob ? 36 : 60, marginBottom: 44 }}>
            <div>
              <img src={logoImg} alt="Metapps" style={{ height: 28, width: 'auto', marginBottom: 14, opacity: 0.6 }} onError={e => e.target.style.display = 'none'} />
              <p style={{ fontSize: 13, color: 'rgba(245,244,255,0.4)', lineHeight: 1.7, maxWidth: 220 }}>
                Aprendizado personalizado com inteligência artificial.
              </p>
            </div>
            {[
              ['Produto', [
                ['Como funciona', null], 
                ['Criar conta', goToRegister], 
                ['Entrar', goToLogin]
              ]],
              ['Suporte', [
                ['metapps@gmail.com', goToSupport]
              ]],
              ['Legal', [
                ['Termos de uso', openTerms], 
                ['Privacidade', openPrivacy]
              ]],
            ].map(([t, links]) => (
              <div key={t}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(245,244,255,0.25)', marginBottom: 16 }}>{t}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {links.map(([label, fn]) => (
                    <span 
                      key={label}
                      onClick={fn || undefined}
                      onMouseEnter={e => fn && (e.currentTarget.style.color = '#f5f4ff')}
                      onMouseLeave={e => fn && (e.currentTarget.style.color = 'rgba(245,244,255,0.45)')}
                      style={{ 
                        fontSize: 14, 
                        color: 'rgba(245,244,255,0.45)', 
                        cursor: fn ? 'pointer' : 'default', 
                        transition: 'color 0.15s',
                        userSelect: 'none'
                      }}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 22, fontSize: 12, color: 'rgba(245,244,255,0.2)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span>© 2026 Metapps — Projeto acadêmico (TCC)</span>
            <span>Todos os direitos reservados</span>
          </div>
        </div>
      </footer>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: 'Inter', -apple-system, sans-serif; }
        html, body { overflow-x: hidden; background: #f5f4ff; }
        body { overflow-y: auto; }
        button { transition: opacity 0.15s, transform 0.15s; }
        button:hover { opacity: 0.85; }
        button:active { transform: scale(0.97); }
      `}</style>
    </div>
  )
}

const navLink = {
  padding: '8px 14px', borderRadius: 8, border: 'none',
  background: 'transparent', color: '#6b6b8a',
  fontSize: 14, fontWeight: 600, cursor: 'pointer'
}

const navCta = {
  padding: '8px 18px', borderRadius: 8,
  border: '1.5px solid rgba(99,130,255,0.3)',
  background: 'rgba(99,130,255,0.08)', color: '#6382ff',
  fontSize: 14, fontWeight: 700, cursor: 'pointer'
}

const btnExperiment = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '14px 32px', borderRadius: 12, border: 'none',
  background: '#1a1a2e', color: '#f5f4ff',
  fontSize: 16, fontWeight: 800, cursor: 'pointer',
  letterSpacing: '-0.01em'
}

const btnCtaFinal = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '13px 40px', borderRadius: 12,
  border: '2px solid rgba(245,244,255,0.2)',
  background: 'transparent', color: '#f5f4ff',
  fontSize: 16, fontWeight: 700, cursor: 'pointer'
}