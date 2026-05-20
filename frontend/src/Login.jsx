import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login, loginWithGoogle } from './api'
import logo from './assets/logo.svg'

/* Ícones */
const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 4l10 9 10-9"/>
  </svg>
)
const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)
const EyeShow = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeHide = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const Spin = () => <svg style={{ animation:'spin .7s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><circle cx="12" cy="12" r="10" strokeOpacity=".22"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
const GIcon = () => <svg width="16" height="16" viewBox="0 0 48 48" style={{ flexShrink:0 }}><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h12.7c-.5 2.8-2.2 5.1-4.6 6.7v5.5h7.4c4.3-4 6.8-9.9 6.8-16.4z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.5c-2.2 1.4-4.9 2.2-8.5 2.2-6.5 0-12-4.4-14-10.3H2.4v5.7C6.4 42.8 14.6 48 24 48z"/><path fill="#FBBC05" d="M10 28.6A14.9 14.9 0 0 1 10 24c0-1.6.3-3.1.7-4.6v-5.7H2.4A24 24 0 0 0 0 24c0 3.9.9 7.6 2.4 10.9L10 28.6z"/><path fill="#EA4335" d="M24 9.5c3.6 0 6.9 1.2 9.4 3.6l7-7C36.3 2.4 30.6 0 24 0 14.6 0 6.4 5.2 2.4 13.1l7.6 5.7C12 12.9 17.5 9.5 24 9.5z"/></svg>

function PwField({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#a8a6c8', display:'flex', pointerEvents:'none' }}>
        <IconLock />
      </div>
      <input type={show?'text':'password'} value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete}
        style={{ ...inp, paddingLeft:42, paddingRight:44 }} />
      <button type="button" onClick={() => setShow(v=>!v)} style={eyeBtn}>
        {show ? <EyeHide /> : <EyeShow />}
      </button>
    </div>
  )
}

function mapErr(m='') {
  if (m.includes('failed to fetch')||m.includes('networkerror')||m.includes('load failed')) return 'Sem conexao com o servidor.'
  if (m.includes('invalid')||m.includes('password')||m.includes('credentials')) return 'E-mail ou senha incorretos.'
  return m||'Algo deu errado.'
}

export default function Login() {
  const navigate = useNavigate()
  const [mob, setMob]     = useState(window.innerWidth<=768)
  const [email, setEmail] = useState('')
  const [pw,    setPw]    = useState('')
  const [err,   setErr]   = useState('')
  const [load,  setLoad]  = useState(false)
  const [out,   setOut]   = useState(false)

  useEffect(() => {
    const fn = () => setMob(window.innerWidth<=768)
    window.addEventListener('resize',fn); return () => window.removeEventListener('resize',fn)
  },[])

  function go(p) { setOut(true); setTimeout(()=>navigate(p),230) }

  async function submit(e) {
    e.preventDefault(); setErr('')
    if (!email.trim()||!pw) { setErr('Preencha todos os campos.'); return }
    setLoad(true)
    try { await login(email.trim(),pw); go('/splash') }
    catch(er) { setErr(mapErr(er.message)) }
    finally { setLoad(false) }
  }

  async function handleGoogle() {
    try { await loginWithGoogle(); go('/splash') }
    catch(er) { setErr(mapErr(er.message)) }
  }

  const form = (
    <>
      <h1 style={title}>Bem-vindo de volta</h1>
      <p style={sub}>Entre com sua conta para continuar.</p>
      <form onSubmit={submit} noValidate>
        <div style={field}>
          <label style={lbl}>E-mail</label>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#a8a6c8', display:'flex', pointerEvents:'none' }}>
              <IconMail />
            </div>
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
        <button type="submit" disabled={load} style={{ ...btnMain, opacity:load?.55:1, marginTop:4 }}>
          {load ? <><Spin /> Entrando…</> : 'Entrar'}
        </button>
      </form>
      <div style={orRow}><span style={orLine}/><span style={orText}>ou</span><span style={orLine}/></div>
      <button onClick={handleGoogle} style={btnGoogle}><GIcon /> Continuar com Google</button>
      <p style={footTxt}>Sem conta?{' '}<a href="#" style={footLnk} onClick={e=>{e.preventDefault();go('/register')}}>Criar conta</a></p>
    </>
  )

  if (mob) return (
    <div style={mobPage}>
      <div style={{ marginBottom:28, textAlign:'center', animation:'fIn .5s ease both' }}>
        <img src={logo} alt="Metapps" style={{ height:48, width:'auto' }}
          onError={e=>{e.target.style.display='none'}} />
      </div>
      <div style={{ ...mobCard, animation: out?'fOut .22s ease-in forwards':'fIn .5s ease both' }}>{form}</div>
      <style>{ANIMS}</style>
    </div>
  )

  return (
    <div style={split}>
      {/* LEFT – agora com efeito de vidro fosco */}
      <div style={leftPanel}>
        {/* Camada de fundo com blobs e grain (atrás do vidro) */}
        <div style={leftBgLayer}>
          <div style={lpGrain} />
          <div style={{ ...lpBlob, width:640, height:640, background:'#5d6b8e', top:-220, left:-180, opacity:0.15 }} />
          <div style={{ ...lpBlob, width:400, height:400, background:'#27187e', opacity:0.1, bottom:-100, right:-40 }} />
          <div style={{ ...lpBlob, width:260, height:260, background:'#a8a6c8', opacity:0.08, top:'45%', right:'18%' }} />
        </div>

        {/* Camada de vidro fosco */}
        <div style={glassOverlay} />

        {/* Conteúdo nítido acima do vidro */}
        <div style={{ position:'relative', zIndex:3, textAlign:'center', animation:'lgIn .9s ease both .1s' }}>
          <img src={logo} alt="Metapps" style={{ width:'min(320px,40vw)', height:'auto', display:'block', margin:'0 auto', filter:'drop-shadow(0 20px 60px rgba(39,24,126,0.3))' }}
            onError={e=>{e.target.style.display='none';e.target.insertAdjacentHTML('afterend','<div style="font-family:\'Playfair Display\',serif;font-size:clamp(42px,6vw,62px);font-weight:700;letter-spacing:-2px;color:#e8ecf2;background:linear-gradient(120deg,#5d6b8e,#27187e);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Metapps</div>')}} />
        </div>
      </div>

      {/* RIGHT */}
      <div style={rightPanel}>
        <div style={{ ...fbox, animation: out?'fOut .22s ease-in forwards':'fIn .55s ease both' }}>{form}</div>
      </div>
      <style>{ANIMS}</style>
    </div>
  )
}

/* Animações */
const ANIMS = `
  @keyframes fIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fOut{from{opacity:1}to{opacity:0;transform:translateY(-12px)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes lgIn{from{opacity:0;transform:scale(0.88)}to{opacity:1;transform:scale(1)}}
  input[type=password]::-ms-reveal,input[type=password]::-ms-clear{display:none}
  input::-webkit-credentials-auto-fill-button,input::-webkit-contacts-auto-fill-button{visibility:hidden;pointer-events:none;width:0;height:0}
  input:focus{border-color:#5d6b8e!important;box-shadow:0 0 0 3px rgba(93,107,142,0.2)!important;outline:none}
`

/* Layout */
const split      = { display:'flex', height:'100vh', overflow:'hidden', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased' }

/* Painel esquerdo com vidro fosco */
const leftPanel = {
  flex:'0 0 58%',
  position:'relative',
  overflow:'hidden',
  display:'flex',
  alignItems:'center',
  justifyContent:'center',
  background:'linear-gradient(158deg,#14182b 0%,#212842 55%,#14182b 100%)' /* fallback */
}

/* Camada de fundo (blobs + grain) */
const leftBgLayer = {
  position:'absolute',
  inset:0,
  zIndex:0,
}

/* Vidro fosco – cobre todo o painel esquerdo */
const glassOverlay = {
  position:'absolute',
  inset:0,
  zIndex:1,
  backdropFilter:'blur(24px)',
  WebkitBackdropFilter:'blur(24px)',
  background:'rgba(33,40,66,0.25)',  /* tom da paleta com transparência */
  borderRight:'1px solid rgba(168,166,200,0.08)',
}

/* Blobs e grain (mesmos de antes, apenas reposicionados dentro de leftBgLayer) */
const lpGrain = {
  position:'absolute',
  inset:0,
  pointerEvents:'none',
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.76' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
  zIndex:0,
}
const lpBlob = {
  position:'absolute',
  borderRadius:'50%',
  filter:'blur(100px)',
  pointerEvents:'none',
  zIndex:0,
}

/* Painel direito (inalterado) */
const rightPanel = { flex:'0 0 42%', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 52px', overflowY:'auto', position:'relative', background:'linear-gradient(160deg,#1a1e33 0%,#212842 40%,#1a1e33 100%)' }

/* Mobile */
const mobPage   = { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px', background:'linear-gradient(158deg,#14182b 0%,#212842 55%,#14182b 100%)', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased' }
const mobCard   = { width:'100%', maxWidth:400, background:'rgba(247,247,255,0.02)', border:'1px solid rgba(168,166,200,0.08)', borderRadius:16, padding:'32px 26px 28px' }
const fbox      = { width:'100%', maxWidth:360 }

/* Tipografia */
const title     = { fontSize:22, fontWeight:700, color:'#f7f7ff', letterSpacing:'-0.5px', lineHeight:1.2, marginBottom:6 }
const sub       = { fontSize:13.5, color:'#a8a6c8', lineHeight:1.5, marginBottom:24 }

/* Campos */
const field     = { marginBottom:16 }
const lbl       = { display:'block', fontSize:12.5, fontWeight:600, color:'#a8a6c8', letterSpacing:'0.3px', marginBottom:6 }
const inp       = {
  width:'100%', background:'rgba(247,247,255,0.04)', border:'1.5px solid rgba(168,166,200,0.15)',
  borderRadius:12, color:'#f7f7ff', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14,
  padding:'13px 14px', outline:'none', transition:'border-color .2s, box-shadow .2s',
  WebkitAppearance:'none', appearance:'none'
}
const eyeBtn    = { position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:6, color:'#a8a6c8', display:'flex', alignItems:'center', borderRadius:6, zIndex:2, transition:'color .15s' }

/* Links */
const forgotLnk = { fontSize:12.5, fontWeight:500, color:'#4f7edd', textDecoration:'none', transition:'color .15s' }
const footLnk   = { color:'#4f7edd', fontWeight:600, textDecoration:'none' }

/* Erro */
const errBox    = { background:'rgba(220,60,60,0.08)', border:'1px solid rgba(220,60,60,0.15)', borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:500, color:'#e08080', lineHeight:1.45, marginBottom:14 }

/* Botões */
const btnMain   = {
  width:'100%', padding:'13px', border:'none', borderRadius:12, fontFamily:"'Inter',-apple-system,sans-serif",
  fontSize:14.5, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
  gap:8, background:'#4f7edd', color:'#fff', transition:'all .2s',
  boxShadow:'0 4px 14px rgba(79,126,221,0.3)'
}
const btnGoogle = {
  width:'100%', padding:'13px', borderRadius:12, border:'1.5px solid rgba(168,166,200,0.2)',
  background:'rgba(247,247,255,0.02)', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14,
  fontWeight:600, color:'#f7f7ff', cursor:'pointer', display:'flex', alignItems:'center',
  justifyContent:'center', gap:10, transition:'background .2s, border-color .2s'
}

/* Separador "ou" */
const orRow     = { display:'flex', alignItems:'center', gap:14, margin:'20px 0 18px' }
const orLine    = { flex:1, height:1, background:'rgba(168,166,200,0.15)' }
const orText    = { fontSize:12, color:'#a8a6c8', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.5px' }

/* Rodapé */
const footTxt   = { fontSize:13.5, color:'#a8a6c8', textAlign:'center', marginTop:20 }