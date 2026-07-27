import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landpage      from './Landpage'
import Login         from './Login'
import Register      from './Register'
import Homepage      from './Homepage'
import GoogleCallback from './GoogleCallback'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                       element={<Landpage />} />
        <Route path="/auth/login"             element={<Login />} />
        <Route path="/auth/register"          element={<Register />} />
        <Route path="/auth/google/callback"   element={<GoogleCallback />} />
        <Route path="/home"                   element={<Homepage />} />
        <Route path="*"                       element={<Landpage />} />
      </Routes>
    </BrowserRouter>

    // bandido n quer 67 resenha, bandido quer chocolex 😋
  )
}
