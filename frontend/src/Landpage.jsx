import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import icon from './assets/logo.png'
import linePng from './assets/line.png'

/* ── Scroll reveal ── */
function useReveal(threshold = 0.12) {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
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
        transform: on ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
        ...custom,
      }}
    >
      {children}
    </div>
  )
}

/* ── Interface simulada do Metapps (substitui o código Python) ── */
function MockMetappsUI() {
  return (
    <div
      style={{
        background: '#0f172a',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '28px',
        fontFamily: "'Inter', sans-serif",
        color: '#e2e8f0',
        maxWidth: 400,
      }}
    >
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Suas atividades</span>
        <span style={{ fontSize: 12, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 99 }}>Hoje</span>
      </div>

      {/* Card de atividade 1 */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#4f7edd', fontWeight: 600 }}>Matemática</span>
          <span style={{ fontSize: 12, color: '#22c55e' }}>80%</span>
        </div>
        <div style={{ fontSize: 14, marginBottom: 10 }}>Equações do 2º grau</div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: '80%', height: '100%', background: '#4f7edd', borderRadius: 99 }} />
        </div>
      </div>

      {/* Card de atividade 2 */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#ec4899', fontWeight: 600 }}>Inglês</span>
          <span style={{ fontSize: 12, color: '#f59e0b' }}>45%</span>
        </div>
        <div style={{ fontSize: 14, marginBottom: 10 }}>Past perfect tense</div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: '45%', height: '100%', background: '#ec4899', borderRadius: 99 }} />
        </div>
      </div>

      {/* Card de atividade 3 */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#a855f7', fontWeight: 600 }}>Programação</span>
          <span style={{ fontSize: 12, color: '#22c55e' }}>100%</span>
        </div>
        <div style={{ fontSize: 14, marginBottom: 10, textDecoration: 'line-through', color: '#94a3b8' }}>Busca binária em Python</div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', background: '#a855f7', borderRadius: 99 }} />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>Atualizado agora pela IA</span>
      </div>
    </div>
  )
}

