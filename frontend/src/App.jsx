import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Splash        from './Splash'
import Landpage      from './Landpage'
import Login         from './Login'
import Register      from './Register'
import Homepage      from './Homepage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"               element={<Landpage />} />
        <Route path="/splash"         element={<Splash />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/home"           element={<Homepage />} />
        <Route path="*"               element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}