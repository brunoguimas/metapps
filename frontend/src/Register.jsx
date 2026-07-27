import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { register, emailVerify, resendVerification } from './api'
import logo from './assets/logo.svg'
import icon from './assets/icon.svg'

const IconUser = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IconMail = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 4l10 9 10-9"/></svg>
const IconLock = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const IconBack = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
const EyeShow = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeHide = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const Spin = () => <svg style={{ animation:'spin .7s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10" strokeOpacity=".22"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>

function PwField({ value, onChange, placeholder, autoComplete, invalid }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position:'relative' }}>
      <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(245,244,255,0.35)', display:'flex', pointerEvents:'none' }}>
        <IconLock />
      </div>
      <input type={show?'text':'password'} value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete}
        style={{ ...inp, paddingLeft:42, paddingRight:44, borderColor: invalid ? 'rgba(240,106,106,0.5)' : 'rgba(255,255,255,0.1)' }} />
      <button type="button" onClick={() => setShow(v=>!v)} style={eyeBtn}>
        {show ? <EyeHide /> : <EyeShow />}
      </button>
    </div>
  )
}

function Match({ pw, cpw }) {
  if (!cpw.length) return <div style={{ height:12 }} />
  return (
    <div style={{ fontSize:11, marginTop:5, color: pw===cpw ? '#3ecf8e' : '#f06a6a' }}>
      {pw===cpw ? 'Senhas conferem' : 'Senhas não conferem'}
    </div>
  )
}

function mapErr(m='') {
  if (m.includes('failed to fetch')||m.includes('networkerror')||m.includes('load failed')) return 'Sem conexão com o servidor.'
  if (m.includes("couldn't create")||m.includes('already')) return 'Este e-mail já está em uso.'
  if (m.includes('invalid')||m.includes('code')||m.includes('expired')) return 'Código inválido ou expirado.'
  return m||'Algo deu errado.'
}

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
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i-1]?.focus()
    if (e.key === 'Enter') { const code = digits.join(''); if (code.length === 6) submitCode(code) }
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
      <div style={{ width:52, height:52, margin:'0 auto 18px', background:'rgba(99,130,255,0.15)', border:'1px solid rgba(99,130,255,0.3)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="22" height="22" fill="none" stroke="#9ab4ff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 4l10 9 10-9"/>
        </svg>
      </div>
      <h2 style={{ fontSize:22, fontWeight:900, color:'#f5f4ff', letterSpacing:'-0.4px', marginBottom:8 }}>Verifique seu e-mail</h2>
      <p style={{ fontSize:14, color:'rgba(245,244,255,0.55)', lineHeight:1.65, marginBottom:28 }}>
        Enviamos um código de 6 dígitos para<br/>
        <strong style={{ color:'#f5f4ff', fontWeight:700 }}>{email}</strong>
      </p>

      <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:16 }} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input key={i} ref={el => inputs.current[i] = el}
            type="text" inputMode="numeric" maxLength={1} value={d}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
            style={{
              width:44, height:54, textAlign:'center', fontSize:24, fontWeight:800,
              background:'rgba(255,255,255,0.06)',
              border:`2px solid ${err ? 'rgba(240,106,106,0.6)' : d ? '#6382ff' : 'rgba(255,255,255,0.12)'}`,
              borderRadius:12, color:'#f5f4ff', fontFamily:"'Inter',-apple-system,sans-serif",
              outline:'none', transition:'border-color .15s, box-shadow .15s',
              boxShadow: d ? '0 0 0 3px rgba(99,130,255,0.2)' : 'none',
              caretColor:'transparent',
            }}
          />
        ))}
      </div>

      {err && <div style={{ ...errBox, marginBottom:14 }}>{err}</div>}

      <button onClick={() => submitCode(digits.join(''))} disabled={load || digits.some(d=>!d)}
        style={{ ...btnPrimary, opacity: (load || digits.some(d=>!d)) ? 0.5 : 1, marginBottom:16 }}>
        {load ? <><Spin /> Verificando…</> : 'Verificar código'}
      </button>

      <p style={{ fontSize:13, color:'rgba(245,244,255,0.45)' }}>
        Não recebeu?{' '}
        <span onClick={resend} style={{ color: cd>0 ? 'rgba(245,244,255,0.45)' : '#9ab4ff', fontWeight:700, cursor: cd>0 ? 'default' : 'pointer' }}>
          {cd>0 ? `Reenviar em ${cd}s` : 'Reenviar código'}
        </span>
      </p>
      {sent && <p style={{ fontSize:12, color:'#3ecf8e', marginTop:8 }}>Código reenviado!</p>}
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
    document.body.style.overflow = 'auto'
    document.body.style.height = 'auto'
    document.title = 'Criar conta — Metapps'
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
      <h1 style={formTitle}>Criar conta</h1>
      <p style={formSub}>Comece a aprender com IA hoje.</p>
      <form onSubmit={submit} noValidate>
        <div style={field}>
          <label style={lbl}>Nome de usuário</label>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(245,244,255,0.35)', display:'flex', pointerEvents:'none' }}><IconUser /></div>
            <input type="text" placeholder="seunome" autoComplete="username"
              style={{ ...inp, paddingLeft:42 }} value={uname} onChange={e=>{setUname(e.target.value);setErr('')}} />
          </div>
        </div>

        <div style={field}>
          <label style={lbl}>E-mail</label>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(245,244,255,0.35)', display:'flex', pointerEvents:'none' }}><IconMail /></div>
            <input type="email" placeholder="voce@email.com" autoComplete="email"
              style={{ ...inp, paddingLeft:42 }} value={email} onChange={e=>{setEmail(e.target.value);setErr('')}} />
          </div>
        </div>

        <div style={field}>
          <label style={lbl}>Senha</label>
          <PwField value={pw} onChange={e=>{setPw(e.target.value);setErr('')}} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
        </div>

        <div style={field}>
          <label style={lbl}>Confirmar senha</label>
          <PwField value={cpw} onChange={e=>{setCpw(e.target.value);setErr('')}} placeholder="Repita a senha" autoComplete="new-password" invalid={cpw.length>0&&pw!==cpw} />
          <Match pw={pw} cpw={cpw} />
        </div>

        {err && <div style={errBox}>{err}</div>}

        <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'4px 0 16px' }}>
          <input type="checkbox" id="tc" checked={terms} onChange={e=>setTerms(e.target.checked)}
            style={{ marginTop:3, flexShrink:0, width:15, height:15, accentColor:'#6382ff', cursor:'pointer' }} />
          <label htmlFor="tc" style={{ fontSize:12.5, color:'rgba(245,244,255,0.5)', lineHeight:1.55, cursor:'pointer' }}>
            Li e concordo com os{' '}
            <span onClick={()=>window.open('/src/pages/Termos.html','_blank')} style={{ color:'#9ab4ff', fontWeight:600, cursor:'pointer' }}>Termos de Serviço</span>
            {' '}e a{' '}
            <span onClick={()=>window.open('/src/pages/Termos.html#privacidade','_blank')} style={{ color:'#9ab4ff', fontWeight:600, cursor:'pointer' }}>Política de Privacidade</span>
          </label>
        </div>

        <button type="submit" disabled={load} style={{ ...btnPrimary, opacity:load?0.7:1 }}>
          {load ? <><Spin /> Criando conta…</> : 'Criar conta'}
        </button>
      </form>

      <p style={footTxt}>Já tem conta?{' '}
        <a href="#" style={footLnk} onClick={e=>{e.preventDefault();go('/auth/login')}}>Entrar</a>
      </p>
    </>
  )

  const content = done
    ? <VerifyPane email={email} onSuccess={() => go('/auth/login')} />
    : regForm

  const BackBtn = () => (
    <button onClick={() => navigate('/')} style={{
      position:'absolute', top:20, left:20, zIndex:10,
      display:'flex', alignItems:'center', gap:6,
      background:'none', border:'none',
      color:'rgba(245,244,255,0.5)', fontSize:13, fontWeight:600,
      cursor:'pointer', fontFamily:'inherit', transition:'color .15s',
      padding:4
    }}
      onMouseEnter={e => e.currentTarget.style.color='#f5f4ff'}
      onMouseLeave={e => e.currentTarget.style.color='rgba(245,244,255,0.5)'}
    >
      <IconBack /> Voltar
    </button>
  )

  if (mob) return (
    <div style={mobPage}>
      <BackBtn />
      <div style={{ ...mobCard, animation: out?'fOut .22s ease-in forwards':'fIn .5s ease both' }}>{content}</div>
      <style>{ANIMS}</style>
    </div>
  )

  return (
    <div style={split}>
      <BackBtn />

      {/* Painel esquerdo — sem faixas */}
      <div style={leftPanel}>
        <div style={{ position:'relative', zIndex:1, textAlign:'center' }}>
          <img src={logo} alt="Metapps"
            style={{ width:'min(220px,30vw)', height:'auto', display:'block', margin:'0 auto', cursor:'pointer' }}
            onClick={() => navigate('/')}
            onError={e => e.target.style.display='none'}
          />
        </div>
      </div>

      {/* Painel direito */}
      <div style={rightPanel}>
        <div style={{ ...fbox, animation: out?'fOut .22s ease-in forwards':'fIn .55s ease both' }}>{content}</div>
      </div>
      <style>{ANIMS}</style>
    </div>
  )
}

