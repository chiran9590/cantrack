import { useState } from 'react'
import { capacity, posId, type Store } from '../data'

export default function Admin({ s }: { s: Store }) {
  const [f, setF] = useState({ code: '', name: '', platforms: 2, columns: 6, rows: 20 })
  const [err, setErr] = useState<string | null>(null)
  const num = (k: 'platforms' | 'columns' | 'rows') => (
    <label className="text-sm text-white/60 capitalize">{k}
      <input type="number" min={1} className="input mt-1" value={f[k]} onChange={e => setF({ ...f, [k]: +e.target.value })} /></label>
  )
  const add = () => {
    const code = f.code.trim().toUpperCase()
    const e = s.addHouse({ ...f, code, name: f.name.trim() || `Glasshouse ${code}` })
    setErr(e); if (!e) setF({ ...f, code: '', name: '' })
  }
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Facility setup</h1>
      <div className="grid md:grid-cols-3 gap-3">
        {s.houses.map(h => (
          <div key={h.code} className="card">
            <div className="font-display text-2xl font-extrabold text-lime-300">{h.code}</div>
            <div className="text-sm text-white/60">{h.name}</div>
            <div className="mt-2 text-sm">{h.platforms} platforms · {h.columns} × {h.rows}</div>
            <div className="font-mono text-xs text-white/50 mt-1">{capacity(h)} positions</div>
            <div className="font-mono text-[11px] text-white/40">{posId(h.code, 1, 1, 1)} … {posId(h.code, h.platforms, h.columns, h.rows)}</div>
          </div>
        ))}
      </div>
      <div className="card space-y-3 max-w-xl">
        <h2 className="font-semibold">Add glasshouse</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-white/60">Code<input className="input mt-1" maxLength={4} placeholder="B4" value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} /></label>
          <label className="text-sm text-white/60">Name<input className="input mt-1" placeholder="Glasshouse B4" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
          {num('platforms')}{num('columns')}{num('rows')}
        </div>
        <p className="text-xs text-white/50">Creates {f.platforms * f.columns * f.rows || 0} positions. Facility total becomes {(s.houses.reduce((a, h) => a + capacity(h), 0) + (f.platforms * f.columns * f.rows || 0)).toLocaleString()}.</p>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button className="btn" onClick={add}>Add glasshouse</button>
      </div>
    </div>
  )
}
