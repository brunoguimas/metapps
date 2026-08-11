// ─── REACT DO CELLBIT ────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login, loginWithGoogle } from './api'
import logo from './assets/logo.svg'
import icon from './assets/icon.svg'

// ─── ÍCONES (xml) ───────────────────────────
const IconMail = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 4l10 9 10-9"/></svg>
const IconLock = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const IconBack = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
const EyeShow  = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeHide  = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const Spin     = () => <svg style={{ animation:'spin .7s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><circle cx="12" cy="12" r="10" strokeOpacity=".22"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
const GIcon    = () => <svg width="16" height="16" viewBox="0 0 48 48" style={{ flexShrink:0 }}><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h12.7c-.5 2.8-2.2 5.1-4.6 6.7v5.5h7.4c4.3-4 6.8-9.9 6.8-16.4z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.5c-2.2 1.4-4.9 2.2-8.5 2.2-6.5 0-12-4.4-14-10.3H2.4v5.7C6.4 42.8 14.6 48 24 48z"/><path fill="#FBBC05" d="M10 28.6A14.9 14.9 0 0 1 10 24c0-1.6.3-3.1.7-4.6v-5.7H2.4A24 24 0 0 0 0 24c0 3.9.9 7.6 2.4 10.9L10 28.6z"/><path fill="#EA4335" d="M24 9.5c3.6 0 6.9 1.2 9.4 3.6l7-7C36.3 2.4 30.6 0 24 0 14.6 0 6.4 5.2 2.4 13.1l7.6 5.7C12 12.9 17.5 9.5 24 9.5z"/></svg>

// ─── FILTRO DE ERROS AMIGÁVEL (CELLBIT STYLE) ──────────────
function mapErr(m = '') {
  const msg = m.toLowerCase?.() ?? String(m)
  
  // Conexão / rede
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('timeout') ||
    msg.includes('unreachable')
  ) {
    return 'Sem conexão com o servidor. Verifique sua internet.'
  }

  // Credenciais / login
  if (
    msg.includes('invalid') ||
    msg.includes('password') ||
    msg.includes('credentials') ||
    msg.includes('unauthorized') ||
    msg.includes('senha') ||
    msg.includes('credenciais')
  ) {
    if (msg.includes('email') || msg.includes('e-mail') || msg.includes('usuário') || msg.includes('user')) {
      return 'E-mail ou senha incorretos.'
    }
    return 'E-mail ou senha incorretos.'
  }

  // Usuário não encontrado
  if (
    msg.includes('not found') ||
    msg.includes('não encontrado') ||
    msg.includes('inexistente') ||
    msg.includes('no user')
  ) {
    return 'Usuário não encontrado. Verifique o e-mail ou crie uma conta.'
  }

  // Conta bloqueada / desativada
  if (
    msg.includes('disabled') ||
    msg.includes('blocked') ||
    msg.includes('locked') ||
    msg.includes('suspended') ||
    msg.includes('bloqueada') ||
    msg.includes('desativada')
  ) {
    return 'Sua conta foi temporariamente bloqueada. Entre em contato com o suporte.'
  }

  // Muitas tentativas / rate limit
  if (
    msg.includes('too many') ||
    msg.includes('rate limit') ||
    msg.includes('muitas tentativas') ||
    msg.includes('429')
  ) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  }

  // Bad request genérico (400)
  if (msg.includes('bad request') || msg.includes('400') || msg.includes('requisição inválida')) {
    return 'Dados inválidos. Verifique os campos e tente novamente.'
  }

  // Erro interno do servidor (500)
  if (msg.includes('internal server') || msg.includes('500') || msg.includes('erro interno')) {
    return 'Erro no servidor. Nossa equipe já foi notificada. Tente mais tarde.'
  }

  // Qualquer outra mensagem que veio do backend (não mostrar ao usuário)
  // Se for uma string genérica mas não vazia, retornamos um fallback educado
  if (msg && msg.length > 0) {
    return 'Algo deu errado. Tente novamente em alguns instantes.'
  }

  // Fallback final (caso raro)
  return 'Ocorreu um erro inesperado. Por favor, tente novamente.'
}

