import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landpage       from './Landpage'
import Homepage       from './Homepage'
import GoogleCallback from './GoogleCallback'

// ─────────────────────────────────────────────────────────────────────────
// Login, Register e ForgotPassword não são mais páginas próprias: agora
// vivem como AuthModal dentro da própria Landpage (modos 'login',
// 'register' e 'forgot'). As rotas antigas continuam existindo só pra
// não quebrar links salvos/compartilhados — elas redirecionam pra "/"
// já passando ?auth=login, ?auth=register ou ?auth=forgot, e a Landpage
// lê esse parâmetro no carregamento pra abrir o modal certo.
// ─────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                       element={<Landpage />} />
        <Route path="/auth/login"             element={<Navigate to="/?auth=login" replace />} />
        <Route path="/auth/register"          element={<Navigate to="/?auth=register" replace />} />
        <Route path="/forgot-password"        element={<Navigate to="/?auth=forgot" replace />} />
        <Route path="/auth/google/callback"   element={<GoogleCallback />} />
        <Route path="/home"                   element={<Homepage />} />
        <Route path="*"                       element={<Landpage />} />
      </Routes>
    </BrowserRouter>

    // bandido n quer 67 resenha, bandido quer chocolex 😋
  )
}