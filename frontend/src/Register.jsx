// ─── IMPORTS DO REACT DO CELLBIT ───────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { register, emailVerify, resendVerification, loginWithGoogle } from './api'
import logo from './assets/logo.svg'
import icon from './assets/icon.svg'

// ─── ÍCONES ──────────────────────────────────────────────────
const IconUser = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IconMail = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 4l10 9 10-9"/></svg>
const IconLock = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const IconBack = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
const EyeShow = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeHide = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const Spin = () => <svg style={{ animation:'spin .7s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10" strokeOpacity=".22"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
const GIcon = () => <svg width="16" height="16" viewBox="0 0 48 48" style={{ flexShrink:0 }}><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h12.7c-.5 2.8-2.2 5.1-4.6 6.7v5.5h7.4c4.3-4 6.8-9.9 6.8-16.4z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.5c-2.2 1.4-4.9 2.2-8.5 2.2-6.5 0-12-4.4-14-10.3H2.4v5.7C6.4 42.8 14.6 48 24 48z"/><path fill="#FBBC05" d="M10 28.6A14.9 14.9 0 0 1 10 24c0-1.6.3-3.1.7-4.6v-5.7H2.4A24 24 0 0 0 0 24c0 3.9.9 7.6 2.4 10.9L10 28.6z"/><path fill="#EA4335" d="M24 9.5c3.6 0 6.9 1.2 9.4 3.6l7-7C36.3 2.4 30.6 0 24 0 14.6 0 6.4 5.2 2.4 13.1l7.6 5.7C12 12.9 17.5 9.5 24 9.5z"/></svg>

// ─── FILTRO DE ERROS AMIGÁVEL (ATUALIZADO) ─────────────────
function mapErr(m = '') {
  const msg = (m?.toLowerCase?.() ?? String(m)).trim()

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

  // E-mail já existe / duplicado
  if (
    msg.includes("couldn't create") ||
    msg.includes('already exists') ||
    msg.includes('already in use') ||
    msg.includes('duplicate') ||
    msg.includes('já está em uso') ||
    msg.includes('já cadastrado') ||
    msg.includes('e-mail já')
  ) {
    return 'Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.'
  }

  // Nome de usuário já existe
  if (
    msg.includes('username') && (msg.includes('taken') || msg.includes('already') || msg.includes('exists'))
  ) {
    return 'Este nome de usuário já está em uso. Escolha outro.'
  }

  // Código de verificação inválido / expirado
  if (
    msg.includes('invalid code') ||
    msg.includes('expired') ||
    msg.includes('código inválido') ||
    msg.includes('código expirado') ||
    msg.includes('verification failed')
  ) {
    return 'Código inválido ou expirado. Solicite um novo código.'
  }

  // Credenciais inválidas (pode ocorrer em fluxos alternativos)
  if (
    msg.includes('invalid credentials') ||
    msg.includes('password') ||
    msg.includes('senha incorreta')
  ) {
    return 'Credenciais inválidas. Verifique os dados e tente novamente.'
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

  // Qualquer outra mensagem desconhecida
  if (msg && msg.length > 0) {
    return 'Algo deu errado. Tente novamente em alguns instantes.'
  }

  // Fallback final
  return 'Ocorreu um erro inesperado. Por favor, tente novamente.'
}

// ─── COMPONENTE DE CAMPO DE SENHA (VERSÃO LIGHT/DARK) ─────
function PwField({ value, onChange, placeholder, autoComplete, invalid, light }) {
  const [show, setShow] = useState(false)
  const iconColor = light ? 'rgba(26,26,46,0.35)' : 'rgba(245,244,255,0.35)'
  const inputStyle = light ? { ...inpLight, paddingLeft:42, paddingRight:44, borderColor: invalid ? 'rgba(240,106,106,0.5)' : '#d0d0e0' }
                           : { ...inpDark, paddingLeft:42, paddingRight:44, borderColor: invalid ? 'rgba(240,106,106,0.5)' : 'rgba(255,255,255,0.1)' }
  return (
    <div style={{ position:'relative' }}>
      <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:iconColor, display:'flex', pointerEvents:'none' }}><IconLock /></div>
      <input type={show?'text':'password'} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete}
        style={inputStyle} />
      <button type="button" onClick={() => setShow(v=>!v)} style={{ ...eyeBtn, color: iconColor }}>{show ? <EyeHide /> : <EyeShow />}</button>
    </div>
  )
}

