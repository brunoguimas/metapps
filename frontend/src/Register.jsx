import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { register, emailVerify, resendVerification } from './api'
import logo from './assets/logo.svg'

/* Ícones */
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
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

function PwField({ value, onChange, placeholder, autoComplete, invalid }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#a8a6c8', display:'flex', pointerEvents:'none' }}>
        <IconLock />
      </div>
      <input type={show?'text':'password'} value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete}
        style={{ ...inp, paddingLeft:42, paddingRight:44, borderColor: invalid ? 'rgba(220,80,80,0.5)' : undefined }} />
      <button type="button" onClick={() => setShow(v=>!v)} style={eyeBtn}>
        {show ? <EyeHide /> : <EyeShow />}
      </button>
    </div>
  )
}

function Match({ pw, cpw }) {
  if (!cpw.length) return <div style={{ height:12 }} />
  return <div style={{ fontSize:11, marginTop:5, color: pw===cpw ? '#6aaf6a' : '#e08080' }}>
    {pw===cpw ? 'Senhas conferem' : 'Senhas não conferem'}
  </div>
}

function mapErr(m='') {
  if (m.includes('failed to fetch')||m.includes('networkerror')||m.includes('load failed')) return 'Sem conexão com o servidor.'
  if (m.includes("couldn't create")||m.includes('already')) return 'Este e-mail já está em uso.'
  if (m.includes('invalid')||m.includes('code')||m.includes('expired')) return 'Código inválido ou expirado.'
  return m||'Algo deu errado.'
}

