// ─── AuthModal.jsx ──────────────────────────────────────────────────────────
//
// Modal único de autenticação (Login + Registro + Verificação de e-mail).
// Substitui as antigas páginas /auth/login e /auth/register: agora o
// usuário nunca sai da Landpage, só abre esse overlay por cima dela.
//
// Toda a lógica de validação, chamadas de API e tratamento de erro foi
// migrada dos componentes Login.jsx e Register.jsx originais — não foi
// reescrita do zero.
//
// USO (dentro da Landpage):
//
//   const [authMode, setAuthMode] = useState(null) // null | 'login' | 'register'
//   ...
//   <AuthModal
//     mode={authMode}
//     onClose={() => setAuthMode(null)}
//     onSwitchMode={(m) => setAuthMode(m)}
//     onLoginSuccess={() => navigate('/home')}
//   />
//
// ─────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'

import {
  register,
  login,
  emailVerify,
  resendVerification,
  loginWithGoogle,
  forgotPassword,
  resetPassword,
} from './api'

// ─── ÍCONES (reaproveitados de Login.jsx / Register.jsx) ───────────────────

const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M2 4l10 9 10-9" />
  </svg>
)

const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const IconAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5" />
    <path d="M12 16.5h.01" />
  </svg>
)

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const EyeShow = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeHide = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

const Spin = () => (
  <svg style={{ animation: 'authSpin .7s linear infinite' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <circle cx="12" cy="12" r="10" strokeOpacity=".22" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
)

const GIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h12.7c-.5 2.8-2.2 5.1-4.6 6.7v5.5h7.4c4.3-4 6.8-9.9 6.8-16.4z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.5c-2.2 1.4-4.9 2.2-8.5 2.2-6.5 0-12-4.4-14-10.3H2.4v5.7C6.4 42.8 14.6 48 24 48z" />
    <path fill="#FBBC05" d="M10 28.6A14.9 14.9 0 0 1 10 24c0-1.6.3-3.1.7-4.6v-5.7H2.4A24 24 0 0 0 0 24c0 3.9.9 7.6 2.4 10.9L10 28.6z" />
    <path fill="#EA4335" d="M24 9.5c3.6 0 6.9 1.2 9.4 3.6l7-7C36.3 2.4 30.6 0 24 0 14.6 0 6.4 5.2 2.4 13.1l7.6 5.7C12 12.9 17.5 9.5 24 9.5z" />
  </svg>
)

// ─── VALIDAÇÃO ──────────────────────────────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getPasswordErrors(password) {
  const errors = []
  if (password.length < 8) errors.push('pelo menos 8 caracteres')
  if (!/[A-Z]/.test(password)) errors.push('uma letra maiúscula')
  if (!/[a-z]/.test(password)) errors.push('uma letra minúscula')
  if (!/\d/.test(password)) errors.push('um número')
  return errors
}

// ─── TRATAMENTO DE ERROS (unifica o mapErr do Login e o do Register) ───────

const FIELD_NAME_MAP = {
  username: 'username',
  user_name: 'username',
  email: 'email',
  password: 'password',
  confirm_password: 'confirmPassword',
  confirmPassword: 'confirmPassword',
  terms: 'terms',
  terms_of_service: 'terms',
}

function normalizeFieldName(rawName) {
  return FIELD_NAME_MAP[rawName] || null
}

function mapDetailsToFields(details) {
  const fields = {}
  if (!details || typeof details !== 'object' || Array.isArray(details)) return fields

  for (const [rawField, rawMsg] of Object.entries(details)) {
    const fieldName = normalizeFieldName(rawField)
    const msgText = Array.isArray(rawMsg) ? rawMsg.join(' ') : String(rawMsg ?? '').trim()
    if (!msgText) continue
    fields[fieldName || 'general'] = msgText
  }

  return fields
}

