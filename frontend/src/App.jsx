import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Landpage       from './Landpage'
import Homepage       from './Homepage'
import HistoryPage    from './HistoryPage'
import GoogleCallback from './GoogleCallback'

// ─────────────────────────────────────────────────────────────────────────
// Login, Register e ForgotPassword não são mais páginas próprias: agora
// vivem como AuthModal dentro da própria Landpage (modos 'login',
// 'register' e 'forgot'). As rotas antigas continuam existindo só pra
// não quebrar links salvos/compartilhados — elas redirecionam pra "/"
// já passando ?auth=login, ?auth=register ou ?auth=forgot, e a Landpage
// lê esse parâmetro no carregamento pra abrir o modal certo.
//
// Parâmetros de erro (error/reason), usados pelo fluxo de OAuth quando o
// Google login falha, são preservados no redirect pra que o AuthModal
// consiga exibir o motivo ao usuário.
// ─────────────────────────────────────────────────────────────────────────

function AuthRedirect({ mode }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const target = new URLSearchParams()
  target.set('auth', mode)

  const error = params.get('error')
  const reason = params.get('reason')
  if (error) target.set('error', error)
  if (reason) target.set('reason', reason)

  return <Navigate to={`/?${target.toString()}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                       element={<Landpage />} />
        <Route path="/auth/login"             element={<AuthRedirect mode="login" />} />
        <Route path="/auth/register"          element={<AuthRedirect mode="register" />} />
        <Route path="/forgot-password"        element={<AuthRedirect mode="forgot" />} />
        <Route path="/auth/google/callback"   element={<GoogleCallback />} />
        <Route path="/home"                   element={<Homepage />} />
        <Route path="/history"                element={<HistoryPage />} />
        <Route path="*"                       element={<Landpage />} />
      </Routes>
    </BrowserRouter>

    // bandido n quer 67 resenha, bandido quer chocolex 😋
  )
}   