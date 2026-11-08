import { useState } from 'react'
import { api, fmtDate, useLoad, type User } from '../api'

export default function System({ me }: { me: User }) {
  const [tick, setTick] = useState(0)
  const { data: d, error } = useLoad(api.overview, [tick])
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'gardener' })
  const [msg, setMsg] = useState('')
  if (error) return <p className="text-red-400">{error}</p>
  if (!d) return <p className="text-white/50">Loading…</p>
  const db = d.database
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); setMsg(''); setTick(t => t + 1) } catch (e) { setMsg((e as Error).message) } }
  const add = () => act(async () => { await api.addUser(f); setF({ name: '', email: '', password: '', role: 'gardener' }) })
  const reset = (id: number) => { const p = window.prompt('New password (at least 8 characters)?'); if (p) act(() => api.patchUser(id, { password: p })) }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Database &amp; members</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card space-y-1 text-sm">
          <h2 className="font-semibold mb-2">Where the data is stored</h2>
          <div>PostgreSQL <span className="font-mono text-lime-300">{db.version}</span></div>
          <div>Database <span className="font-mono text-lime-300">{db.name}</span> · {db.size}</div>
          <div>Server <span className="font-mono">{db.host}:{db.port}</span></div>
          <div>Files on disk <span className="font-mono break-all">{db.data_directory ?? 'not visible to this DB user'}</span></div>
        </div>
        <div className="card text-sm">
          <h2 className="font-semibold mb-2">Members</h2>
          <div className="font-display text-4xl font-extrabold text-lime-300">{d.members.total}</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(d.members.by_role).map(([r, n]) => <span key={r} className="btn-ghost text-xs capitalize">{r}: {n}</span>)}
          </div>
          <div className="mt-3 text-white/60">{d.scans.total} scans total · {d.scans.today} today{d.scans.last_scan && ` · last ${fmtDate(d.scans.last_scan)}`}</div>
        </div>
      </div>

      {msg && <p className="text-red-400 text-sm">{msg}</p>}
      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Users (<span className="font-mono">users</span> table)</h2>
        <table className="w-full text-sm text-left">
          <thead className="text-white/50"><tr><th className="py-1">Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead>
          <tbody>{d.users.map(u => (
            <tr key={u.id} className="border-t border-white/10">
              <td className="py-2">{u.name}</td><td className="font-mono">{u.email}</td>
              <td><select disabled={u.id === me.id} className="bg-black/40 rounded px-2 py-1 capitalize" value={u.role} onChange={e => act(() => api.patchUser(u.id, { role: e.target.value }))}>
                {['admin', 'manager', 'breeder', 'gardener', 'member'].map(r => <option key={r}>{r}</option>)}</select></td>
              <td className={u.active ? 'text-emerald-300' : 'text-red-300'}>{u.active ? 'Active' : 'Disabled'}</td>
              <td className="text-white/50">{fmtDate(u.last_login_at)}</td>
              <td className="whitespace-nowrap"><button className="btn-ghost !py-1 text-xs mr-2" onClick={() => reset(u.id)}>Reset password</button>
                {u.id !== me.id && <button className="btn-ghost !py-1 text-xs" onClick={() => act(() => api.patchUser(u.id, { active: !u.active }))}>{u.active ? 'Disable' : 'Enable'}</button>}</td>
            </tr>
          ))}</tbody>
        </table>
        <div className="grid md:grid-cols-5 gap-2 mt-4">
          <input className="input !py-2" placeholder="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <input className="input !py-2" placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
          <input className="input !py-2" type="password" placeholder="Password (8+)" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
          <select className="input !py-2 !font-sans" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>{['member', 'gardener', 'breeder', 'manager', 'admin'].map(r => <option key={r}>{r}</option>)}</select>
          <button className="btn !py-2" disabled={!f.name || !f.email || f.password.length < 8} onClick={add}>Add user</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Tables</h2>
        <table className="w-full text-sm text-left">
          <thead className="text-white/50"><tr><th className="py-1">Table</th><th>Rows</th><th>Size</th></tr></thead>
          <tbody>{d.tables.map(t => (
            <tr key={t.table} className="border-t border-white/10"><td className="py-2 font-mono">{t.table}</td><td>{t.rows.toLocaleString()}</td><td>{t.size}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}