// mapErr cobre tanto os erros de registro (com detalhamento por campo)
// quanto os de login (mais simples, com status 401 / EMAIL_NOT_VERIFIED).
function mapErr(error) {
  // 1) Formato novo do contrato do backend: error.details = { campo: msg }
  const detailsFields = mapDetailsToFields(error?.details)

  if (Object.keys(detailsFields).length > 0) {
    const specificFieldNames = Object.keys(detailsFields).filter((n) => n !== 'general')
    return {
      message: specificFieldNames.length > 0
        ? 'Verifique os campos destacados abaixo.'
        : Object.values(detailsFields)[0],
      fields: detailsFields,
    }
  }

  // 2) Casos específicos de login
  if (error?.status === 401) {
    return { message: 'Email ou senha incorretos.', fields: { general: 'Email ou senha incorretos.' } }
  }

  if (error?.code === 'EMAIL_NOT_VERIFIED' || error?.message === 'EMAIL_NOT_VERIFIED') {
    return {
      message: 'Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada.',
      fields: { general: 'E-mail não verificado.' },
    }
  }

  // 3) Fallback heurístico por código/texto
  const raw = String(error?.message || error?.error || error || '')
  const msg = raw.toLowerCase().trim()
  const code = String(error?.code || error?.error || error?.message || '').trim().toUpperCase()

  if (
    code === 'EMAIL_ALREADY_IN_USE' || code === 'EMAIL_ALREADY_EXISTS' ||
    msg.includes('already in use') || msg.includes('already exists') ||
    msg.includes('já está em uso') || msg.includes('já cadastrado') || msg.includes('e-mail já')
  ) {
    return {
      message: 'Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.',
      fields: { email: 'Este e-mail já está cadastrado.' },
    }
  }

  if (
    code === 'USERNAME_ALREADY_IN_USE' || code === 'USERNAME_ALREADY_EXISTS' ||
    (msg.includes('username') && (msg.includes('taken') || msg.includes('already') || msg.includes('exists')))
  ) {
    return {
      message: 'Este nome de usuário já está em uso. Escolha outro.',
      fields: { username: 'Este nome de usuário já está em uso.' },
    }
  }

  if (
    msg.includes('failed to fetch') || msg.includes('network error') ||
    msg.includes('load failed') || msg.includes('timeout') || msg.includes('unreachable')
  ) {
    return { message: 'Sem conexão com o servidor. Verifique sua internet.', fields: { general: 'Sem conexão com o servidor.' } }
  }

  if (
    msg.includes('invalid code') || msg.includes('expired') ||
    msg.includes('código inválido') || msg.includes('código expirado') || msg.includes('verification failed')
  ) {
    return { message: 'Código inválido ou expirado. Solicite um novo código.', fields: { general: 'Código inválido ou expirado.' } }
  }

  if (msg.includes('not found') || msg.includes('não encontrado') || msg.includes('inexistente') || msg.includes('no user')) {
    return { message: 'Usuário não encontrado. Verifique o e-mail ou crie uma conta.', fields: { general: 'Usuário não encontrado.' } }
  }

  if (msg.includes('disabled') || msg.includes('blocked') || msg.includes('locked') || msg.includes('suspended') || msg.includes('bloqueada') || msg.includes('desativada')) {
    return { message: 'Sua conta foi temporariamente bloqueada. Entre em contato com o suporte.', fields: { general: 'Conta bloqueada.' } }
  }

  if (msg.includes('too many') || msg.includes('rate limit') || msg.includes('muitas tentativas') || msg.includes('429')) {
    return { message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', fields: { general: 'Muitas tentativas.' } }
  }

  if (msg.includes('bad request') || msg.includes('400') || msg.includes('requisição inválida')) {
    return { message: 'Dados inválidos. Verifique os campos e tente novamente.', fields: { general: 'Dados inválidos.' } }
  }

  if (msg.includes('internal server') || msg.includes('500') || msg.includes('erro interno')) {
    return { message: 'Erro no servidor. Tente novamente mais tarde.', fields: { general: 'Erro no servidor.' } }
  }

  return { message: 'Algo deu errado. Tente novamente em alguns instantes.', fields: { general: 'Algo deu errado.' } }
}

// ─── CAMPO DE SENHA ─────────────────────────────────────────────────────────

function PwField({ value, onChange, placeholder, autoComplete, invalid }) {
  const [show, setShow] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <div style={iconSlot}><IconLock /></div>
      <input
        className="authFieldInput"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{ ...inp, paddingLeft: 42, paddingRight: 44, borderColor: invalid ? '#f06a6a' : '#d0d0e0' }}
      />
      <button type="button" onClick={() => setShow((v) => !v)} style={eyeBtn} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
        {show ? <EyeHide /> : <EyeShow />}
      </button>
    </div>
  )
}

