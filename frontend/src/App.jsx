import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Splash        from './Splash'
import Landpage      from './Landpage'
import Login         from './Login'
import Register      from './Register'
import VerifyEmail   from './VerifyEmail'
import EmailVerified from './EmailVerified'
import Criacao       from './Criacao'
import Chat          from './Chat'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"               element={<Splash />} />
        <Route path="/home"           element={<Landpage />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/verify-email"   element={<VerifyEmail />} />
        <Route path="/email-verified" element={<EmailVerified />} />
        <Route path="/criar"          element={<Criacao />} />
        <Route path="/chat"           element={<Chat />} />
        <Route path="*"               element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  )
}