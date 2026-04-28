import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const LABEL = { matematica:'Matematica', programacao:'Programacao', ingles:'Ingles', fisica:'Fisica', quimica:'Quimica', historia:'Historia', portugues:'Portugues', biologia:'Biologia', economia:'Economia', filosofia:'Filosofia', redacao:'Redacao' }
const toLabel = t => LABEL[t?.toLowerCase()] || t || 'Estudos'

/* ─── Typing dots ─── */
const TypingDots = () => (
  <span style={{ display:'inline-flex', gap:4 }}>
    {[0,1,2].map(i => (
      <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#7bb3f0', display:'inline-block', animation:`tdot 1.2s ease-in-out ${i*0.2}s infinite` }} />
    ))}
  </span>
)

/* ─── Mascot SVG (small, for chat border) ─── */
function MiniMascot() {
  return (
    <svg width="36" height="36" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="75" rx="30" ry="24" fill="#4f7edd"/>
      <circle cx="60" cy="46" r="26" fill="#4f7edd"/>
      <ellipse cx="51" cy="43" rx="5" ry="6" fill="#fff"/>
      <ellipse cx="69" cy="43" rx="5" ry="6" fill="#fff"/>
      <circle cx="52" cy="44" r="3" fill="#1a1a2e"/>
      <circle cx="70" cy="44" r="3" fill="#1a1a2e"/>
      <circle cx="53.2" cy="42.8" r="1.2" fill="#fff"/>
      <circle cx="71.2" cy="42.8" r="1.2" fill="#fff"/>
      <path d="M52 52 Q60 58 68 52" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
      <rect x="42" y="68" width="36" height="9" rx="4.5" fill="#d4924a"/>
    </svg>
  )
}

/* ─── New chat modal ─── */
const MAIN_S  = ['Matematica','Redacao','Ingles']
const MORE_S  = ['Fisica','Quimica','Historia','Portugues','Biologia','Economia','Filosofia','Programacao','Outro']
const TIMES_S = ['5 min','10 min','15 min','30 min']

function NewChatModal({ onClose, onCreate }) {
  const [subject, setSubject] = useState('')
  const [time,    setTime]    = useState('')
  const [custom,  setCustom]  = useState('')
  const [more,    setMore]    = useState(false)
  const valid = (subject && subject !== 'Outro') || (subject === 'Outro' && custom.trim().length > 1)

  return (
    <div style={modal.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal.box}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'#e8ecf2' }}>Novo chat</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6e7a92', cursor:'pointer', fontSize:20, lineHeight:1 }}>×</button>
        </div>
        <div style={{ fontSize:12, color:'#6e7a92', marginBottom:10 }}>Assunto</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:7, marginBottom:8 }}>
          {MAIN_S.map(s => (
            <button key={s} onClick={() => setSubject(s)} style={{ ...modal.btn, background: subject===s ? '#4f7edd' : 'rgba(255,255,255,0.05)', color: subject===s ? '#fff' : '#c4d4e8', borderColor: subject===s ? '#4f7edd' : 'rgba(255,255,255,0.1)' }}>{s}</button>
          ))}
        </div>
        <button onClick={() => setMore(v=>!v)} style={{ fontSize:12, color:'#4f7edd', background:'none', border:'none', cursor:'pointer', marginBottom:8, fontFamily:'inherit' }}>
          {more ? 'Menos opções' : 'Mais matérias'}
        </button>
        {more && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:8 }}>
            {MORE_S.map(s => (
              <button key={s} onClick={() => setSubject(s)} style={{ ...modal.btn, fontSize:12, background: subject===s ? '#4f7edd' : 'rgba(255,255,255,0.04)', color: subject===s ? '#fff' : '#8892a4', borderColor: subject===s ? '#4f7edd' : 'rgba(255,255,255,0.08)' }}>{s}</button>
            ))}
          </div>
        )}
        {subject === 'Outro' && (
          <input autoFocus type="text" placeholder="Qual assunto?" value={custom} onChange={e=>setCustom(e.target.value)}
            style={{ ...modal.inp, marginBottom:12 }} />
        )}
        <div style={{ fontSize:12, color:'#6e7a92', marginBottom:8 }}>Tempo de estudo</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7, marginBottom:18 }}>
          {TIMES_S.map(t => (
            <button key={t} onClick={() => setTime(t)} style={{ ...modal.btn, background: time===t ? '#d4924a' : 'rgba(255,255,255,0.04)', color: time===t ? '#fff' : '#8892a4', borderColor: time===t ? '#d4924a' : 'rgba(255,255,255,0.08)' }}>{t}</button>
          ))}
        </div>
        <button disabled={!valid || !time} onClick={() => onCreate(subject==='Outro'?custom.trim():subject, time)}
          style={{ ...modal.create, opacity: valid&&time ? 1 : 0.4 }}>
          Criar chat
        </button>
      </div>
    </div>
  )
}