function Match({ pw, cpw }) {
  if (!cpw.length) return <div style={{ height: 12 }} />
  return (
    <div style={{ fontSize: 11, marginTop: 5, color: pw === cpw ? '#3ecf8e' : '#f06a6a' }}>
      {pw === cpw ? 'Senhas conferem' : 'Senhas não conferem'}
    </div>
  )
}

// ─── PAINEL DE VERIFICAÇÃO DE E-MAIL ────────────────────────────────────────

function VerifyPane({ email, onSuccess }) {
  const inputs = useRef([])
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [err, setErr] = useState('')
  const [load, setLoad] = useState(false)
  const [cd, setCd] = useState(0)
  const [sent, setSent] = useState(false)
  const iv = useRef(null)

  function startCd() {
    setCd(30)
    if (iv.current) clearInterval(iv.current)
    iv.current = setInterval(() => {
      setCd((v) => {
        if (v <= 1) { clearInterval(iv.current); iv.current = null; return 0 }
        return v - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (iv.current) clearInterval(iv.current) }, [])

  function handleDigit(index, value) {
    if (!/^\d*$/.test(value)) return
    const next = [...digits]
    next[index] = value.slice(-1)
    setDigits(next)
    setErr('')
    if (value && index < 5) inputs.current[index + 1]?.focus()
    if (value && index === 5 && next.every((d) => d)) submitCode(next.join(''))
  }

  function handleKey(index, event) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus()
    if (event.key === 'Enter') {
      const code = digits.join('')
      if (code.length === 6) submitCode(code)
    }
  }

  function handlePaste(event) {
    const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    event.preventDefault()
    const next = [...digits]
    text.split('').forEach((char, index) => { next[index] = char })
    setDigits(next)
    inputs.current[Math.min(text.length, 5)]?.focus()
    if (text.length === 6) submitCode(text)
  }

  async function submitCode(code) {
    if (load) return
    if (code.length !== 6) { setErr('Digite o código de 6 dígitos.'); return }
    setErr('')
    setLoad(true)
    try {
      await emailVerify(email, code)
      onSuccess()
    } catch (error) {
      setErr(mapErr(error).message)
      setDigits(['', '', '', '', '', ''])
      setTimeout(() => inputs.current[0]?.focus(), 0)
    } finally {
      setLoad(false)
    }
  }

  async function resend() {
    if (cd > 0 || load) return
    setErr('')
    try {
      await resendVerification(email)
      setSent(true)
      setTimeout(() => setSent(false), 3000)
      startCd()
    } catch (error) {
      setErr(mapErr(error).message)
    }
  }

  return (
    <div style={{ animation: 'authSlideIn .4s cubic-bezier(0.16,1,0.3,1) both', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, margin: '0 auto 18px', background: 'rgba(99,130,255,0.1)', border: '1px solid rgba(99,130,255,0.3)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" fill="none" stroke="#6382ff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M2 4l10 9 10-9" />
        </svg>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1a1a2e', letterSpacing: '-0.4px', marginBottom: 8 }}>Verifique seu e-mail</h2>

      <p style={{ fontSize: 14, color: '#6b6b8a', lineHeight: 1.65, marginBottom: 28 }}>
        Enviamos um código de 6 dígitos para<br />
        <strong style={{ color: '#1a1a2e', fontWeight: 700 }}>{email}</strong>
      </p>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }} onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputs.current[index] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigit(index, e.target.value)}
            onKeyDown={(e) => handleKey(index, e)}
            style={{
              width: 44, height: 54, textAlign: 'center', fontSize: 24, fontWeight: 800,
              background: '#fff',
              border: `2px solid ${err ? '#f06a6a' : digit ? '#6382ff' : '#d0d0e0'}`,
              borderRadius: 12, color: '#1a1a2e',
              fontFamily: "'Inter',-apple-system,sans-serif", outline: 'none',
              transition: 'border-color .15s, box-shadow .15s',
              boxShadow: digit ? '0 0 0 3px rgba(99,130,255,0.2)' : 'none',
              caretColor: 'transparent',
            }}
          />
        ))}
      </div>

      {err && <div style={{ ...errBox, marginBottom: 14 }}>{err}</div>}

      <button
        type="button"
        onClick={() => submitCode(digits.join(''))}
        disabled={load || digits.some((d) => !d)}
        style={{ ...btnPrimary, opacity: load || digits.some((d) => !d) ? 0.5 : 1, marginBottom: 16 }}
      >
        {load ? (<><Spin />Verificando…</>) : 'Verificar código'}
      </button>

      <p style={{ fontSize: 13, color: '#6b6b8a' }}>
        Não recebeu?{' '}
        <span onClick={resend} style={{ color: cd > 0 ? '#6b6b8a' : '#6382ff', fontWeight: 700, cursor: cd > 0 ? 'default' : 'pointer' }}>
          {cd > 0 ? `Reenviar em ${cd}s` : 'Reenviar código'}
        </span>
      </p>

      {sent && <p style={{ fontSize: 12, color: '#3ecf8e', marginTop: 8 }}>Código reenviado!</p>}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL: AuthModal ───────────────────────────────────────