// ─── COMPONENTES AUXILIARES ─────────────────────────────────
function PwField({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(245,244,255,0.35)', display:'flex', pointerEvents:'none' }}><IconLock /></div>
      <input type={show?'text':'password'} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete}
        style={{ ...inp, paddingLeft:42, paddingRight:44 }} />
      <button type="button" onClick={() => setShow(v=>!v)} style={eyeBtn}>{show ? <EyeHide /> : <EyeShow />}</button>
    </div>
  )
}

// ─── LOGIN (o componente em si finalmente) ───────────────────
export default function Login() {
  const navigate = useNavigate()
  const [mob,   setMob]   = useState(window.innerWidth<=768)
  const [email, setEmail] = useState('')
  const [pw,    setPw]    = useState('')
  const [err,   setErr]   = useState('')
  const [load,  setLoad]  = useState(false)
  const [out,   setOut]   = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'auto'; document.body.style.height = 'auto'
    document.title = 'Entrar — Metapps'
    const favicon = document.querySelector("link[rel*='icon']")
    if (favicon) favicon.href = icon
    else { const l = document.createElement('link'); l.rel='icon'; l.href=icon; document.head.appendChild(l) }
    return () => { document.body.style.overflow = ''; document.body.style.height = '' }
  }, [])

  useEffect(() => {
    const fn = () => setMob(window.innerWidth<=768)
    window.addEventListener('resize',fn); return () => window.removeEventListener('resize',fn)
  },[])

  function go(p) { setOut(true); setTimeout(()=>navigate(p),230) }

  async function submit(e) {
    e.preventDefault(); setErr('')
    if (!email.trim()||!pw) { setErr('Preencha todos os campos.'); return }
    setLoad(true)
    try { await login(email.trim(),pw); go('/home') }
    catch(er) { setErr(mapErr(er?.message || er)) }
    finally { setLoad(false) }
  }

  async function handleGoogle() {
    try { await loginWithGoogle(); go('/home') }
    catch(er) { setErr(mapErr(er?.message || er)) }
  }

  const BackBtn = () => (
    <button onClick={() => navigate('/')}
      onMouseEnter={e => e.currentTarget.style.color='#f5f4ff'}
      onMouseLeave={e => e.currentTarget.style.color='rgba(245,244,255,0.5)'}
      style={{ position:'absolute', top:20, left:20, zIndex:10, display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'rgba(245,244,255,0.5)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'color .15s', padding:4 }}>
      <IconBack /> Voltar
    </button>
  )

  const form = (
    <>
      <h1 style={formTitle}>Bem-vindo de volta</h1>
      <p style={formSub}>Entre com sua conta para continuar.</p>

      <button onClick={handleGoogle} style={btnGoogle}><GIcon /> Continuar com Google</button>

      <div style={{ display:'flex', alignItems:'center', gap:14, margin:'18px 0' }}>
        <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }}/>
        <span style={{ fontSize:12, color:'rgba(245,244,255,0.35)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.5px' }}>ou</span>
        <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }}/>
      </div>

      <form onSubmit={submit} noValidate>
        <div style={field}>
          <label style={lbl}>E-mail</label>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(245,244,255,0.35)', display:'flex', pointerEvents:'none' }}><IconMail /></div>
            <input type="email" placeholder="voce@email.com" autoComplete="email"
              style={{ ...inp, paddingLeft:42 }} value={email} onChange={e=>{setEmail(e.target.value);setErr('')}} />
          </div>
        </div>
        <div style={field}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <label style={lbl}>Senha</label>
            <Link to="/forgot-password" style={forgotLnk}>Esqueci a senha</Link>
          </div>
          <PwField value={pw} onChange={e=>{setPw(e.target.value);setErr('')}} placeholder="Sua senha" autoComplete="current-password" />
        </div>
        {err && <div style={errBox}>{err}</div>}
        <button type="submit" disabled={load} style={{ ...btnPrimary, opacity:load?0.7:1, marginTop:4 }}>
          {load ? <><Spin /> Entrando…</> : 'Entrar'}
        </button>
      </form>

      <p style={footTxt}>Sem conta?{' '}<a href="#" style={footLnk} onClick={e=>{e.preventDefault();go('/auth/register')}}>Criar conta</a></p>
    </>
  )

  if (mob) return (
    <div style={mobPage}>
      <BackBtn />
      <div style={{ marginBottom:28, textAlign:'center' }}>
        <img src={logo} alt="Metapps" style={{ height:48, width:'auto' }} onError={e=>e.target.style.display='none'} />
      </div>
      <div style={{ ...mobCard, animation: out?'fOut .22s ease-in forwards':'fIn .5s ease both' }}>{form}</div>
      <style>{ANIMS}</style>
    </div>
  )

  return (
    <div style={split}>
      <BackBtn />
      <div style={leftPanel}>
        <img src={logo} alt="Metapps"
          style={{ width:'min(220px,30vw)', height:'auto', display:'block', margin:'0 auto', cursor:'pointer', position:'relative', zIndex:1 }}
          onClick={() => navigate('/')} onError={e=>e.target.style.display='none'} />
      </div>
      <div style={rightPanel}>
        <div style={{ ...fbox, animation: out?'fOut .22s ease-in forwards':'fIn .55s ease both' }}>{form}</div>
      </div>
      <style>{ANIMS}</style>
    </div>
  )
}

