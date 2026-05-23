import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import icon from './assets/icon.svg'
import logoImg from './assets/logo.svg'
import videoDemo from './assets/animacao.mp4'

/* ── Scroll reveal ── */
function useReveal(threshold = 0.15) {
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
      transform: on ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      ...custom
    }}>
      {children}
    </div>
  )
}

/* ── Passo a passo ── */
const StepLine = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, flexWrap: 'wrap', margin: '24px 0' }}>
    {['Escolha o tema', 'IA gera atividades', 'Pratique e evolua'].map((label, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: i === 0 ? '#4f7edd' : i === 1 ? '#5d6b8e' : '#27187e',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 18
        }}>{i + 1}</div>
        <span style={{ fontWeight: 600, color: '#f7f7ff', fontSize: 14 }}>{label}</span>
      </div>
    ))}
  </div>
)

export default function Landpage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mob, setMob] = useState(window.innerWidth < 768)

  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.body.style.height = 'auto'
    document.title = 'Metapps'
    const favicon = document.querySelector("link[rel*='icon']")
    if (favicon) favicon.href = icon
    else { const l = document.createElement('link'); l.rel='icon'; l.href=icon; document.head.appendChild(l) }
    return () => { document.body.style.overflow = ''; document.body.style.height = '' }
  }, [icon])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    const onResize = () => setMob(window.innerWidth < 768)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize) }
  }, [])

  return (
    <div style={{
      width: '100%', fontFamily: "'Inter',-apple-system,sans-serif",
      WebkitFontSmoothing: 'antialiased',
      background: '#14182b', color: '#f7f7ff', overflowX: 'hidden'
    }}>
      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        transform: scrolled ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.3s ease',
        background: 'rgba(20,24,43,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(168,166,200,0.06)'
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src={icon} alt="Metapps" style={{ height: 32, width: 'auto', cursor: 'pointer' }} onClick={() => navigate('/home')} onError={e => e.target.style.display = 'none'} />
          <button onClick={() => navigate('/auth/register')} style={btnPrimary}>Começar agora</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        ...sectionBase,
        background: 'linear-gradient(180deg, #14182b 0%, #212842 50%, #14182b 100%)',
        paddingTop: mob ? 120 : 150, paddingBottom: mob ? 40 : 60, position: 'relative'
      }}>
        <div style={container}>
          <div style={{ display: 'flex', flexDirection: mob ? 'column' : 'row', alignItems: 'center', gap: mob ? 40 : 80, textAlign: mob ? 'center' : 'left' }}>
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontSize: mob ? 'clamp(32px,10vw,52px)' : 'clamp(44px,8vw,72px)',
                fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 20, color: '#f7f7ff'
              }}>
                Seus estudos do seu jeito,{' '}
                <span style={{ background: 'linear-gradient(135deg, #4f7edd, #27187e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>com IA.</span>
              </h1>
              <p style={{ fontSize: mob ? 16 : 20, color: '#a8a6c8', lineHeight: 1.6, marginBottom: 28, maxWidth: mob ? 'auto' : 480 }}>
                O Metapps cria atividades personalizadas usando inteligência artificial — no seu ritmo, no seu nível, em qualquer assunto.
              </p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: mob ? 'center' : 'flex-start' }}>
                <button onClick={() => navigate('/auth/register')} style={{ ...btnPrimary, padding: '14px 32px', fontSize: 18 }}>Começar agora</button>
                <button onClick={() => navigate('/auth/login')} style={btnOutline}>Já tenho conta</button>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <img src={logoImg} alt="Metapps" style={{ width: '100%', maxWidth: 400, height: 'auto', filter: 'drop-shadow(0 20px 40px rgba(79,126,221,0.3))' }} onError={e => { e.target.style.display = 'none' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section style={{ ...sectionBase, background: '#212842' }}>
        <div style={container}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#4f7edd', marginBottom: 12 }}>Como funciona</div>
              <h2 style={{ fontSize: 'clamp(28px,5vw,40px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f7f7ff', lineHeight: 1.1, marginBottom: 16 }}>Três passos simples</h2>
              <StepLine />
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr 1fr', gap: 24 }}>
            {[
              { step: '01', title: 'Escolha o tema', desc: 'Diga para a IA o que quer aprender — qualquer assunto, do básico ao avançado.', color: '#4f7edd' },
              { step: '02', title: 'IA gera atividades', desc: 'Exercícios e desafios são criados em tempo real, adaptados ao seu nível.', color: '#5d6b8e' },
              { step: '03', title: 'Pratique e evolua', desc: 'Complete as tarefas, acompanhe seu progresso e mantenha suas conquistas diárias.', color: '#27187e' },
            ].map(({ step, title, desc, color }, i) => (
              <Reveal key={step} delay={i * 100}>
                <div style={{
                  padding: 28, borderRadius: 18, background: '#14182b', border: '1px solid rgba(168,166,200,0.12)',
                  boxShadow: '0 8px 24px rgba(33,40,66,0.3)', height: '100%', transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(33,40,66,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 24px rgba(33,40,66,0.3)' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color, marginBottom: 16 }}>{step}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#f7f7ff', marginBottom: 12 }}>{title}</h3>
                  <p style={{ fontSize: 15, color: '#a8a6c8', lineHeight: 1.6 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PERSONALIZAÇÃO INTELIGENTE ── */}
      <section style={{ ...sectionBase, background: '#14182b' }}>
        <div style={container}>
          <div style={{ display: 'flex', flexDirection: mob ? 'column' : 'row', gap: mob ? 40 : 80, alignItems: 'center' }}>
            <div style={{ flex: 1, textAlign: mob ? 'center' : 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#4f7edd', marginBottom: 12 }}>Personalização inteligente</div>
              <h2 style={{ fontSize: 'clamp(28px,5vw,40px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f7f7ff', lineHeight: 1.1, marginBottom: 20 }}>A IA conhece você</h2>
              <p style={{ fontSize: 16, color: '#a8a6c8', lineHeight: 1.7, marginBottom: 32 }}>Adaptação contínua baseada no seu desempenho real — quanto mais você pratica, mais precisa se torna a geração de tarefas.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {[
                  { title: 'Questionário inicial', desc: 'Responda algumas perguntas sobre seus interesses e nível atual para calibrar a IA.', color: '#27187e' },
                  { title: 'Geração sob medida', desc: 'Exercícios únicos criados com base no seu perfil, ajustando dificuldade automaticamente.', color: '#4f7edd' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 16, background: '#212842', borderRadius: 12, border: '1px solid rgba(168,166,200,0.12)', textAlign: 'left' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, marginTop: 6, flexShrink: 0 }} />
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 700, color: '#f7f7ff', marginBottom: 6 }}>{item.title}</h4>
                      <p style={{ fontSize: 14, color: '#a8a6c8', lineHeight: 1.6 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: '#212842', borderRadius: 18, padding: 24, border: '1px solid rgba(168,166,200,0.12)', boxShadow: '0 12px 32px rgba(33,40,66,0.4)', width: '100%', maxWidth: 380 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <span style={{ fontWeight: 700, color: '#f7f7ff' }}>Suas atividades</span>
                  <span style={{ fontSize: 12, color: '#a8a6c8', background: '#14182b', padding: '4px 12px', borderRadius: 99 }}>Hoje</span>
                </div>
                {[
                  { subject: 'Matemática', pct: 80, color: '#4f7edd', desc: 'Equações do 2º grau' },
                  { subject: 'Inglês', pct: 45, color: '#5d6b8e', desc: 'Past perfect tense' },
                  { subject: 'Programação', pct: 100, color: '#27187e', desc: 'Busca binária em Python', done: true },
                ].map(({ subject, pct, color, desc, done }) => (
                  <div key={subject} style={{ background: '#14182b', borderRadius: 10, padding: 12, marginBottom: 10, border: '1px solid rgba(168,166,200,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{subject}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: pct === 100 ? '#6aaf6a' : '#c4a44a' }}>{pct}%</span>
                    </div>
                    <div style={{ fontSize: 13, color: done ? '#a8a6c8' : '#f7f7ff', textDecoration: done ? 'line-through' : 'none', marginBottom: 8 }}>{desc}</div>
                    <div style={{ height: 4, background: 'rgba(168,166,200,0.15)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
                <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#a8a6c8' }}>Atualizado agora pela IA</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEMONSTRAÇÃO (VÍDEO) ── */}
      <section style={{ ...sectionBase, background: '#212842' }}>
        <div style={container}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#4f7edd', marginBottom: 12 }}>Demonstração</div>
              <h2 style={{ fontSize: 'clamp(28px,5vw,40px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f7f7ff', lineHeight: 1.1, marginBottom: 12 }}>Veja o Metapps em ação</h2>
            </div>
          </Reveal>
          <div style={{ position: 'relative', width: '100%', maxWidth: 800, margin: '0 auto', borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 32px rgba(33,40,66,0.5)' }}>
            <video src={videoDemo} autoPlay muted loop playsInline style={{ width: '100%', height: 'auto', aspectRatio: '16/9', objectFit: 'cover' }} />
          </div>
        </div>
      </section>

      {/* ── RECURSOS PRINCIPAIS ── */}
      <section style={{ ...sectionBase, background: '#14182b' }}>
        <div style={container}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#4f7edd', marginBottom: 12 }}>Recursos principais</div>
              <h2 style={{ fontSize: 'clamp(28px,5vw,40px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f7f7ff', lineHeight: 1.1, marginBottom: 12 }}>Tudo que você precisa</h2>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr 1fr', gap: 20 }}>
            {[
              ['Assuntos ilimitados', 'Matemática, inglês, programação, história — ou qualquer outro tema.'],
              ['Conquistas diárias', 'Mantenha o foco com metas diárias e streaks que te motivam.'],
              ['Métricas detalhadas', 'Acompanhe seu progresso com gráficos claros e identifique pontos de melhoria.'],
              ['Disponível 24/7', 'Acesse de qualquer lugar, a qualquer hora — no celular ou no computador.'],
              ['Sem conteúdo fixo', 'Cada atividade é única, gerada na hora pela IA, sem apostilas prontas.'],
              ['Exportação fácil', 'Baixe suas atividades em PDF, compartilhe com colegas ou estude offline.'],
            ].map(([title, desc], i) => (
              <Reveal key={i} delay={i * 50}>
                <div style={{ padding: 24, borderRadius: 14, background: '#212842', border: '1px solid rgba(168,166,200,0.12)', height: '100%' }}>
                  <div style={{ marginBottom: 8 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6aaf6a" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: '#f7f7ff', marginBottom: 8 }}>{title}</h4>
                  <p style={{ fontSize: 14, color: '#a8a6c8', lineHeight: 1.6 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ ...sectionBase, background: '#212842', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px' }}>
          <Reveal>
            <h2 style={{ fontSize: 'clamp(30px,6vw,44px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f7f7ff', lineHeight: 1.1, marginBottom: 20 }}>Pronto para começar?</h2>
            <p style={{ fontSize: 17, color: '#a8a6c8', marginBottom: 36, lineHeight: 1.7 }}>Crie sua conta agora e descubra como a inteligência artificial pode transformar seus estudos.</p>
            <button onClick={() => navigate('/auth/register')} style={{ ...btnPrimary, padding: '16px 44px', fontSize: 18, boxShadow: '0 8px 28px rgba(79,126,221,0.5)' }}>Começar agora</button>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#14182b', padding: '50px 0 30px', borderTop: '1px solid rgba(168,166,200,0.06)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 40 }}>
            <div>
              <img src={logoImg} alt="Metapps" style={{ width: 100, height: 'auto', marginBottom: 16, opacity: 0.7 }} />
              <p style={{ fontSize: 13, color: '#a8a6c8', lineHeight: 1.6, maxWidth: 240 }}>Seus estudos do seu jeito — Aprendizado personalizado com IA.</p>
            </div>
            {[
              ['Produto', [['Como funciona', null], ['Criar conta', () => navigate('/auth/register')], ['Entrar', () => navigate('/auth/login')]]],
              ['Suporte', [['suporte@metapps.com', null], ['contato@metapps.com', null]]],
              ['Legal', [['Termos de uso', () => window.open('/src/pages/Termos.html', '_blank')], ['Privacidade', () => window.open('/src/pages/Termos.html#privacidade', '_blank')]]],
            ].map(([title, links]) => (
              <div key={title}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#a8a6c8', marginBottom: 16 }}>{title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {links.map(([label, fn]) => (
                    <span key={label} style={{ fontSize: 13, color: 'rgba(247,247,255,0.5)', cursor: fn ? 'pointer' : 'default', transition: 'color 0.2s' }}
                      onClick={() => fn && fn()}
                      onMouseEnter={e => e.currentTarget.style.color = '#4f7edd'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(247,247,255,0.5)'}>{label}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(168,166,200,0.06)', paddingTop: 20, fontSize: 12, color: '#a8a6c8', textAlign: 'center' }}>© 2026 Metapps — Projeto acadêmico (TCC). Todos os direitos reservados.</div>
        </div>
      </footer>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: 'Inter', -apple-system, sans-serif; }
        html, body { overflow-x: hidden; background: #14182b; }
        body { overflow-y: auto; }
      `}</style>
    </div>
  )
}

const container = { maxWidth: 1280, margin: '0 auto', padding: '0 24px' }
const sectionBase = { padding: '80px 0' }

const btnPrimary = {
  padding: '10px 24px', borderRadius: 12, border: 'none',
  background: '#4f7edd', color: '#fff', fontSize: 15, fontWeight: 700,
  cursor: 'pointer', letterSpacing: '0.3px',
  boxShadow: '0 4px 14px rgba(79,126,221,0.3)',
  transition: 'all 0.2s'
}

const btnOutline = {
  padding: '12px 28px', borderRadius: 12, border: '2px solid #f7f7ff',
  background: 'transparent', color: '#f7f7ff', fontSize: 16, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.2s'
}