function Match({ pw, cpw, light }) {
  const textColor = light ? '#6b6b8a' : 'rgba(245,244,255,0.45)'
  if (!cpw.length) return <div style={{ height:12 }} />
  return <div style={{ fontSize:11, marginTop:5, color: pw===cpw ? '#3ecf8e' : '#f06a6a' }}>{pw===cpw ? 'Senhas conferem' : 'Senhas não conferem'}</div>
}

// ─── PAINEL DE VERIFICAÇÃO (VERSÃO LIGHT) ──────────────────
function VerifyPane({ email, onSuccess, light }) {
  const inputs = useRef([])
  const [digits, setDigits] = useState(['','','','','',''])
  const [err, setErr] = useState('')
  const [load, setLoad] = useState(false)
  const [cd, setCd] = useState(0)
  const [sent, setSent] = useState(false)
  const iv = useRef(null)

  function startCd() {
    setCd(30)
    iv.current = setInterval(() => setCd(x => { if (x<=1){clearInterval(iv.current);return 0} return x-1 }), 1000)
  }
  useEffect(() => () => { if (iv.current) clearInterval(iv.current) }, [])

  function handleDigit(i, val) {
    if (!/^\d*$/.test(val)) return
    const next = [...digits]; next[i] = val.slice(-1); setDigits(next); setErr('')
    if (val && i < 5) inputs.current[i+1]?.focus()
    if (val && i === 5 && next.every(d => d)) submitCode(next.join(''))
  }

  function handleKey(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i-1]?.focus()
    if (e.key === 'Enter') { const code = digits.join(''); if (code.length === 6) submitCode(code) }
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    if (!text) return; e.preventDefault()
    const next = [...digits]; text.split('').forEach((c,i) => { next[i] = c }); setDigits(next)
    inputs.current[Math.min(text.length, 5)]?.focus()
    if (text.length === 6) submitCode(text)
  }

  async function submitCode(code) {
    setErr(''); setLoad(true)
    try { await emailVerify(email, code); onSuccess() }
    catch(er) { setErr(mapErr(er?.message || er)); setDigits(['','','','','','']); inputs.current[0]?.focus() }
    finally { setLoad(false) }
  }

  async function resend() {
    if (cd > 0) return
    try { await resendVerification(email) } catch(_) {}
    setSent(true); setTimeout(()=>setSent(false), 3000); startCd()
  }

  // Estilos condicionais
  const containerBg = light ? '#f5f4ff' : '#1a1a2e'
  const textColor = light ? '#1a1a2e' : '#f5f4ff'
  const subColor = light ? '#6b6b8a' : 'rgba(245,244,255,0.55)'
  const inputBg = light ? '#fff' : 'rgba(255,255,255,0.06)'
  const inputBorder = light ? '#d0d0e0' : 'rgba(255,255,255,0.12)'
  const inputBorderFocus = light ? '#6382ff' : '#6382ff'
  const iconBg = light ? 'rgba(99,130,255,0.1)' : 'rgba(99,130,255,0.15)'
  const iconBorder = light ? 'rgba(99,130,255,0.3)' : 'rgba(99,130,255,0.3)'
  const iconStroke = light ? '#6382ff' : '#9ab4ff'
  const linkColor = light ? '#6382ff' : '#9ab4ff'
  const errBoxStyle = light ? errBoxLight : errBoxDark

  return (
    <div style={{ animation:'slideIn .5s cubic-bezier(0.16,1,0.3,1) both', textAlign:'center' }}>
      <div style={{ width:52, height:52, margin:'0 auto 18px', background:iconBg, border:`1px solid ${iconBorder}`, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="22" height="22" fill="none" stroke={iconStroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 4l10 9 10-9"/>
        </svg>
      </div>
      <h2 style={{ fontSize:22, fontWeight:900, color:textColor, letterSpacing:'-0.4px', marginBottom:8 }}>Verifique seu e-mail</h2>
      <p style={{ fontSize:14, color:subColor, lineHeight:1.65, marginBottom:28 }}>
        Enviamos um código de 6 dígitos para<br/>
        <strong style={{ color:textColor, fontWeight:700 }}>{email}</strong>
      </p>
      <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:16 }} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input key={i} ref={el => inputs.current[i] = el} type="text" inputMode="numeric" maxLength={1} value={d}
            onChange={e => handleDigit(i, e.target.value)} onKeyDown={e => handleKey(i, e)}
            style={{ width:44, height:54, textAlign:'center', fontSize:24, fontWeight:800, background:inputBg, border:`2px solid ${err ? 'rgba(240,106,106,0.6)' : d ? '#6382ff' : inputBorder}`, borderRadius:12, color:textColor, fontFamily:"'Inter',-apple-system,sans-serif", outline:'none', transition:'border-color .15s, box-shadow .15s', boxShadow: d ? '0 0 0 3px rgba(99,130,255,0.2)' : 'none', caretColor:'transparent' }} />
        ))}
      </div>
      {err && <div style={{ ...errBoxStyle, marginBottom:14 }}>{err}</div>}
      <button onClick={() => submitCode(digits.join(''))} disabled={load || digits.some(d=>!d)}
        style={{ ...(light ? btnPrimaryLight : btnPrimaryDark), opacity: (load || digits.some(d=>!d)) ? 0.5 : 1, marginBottom:16 }}>
        {load ? <><Spin /> Verificando…</> : 'Verificar código'}
      </button>
      <p style={{ fontSize:13, color:subColor }}>
        Não recebeu?{' '}
        <span onClick={resend} style={{ color: cd>0 ? subColor : linkColor, fontWeight:700, cursor: cd>0 ? 'default' : 'pointer' }}>
          {cd>0 ? `Reenviar em ${cd}s` : 'Reenviar código'}
        </span>
      </p>
      {sent && <p style={{ fontSize:12, color:'#3ecf8e', marginTop:8 }}>Código reenviado!</p>}
    </div>
  )
}