/* ─── Main Chat ─── */
let chatIdCounter = 2

export default function Chat() {
  const navigate  = useNavigate()
  const [params]  = useSearchParams()
  const initTopic = params.get('topic') || 'estudos'
  const initTime  = params.get('time')  || '30'

  /* Chats list */
  const [chats, setChats] = useState([
    { id: 1, topic: initTopic, time: initTime, archived: false,
      messages: [{ role:'assistant', text:`Oi! Vamos comecar sua sessao de ${toLabel(initTopic)} (${initTime} min).\n\nFaca perguntas, peça explicacoes ou diga "comecar atividade" para eu gerar um exercicio.` }] },
  ])
  const [activeId,   setActiveId]   = useState(1)
  const [sideOpen,   setSideOpen]   = useState(true)
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [tab,        setTab]        = useState('chats')   // 'chats' | 'archived' | 'settings'
  const [showModal,  setShowModal]  = useState(false)
  const [ctxMenu,    setCtxMenu]    = useState(null)      // { id, x, y }
  const [mob,        setMob]        = useState(window.innerWidth < 700)

  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    const fn = () => setMob(window.innerWidth < 700)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [chats, loading, activeId])

  const activeChat = chats.find(c => c.id === activeId)

  /* ── Actions ── */
  function archiveChat(id) {
    setChats(cs => cs.map(c => c.id===id ? { ...c, archived: !c.archived } : c))
    setCtxMenu(null)
  }
  function deleteChat(id) {
    const remaining = chats.filter(c => c.id !== id)
    setChats(remaining)
    if (activeId === id) setActiveId(remaining[0]?.id ?? null)
    setCtxMenu(null)
  }
  function createChat(topic, time) {
    const id = ++chatIdCounter
    const newChat = {
      id, topic, time: time.replace(' min',''), archived: false,
      messages: [{ role:'assistant', text:`Vamos comecar ${toLabel(topic)} (${time})! Pode perguntar ou pedir uma atividade.` }],
    }
    setChats(cs => [...cs, newChat])
    setActiveId(id); setShowModal(false); setTab('chats')
  }
  function switchChat(id) {
    setActiveId(id)
    if (mob) setSideOpen(false)
  }

  /* ── Send message ── */
  async function send() {
    const text = input.trim()
    if (!text || loading || !activeChat) return
    setInput('')
    const updated = { ...activeChat, messages: [...activeChat.messages, { role:'user', text }] }
    setChats(cs => cs.map(c => c.id===activeId ? updated : c))
    setLoading(true)
    try {
      await new Promise(r => setTimeout(r, 900 + Math.random()*400))
      const reply = `Recebi sua mensagem sobre ${toLabel(activeChat.topic)}. A integracao com a IA sera ativada quando o backend estiver conectado!`
      setChats(cs => cs.map(c => c.id===activeId ? { ...c, messages:[...c.messages, { role:'user',text }, { role:'assistant',text:reply }] } : c))
    } catch {
      setChats(cs => cs.map(c => c.id===activeId ? { ...c, messages:[...c.messages, { role:'user',text }, { role:'assistant',text:'Erro ao conectar com o servidor.' }] } : c))
    } finally { setLoading(false) }
  }
  function onKey(e) { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const visibleChats   = chats.filter(c => !c.archived)
  const archivedChats  = chats.filter(c => c.archived)

  /* ── Context menu handler ── */
  useEffect(() => {
    const fn = () => setCtxMenu(null)
    window.addEventListener('click', fn)
    return () => window.removeEventListener('click', fn)
  }, [])

  return (
    <div style={shell}>

      {/* ── VHS scanline overlay ── */}
      <div style={vhsOverlay} />

      {/* ── Screen bezel (mascot-screen relevo) ── */}
      <div style={bezelTop}>
        <div style={bezelDot} /><div style={bezelDot} /><div style={bezelDot} />
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <MiniMascot />
          <span style={{ fontSize:12, fontWeight:700, color:'rgba(232,236,242,0.5)', letterSpacing:'0.3px' }}>
            {activeChat ? toLabel(activeChat.topic) : 'MetaPPS'}
          </span>
        </div>
      </div>
      <div style={bezelBottom} />
      <div style={bezelLeft}  />
      <div style={bezelRight} />

      {/* ── Sidebar ── */}
      <aside style={{ ...sidebar, width: sideOpen ? (mob ? '100%' : 240) : 0, minWidth: sideOpen ? (mob ? '100%' : 240) : 0 }}>
        {/* Sidebar header */}
        <div style={sideHead}>
          <span style={{ fontSize:15, fontWeight:700, color:'#e8ecf2' }}>MetaPPS</span>
          <button onClick={() => setSideOpen(false)} style={iconBtn} title="Fechar">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
        </div>

        {/* New chat button */}
        <button onClick={() => setShowModal(true)} style={newChatBtn}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo chat
        </button>

        {/* Tab nav */}
        <div style={tabRow}>
          {[['chats','Chats'],['archived','Arquivados']].map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ ...tabBtn, color: tab===key ? '#4f7edd' : '#6e7a92', borderBottom: tab===key ? '2px solid #4f7edd' : '2px solid transparent' }}>{label}</button>
          ))}
        </div>

        {/* Chat list */}
        <div style={{ flex:1, overflowY:'auto', padding:'8px 8px' }}>
          {(tab === 'chats' ? visibleChats : archivedChats).map(c => (
            <div key={c.id} style={{ position:'relative' }}
              onContextMenu={e => { e.preventDefault(); setCtxMenu({ id:c.id, x:e.clientX, y:e.clientY }) }}>
              <button onClick={() => switchChat(c.id)} style={{ ...chatItem, background: activeId===c.id ? 'rgba(79,126,221,0.14)' : 'transparent', borderColor: activeId===c.id ? 'rgba(79,126,221,0.28)' : 'transparent' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#e8ecf2', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {toLabel(c.topic)}
                </div>
                <div style={{ fontSize:11, color:'#3e4760', marginTop:2 }}>{c.messages.length} mens.</div>
              </button>
            </div>
          ))}
          {(tab === 'chats' ? visibleChats : archivedChats).length === 0 && (
            <div style={{ fontSize:13, color:'#3e4760', textAlign:'center', padding:'20px 8px' }}>
              {tab === 'archived' ? 'Nenhum chat arquivado' : 'Nenhum chat ativo'}
            </div>
          )}
        </div>

        {/* Bottom: Settings */}
        <div style={sideBottom}>
          <button onClick={() => navigate('/criar')} style={sideAction}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Configuracoes
          </button>
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <main style={chatMain}>
        {/* Header */}
        <header style={chatHeader}>
          {!sideOpen && (
            <button onClick={() => setSideOpen(true)} style={iconBtn} title="Abrir sidebar">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          )}
          <div style={{ flex:1 }} />
          {activeChat && (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#e8ecf2' }}>{toLabel(activeChat.topic)}</div>
                <div style={{ fontSize:11, color:'#3e4760' }}>{activeChat.time} min · {activeChat.messages.length - 1} mensagens</div>
              </div>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#6aaf6a', boxShadow:'0 0 8px rgba(106,175,106,0.6)' }} />
            </div>
          )}
        </header>

        {/* Messages */}
        <div style={feed}>
          {!activeChat && (
            <div style={{ textAlign:'center', marginTop:60, color:'#3e4760', fontSize:14 }}>
              Selecione ou crie um chat para comecar.
            </div>
          )}
          {activeChat?.messages.map((m, i) => (
            <div key={i} style={{ display:'flex', justifyContent: m.role==='user' ? 'flex-end' : 'flex-start', marginBottom:14 }}>
              {m.role === 'assistant' && (
                <div style={aiAv}><MiniMascot /></div>
              )}
              <div style={m.role==='user' ? userBubble : aiBubble}>
                {m.text.split('\n').map((line,j) => <span key={j}>{line}{j<m.text.split('\n').length-1 && <br/>}</span>)}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display:'flex', justifyContent:'flex-start', marginBottom:14 }}>
              <div style={aiAv}><MiniMascot /></div>
              <div style={{ ...aiBubble, padding:'14px 18px' }}><TypingDots /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={inputArea}>
          <div style={inputWrap}>
            <textarea ref={textareaRef} rows={1} placeholder={activeChat ? `Mensagem sobre ${toLabel(activeChat.topic)}…` : 'Selecione um chat...'} value={input}
              onChange={e => setInput(e.target.value)} onKeyDown={onKey} disabled={!activeChat}
              style={textarea} />
            <button onClick={send} disabled={!input.trim()||loading||!activeChat} style={{ ...sendBtn, opacity: input.trim()&&!loading&&activeChat ? 1 : 0.35 }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <p style={inputHint}>Enter para enviar · Shift+Enter para nova linha</p>
        </div>
      </main>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <div style={{ position:'fixed', top:ctxMenu.y, left:ctxMenu.x, background:'#151a2e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'6px', boxShadow:'0 8px 28px rgba(0,0,0,0.5)', zIndex:200 }}
          onClick={e => e.stopPropagation()}>
          <button onClick={() => archiveChat(ctxMenu.id)} style={ctxItem}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
            {chats.find(c=>c.id===ctxMenu.id)?.archived ? 'Desarquivar' : 'Arquivar'}
          </button>
          <button onClick={() => deleteChat(ctxMenu.id)} style={{ ...ctxItem, color:'#e08080' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Excluir chat
          </button>
        </div>
      )}

      {/* ── New chat modal ── */}
      {showModal && <NewChatModal onClose={() => setShowModal(false)} onCreate={createChat} />}

      <style>{`
        @keyframes tdot{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.07);border-radius:2px}
        textarea{resize:none;overflow-y:auto;max-height:130px;scrollbar-width:thin}
        textarea:focus{border-color:rgba(79,126,221,0.5)!important;outline:none}
        @media(max-width:700px){.chat-hint{display:none!important}}
      `}</style>
    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const shell      = { height:'100vh', display:'flex', position:'relative', overflow:'hidden', background:'#08091a', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased' }

/* VHS scanlines overlay */
const vhsOverlay = { position:'fixed', inset:0, zIndex:999, pointerEvents:'none',
  backgroundImage:'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.022) 2px, rgba(0,0,0,0.022) 4px)',
  backgroundSize:'100% 4px',
  mixBlendMode:'multiply',
}

/* Screen bezel — mascot-screen frame feel */
const bezelBase  = { position:'fixed', zIndex:50, pointerEvents:'none', background:'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)' }
const bezelTop   = { ...bezelBase, top:0, left:0, right:0, height:44, display:'flex', alignItems:'center', padding:'0 20px', gap:8, background:'rgba(5,6,16,0.82)', backdropFilter:'blur(10px)', borderBottom:'1px solid rgba(255,255,255,0.05)', zIndex:60 }
const bezelBottom = { ...bezelBase, bottom:0, left:0, right:0, height:16, background:'linear-gradient(to top, rgba(5,6,16,0.7) 0%, transparent 100%)' }
const bezelLeft  = { ...bezelBase, top:0, left:0, bottom:0, width:10, background:'linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 100%)' }
const bezelRight = { ...bezelBase, top:0, right:0, bottom:0, width:10, background:'linear-gradient(to left, rgba(0,0,0,0.5) 0%, transparent 100%)' }
const bezelDot   = { width:9, height:9, borderRadius:'50%', background:'rgba(255,255,255,0.12)' }

/* Sidebar */
const sidebar    = { flexShrink:0, height:'100%', display:'flex', flexDirection:'column', background:'#0d0f22', borderRight:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', transition:'width 0.28s cubic-bezier(0.16,1,0.3,1), min-width 0.28s', paddingTop:44, zIndex:10 }
const sideHead   = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 14px 8px' }
const newChatBtn = { margin:'6px 10px 2px', padding:'9px 14px', borderRadius:9, border:'none', background:'linear-gradient(120deg,#4f7edd,#3a6ccc)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, boxShadow:'0 2px 10px rgba(79,126,221,0.3)', transition:'opacity .15s' }
const tabRow     = { display:'flex', padding:'8px 10px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }
const tabBtn     = { flex:1, padding:'7px 0', background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit', transition:'all .14s' }
const chatItem   = { width:'100%', padding:'10px 10px', borderRadius:9, border:'1px solid', cursor:'pointer', fontFamily:'inherit', textAlign:'left', background:'transparent', transition:'all .14s', marginBottom:4 }
const sideBottom = { padding:'10px', borderTop:'1px solid rgba(255,255,255,0.06)' }
const sideAction = { width:'100%', padding:'9px 12px', borderRadius:8, border:'none', background:'rgba(255,255,255,0.04)', color:'#6e7a92', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, transition:'all .14s' }

/* Chat main */
const chatMain   = { flex:1, display:'flex', flexDirection:'column', overflow:'hidden', paddingTop:44 }
const chatHeader = { flexShrink:0, display:'flex', alignItems:'center', padding:'0 20px', height:54, borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(11,13,34,0.8)' }
const feed       = { flex:1, overflowY:'auto', padding:'20px', display:'flex', flexDirection:'column' }
const aiAv       = { width:36, height:36, borderRadius:10, background:'rgba(79,126,221,0.12)', border:'1px solid rgba(79,126,221,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginRight:10, marginTop:2, overflow:'hidden' }
const aiBubble   = { maxWidth:'75%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'0 14px 14px 14px', padding:'11px 15px', fontSize:14, color:'#e8ecf2', lineHeight:1.65 }
const userBubble = { maxWidth:'75%', background:'linear-gradient(120deg,#4f7edd,#3a6ccc)', borderRadius:'14px 0 14px 14px', padding:'11px 15px', fontSize:14, color:'#fff', lineHeight:1.65, boxShadow:'0 2px 12px rgba(79,126,221,0.3)' }
const inputArea  = { flexShrink:0, padding:'12px 16px 14px', borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(11,13,34,0.9)' }
const inputWrap  = { display:'flex', gap:8, alignItems:'flex-end', maxWidth:800, margin:'0 auto' }
const textarea   = { flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:11, color:'#e8ecf2', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, padding:'11px 13px', transition:'border-color .15s', lineHeight:1.55 }
const sendBtn    = { width:42, height:42, borderRadius:10, border:'none', background:'linear-gradient(120deg,#4f7edd,#3a6ccc)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'opacity .15s', boxShadow:'0 2px 10px rgba(79,126,221,0.35)' }
const inputHint  = { maxWidth:800, margin:'6px auto 0', fontSize:11, color:'#2e3649', textAlign:'center' }

/* Context menu */
const ctxItem    = { display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:7, background:'none', border:'none', color:'#c4d4e8', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', width:'100%', textAlign:'left', transition:'background .12s' }
const iconBtn    = { background:'none', border:'none', color:'#6e7a92', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:6, borderRadius:7, transition:'all .14s' }

/* Modal */
const modal = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'20px' },
  box:     { background:'#111428', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, padding:'26px 24px', width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.6)' },
  btn:     { padding:'8px 10px', borderRadius:8, border:'1px solid', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .14s' },
  inp:     { width:'100%', padding:'10px 12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#e8ecf2', fontFamily:'inherit', fontSize:13, outline:'none' },
  create:  { width:'100%', padding:'11px', borderRadius:9, border:'none', background:'linear-gradient(120deg,#4f7edd,#3a6ccc)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 12px rgba(79,126,221,0.4)', transition:'opacity .15s' },
}