/* ── VerifyPane – mesmo estilo aprimorado ── */
function VerifyPane({ email, onSuccess }) {
  const inputs = useRef([])
  const [digits, setDigits] = useState(['','','','','',''])
  const [err,    setErr]    = useState('')
  const [load,   setLoad]   = useState(false)
  const [cd,     setCd]     = useState(0)
  const [sent,   setSent]   = useState(false)
  const iv = useRef(null)

  function startCd() {
    setCd(30)
    iv.current = setInterval(() => setCd(x => { if (x<=1){clearInterval(iv.current);return 0} return x-1 }), 1000)
  }
  useEffect(() => () => { if (iv.current) clearInterval(iv.current) }, [])

  function handleDigit(i, val) {
    if (!/^\d*$/.test(val)) return
    const next = [...digits]
    next[i] = val.slice(-1)
    setDigits(next)
    setErr('')
    if (val && i < 5) inputs.current[i+1]?.focus()
    if (val && i === 5 && next.every(d => d)) submitCode(next.join(''))
  }

  function handleKey(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i-1]?.focus()
    }
    if (e.key === 'Enter') {
      const code = digits.join('')
      if (code.length === 6) submitCode(code)
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    if (!text) return
    e.preventDefault()
    const next = [...digits]
    text.split('').forEach((c,i) => { next[i] = c })
    setDigits(next)
    inputs.current[Math.min(text.length, 5)]?.focus()
    if (text.length === 6) submitCode(text)
  }

  async function submitCode(code) {
    setErr(''); setLoad(true)
    try {
      await emailVerify(email, code)
      onSuccess()
    } catch(er) {
      setErr(mapErr(er.message))
      setDigits(['','','','','',''])
      inputs.current[0]?.focus()
    } finally { setLoad(false) }
  }

  async function resend() {
    if (cd > 0) return
    try { await resendVerification(email) } catch(_) {}
    setSent(true); setTimeout(()=>setSent(false), 3000)
    startCd()
  }

  return (
    <div style={{ animation:'slideIn .5s cubic-bezier(0.16,1,0.3,1) both', textAlign:'center' }}>
      <div style={{ width:52, height:52, margin:'0 auto 18px', background:'rgba(79,126,221,0.1)', border:'1px solid rgba(79,126,221,0.2)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="22" height="22" fill="none" stroke="#4f7edd" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 4l10 9 10-9"/>
        </svg>
      </div>
      <h2 style={{ fontSize:20, fontWeight:700, color:'#f7f7ff', letterSpacing:'-0.3px', marginBottom:8 }}>Verifique seu e-mail</h2>
      <p style={{ fontSize:13, color:'#a8a6c8', lineHeight:1.65, marginBottom:28 }}>
        Enviamos um código de 6 dígitos para<br/>
        <strong style={{ color:'#f7f7ff', fontWeight:600 }}>{email}</strong>
      </p>

      <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:16 }} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => inputs.current[i] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
            style={{
              width:42, height:52, textAlign:'center', fontSize:22, fontWeight:700,
              background:'rgba(247,247,255,0.04)',
              border:`1.5px solid ${err ? 'rgba(220,80,80,0.4)' : d ? 'rgba(79,126,221,0.5)' : 'rgba(168,166,200,0.2)'}`,
              borderRadius:10, color:'#f7f7ff', fontFamily:"'Inter',-apple-system,sans-serif",
              outline:'none', transition:'border-color .2s, box-shadow .2s',
              boxShadow: d ? '0 0 0 3px rgba(79,126,221,0.1)' : 'none',
              caretColor:'transparent',
            }}
          />
        ))}
      </div>

      {err && <div style={{ ...errBox, marginBottom:14 }}>{err}</div>}

      <button
        onClick={() => submitCode(digits.join(''))}
        disabled={load || digits.some(d=>!d)}
        style={{ ...btnMain, opacity: (load || digits.some(d=>!d)) ? 0.5 : 1, marginBottom:16 }}
      >
        {load ? <><Spin /> Verificando…</> : 'Verificar código'}
      </button>

      <p style={{ fontSize:13, color:'#a8a6c8' }}>
        Não recebeu?{' '}
        <span onClick={resend} style={{ color: cd>0 ? '#a8a6c8' : '#4f7edd', fontWeight:600, cursor: cd>0 ? 'default' : 'pointer' }}>
          {cd>0 ? `Reenviar em ${cd}s` : 'Reenviar código'}
        </span>
      </p>
      {sent && <p style={{ fontSize:12, color:'#6aaf6a', marginTop:8 }}>Código reenviado!</p>}
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const [mob, setMob]     = useState(window.innerWidth<=768)
  const [uname, setUname] = useState('')
  const [email, setEmail] = useState('')
  const [pw,    setPw]    = useState('')
  const [cpw,   setCpw]   = useState('')
  const [terms, setTerms] = useState(false)
  const [err,   setErr]   = useState('')
  const [load,  setLoad]  = useState(false)
  const [out,   setOut]   = useState(false)
  const [done,  setDone]  = useState(false)

  useEffect(() => {
    const fn = () => setMob(window.innerWidth<=768)
    window.addEventListener('resize',fn); return () => window.removeEventListener('resize',fn)
  },[])

  function go(p) { setOut(true); setTimeout(()=>navigate(p),230) }

  async function submit(e) {
    e.preventDefault(); setErr('')
    if (!uname.trim()||!email.trim()||!pw||!cpw) { setErr('Preencha todos os campos.'); return }
    if (pw.length<8) { setErr('A senha deve ter pelo menos 8 caracteres.'); return }
    if (pw!==cpw)    { setErr('As senhas não conferem.'); return }
    if (!terms)      { setErr('Aceite os Termos de Serviço para continuar.'); return }
    setLoad(true)
    try {
      await register(uname.trim(), email.trim(), pw)
      setDone(true)
    } catch(er) { setErr(mapErr(er.message)) }
    finally { setLoad(false) }
  }

  const regForm = (
    <>
      <h1 style={title}>Criar conta</h1>
      <p style={sub}>Comece a aprender com IA hoje.</p>
      <form onSubmit={submit} noValidate>
        {/* Nome de usuário */}
        <div style={field}>
          <label style={lbl}>Nome de usuário</label>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#a8a6c8', display:'flex', pointerEvents:'none' }}>
              <IconUser />
            </div>
            <input type="text" placeholder="seunome" autoComplete="username"
              style={{ ...inp, paddingLeft:42 }} value={uname} onChange={e=>{setUname(e.target.value);setErr('')}} />
          </div>
        </div>

        {/* E-mail */}
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

        {/* Senha */}
        <div style={field}>
          <label style={lbl}>Senha</label>
          <PwField value={pw} onChange={e=>{setPw(e.target.value);setErr('')}} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
        </div>

        {/* Confirmar senha */}
        <div style={field}>
          <label style={lbl}>Confirmar senha</label>
          <PwField value={cpw} onChange={e=>{setCpw(e.target.value);setErr('')}} placeholder="Repita a senha" autoComplete="new-password" invalid={cpw.length>0&&pw!==cpw} />
          <Match pw={pw} cpw={cpw} />
        </div>

        {err && <div style={errBox}>{err}</div>}

        {/* Checkbox Termos */}
        <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'6px 0 16px' }}>
          <input type="checkbox" id="tc" checked={terms} onChange={e=>setTerms(e.target.checked)}
            style={{ marginTop:2, flexShrink:0, width:15, height:15, accentColor:'#4f7edd', cursor:'pointer' }} />
          <label htmlFor="tc" style={{ fontSize:12.5, color:'#a8a6c8', lineHeight:1.55, cursor:'pointer' }}>
            Li e concordo com os{' '}
            <span onClick={()=>window.open('/src/pages/Termos.html','_blank')} style={{ color:'#4f7edd', fontWeight:500, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2 }}>Termos de Serviço</span>
            {' '}e a{' '}
            <span onClick={()=>window.open('/src/pages/Termos.html#privacidade','_blank')} style={{ color:'#4f7edd', fontWeight:500, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2 }}>Política de Privacidade</span>
          </label>
        </div>

        <button type="submit" disabled={load} style={{ ...btnMain, opacity:load?.55:1 }}>
          {load ? <><Spin /> Criando conta…</> : 'Criar conta'}
        </button>
      </form>

      <p style={footTxt}>Já tem conta?{' '}<a href="#" style={footLnk} onClick={e=>{e.preventDefault();go('/login')}}>Entrar</a></p>
    </>
  )

  const content = done
    ? <VerifyPane email={email} onSuccess={() => go('/splash')} />
    : regForm

  if (mob) return (
    <div style={mobPage}>
      <div style={{ marginBottom:28, textAlign:'center', animation:'fIn .5s ease both' }}>
        <img src={logo} alt="Metapps" style={{ height:48, width:'auto' }}
          onError={e=>{e.target.style.display='none'}} />
      </div>
      <div style={{ ...mobCard, animation: out?'fOut .22s ease-in forwards':'fIn .5s ease both' }}>{content}</div>
      <style>{ANIMS}</style>
    </div>
  )

  return (
    <div style={split}>
      <div style={leftPanel}>
        <div style={lpGrain} />
        <div style={{ ...lpBlob, width:600, height:600, background:'#5d6b8e', top:-180, left:-160, opacity:0.12 }} />
        <div style={{ ...lpBlob, width:380, height:380, background:'#27187e', opacity:0.08, bottom:-80, right:-40 }} />
        <div style={{ ...lpBlob, width:240, height:240, background:'#a8a6c8', opacity:0.06, top:'40%', right:'20%' }} />
        <div style={{ position:'relative', zIndex:2, textAlign:'center', animation:'lgIn .9s ease both .1s' }}>
          <img src={logo} alt="Metapps" style={{ width:'min(300px,38vw)', height:'auto', display:'block', margin:'0 auto', filter:'drop-shadow(0 20px 60px rgba(39,24,126,0.2))' }}
            onError={e=>{e.target.style.display='none';e.target.insertAdjacentHTML('afterend','<div style="font-family:\'Playfair Display\',serif;font-size:clamp(42px,6vw,60px);font-weight:700;letter-spacing:-2px;color:#e8ecf2;background:linear-gradient(120deg,#5d6b8e,#27187e);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Metapps</div>')}} />
        </div>
        <div style={lpSep} />
      </div>
      <div style={rightPanel}>
        <div style={{ ...fbox, animation: out?'fOut .22s ease-in forwards':'fIn .55s ease both' }}>{content}</div>
      </div>
      <style>{ANIMS}</style>
    </div>
  )
}

