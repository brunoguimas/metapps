import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Splash      from './Splash'
import Login       from './Login'
import Register    from './Register'
import VerifyEmail from './VerifyEmail'

// Termos is served as static HTML at /termos.html (public/termos.html)
// No React route needed — browser navigates to it directly.

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"             element={<Splash />} />
        <Route path="/login"        element={<Login />} />
        <Route path="/register"     element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="*"             element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}