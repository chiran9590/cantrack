import { useState } from 'react'
import type { Store } from '../data'

export default function Search({ s, onLocate }: { s: Store; onLocate: (pos: string) => void }) {
  const [q, setQ] = useState('')
  const t = q.trim().toLowerCase()
  const hits = t ? s.plants.filter(p => p.gid.toLowerCase().includes(t) || p.uuid.includes(t) || p.position.toLowerCase().includes(t)) : []
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold">Search</h1>
      <input className="input" placeholder="GID, plant UUID, position ID, or glasshouse (e.g. GT-1007, L1-P01)" value={q} onChange={e => setQ(e.target.value)} autoFocus />
      {t && <p className="text-sm text-white/50">{hits.length} plant(s) found{hits.length > 40 && ' — showing first 40'}</p>}
      <div className="space-y-2">
        {hits.slice(0, 40).map(p => (
          <div key={p.uuid} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-lime-300">{p.gid} <span className="text-white/40">·</span> {p.position}</div>
              <div className="font-mono text-xs text-white/50 break-all">{p.uuid}</div>
            </div>
            <button className="btn-ghost text-sm" onClick={() => onLocate(p.position)}>Show on map →</button>
          </div>
        ))}
      </div>
    </div>
  )
}