/* ── Animações ─────────────────────────────────── */
const ANIMS = `
  @keyframes fIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fOut{from{opacity:1}to{opacity:0;transform:translateY(-12px)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes lgIn{from{opacity:0;transform:scale(0.88)}to{opacity:1;transform:scale(1)}}
  @keyframes slideIn{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  input[type=password]::-ms-reveal,input[type=password]::-ms-clear{display:none}
  input::-webkit-credentials-auto-fill-button,input::-webkit-contacts-auto-fill-button{visibility:hidden;pointer-events:none;width:0;height:0}
  input:focus{border-color:#5d6b8e!important;box-shadow:0 0 0 3px rgba(93,107,142,0.2)!important;outline:none}
`

/* ── Layout ────────────────────────────────────── */
const split      = { display:'flex', height:'100vh', overflow:'hidden', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased' }
const leftPanel  = { flex:'0 0 58%', position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(158deg,#14182b 0%,#212842 55%,#14182b 100%)' }
const lpGrain    = { position:'absolute', inset:0, pointerEvents:'none', zIndex:1, backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.76' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")` }
const lpBlob     = { position:'absolute', borderRadius:'50%', filter:'blur(100px)', pointerEvents:'none', zIndex:0, opacity:0.18 }
const lpSep      = { position:'absolute', right:0, top:0, width:160, height:'100%', background:'linear-gradient(90deg, transparent 0%, rgba(33,40,66,0.9) 60%, #212842 100%)', zIndex:3, pointerEvents:'none' }
const rightPanel = { flex:'0 0 42%', display:'flex', alignItems:'center', justifyContent:'center', padding:'28px 52px', overflowY:'auto', position:'relative', background:'linear-gradient(160deg,#1a1e33 0%,#212842 40%,#1a1e33 100%)' }

/* Mobile */
const mobPage   = { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px', background:'linear-gradient(158deg,#14182b 0%,#212842 55%,#14182b 100%)', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased' }
const mobCard   = { width:'100%', maxWidth:400, background:'rgba(247,247,255,0.02)', border:'1px solid rgba(168,166,200,0.08)', borderRadius:16, padding:'32px 26px 28px' }
const fbox      = { width:'100%', maxWidth:360 }

/* Tipografia */
const title     = { fontSize:22, fontWeight:700, color:'#f7f7ff', letterSpacing:'-0.5px', lineHeight:1.2, marginBottom:6 }
const sub       = { fontSize:13.5, color:'#a8a6c8', lineHeight:1.5, marginBottom:22 }

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

/* Rodapé */
const footTxt   = { fontSize:13.5, color:'#a8a6c8', textAlign:'center', marginTop:20 }