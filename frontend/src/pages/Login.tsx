import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import AuthShell from '../site/AuthShell'

export default function Login() {
  const { user, signIn } = useAuth()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/app'
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to={from} replace />
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { const r = await api.login(email, pw); signIn(r.token, r.user) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to open the dashboard.">
      <form onSubmit={submit} className="space-y-4">
        <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
        <input className="input" type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button className="btn w-full" disabled={busy || !email || !pw}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="text-sm text-white/60 mt-6">New here? <Link to="/register" className="text-lime-300 underline">Create an account</Link></p>
    </AuthShell>
  )
}