export default function AuthModal({ mode, onClose, onSwitchMode, onLoginSuccess }) {
  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'

  // login
  const [lEmail, setLEmail] = useState('')
  const [lPw, setLPw] = useState('')
  const [lErr, setLErr] = useState('')
  const [lLoad, setLLoad] = useState(false)

  // registro
  const [uname, setUname] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [cpw, setCpw] = useState('')
  const [terms, setTerms] = useState(false)
  const [rErr, setRErr] = useState('')
  const [fieldErr, setFieldErr] = useState({ username: '', email: '', password: '', confirmPassword: '', terms: '' })
  const [rLoad, setRLoad] = useState(false)
  const [done, setDone] = useState(false)

  // esqueci a senha (dois passos: pedir código → redefinir)
  const [fpEmail, setFpEmail] = useState('')
  const [fpCode, setFpCode] = useState('')
  const [fpPassword, setFpPassword] = useState('')
  const [fpConfirm, setFpConfirm] = useState('')
  const [fpSent, setFpSent] = useState(false)
  const [fpMessage, setFpMessage] = useState('')
  const [fpErr, setFpErr] = useState('')
  const [fpLoad, setFpLoad] = useState(false)

  // fecha com ESC
  useEffect(() => {
    if (!mode) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [mode, onClose])

  // reseta o estado de "verificação concluída" toda vez que o modal reabre
  useEffect(() => {
    if (mode === 'register') setDone(false)
  }, [mode])

  // reseta o fluxo de recuperação de senha toda vez que o modal reabre
  // nesse modo, e pré-preenche o e-mail se o usuário já tinha digitado
  // algo na tela de login antes de clicar em "Esqueci a senha".
  useEffect(() => {
    if (mode === 'forgot') {
      setFpSent(false)
      setFpCode('')
      setFpPassword('')
      setFpConfirm('')
      setFpMessage('')
      setFpErr('')
      setFpEmail((prev) => prev || lEmail)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  if (!mode) return null

  // ─── LOGIN ────────────────────────────────────────────────────────────

  async function submitLogin(e) {
    e.preventDefault()
    setLErr('')

    if (!lEmail.trim() || !lPw) {
      setLErr('Preencha todos os campos.')
      return
    }

    setLLoad(true)
    try {
      await login(lEmail.trim(), lPw)
      onLoginSuccess?.()
      onClose()
    } catch (error) {
      setLErr(mapErr(error).message)
    } finally {
      setLLoad(false)
    }
  }

  // ─── REGISTRO ─────────────────────────────────────────────────────────

  function clearFieldError(field) {
    setFieldErr((prev) => ({ ...prev, [field]: '' }))
    setRErr('')
  }

  function validateForm() {
    const errors = { username: '', email: '', password: '', confirmPassword: '', terms: '' }
    const username = uname.trim()
    const normalizedEmail = email.trim().toLowerCase()
    let valid = true

    if (!username) { errors.username = 'Informe um nome de usuário.'; valid = false }
    else if (username.length < 3) { errors.username = 'O nome de usuário deve ter pelo menos 3 caracteres.'; valid = false }

    if (!normalizedEmail) { errors.email = 'Informe seu e-mail.'; valid = false }
    else if (!isValidEmail(normalizedEmail)) { errors.email = 'Digite um e-mail válido.'; valid = false }

    if (!pw) { errors.password = 'Informe uma senha.'; valid = false }
    else {
      const pwErrors = getPasswordErrors(pw)
      if (pwErrors.length > 0) { errors.password = `A senha precisa ter ${pwErrors.join(', ')}.`; valid = false }
    }

    if (!cpw) { errors.confirmPassword = 'Confirme sua senha.'; valid = false }
    else if (pw !== cpw) { errors.confirmPassword = 'As senhas não conferem.'; valid = false }

    if (!terms) { errors.terms = 'Aceite os Termos de Serviço para continuar.'; valid = false }

    setFieldErr(errors)
    setRErr(valid ? '' : 'Verifique os campos destacados antes de continuar.')
    return valid
  }

  async function submitRegister(e) {
    e.preventDefault()
    if (rLoad) return

    setRErr('')
    setFieldErr({ username: '', email: '', password: '', confirmPassword: '', terms: '' })

    if (!validateForm()) return

    const username = uname.trim()
    const normalizedEmail = email.trim().toLowerCase()

    setRLoad(true)
    try {
      await register(username, normalizedEmail, pw)
      setDone(true)
    } catch (error) {
      const mapped = mapErr(error)
      setRErr(mapped.message)
      if (mapped.fields) {
        setFieldErr((prev) => {
          const next = { ...prev }
          for (const [field, msg] of Object.entries(mapped.fields)) {
            if (field !== 'general' && field in next) next[field] = msg
          }
          return next
        })
      }
    } finally {
      setRLoad(false)
    }
  }

  function handleGoogle() {
    loginWithGoogle()
  }

  function switchTo(nextMode) {
    setLErr('')
    setRErr('')
    setFpErr('')
    onSwitchMode(nextMode)
  }

  // ─── ESQUECI A SENHA ────────────────────────────────────────────────────

  async function submitForgotRequest(e) {
    e.preventDefault()
    setFpErr('')
    setFpMessage('')
    setFpLoad(true)
    try {
      await forgotPassword(fpEmail.trim())
      setFpSent(true)
      setFpMessage('Se houver uma conta para este e-mail, enviamos um código de 6 dígitos.')
    } catch (error) {
      setFpErr(mapErr(error).message || 'Não foi possível enviar o código.')
    } finally {
      setFpLoad(false)
    }
  }

  async function submitForgotReset(e) {
    e.preventDefault()
    if (fpPassword.length < 8) { setFpErr('A senha deve ter pelo menos 8 caracteres.'); return }
    if (fpPassword !== fpConfirm) { setFpErr('As senhas não coincidem.'); return }

    setFpErr('')
    setFpLoad(true)
    try {
      await resetPassword(fpEmail.trim(), fpCode.trim(), fpPassword)
      // senha redefinida com sucesso — manda o usuário direto pro login,
      // já com o e-mail preenchido
      setLEmail(fpEmail.trim())
      switchTo('login')
    } catch (error) {
      setFpErr(mapErr(error).message || 'Não foi possível redefinir a senha.')
    } finally {
      setFpLoad(false)
    }
  }

  // ─── CONTEÚDO: LOGIN ────────────────────────────────────────────────────

  const loginContent = (
    <>
      <h2 style={title}>Bem-vindo de volta</h2>
      <p style={sub}>Entre com sua conta para continuar.</p>

      <button type="button" onClick={handleGoogle} style={btnGoogle}>
        <GIcon />Continuar com Google
      </button>

      <Divider />

      <form onSubmit={submitLogin} noValidate>
        <div style={field}>
          <label style={lbl}>E-mail</label>
          <div style={{ position: 'relative' }}>
            <div style={iconSlot}><IconMail /></div>
            <input
              type="email"
              placeholder="voce@email.com"
              autoComplete="email"
              value={lEmail}
              onChange={(e) => { setLEmail(e.target.value); setLErr('') }}
              style={{ ...inp, paddingLeft: 42 }}
            />
          </div>
        </div>

        <div style={field}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={lbl}>Senha</label>
            <span
              onClick={() => switchTo('forgot')}
              style={{ fontSize: 12.5, fontWeight: 600, color: '#6382ff', cursor: 'pointer' }}
            >
              Esqueci a senha
            </span>
          </div>
          <PwField value={lPw} onChange={(e) => { setLPw(e.target.value); setLErr('') }} placeholder="Sua senha" autoComplete="current-password" />
        </div>

        {lErr && (
          <div style={{ ...errBox, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <span style={{ color: '#f06a6a', marginTop: 1 }}><IconAlert /></span>
            <span>{lErr}</span>
          </div>
        )}

        <button type="submit" disabled={lLoad} style={{ ...btnPrimary, opacity: lLoad ? 0.7 : 1, marginTop: 4 }}>
          {lLoad ? (<><Spin />Entrando…</>) : 'Entrar'}
        </button>
      </form>

      <p style={footTxt}>
        Sem conta?{' '}
        <span onClick={() => switchTo('register')} style={footLnk}>Criar conta</span>
      </p>
    </>
  )

  // ─── CONTEÚDO: REGISTRO ─────────────────────────────────────────────────

  const registerContent = done ? (
    <VerifyPane
      email={email.trim().toLowerCase()}
      onSuccess={() => switchTo('login')}
    />
  ) : (
    <>
      <h2 style={title}>Criar conta</h2>
      <p style={sub}>Comece a aprender com IA hoje.</p>

      <button type="button" onClick={handleGoogle} style={btnGoogle}>
        <GIcon />Continuar com Google
      </button>

      <Divider />

      <form onSubmit={submitRegister} noValidate>
        <div style={field}>
          <label style={lbl}>Nome de usuário</label>
          <div style={{ position: 'relative' }}>
            <div style={iconSlot}><IconUser /></div>
            <input
              type="text"
              placeholder="seunome"
              autoComplete="username"
              value={uname}
              onChange={(e) => { setUname(e.target.value); clearFieldError('username') }}
              aria-invalid={!!fieldErr.username}
              style={{ ...inp, paddingLeft: 42, borderColor: fieldErr.username ? '#f06a6a' : '#d0d0e0' }}
            />
          </div>
          {fieldErr.username && <div style={fieldErrTxt}>{fieldErr.username}</div>}
        </div>

        <div style={field}>
          <label style={lbl}>E-mail</label>
          <div style={{ position: 'relative' }}>
            <div style={iconSlot}><IconMail /></div>
            <input
              type="email"
              placeholder="voce@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearFieldError('email') }}
              aria-invalid={!!fieldErr.email}
              style={{ ...inp, paddingLeft: 42, borderColor: fieldErr.email ? '#f06a6a' : '#d0d0e0' }}
            />
          </div>
          {fieldErr.email && <div style={fieldErrTxt}>{fieldErr.email}</div>}
        </div>

        <div style={field}>
          <label style={lbl}>Senha</label>
          <PwField
            value={pw}
            onChange={(e) => { setPw(e.target.value); clearFieldError('password') }}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            invalid={!!fieldErr.password}
          />
          {fieldErr.password && <div style={fieldErrTxt}>{fieldErr.password}</div>}
        </div>

        <div style={field}>
          <label style={lbl}>Confirmar senha</label>
          <PwField
            value={cpw}
            onChange={(e) => { setCpw(e.target.value); clearFieldError('confirmPassword') }}
            placeholder="Repita a senha"
            autoComplete="new-password"
            invalid={cpw.length > 0 && pw !== cpw}
          />
          <Match pw={pw} cpw={cpw} />
          {fieldErr.confirmPassword && <div style={fieldErrTxt}>{fieldErr.confirmPassword}</div>}
        </div>

        {rErr && <div style={errBox}>{rErr}</div>}

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '4px 0 16px' }}>
          <input
            type="checkbox"
            id="auth-modal-terms"
            checked={terms}
            onChange={(e) => { setTerms(e.target.checked); clearFieldError('terms') }}
            style={{ marginTop: 3, flexShrink: 0, width: 15, height: 15, accentColor: '#6382ff', cursor: 'pointer' }}
          />
          <label htmlFor="auth-modal-terms" style={{ fontSize: 12.5, color: '#6b6b8a', lineHeight: 1.55, cursor: 'pointer' }}>
            Li e concordo com os{' '}
            <span onClick={() => window.open('/src/pages/Termos.html', '_blank')} style={{ color: '#6382ff', fontWeight: 600, cursor: 'pointer' }}>
              Termos de Serviço
            </span>{' '}e a{' '}
            <span onClick={() => window.open('/src/pages/Termos.html#privacidade', '_blank')} style={{ color: '#6382ff', fontWeight: 600, cursor: 'pointer' }}>
              Política de Privacidade
            </span>
          </label>
        </div>

        {fieldErr.terms && <div style={{ ...fieldErrTxt, marginTop: -10, marginBottom: 13 }}>{fieldErr.terms}</div>}

        <button type="submit" disabled={rLoad} style={{ ...btnPrimary, opacity: rLoad ? 0.7 : 1 }}>
          {rLoad ? (<><Spin />Criando conta…</>) : 'Criar conta'}
        </button>
      </form>

      <p style={footTxt}>
        Já tem conta?{' '}
        <span onClick={() => switchTo('login')} style={footLnk}>Entrar</span>
      </p>
    </>
  )

  // ─── CONTEÚDO: ESQUECI A SENHA ───────────────────────────────────────────

  const forgotContent = (
    <>
      <span onClick={() => switchTo('login')} style={{ display: 'inline-block', color: '#6382ff', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 18 }}>
        ← Voltar ao login
      </span>

      <h2 style={title}>Recuperar senha</h2>
      <p style={sub}>
        {fpSent
          ? 'Digite o código que enviamos e escolha uma nova senha.'
          : 'Informe seu e-mail para receber um código de recuperação.'}
      </p>

      {!fpSent ? (
        <form onSubmit={submitForgotRequest} noValidate>
          <div style={field}>
            <label style={lbl}>E-mail</label>
            <div style={{ position: 'relative' }}>
              <div style={iconSlot}><IconMail /></div>
              <input
                type="email"
                placeholder="voce@email.com"
                autoComplete="email"
                value={fpEmail}
                onChange={(e) => { setFpEmail(e.target.value); setFpErr('') }}
                required
                style={{ ...inp, paddingLeft: 42 }}
              />
            </div>
          </div>

          {fpErr && <div style={errBox}>{fpErr}</div>}

          <button type="submit" disabled={fpLoad} style={{ ...btnPrimary, opacity: fpLoad ? 0.7 : 1 }}>
            {fpLoad ? (<><Spin />Enviando…</>) : 'Enviar código'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitForgotReset} noValidate>
          <div style={field}>
            <label style={lbl}>Código de 6 dígitos</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={fpCode}
              onChange={(e) => { setFpCode(e.target.value.replace(/\D/g, '')); setFpErr('') }}
              required
              style={inp}
            />
          </div>

          <div style={field}>
            <label style={lbl}>Nova senha</label>
            <PwField
              value={fpPassword}
              onChange={(e) => { setFpPassword(e.target.value); setFpErr('') }}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />
          </div>

          <div style={field}>
            <label style={lbl}>Confirmar nova senha</label>
            <PwField
              value={fpConfirm}
              onChange={(e) => { setFpConfirm(e.target.value); setFpErr('') }}
              placeholder="Repita a senha"
              autoComplete="new-password"
              invalid={fpConfirm.length > 0 && fpPassword !== fpConfirm}
            />
            <Match pw={fpPassword} cpw={fpConfirm} />
          </div>

          {fpErr && <div style={errBox}>{fpErr}</div>}

          <button type="submit" disabled={fpLoad} style={{ ...btnPrimary, opacity: fpLoad ? 0.7 : 1 }}>
            {fpLoad ? (<><Spin />Redefinindo…</>) : 'Redefinir senha'}
          </button>

          <p style={{ ...footTxt, marginTop: 16 }}>
            Não recebeu?{' '}
            <span onClick={() => { setFpSent(false); setFpMessage(''); setFpErr('') }} style={footLnk}>
              Enviar novamente
            </span>
          </p>
        </form>
      )}

      {fpMessage && !fpErr && (
        <p style={{ marginTop: 14, fontSize: 13, color: '#3ecf8e', lineHeight: 1.5 }}>{fpMessage}</p>
      )}
    </>
  )

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="authModalOverlay" onClick={onClose}>
      <div className="authModalCard" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="authModalClose" aria-label="Fechar">
          <IconClose />
        </button>

        <div key={isRegister ? (done ? 'verify' : 'register') : isForgot ? (fpSent ? 'forgot-reset' : 'forgot-request') : 'login'} className="authModalContent">
          {isRegister ? registerContent : isForgot ? forgotContent : loginContent}
        </div>
      </div>

      <style>{AUTH_MODAL_STYLES}</style>
    </div>
  )
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '18px 0' }}>
      <span style={{ flex: 1, height: 1, background: 'rgba(26,26,46,0.12)' }} />
      <span style={{ fontSize: 12, color: 'rgba(26,26,46,0.35)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ou</span>
      <span style={{ flex: 1, height: 1, background: 'rgba(26,26,46,0.12)' }} />
    </div>
  )
}

// ─── ESTILOS ────────────────────────────────────────────────────────────────

const iconSlot = { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(26,26,46,0.35)', display: 'flex', pointerEvents: 'none' }

const inp = {
  width: '100%', background: '#fff', border: '1.5px solid #d0d0e0', borderRadius: 10, color: '#1a1a2e',
  fontFamily: "'Inter',-apple-system,sans-serif", fontSize: 14, padding: '12px 14px', outline: 'none',
  transition: 'border-color .2s, box-shadow .2s', WebkitAppearance: 'none', appearance: 'none', boxSizing: 'border-box',
}

const eyeBtn = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 6, color: 'rgba(26,26,46,0.35)' }

const title = { fontSize: 26, fontWeight: 900, color: '#1a1a2e', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: 6 }
const sub = { fontSize: 14, color: '#6b6b8a', lineHeight: 1.5, marginBottom: 20 }
const field = { marginBottom: 14 }
const lbl = { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#6b6b8a', letterSpacing: '0.2px', marginBottom: 6 }
const fieldErrTxt = { fontSize: 11.5, color: '#d14c4c', marginTop: 5, lineHeight: 1.4 }

const errBox = {
  background: 'rgba(240,106,106,0.08)', border: '1px solid rgba(240,106,106,0.2)', borderRadius: 8,
  padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#d14c4c', lineHeight: 1.45, marginBottom: 13,
}

const btnPrimary = {
  width: '100%', padding: '13px', border: 'none', borderRadius: 10, fontFamily: "'Inter',-apple-system,sans-serif",
  fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 8, background: '#6382ff', color: '#fff', transition: 'all .2s',
}

const btnGoogle = {
  width: '100%', padding: '13px', borderRadius: 10, border: '1.5px solid #d0d0e0', background: '#fff',
  fontFamily: "'Inter',-apple-system,sans-serif", fontSize: 14, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'background .2s',
}

const footTxt = { fontSize: 13.5, color: '#6b6b8a', textAlign: 'center', marginTop: 24 }
const footLnk = { color: '#6382ff', fontWeight: 700, cursor: 'pointer' }

const AUTH_MODAL_STYLES = `
  @keyframes authFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes authCardIn {
    from { opacity: 0; transform: translateY(24px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes authSpin { to { transform: rotate(360deg); } }
  @keyframes authSlideIn {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .authModalOverlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(26,26,46,0.55);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: authFadeIn .2s ease both;
  }

  .authModalCard {
    position: relative;
    width: 100%;
    max-width: 420px;
    max-height: 90vh;
    overflow-y: auto;
    background: #f5f4ff;
    border-radius: 20px;
    padding: 36px 32px;
    box-shadow: 0 30px 80px rgba(26,26,46,0.35);
    animation: authCardIn .32s cubic-bezier(0.16,1,0.3,1) both;
  }

  .authModalClose {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: rgba(26,26,46,0.06);
    color: #6b6b8a;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background .15s, color .15s;
  }

  .authModalClose:hover {
    background: rgba(26,26,46,0.1);
    color: #1a1a2e;
  }

  .authModalContent {
    animation: authSlideIn .25s ease both;
  }

  .authModalCard input:focus {
    border-color: #6382ff !important;
    box-shadow: 0 0 0 3px rgba(99,130,255,0.2) !important;
    outline: none;
  }

  .authModalCard button:focus-visible {
    outline: 2px solid #6382ff;
    outline-offset: 2px;
  }

  @media (max-width: 480px) {
    .authModalOverlay {
      padding: 0;
      align-items: flex-end;
    }
    .authModalCard {
      max-width: none;
      width: 100%;
      max-height: 92vh;
      border-radius: 24px 24px 0 0;
      padding: 30px 22px 28px;
      animation: authCardIn .28s ease both;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .authModalOverlay, .authModalCard, .authModalContent {
      animation-duration: .01ms !important;
    }
  }
`