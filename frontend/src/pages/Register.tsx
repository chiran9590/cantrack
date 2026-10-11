import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, useLoad } from '../api'
import { useAuth } from '../auth'
import AuthShell from '../site/AuthShell'

export default function Register() {
  const { user, signIn } = useAuth()
  const cfg = useLoad(api.authConfig)
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/app" replace />
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const bad = f.password.length < 8 ? 'Password must be at least 8 characters' : f.password !== f.confirm ? 'Passwords do not match' : ''
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (bad) { setErr(bad); return }
    setBusy(true); setErr('')
    try { const r = await api.register(f.name.trim(), f.email.trim(), f.password); signIn(r.token, r.user) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  const closed = cfg.data && !cfg.data.registration_open
  return (
    <AuthShell title="Create your account" subtitle="No email verification needed: register and you are in.">
      {closed ? <p className="card text-white/70">Registration is currently closed. Please contact an administrator.</p> : (
        <form onSubmit={submit} className="space-y-4">
          <input className="input !font-sans" placeholder="Full name" value={f.name} onChange={set('name')} autoFocus />
          <input className="input" type="email" placeholder="Email" value={f.email} onChange={set('email')} />
          <input className="input" type="password" placeholder="Password (8+ characters)" value={f.password} onChange={set('password')} />
          <input className="input" type="password" placeholder="Repeat password" value={f.confirm} onChange={set('confirm')} />
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button className="btn w-full" disabled={busy || !f.name.trim() || !f.email}>{busy ? 'Creating…' : 'Create account'}</button>
          <p className="text-xs text-white/40">New accounts can view the dashboard. An administrator can give you scanning and editing rights.</p>
        </form>
      )}
      <p className="text-sm text-white/60 mt-6">Already registered? <Link to="/login" className="text-lime-300 underline">Sign in</Link></p>
    </AuthShell>
  )
}