// ─── CSS QUE EU AMO <3 AI KAWAIIII ───────────────────────────────────────
const ANIMS = `
  @keyframes fIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fOut{from{opacity:1}to{opacity:0;transform:translateY(-12px)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  input[type=password]::-ms-reveal,input[type=password]::-ms-clear{display:none}
  input::-webkit-credentials-auto-fill-button,input::-webkit-contacts-auto-fill-button{visibility:hidden;pointer-events:none;width:0;height:0}
  input:focus{border-color:#6382ff!important;box-shadow:0 0 0 3px rgba(99,130,255,0.2)!important;outline:none}
`

const split      = { display:'flex', height:'100vh', overflow:'hidden', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', background:'#1a1a2e', position:'relative' }
const leftPanel  = { flex:'0 0 45%', position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(160deg, #0f1535 0%, #1a2550 50%, #0f1535 100%)' }
const rightPanel = { flex:'0 0 55%', display:'flex', alignItems:'center', justifyContent:'center', padding:'28px 60px', overflowY:'auto', background:'#141930' }
const mobPage    = { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px 40px', background:'linear-gradient(160deg, #0f1535 0%, #141930 60%, #0f1535 100%)', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', position:'relative' }
const mobCard    = { width:'100%', maxWidth:400 }
const fbox       = { width:'100%', maxWidth:380 }
const formTitle  = { fontSize:28, fontWeight:900, color:'#f5f4ff', letterSpacing:'-0.5px', lineHeight:1.2, marginBottom:6 }
const formSub    = { fontSize:14, color:'rgba(245,244,255,0.5)', lineHeight:1.5, marginBottom:20 }
const field      = { marginBottom:14 }
const lbl        = { display:'block', fontSize:12.5, fontWeight:600, color:'rgba(245,244,255,0.45)', letterSpacing:'0.2px', marginBottom:6 }
const inp        = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:10, color:'#f5f4ff', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, padding:'12px 14px', outline:'none', transition:'border-color .2s, box-shadow .2s', WebkitAppearance:'none', appearance:'none', boxSizing:'border-box' }
const eyeBtn     = { position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:6, color:'rgba(245,244,255,0.35)', display:'flex', alignItems:'center', borderRadius:6, zIndex:2 }
const forgotLnk  = { fontSize:12.5, fontWeight:600, color:'#9ab4ff', textDecoration:'none' }
const errBox     = { background:'rgba(240,106,106,0.08)', border:'1px solid rgba(240,106,106,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:500, color:'#f06a6a', lineHeight:1.45, marginBottom:13 }
const btnPrimary = { width:'100%', padding:'13px', border:'none', borderRadius:10, fontFamily:"'Inter',-apple-system,sans-serif", fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#6382ff', color:'#fff', transition:'all .2s' }
const btnGoogle  = { width:'100%', padding:'13px', borderRadius:10, border:'1.5px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, fontWeight:600, color:'#f5f4ff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'background .2s' }
const footTxt    = { fontSize:13.5, color:'rgba(245,244,255,0.45)', textAlign:'center', marginTop:24 }
const footLnk    = { color:'#9ab4ff', fontWeight:700, textDecoration:'none' }