/* ── Página principal ── */
export default function Landpage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mob, setMob] = useState(window.innerWidth < 860)

  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.body.style.height = 'auto'

    document.title = 'Metapps'
    const favicon = document.querySelector("link[rel*='icon']")
    if (favicon) favicon.href = icon
    else {
      const newLink = document.createElement('link')
      newLink.rel = 'icon'
      newLink.href = icon
      document.head.appendChild(newLink)
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.height = ''
    }
  }, [icon])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    const onResize = () => setMob(window.innerWidth < 860)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div
      style={{
        width: '100%',
        fontFamily: "'Inter', -apple-system, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        background: '#080c14',
        color: '#e2e8f0',
        overflowX: 'hidden',
      }}
    >
      {/* ── NAVBAR ── */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          transform: scrolled ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.4s ease',
          background: 'rgba(8,12,20,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '0 32px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo com line.png ajustada (agora com altura 32px) */}
          <img
            src={linePng}
            alt="Metapps"
            style={{ height: 32, width: 'auto', opacity: 0.9, filter: 'brightness(0.95)' }}
            onClick={() => navigate('/home')}
            onError={(e) => (e.target.style.display = 'none')}
          />
          <button
            onClick={() => navigate('/register')}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              background: '#4f7edd',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '0.3px',
            }}
          >
            Começar agora
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          padding: mob ? '120px 0 80px' : '140px 0 100px',
          background: 'linear-gradient(170deg, #080c14 0%, #0c1220 50%, #080c14 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', width: '100%', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', flexDirection: mob ? 'column' : 'row', alignItems: 'center', gap: mob ? 48 : 80 }}>
            {/* Texto à esquerda */}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 'clamp(42px,7vw,72px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 24, color: '#f8fafc' }}>
                Estude do seu jeito,{' '}
                <span style={{ background: 'linear-gradient(135deg, #4f7edd, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  com IA.
                </span>
              </h1>
              <p style={{ fontSize: 18, color: 'rgba(226,232,240,0.55)', lineHeight: 1.7, marginBottom: 32, maxWidth: 500 }}>
                O Metapps cria atividades personalizadas usando inteligência artificial — no seu ritmo, no seu nível, em qualquer assunto.
              </p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <button onClick={() => navigate('/register')} style={{ padding: '12px 28px', borderRadius: 6, border: 'none', background: '#4f7edd', color: '#fff', fontSize: 16, fontWeight: 500, cursor: 'pointer' }}>
                  Começar agora
                </button>
                <button onClick={() => navigate('/login')} style={{ padding: '12px 28px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#e2e8f0', fontSize: 16, fontWeight: 500, cursor: 'pointer' }}>
                  Já tenho conta
                </button>
              </div>
            </div>

            {/* Imagem à direita (agora sem borda nem borderRadius) */}
            {!mob && (
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <img
                  src={linePng}
                  alt="Interface Metapps"
                  style={{ width: '100%', maxWidth: 540, height: 'auto' }}
                  onError={(e) => (e.target.style.display = 'none')}
                />
              </div>
            )}
            {mob && (
              <div style={{ width: '100%', marginTop: 24 }}>
                <img
                  src={linePng}
                  alt="Interface Metapps"
                  style={{ width: '100%', maxWidth: 480, height: 'auto' }}
                  onError={(e) => (e.target.style.display = 'none')}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section style={{ padding: mob ? '80px 0' : '120px 0', background: '#0a0f1a' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <Reveal>
            <div style={{ marginBottom: 64, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#ec4899', marginBottom: 16 }}>Como funciona</div>
              <h2 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f1f5f9', lineHeight: 1.1, marginBottom: 16 }}>Três passos simples</h2>
              <p style={{ fontSize: 16, color: 'rgba(226,232,240,0.5)', maxWidth: 500, margin: '0 auto' }}>
                Nossa IA entende o que você precisa aprender e cria atividades sob medida, como um professor particular.
              </p>
            </div>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr 1fr', gap: 32 }}>
            {[
              { step: '01', title: 'Escolha o tema', desc: 'Diga para a IA o que quer aprender — qualquer assunto, do básico ao avançado.', color: '#4f7edd' },
              { step: '02', title: 'IA gera atividades', desc: 'Exercícios e desafios são criados em tempo real, adaptados ao seu nível.', color: '#ec4899' },
              { step: '03', title: 'Pratique e evolua', desc: 'Complete as tarefas, acompanhe seu progresso e mantenha suas conquistas diárias.', color: '#a855f7' },
            ].map(({ step, title, desc, color }, i) => (
              <Reveal key={step} delay={i * 80}>
                <div style={{ padding: '32px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', height: '100%' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color, marginBottom: 20 }}>{step}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>{title}</h3>
                  <p style={{ fontSize: 15, color: 'rgba(226,232,240,0.55)', lineHeight: 1.65 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PERSONALIZAÇÃO INTELIGENTE (agora com MockMetappsUI) ── */}
      <section style={{ padding: mob ? '80px 0' : '120px 0', background: 'linear-gradient(180deg, #080c14 0%, #0a0f1a 50%, #080c14 100%)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'flex', flexDirection: mob ? 'column' : 'row', gap: mob ? 40 : 80, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#4f7edd', marginBottom: 16 }}>Personalização inteligente</div>
              <h2 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f1f5f9', lineHeight: 1.1, marginBottom: 20 }}>A IA conhece você</h2>
              <p style={{ fontSize: 16, color: 'rgba(226,232,240,0.55)', lineHeight: 1.7, marginBottom: 40 }}>
                Adaptação contínua baseada no seu desempenho real — quanto mais você pratica, mais precisa se torna a geração de tarefas.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {[
                  { title: 'Questionário inicial', desc: 'Responda algumas perguntas sobre seus interesses e nível atual para calibrar a IA.' },
                  { title: 'Geração sob medida', desc: 'Exercícios únicos criados com base no seu perfil, ajustando dificuldade automaticamente.' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? '#ec4899' : '#4f7edd', marginTop: 8, flexShrink: 0 }} />
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>{item.title}</h4>
                      <p style={{ fontSize: 14, color: 'rgba(226,232,240,0.5)', lineHeight: 1.6 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <MockMetappsUI />
            </div>
          </div>
        </div>
      </section>

      {/* ── DEMONSTRAÇÃO (vídeo à esquerda, textos à direita) ── */}
      <section style={{ padding: mob ? '80px 0' : '120px 0', background: '#0a0f1a' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'flex', flexDirection: mob ? 'column' : 'row', gap: 40, alignItems: 'center' }}>
            {/* Player de vídeo à esquerda */}
            <div style={{ flex: 1 }}>
              <Reveal>
                <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', background: '#0f172a', border: '1px solid rgba(255,255,255,0.06)', aspectRatio: '16/9', cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0e1a2b, #0f172a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" fill="none" stroke="#e2e8f0" strokeWidth="1.5" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" /></svg>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Textos à direita */}
            <div style={{ flex: 1 }}>
              <Reveal delay={100}>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#ec4899', marginBottom: 16 }}>Demonstração</div>
                <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f1f5f9', lineHeight: 1.1, marginBottom: 20 }}>
                  Veja o Metapps em ação
                </h2>
                <p style={{ fontSize: 16, color: 'rgba(226,232,240,0.55)', lineHeight: 1.7, marginBottom: 24 }}>
                  Assista como a IA gera atividades personalizadas em segundos e entenda como nossa interface foi projetada para ser simples e produtiva.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {['Interface limpa e focada', 'Geração instantânea de tarefas', 'Feedback imediato de progresso'].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(79,126,221,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="12" height="12" fill="none" stroke="#4f7edd" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      <span style={{ fontSize: 15, color: '#e2e8f0' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── NOVA SEÇÃO: Recursos principais ── */}
      <section style={{ padding: mob ? '80px 0' : '120px 0', background: 'linear-gradient(180deg, #080c14 0%, #0a0f1a 100%)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <Reveal>
            <div style={{ marginBottom: 64, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#4f7edd', marginBottom: 16 }}>Recursos principais</div>
              <h2 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f1f5f9', lineHeight: 1.1, marginBottom: 16 }}>
                Tudo que você precisa
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(226,232,240,0.5)', maxWidth: 500, margin: '0 auto' }}>
                Ferramentas completas para transformar seus estudos, sem limites de conteúdo.
              </p>
            </div>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr 1fr', gap: 24 }}>
            {[
              { title: 'Assuntos ilimitados', desc: 'Matemática, inglês, programação, história — ou qualquer outro tema que você imaginar.' },
             { title: 'Conquistas diárias', desc: 'Mantenha o foco com metas diárias e streaks que te motivam a nunca parar.' },
              { title: 'Métricas detalhadas', desc: 'Acompanhe seu progresso com gráficos claros e identifique onde precisa melhorar.' },
              { title: 'Disponível 24/7', desc: 'Acesse de qualquer lugar, a qualquer hora — no celular ou no computador.' },
              { title: 'Sem conteúdo fixo', desc: 'Nada de apostilas prontas. Cada atividade é única, gerada na hora pela IA.' },
              { title: 'Exportação fácil', desc: 'Baixe suas atividades em PDF, compartilhe com colegas ou estude offline.' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 60}>
                <div style={{ padding: '24px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', height: '100%' }}>
                  <h4 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>{item.title}</h4>
                  <p style={{ fontSize: 14, color: 'rgba(226,232,240,0.55)', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ padding: mob ? '80px 0' : '120px 0', background: 'linear-gradient(160deg, #0a0f1a, #080c14)', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 32px' }}>
          <Reveal>
            <h2 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f1f5f9', lineHeight: 1.1, marginBottom: 20 }}>
              Pronto para começar?
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(226,232,240,0.5)', marginBottom: 40, lineHeight: 1.7 }}>
              Crie sua conta agora e descubra como a inteligência artificial pode transformar seus estudos.
            </p>
            <button onClick={() => navigate('/register')} style={{ padding: '14px 40px', borderRadius: 6, border: 'none', background: '#4f7edd', color: '#fff', fontSize: 16, fontWeight: 500, cursor: 'pointer' }}>
              Começar agora — é grátis
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#080c14', padding: '60px 0 30px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr 1fr' : '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 50 }}>
            <div style={{ gridColumn: mob ? 'span 2' : 'auto' }}>
              <img src={linePng} alt="Metapps" style={{ width: 100, height: 'auto', marginBottom: 16, opacity: 0.5 }} onError={(e) => (e.target.style.display = 'none')} />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6, maxWidth: 240 }}>Aprendizado personalizado com IA — do seu jeito, no seu ritmo.</p>
            </div>
            {[
              ['Produto', [['Como funciona', null], ['Criar conta', () => navigate('/register')], ['Entrar', () => navigate('/login')]]],
              ['Suporte', [['suporte@metapps.com', null], ['contato@metapps.com', null]]],
              ['Legal', [['Termos de uso', () => window.open('/src/pages/Termos.html', '_blank')], ['Privacidade', () => window.open('/src/pages/Termos.html#privacidade', '_blank')]]],
            ].map(([title, links]) => (
              <div key={title}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 16 }}>{title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {links.map(([label, fn]) => (
                    <span key={label} style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', cursor: fn ? 'pointer' : 'default', transition: 'color 0.2s' }}
                      onClick={() => fn && fn()}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ec4899')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
            © 2026 Metapps — Projeto acadêmico (TCC). Todos os direitos reservados.
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes hUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: 'Inter', -apple-system, sans-serif; }
        html, body { overflow-x: hidden; }
        body { overflow-y: auto; background: #080c14; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  )
}