const ANIMS = `
  @keyframes fIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fOut{from{opacity:1}to{opacity:0;transform:translateY(-12px)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes slideIn{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
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
const formSub    = { fontSize:14, color:'rgba(245,244,255,0.5)', lineHeight:1.5, marginBottom:28 }
const field      = { marginBottom:14 }
const lbl        = { display:'block', fontSize:12.5, fontWeight:600, color:'rgba(245,244,255,0.45)', letterSpacing:'0.2px', marginBottom:6 }
const inp        = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:10, color:'#f5f4ff', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, padding:'12px 14px', outline:'none', transition:'border-color .2s, box-shadow .2s', WebkitAppearance:'none', appearance:'none', boxSizing:'border-box' }
const eyeBtn     = { position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:6, color:'rgba(245,244,255,0.35)', display:'flex', alignItems:'center', borderRadius:6, zIndex:2 }
const errBox     = { background:'rgba(240,106,106,0.08)', border:'1px solid rgba(240,106,106,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:500, color:'#f06a6a', lineHeight:1.45, marginBottom:13 }
const btnPrimary = { width:'100%', padding:'13px', border:'none', borderRadius:10, fontFamily:"'Inter',-apple-system,sans-serif", fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#6382ff', color:'#fff', transition:'all .2s' }
const footTxt    = { fontSize:13.5, color:'rgba(245,244,255,0.45)', textAlign:'center', marginTop:24 }
const footLnk    = { color:'#9ab4ff', fontWeight:700, textDecoration:'none' }