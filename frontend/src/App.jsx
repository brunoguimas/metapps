import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Splash        from './Splash'
import Landpage      from './Landpage'
import Login         from './Login'
import Register      from './Register'
import Criacao       from './Criacao'
import Chat          from './Chat'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"               element={<Landpage />} />   {/* era Splash */}
        <Route path="/splash"         element={<Splash />} />     {/* nova rota */}
        <Route path="/login"          element={<Login />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/criar"          element={<Criacao />} />
        <Route path="/chat"           element={<Chat />} />
        <Route path="*"               element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}