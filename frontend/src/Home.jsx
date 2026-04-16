import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from './assets/logo.png'

/* ─── Scroll reveal hook ─────────────────────────────── */
function useReveal(threshold = 0.1) {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, on]
}

function Reveal({ children, delay = 0, style: extra }) {
  const [ref, on] = useReveal()
  return (
    <div ref={ref} style={{
      opacity: on ? 1 : 0,
      transform: on ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      ...extra,
    }}>
      {children}
    </div>
  )
}

/* ─── AI Activity card — hero visual ─────────────────── */
function ActivityCard() {
  const items = [
    { subject: 'Inglês', task: 'Complete the sentence using past perfect tense.', done: true,  color: '#4f7edd' },
    { subject: 'Matemática', task: 'Resolva a equação diferencial de segunda ordem.', done: true,  color: '#d4924a' },
    { subject: 'Programação', task: 'Implemente uma função de busca binária em Python.', done: false, color: '#4f7edd' },
    { subject: 'Física', task: 'Calcule a força resultante usando vetores.', done: false, color: '#d4924a' },
  ]
  return (
    <div style={aiCard}>
      {/* Card header */}
      <div style={aiCardHeader}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(232,236,242,0.35)', marginBottom: 4 }}>
            Plano de hoje
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e8ecf2' }}>Atividades geradas pela IA</div>
        </div>
        <div style={aiPill}>4 atividades</div>
      </div>

      {/* Activity list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(({ subject, task, done, color }) => (
          <div key={subject} style={{ ...aiItem, opacity: done ? 0.55 : 1 }}>
            <div style={{ ...aiCheck, borderColor: done ? color : 'rgba(255,255,255,0.15)', background: done ? color : 'transparent' }}>
              {done && (
                <svg width="9" height="9" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: color, letterSpacing: '0.5px', marginBottom: 2 }}>{subject}</div>
              <div style={{ fontSize: 12.5, color: done ? 'rgba(232,236,242,0.4)' : '#e8ecf2', lineHeight: 1.4, textDecoration: done ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {task}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'rgba(232,236,242,0.4)' }}>Progresso diário</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4f7edd' }}>50%</span>
        </div>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '50%', background: 'linear-gradient(90deg, #4f7edd, #d4924a)', borderRadius: 99 }} />
        </div>
      </div>
    </div>
  )
}

/* ─── Feature card ────────────────────────────────────── */
function FeatureCard({ icon, title, desc, color, delay }) {
  const [ref, on] = useReveal()
  return (
    <div ref={ref} style={{
      ...featCard,
      opacity: on ? 1 : 0,
      transform: on ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    }}>
      <div style={{ ...featIcon, background: color + '18', border: `1px solid ${color}30` }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e8ecf2', marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 14, color: 'rgba(232,236,242,0.5)', lineHeight: 1.65 }}>{desc}</p>
    </div>
  )
}

/* ─── Step ────────────────────────────────────────────── */
function Step({ n, title, desc, color, delay }) {
  return (
    <Reveal delay={delay}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff', boxShadow: `0 4px 16px ${color}44` }}>
          {n}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e8ecf2', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 14, color: 'rgba(232,236,242,0.5)', lineHeight: 1.65 }}>{desc}</div>
        </div>
      </div>
    </Reveal>
  )
}

/* ─── Main component ──────────────────────────────────── */
export default function Home() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  /* Mobile breakpoint */
  const [mobile, setMobile] = useState(window.innerWidth < 900)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 900)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  return (
    <div style={page}>

      {/* ── NAVBAR ───────────────────────────────────────── */}
      <nav style={{
        ...navbar,
        background: scrolled ? 'rgba(9,9,24,0.94)' : 'transparent',
        backdropFilter: scrolled ? 'blur(18px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}>
        <div style={navInner}>
          <img src={logo} alt="MetaPPS" style={navLogo}
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
          <div style={{ display: 'none', fontSize: 20, fontWeight: 800, letterSpacing: '-0.8px', color: '#e8ecf2' }}>
            META<span style={{ color: '#7b9fd4' }}>PPS</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navigate('/login')} style={navGhost}>Entrar</button>
            <button style={navDl}>Baixar app</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section style={heroSection}>
        {/* Background */}
        <div style={grain} />
        <div style={{ ...blobEl, width: 700, height: 700, background: '#1a3a8c', top: -300, left: -200, animation: 'blobA 20s ease-in-out infinite alternate' }} />
        <div style={{ ...blobEl, width: 500, height: 500, background: '#c4770a', opacity: 0.12, bottom: -100, right: -150, animation: 'blobB 24s ease-in-out infinite alternate' }} />

        <div style={{ ...heroInner, flexDirection: mobile ? 'column' : 'row' }}>

          {/* Left — copy */}
          <div style={{ flex: mobile ? 'none' : '0 0 50%', maxWidth: mobile ? '100%' : 520, textAlign: mobile ? 'center' : 'left' }}>
            <div style={{ animation: 'hFadeUp 0.7s var(--ease) both 0s' }}>
              <span style={badge}>Powered by IA</span>
            </div>
            <h1 style={{ ...heroH1, animation: 'hFadeUp 0.7s var(--ease) both 0.1s' }}>
              SEUS estudos,<br />
              <span style={heroGrad}>do seu jeito.</span>
            </h1>
            <p style={{ ...heroSub, animation: 'hFadeUp 0.7s var(--ease) both 0.2s', textAlign: mobile ? 'center' : 'left' }}>
              O MetaPPS usa inteligencia artificial para criar atividades personalizadas com base no que voce quer aprender. Mais flexivel que o Duolingo, mais poderoso que qualquer caderno.
            </p>
            <div style={{ ...heroCtas, justifyContent: mobile ? 'center' : 'flex-start', animation: 'hFadeUp 0.7s var(--ease) both 0.3s' }}>
              <button style={ctaMain}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                  <path d="M8 12l4 4 4-4M12 8v8" />
                </svg>
                Baixar o app
              </button>
              <button onClick={() => navigate('/register')} style={ctaSecondary}>Criar conta gratis</button>
            </div>
          </div>

          {/* Right — visual */}
          {!mobile && (
            <div style={{ flex: '0 0 48%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ animation: 'hFadeUp 0.8s var(--ease) both 0.25s', width: '100%', maxWidth: 400, position: 'relative' }}>
                <ActivityCard />
                {/* Floating chip — streak */}
                <div style={{ ...floatChip, top: -18, right: -12, animation: 'chipFloat1 4s ease-in-out infinite' }}>
                  <svg width="14" height="14" fill="#d4924a" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#e8ecf2' }}>14 dias em sequencia</span>
                </div>
                {/* Floating chip — AI */}
                <div style={{ ...floatChip, bottom: -14, left: -16, animation: 'chipFloat2 5s ease-in-out infinite' }}>
                  <svg width="14" height="14" fill="#4f7edd" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 14.93V17a1 1 0 0 1-2 0v-.07A8.001 8.001 0 0 1 4.07 9H5a1 1 0 0 1 0 2h-.93a6 6 0 0 0 5.86 5.93zm7.93-5A8.001 8.001 0 0 1 13 4.07V5a1 1 0 0 1-2 0v-.93A6 6 0 0 0 5.07 10H5a1 1 0 0 1 0-2h.07A8.001 8.001 0 0 1 11 4.07V5a1 1 0 0 1 2 0v-.93A8 8 0 0 1 19.93 11H19a1 1 0 0 1 0 2h.93z" /></svg>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#e8ecf2' }}>IA gerando atividade</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section style={sectionFull}>
        <div style={sectionInner}>
          <Reveal>
            <p style={sectionEyebrow}>Como funciona</p>
            <h2 style={sectionH2}>Simples como todos <br/>Poderoso como nenhum</h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 20, marginTop: 56 }}>
            <FeatureCard delay={0} color="#4f7edd"
              title="Voce define o tema"
              desc="Diga para a IA o que quer aprender: matematica, ingles, programacao, historia — qualquer assunto."
              icon={<svg width="22" height="22" fill="none" stroke="#4f7edd" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
            />
            <FeatureCard delay={100} color="#d4924a"
              title="A IA cria as atividades"
              desc="O sistema gera exercicios, questoes e desafios personalizados no seu nivel e ritmo de aprendizado."
              icon={<svg width="22" height="22" fill="none" stroke="#d4924a" strokeWidth="1.6" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>}
            />
            <FeatureCard delay={200} color="#4f7edd"
              title="Voce evolui todo dia"
              desc="Complete atividades, mantenha sua sequencia e acompanhe seu progresso com metricas claras."
              icon={<svg width="22" height="22" fill="none" stroke="#4f7edd" strokeWidth="1.6" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
            />
          </div>
        </div>
      </section>

      {/* ── COMPARISON STRIP ─────────────────────────────── */}
      <section style={{ ...sectionFull, background: 'rgba(255,255,255,0.025)', borderTop: '1px solid rgba(255,255,255,0.055)', borderBottom: '1px solid rgba(255,255,255,0.055)' }}>
        <div style={sectionInner}>
          <Reveal>
            <p style={sectionEyebrow}>Por que MetaPPS</p>
            <h2 style={sectionH2}>Aprendizado sem limites de conteudo</h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 20, marginTop: 48 }}>
            {[
              { label: 'Outros apps', items: ['Conteudo fixo e pre-definido', 'Progressao linear e lenta', 'Idiomas apenas ou poucas materias', 'Sem adaptacao ao seu contexto'], bad: true },
              { label: 'MetaPPS', items: ['Qualquer assunto que voce quiser', 'Atividades geradas em tempo real por IA', 'Matematica, codigo, ciencias, idiomas e mais', 'Completamente personalizado para voce'], bad: false },
            ].map(({ label, items, bad }) => (
              <Reveal key={label} delay={bad ? 0 : 100}>
                <div style={{ background: bad ? 'rgba(255,255,255,0.02)' : 'rgba(79,126,221,0.08)', border: `1px solid ${bad ? 'rgba(255,255,255,0.06)' : 'rgba(79,126,221,0.25)'}`, borderRadius: 14, padding: '28px 28px 24px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: bad ? 'rgba(232,236,242,0.4)' : '#4f7edd', letterSpacing: '0.5px', marginBottom: 20 }}>{label.toUpperCase()}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {items.map(item => (
                      <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flexShrink: 0, marginTop: 1 }}>
                          {bad
                            ? <svg width="15" height="15" fill="none" stroke="rgba(232,236,242,0.2)" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            : <svg width="15" height="15" fill="none" stroke="#4f7edd" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                          }
                        </div>
                        <span style={{ fontSize: 14, color: bad ? 'rgba(232,236,242,0.35)' : 'rgba(232,236,242,0.82)', lineHeight: 1.55 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SUBJECTS GRID ────────────────────────────────── */}
      <section style={sectionFull}>
        <div style={sectionInner}>
          <Reveal>
            <p style={sectionEyebrow}>Assuntos suportados</p>
            <h2 style={sectionH2}>Aprenda o que quiser</h2>
            <p style={{ fontSize: 15, color: 'rgba(232,236,242,0.45)', textAlign: 'center', maxWidth: 520, margin: '0 auto', marginTop: 12, lineHeight: 1.65 }}>
              Nossa IA suporta praticamente qualquer area do conhecimento. Se voce pode descrever, ela pode criar atividades.
            </p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 48 }}>
            {[
              ['Matematica', '#4f7edd'],
              ['Programacao', '#d4924a'],
              ['Fisica', '#4f7edd'],
              ['Ingles', '#d4924a'],
              ['Quimica', '#4f7edd'],
              ['Biologia', '#d4924a'],
              ['Historia', '#4f7edd'],
              ['Portugues', '#d4924a'],
              ['Economia', '#4f7edd'],
              ['Filosofia', '#d4924a'],
              ['Estatistica', '#4f7edd'],
              ['E muito mais...', '#4f7edd'],
            ].map(([label, color], i) => (
              <Reveal key={label} delay={i * 30}>
                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  fontSize: 13, fontWeight: 600,
                  color: 'rgba(232,236,242,0.7)',
                  textAlign: 'center',
                  transition: 'all .2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.color = '#e8ecf2'; e.currentTarget.style.background = color + '0f' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(232,236,242,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                >
                  {label}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── STEPS ────────────────────────────────────────── */}
      <section style={{ ...sectionFull, background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.055)' }}>
        <div style={{ ...sectionInner, display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <Reveal>
              <p style={sectionEyebrow}>Primeiros passos</p>
              <h2 style={{ ...sectionH2, textAlign: 'left', marginBottom: 40 }}>Comece em menos de 2 minutos</h2>
            </Reveal>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <Step n="1" color="#4f7edd" delay={0} title="Crie sua conta" desc="Cadastro rapido com e-mail. Nenhuma informacao desnecessaria pedida." />
              <Step n="2" color="#d4924a" delay={80} title="Escolha o que aprender" desc="Digite o tema ou materia. A IA entende e monta seu plano de estudos." />
              <Step n="3" color="#4f7edd" delay={160} title="Comece as atividades" desc="Resolva exercicios gerados na hora, no seu ritmo, no seu nivel." />
            </div>
          </div>
          {/* Stats */}
          <Reveal delay={100}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { val: 'IA', label: 'Gera atividades\npersonalizadas', color: '#4f7edd' },
                { val: '100%', label: 'Gratuito\npara sempre', color: '#d4924a' },
                { val: '24/7', label: 'Disponivel\na qualquer hora', color: '#d4924a' },
                { val: 'Qualquer', label: 'Assunto que\nvoce quiser', color: '#4f7edd' },
              ].map(({ val, label, color }) => (
                <div key={val} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '24px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color, marginBottom: 8, lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 12, color: 'rgba(232,236,242,0.4)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>{label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────── */}
      <section style={ctaSection}>
        <div style={grain} />
        <div style={{ ...blobEl, width: 600, height: 600, background: '#1a3a8c', opacity: 0.22, top: -200, left: '50%', transform: 'translateX(-50%)', animation: 'blobA 20s ease-in-out infinite alternate' }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 580, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 800, letterSpacing: '-1px', color: '#e8ecf2', lineHeight: 1.15, marginBottom: 18 }}>
              SEUS estudos,<br />
              <span style={heroGrad}>na palma da sua mao.</span>
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(232,236,242,0.5)', lineHeight: 1.65, marginBottom: 36 }}>
              Comece hoje. Sem custo, sem compromisso. Apenas voce, a IA e o conhecimento que voce sempre quis ter.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button style={{ ...ctaMain, fontSize: 16, padding: '14px 32px' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                  <path d="M8 12l4 4 4-4M12 8v8" />
                </svg>
                Baixar o app
              </button>
              <button onClick={() => navigate('/register')} style={{ ...ctaSecondary, fontSize: 16, padding: '14px 28px' }}>
                Comecar no navegador
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer style={footerEl}>
        <div style={footerInner}>
          <div style={footerTop}>
            {/* Brand */}
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <img src={logo} alt="MetaPPS" style={{ height: 32, width: 'auto', opacity: 0.8 }}
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
                <div style={{ display: 'none', fontSize: 17, fontWeight: 800, letterSpacing: '-0.5px', color: 'rgba(232,236,242,0.6)' }}>
                  META<span style={{ color: '#7b9fd4' }}>PPS</span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(232,236,242,0.3)', lineHeight: 1.65, maxWidth: 280 }}>
                Aprendizado personalizado com inteligencia artificial. Para estudantes e profissionais que nao tem tempo a perder.
              </p>
            </div>

            {/* Links: Produto */}
            <div>
              <div style={footerGroupTitle}>Produto</div>
              <div style={footerLinks}>
                <a href="#" style={footerLink}>Como funciona</a>
                <a href="#" style={footerLink}>Assuntos disponiveis</a>
                <span onClick={() => navigate('/register')} style={footerLink}>Criar conta gratis</span>
                <span onClick={() => navigate('/login')} style={footerLink}>Entrar</span>
              </div>
            </div>

            {/* Links: Suporte */}
            <div>
              <div style={footerGroupTitle}>Suporte</div>
              <div style={footerLinks}>
                <a href="mailto:suporte@metapps.com" style={footerLink}>suporte@metapps.com</a>
                <a href="mailto:contato@metapps.com" style={footerLink}>contato@metapps.com</a>
              </div>
            </div>

            {/* Links: Legal */}
            <div>
              <div style={footerGroupTitle}>Legal</div>
              <div style={footerLinks}>
                <span onClick={() => window.open('/src/pages/Termos.html', '_blank')} style={footerLink}>Termos de uso</span>
                <span onClick={() => window.open('/src/pages/Termos.html#privacidade', '_blank')} style={footerLink}>Politica de privacidade</span>
              </div>
            </div>
          </div>

          <div style={footerBottom}>
            <p>© 2026 MetaPPS — Projeto academico (TCC). Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes hFadeUp {
          from { opacity: 0; transform: translateY(26px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blobA { from { transform: translate(0,0) scale(1); } to { transform: translate(60px,50px) scale(1.1); } }
        @keyframes blobB { from { transform: translate(0,0); } to { transform: translate(-50px,-40px); } }
        @keyframes chipFloat1 { 0%,100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-8px) rotate(1deg); } }
        @keyframes chipFloat2 { 0%,100% { transform: translateY(0) rotate(1deg); } 50% { transform: translateY(-7px) rotate(-1deg); } }
        :root { --ease: cubic-bezier(0.16,1,0.3,1); }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { color: inherit; }
        button { font-family: 'Inter', -apple-system, sans-serif; }
      `}</style>
    </div>
  )
}

/* ─── Global styles ──────────────────────────────────── */
const page        = { width: '100%', minHeight: '100vh', background: '#09091a', color: '#e8ecf2', fontFamily: "'Inter', -apple-system, sans-serif", WebkitFontSmoothing: 'antialiased', overflowX: 'hidden' }
const grain       = { position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.76' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")` }
const blobEl      = { position: 'absolute', borderRadius: '50%', filter: 'blur(110px)', pointerEvents: 'none', opacity: 0.18 }

/* Navbar */
const navbar      = { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, transition: 'all 0.3s ease' }
const navInner    = { maxWidth: 1160, margin: '0 auto', padding: '0 36px', height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const navLogo     = { height: 38, width: 'auto', filter: 'brightness(1.05)' }
const navGhost    = { padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(232,236,242,0.7)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all .15s' }
const navDl       = { padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4f7edd', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 12px rgba(79,126,221,0.4)', transition: 'all .15s' }

/* Hero */
const heroSection = { position: 'relative', overflow: 'hidden', minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '120px 0 80px' }
const heroInner   = { width: '100%', maxWidth: 1160, margin: '0 auto', padding: '0 36px', display: 'flex', alignItems: 'center', gap: 60, position: 'relative', zIndex: 1 }
const badge       = { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(79,126,221,0.12)', border: '1px solid rgba(79,126,221,0.28)', borderRadius: 99, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: '#7b9fd4', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 22 }
const heroH1      = { fontSize: 'clamp(38px, 5.5vw, 66px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.05, marginBottom: 22, color: '#e8ecf2' }
const heroGrad    = { background: 'linear-gradient(120deg, #4f7edd 0%, #d4924a 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
const heroSub     = { fontSize: 17, color: 'rgba(232,236,242,0.55)', lineHeight: 1.7, marginBottom: 32, maxWidth: 480 }
const heroCtas    = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }
const ctaMain     = { display: 'inline-flex', alignItems: 'center', gap: 9, padding: '13px 26px', borderRadius: 10, border: 'none', background: 'linear-gradient(120deg, #4f7edd 0%, #3a6ccc 100%)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 22px rgba(79,126,221,0.45)', transition: 'all .2s' }
const ctaSecondary = { padding: '13px 22px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(232,236,242,0.75)', fontSize: 15, fontWeight: 500, cursor: 'pointer', transition: 'all .15s' }
const heroNote    = { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'rgba(232,236,242,0.35)' }

/* Hero visual */
const aiCard      = { background: 'rgba(18,20,36,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: '22px 22px 20px', boxShadow: '0 28px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)' }
const aiCardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }
const aiPill      = { background: 'rgba(79,126,221,0.12)', border: '1px solid rgba(79,126,221,0.25)', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#7b9fd4' }
const aiItem      = { display: 'flex', alignItems: 'flex-start', gap: 11, padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', transition: 'opacity .2s' }
const aiCheck     = { flexShrink: 0, width: 18, height: 18, borderRadius: '50%', border: '1.5px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }
const floatChip   = { position: 'absolute', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(18,20,36,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 13px', boxShadow: '0 8px 28px rgba(0,0,0,0.4)', zIndex: 2, whiteSpace: 'nowrap' }

/* Sections */
const sectionFull  = { width: '100%', padding: '100px 0', position: 'relative' }
const sectionInner = { maxWidth: 1160, margin: '0 auto', padding: '0 36px' }
const sectionEyebrow = { fontSize: 12, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#4f7edd', marginBottom: 14, textAlign: 'center' }
const sectionH2   = { fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.8px', color: '#e8ecf2', lineHeight: 1.2, textAlign: 'center', marginBottom: 12 }

/* Feature cards */
const featCard    = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '28px 24px' }
const featIcon    = { width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }

/* CTA section */
const ctaSection  = { position: 'relative', overflow: 'hidden', padding: '120px 36px', textAlign: 'center' }

/* Footer */
const footerEl    = { width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#07071a', padding: '60px 0 32px' }
const footerInner = { maxWidth: 1160, margin: '0 auto', padding: '0 36px' }
const footerTop   = { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }
const footerGroupTitle = { fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(232,236,242,0.3)', marginBottom: 14 }
const footerLinks = { display: 'flex', flexDirection: 'column', gap: 10 }
const footerLink  = { fontSize: 13, color: 'rgba(232,236,242,0.45)', cursor: 'pointer', textDecoration: 'none', transition: 'color .15s', display: 'block' }
const footerBottom = { borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, fontSize: 12, color: 'rgba(232,236,242,0.2)', textAlign: 'center' }