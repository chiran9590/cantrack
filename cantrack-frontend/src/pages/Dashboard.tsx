import { capacity, type Store } from '../data'

export default function Dashboard({ s }: { s: Store }) {
  const total = s.houses.reduce((a, h) => a + capacity(h), 0)
  const active = s.plants.filter(p => p.status === 'active')
  const stats: [string, string][] = [
    ['Glasshouses', String(s.houses.length)], ['Positions', total.toLocaleString()], ['Occupied', active.length.toLocaleString()],
    ['Empty', (total - active.length).toLocaleString()], ['Occupancy', `${((active.length / total) * 100).toFixed(1)}%`],
  ]
  const recent = [...s.moves].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Facility overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {stats.map(([k, v]) => (<div key={k} className="card"><div className="text-xs uppercase tracking-widest text-white/50">{k}</div><div className="font-display text-3xl font-extrabold text-lime-300">{v}</div></div>))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card space-y-4">
          <h2 className="font-semibold">Occupancy by glasshouse</h2>
          {s.houses.map(h => {
            const n = active.filter(p => p.position.startsWith(h.code + '-')).length
            const pct = (n / capacity(h)) * 100
            return (<div key={h.code}><div className="flex justify-between text-sm mb-1"><span>{h.name}</span><span className="font-mono text-white/60">{n}/{capacity(h)} · {pct.toFixed(0)}%</span></div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-lime-400" style={{ width: `${pct}%` }} /></div></div>)
          })}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">Recent movements</h2>
          <ul className="divide-y divide-white/10 text-sm">
            {recent.map(m => (<li key={m.id} className="py-2 flex justify-between gap-2"><span className="font-mono">{m.gid} → {m.position}</span><span className="text-white/50">{m.by} · {m.at.slice(5, 10)}</span></li>))}
          </ul>
        </div>
      </div>
    </div>
  )
}