// ─── REGISTER ────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate()
  const [mob, setMob] = useState(window.innerWidth<=768)
  const [uname, setUname] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [cpw, setCpw] = useState('')
  const [terms, setTerms] = useState(false)
  const [err, setErr] = useState('')
  const [load, setLoad] = useState(false)
  const [out, setOut] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'auto'; document.body.style.height = 'auto'
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
    if (pw!==cpw) { setErr('As senhas não conferem.'); return }
    if (!terms) { setErr('Aceite os Termos de Serviço para continuar.'); return }
    setLoad(true)
    try { await register(uname.trim(), email.trim(), pw); setDone(true) }
    catch(er) { setErr(mapErr(er?.message || er)) }
    finally { setLoad(false) }
  }

  async function handleGoogle() {
    try { await loginWithGoogle() }
    catch(er) { setErr(mapErr(er?.message || er)) }
  }

  // ─── FORMULÁRIO PARA LADO CLARO (DESKTOP) ──────────────
  const regFormLight = (
    <>
      <h1 style={formTitleLight}>Criar conta</h1>
      <p style={formSubLight}>Comece a aprender com IA hoje.</p>

      <button onClick={handleGoogle} style={btnGoogleLight}><GIcon /> Continuar com Google</button>

      <div style={{ display:'flex', alignItems:'center', gap:14, margin:'18px 0' }}>
        <span style={{ flex:1, height:1, background:'rgba(26,26,46,0.12)' }}/>
        <span style={{ fontSize:12, color:'rgba(26,26,46,0.35)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.5px' }}>ou</span>
        <span style={{ flex:1, height:1, background:'rgba(26,26,46,0.12)' }}/>
      </div>

      <form onSubmit={submit} noValidate>
        <div style={fieldLight}>
          <label style={lblLight}>Nome de usuário</label>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(26,26,46,0.35)', display:'flex', pointerEvents:'none' }}><IconUser /></div>
            <input type="text" placeholder="seunome" autoComplete="username"
              style={{ ...inpLight, paddingLeft:42 }} value={uname} onChange={e=>{setUname(e.target.value);setErr('')}} />
          </div>
        </div>
        <div style={fieldLight}>
          <label style={lblLight}>E-mail</label>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(26,26,46,0.35)', display:'flex', pointerEvents:'none' }}><IconMail /></div>
            <input type="email" placeholder="voce@email.com" autoComplete="email"
              style={{ ...inpLight, paddingLeft:42 }} value={email} onChange={e=>{setEmail(e.target.value);setErr('')}} />
          </div>
        </div>
        <div style={fieldLight}>
          <label style={lblLight}>Senha</label>
          <PwField value={pw} onChange={e=>{setPw(e.target.value);setErr('')}} placeholder="Mínimo 8 caracteres" autoComplete="new-password" light={true} />
        </div>
        <div style={fieldLight}>
          <label style={lblLight}>Confirmar senha</label>
          <PwField value={cpw} onChange={e=>{setCpw(e.target.value);setErr('')}} placeholder="Repita a senha" autoComplete="new-password" invalid={cpw.length>0&&pw!==cpw} light={true} />
          <Match pw={pw} cpw={cpw} light={true} />
        </div>
        {err && <div style={errBoxLight}>{err}</div>}
        <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'4px 0 16px' }}>
          <input type="checkbox" id="tc" checked={terms} onChange={e=>setTerms(e.target.checked)}
            style={{ marginTop:3, flexShrink:0, width:15, height:15, accentColor:'#6382ff', cursor:'pointer' }} />
          <label htmlFor="tc" style={{ fontSize:12.5, color:'#6b6b8a', lineHeight:1.55, cursor:'pointer' }}>
            Li e concordo com os{' '}
            <span onClick={()=>window.open('/src/pages/Termos.html','_blank')} style={{ color:'#6382ff', fontWeight:600, cursor:'pointer' }}>Termos de Serviço</span>
            {' '}e a{' '}
            <span onClick={()=>window.open('/src/pages/Termos.html#privacidade','_blank')} style={{ color:'#6382ff', fontWeight:600, cursor:'pointer' }}>Política de Privacidade</span>
          </label>
        </div>
        <button type="submit" disabled={load} style={{ ...btnPrimaryLight, opacity:load?0.7:1 }}>
          {load ? <><Spin /> Criando conta…</> : 'Criar conta'}
        </button>
      </form>
      <p style={footTxtLight}>Já tem conta?{' '}<a href="#" style={footLnkLight} onClick={e=>{e.preventDefault();go('/auth/login')}}>Entrar</a></p>
    </>
  )

  // ─── FORMULÁRIO PARA MOBILE (ESCURO) ─────────────────────
  const regFormDark = (
    <>
      <h1 style={formTitleDark}>Criar conta</h1>
      <p style={formSubDark}>Comece a aprender com IA hoje.</p>

      <button onClick={handleGoogle} style={btnGoogleDark}><GIcon /> Continuar com Google</button>

      <div style={{ display:'flex', alignItems:'center', gap:14, margin:'18px 0' }}>
        <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }}/>
        <span style={{ fontSize:12, color:'rgba(245,244,255,0.35)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.5px' }}>ou</span>
        <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }}/>
      </div>

      <form onSubmit={submit} noValidate>
        <div style={fieldDark}>
          <label style={lblDark}>Nome de usuário</label>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(245,244,255,0.35)', display:'flex', pointerEvents:'none' }}><IconUser /></div>
            <input type="text" placeholder="seunome" autoComplete="username"
              style={{ ...inpDark, paddingLeft:42 }} value={uname} onChange={e=>{setUname(e.target.value);setErr('')}} />
          </div>
        </div>
        <div style={fieldDark}>
          <label style={lblDark}>E-mail</label>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(245,244,255,0.35)', display:'flex', pointerEvents:'none' }}><IconMail /></div>
            <input type="email" placeholder="voce@email.com" autoComplete="email"
              style={{ ...inpDark, paddingLeft:42 }} value={email} onChange={e=>{setEmail(e.target.value);setErr('')}} />
          </div>
        </div>
        <div style={fieldDark}>
          <label style={lblDark}>Senha</label>
          <PwField value={pw} onChange={e=>{setPw(e.target.value);setErr('')}} placeholder="Mínimo 8 caracteres" autoComplete="new-password" light={false} />
        </div>
        <div style={fieldDark}>
          <label style={lblDark}>Confirmar senha</label>
          <PwField value={cpw} onChange={e=>{setCpw(e.target.value);setErr('')}} placeholder="Repita a senha" autoComplete="new-password" invalid={cpw.length>0&&pw!==cpw} light={false} />
          <Match pw={pw} cpw={cpw} light={false} />
        </div>
        {err && <div style={errBoxDark}>{err}</div>}
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
        <button type="submit" disabled={load} style={{ ...btnPrimaryDark, opacity:load?0.7:1 }}>
          {load ? <><Spin /> Criando conta…</> : 'Criar conta'}
        </button>
      </form>
      <p style={footTxtDark}>Já tem conta?{' '}<a href="#" style={footLnkDark} onClick={e=>{e.preventDefault();go('/auth/login')}}>Entrar</a></p>
    </>
  )

  // ─── RENDER ────────────────────────────────────────────────
  const contentLight = done ? <VerifyPane email={email} onSuccess={() => go('/auth/login')} light={true} /> : regFormLight
  const contentDark  = done ? <VerifyPane email={email} onSuccess={() => go('/auth/login')} light={false} /> : regFormDark

  const BackBtn = () => (
    <button onClick={() => navigate('/')}
      onMouseEnter={e => e.currentTarget.style.color='#f5f4ff'}
      onMouseLeave={e => e.currentTarget.style.color='rgba(245,244,255,0.5)'}
      style={{ position:'absolute', top:20, left:20, zIndex:10, display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'rgba(245,244,255,0.5)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'color .15s', padding:4 }}>
      <IconBack /> Voltar
    </button>
  )

  if (mob) return (
    <div style={mobPage}>
      <BackBtn />
      <div style={{ ...mobCard, animation: out?'fOut .22s ease-in forwards':'fIn .5s ease both' }}>{contentDark}</div>
      <style>{ANIMS}</style>
    </div>
  )

  return (
    <div style={split}>
      <BackBtn />
      {/* Painel esquerdo - azul escuro */}
      <div style={leftPanel}>
        {/* Removido onClick */}
        <img src={logo} alt="Metapps"
          style={{ width:'min(220px,30vw)', height:'auto', display:'block', margin:'0 auto', position:'relative', zIndex:1 }}
          onError={e => e.target.style.display='none'} />
      </div>
      {/* Painel direito - claro */}
      <div style={rightPanel}>
        <div style={{ ...fbox, animation: out?'fOut .22s ease-in forwards':'fIn .55s ease both' }}>{contentLight}</div>
      </div>
      <style>{ANIMS}</style>
    </div>
  )
}

// ─── ESTILOS ─────────────────────────────────────────────────────
const ANIMS = `
  @keyframes fIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fOut{from{opacity:1}to{opacity:0;transform:translateY(-12px)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes slideIn{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  input[type=password]::-ms-reveal,input[type=password]::-ms-clear{display:none}
  input::-webkit-credentials-auto-fill-button,input::-webkit-contacts-auto-fill-button{visibility:hidden;pointer-events:none;width:0;height:0}
  input:focus{border-color:#6382ff!important;box-shadow:0 0 0 3px rgba(99,130,255,0.2)!important;outline:none}
`

// Layout principal
const split      = { display:'flex', height:'100vh', overflow:'hidden', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', background:'#1a1a2e', position:'relative' }

// Lado esquerdo (escuro)
const leftPanel  = { flex:'0 0 45%', position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'#1a1a2e' }

// Lado direito (claro)
const rightPanel = { flex:'0 0 55%', display:'flex', alignItems:'center', justifyContent:'center', padding:'28px 60px', overflowY:'auto', background:'#f5f4ff' }

// Mobile
const mobPage    = { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px 40px', background:'#1a1a2e', fontFamily:"'Inter',-apple-system,sans-serif", WebkitFontSmoothing:'antialiased', position:'relative' }
const mobCard    = { width:'100%', maxWidth:400 }
const fbox       = { width:'100%', maxWidth:380 }

// ----- ESTILOS PARA O LADO CLARO (direita) -----
const formTitleLight  = { fontSize:28, fontWeight:900, color:'#1a1a2e', letterSpacing:'-0.5px', lineHeight:1.2, marginBottom:6 }
const formSubLight    = { fontSize:14, color:'#6b6b8a', lineHeight:1.5, marginBottom:20 }
const fieldLight      = { marginBottom:14 }
const lblLight        = { display:'block', fontSize:12.5, fontWeight:600, color:'#6b6b8a', letterSpacing:'0.2px', marginBottom:6 }
const inpLight        = { width:'100%', background:'#fff', border:'1.5px solid #d0d0e0', borderRadius:10, color:'#1a1a2e', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, padding:'12px 14px', outline:'none', transition:'border-color .2s, box-shadow .2s', WebkitAppearance:'none', appearance:'none', boxSizing:'border-box' }
const errBoxLight     = { background:'rgba(240,106,106,0.08)', border:'1px solid rgba(240,106,106,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:500, color:'#d14c4c', lineHeight:1.45, marginBottom:13 }
const btnPrimaryLight = { width:'100%', padding:'13px', border:'none', borderRadius:10, fontFamily:"'Inter',-apple-system,sans-serif", fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#6382ff', color:'#fff', transition:'all .2s' }
const btnGoogleLight  = { width:'100%', padding:'13px', borderRadius:10, border:'1.5px solid #d0d0e0', background:'#fff', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, fontWeight:600, color:'#1a1a2e', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'background .2s' }
const footTxtLight    = { fontSize:13.5, color:'#6b6b8a', textAlign:'center', marginTop:24 }
const footLnkLight    = { color:'#6382ff', fontWeight:700, textDecoration:'none' }

// ----- ESTILOS PARA O LADO ESCURO (mobile) -----
const formTitleDark  = { fontSize:28, fontWeight:900, color:'#f5f4ff', letterSpacing:'-0.5px', lineHeight:1.2, marginBottom:6 }
const formSubDark    = { fontSize:14, color:'rgba(245,244,255,0.5)', lineHeight:1.5, marginBottom:20 }
const fieldDark      = { marginBottom:14 }
const lblDark        = { display:'block', fontSize:12.5, fontWeight:600, color:'rgba(245,244,255,0.45)', letterSpacing:'0.2px', marginBottom:6 }
const inpDark        = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:10, color:'#f5f4ff', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, padding:'12px 14px', outline:'none', transition:'border-color .2s, box-shadow .2s', WebkitAppearance:'none', appearance:'none', boxSizing:'border-box' }
const errBoxDark     = { background:'rgba(240,106,106,0.08)', border:'1px solid rgba(240,106,106,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:500, color:'#f06a6a', lineHeight:1.45, marginBottom:13 }
const btnPrimaryDark = { width:'100%', padding:'13px', border:'none', borderRadius:10, fontFamily:"'Inter',-apple-system,sans-serif", fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#6382ff', color:'#fff', transition:'all .2s' }
const btnGoogleDark  = { width:'100%', padding:'13px', borderRadius:10, border:'1.5px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', fontFamily:"'Inter',-apple-system,sans-serif", fontSize:14, fontWeight:600, color:'#f5f4ff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'background .2s' }
const footTxtDark    = { fontSize:13.5, color:'rgba(245,244,255,0.45)', textAlign:'center', marginTop:24 }
const footLnkDark    = { color:'#9ab4ff', fontWeight:700, textDecoration:'none' }

// Olho de senha (comum)
const eyeBtn = { position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:6, display:'flex', alignItems:'center', borderRadius:6, zIndex:2 }