import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Splash        from './Splash'
import Home          from './Home'
import Login         from './Login'
import Register      from './Register'
import VerifyEmail   from './VerifyEmail'
import EmailVerified from './EmailVerified'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"               element={<Splash />} />
        <Route path="/home"           element={<Home />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/verify-email"   element={<VerifyEmail />} />
        <Route path="/email-verified" element={<EmailVerified />} />
        <Route path="*"               element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}