import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth'
import SiteLayout from './site/SiteLayout'
import Home from './site/Home'
import { Careers, Contact, Legal } from './site/Pages'
import Login from './pages/Login'
import Register from './pages/Register'
import Console from './Console'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const { pathname } = useLocation()
  if (!ready) return null
  return user ? <>{children}</> : <Navigate to="/login" replace state={{ from: pathname }} />
}

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="careers" element={<Careers />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy" element={<Legal kind="privacy" />} />
        <Route path="legal" element={<Legal kind="legal" />} />
      </Route>
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      <Route path="app/:tab?" element={<RequireAuth><Console /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
