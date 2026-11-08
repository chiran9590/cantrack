import { useEffect, useState } from 'react'
import { api, fmtDate, useLoad } from '../api'

export default function Dashboard() {
  const [tick, setTick] = useState(0)
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 4000); return () => clearInterval(i) }, []) // live refresh
  const { data, error } = useLoad(api.dashboard, [tick])
  if (error) return <p className="text-red-400">{error}</p>
  if (!data) return <p className="text-white/50">Loading…</p>
  const total = data.houses.reduce((a, h) => a + h.total, 0)
  const occ = data.houses.reduce((a, h) => a + h.occupied, 0)
  const st = data.stats
  const row1: [string, string][] = [
    ['Glasshouses', String(data.houses.length)], ['Positions', total.toLocaleString()], ['Occupied', occ.toLocaleString()],
    ['Empty', (total - occ).toLocaleString()], ['Occupancy', `${total ? ((occ / total) * 100).toFixed(1) : 0}%`],
  ]
  const row2: [string, string][] = [
    ['Active plants', st.active_plants.toLocaleString()], ['Removed plants', st.removed_plants.toLocaleString()],
    ['Scans today', st.scans_today.toLocaleString()], ['Rejected today', st.rejected_today.toLocaleString()],
  ]
  const Card = ([k, v]: [string, string]) => (<div key={k} className="card"><div className="text-xs uppercase tracking-widest text-white/50">{k}</div><div className="font-display text-3xl font-extrabold text-lime-300">{v}</div></div>)
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Facility overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{row1.map(Card)}</div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{row2.map(Card)}</div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card space-y-4">
          <h2 className="font-semibold">Occupancy by glasshouse</h2>
          {data.houses.map(h => {
            const pct = (h.occupied / h.total) * 100
            return (<div key={h.code}><div className="flex justify-between text-sm mb-1"><span>{h.name}</span><span className="font-mono text-white/60">{h.occupied}/{h.total} · {pct.toFixed(0)}%</span></div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-lime-400" style={{ width: `${pct}%` }} /></div></div>)
          })}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">Recent scans <span className="ml-2 text-xs text-lime-400 animate-pulse">● live</span></h2>
          <ul className="divide-y divide-white/10 text-sm">
            {data.recent.map(m => {
              const fresh = Date.now() - new Date(m.moved_at).getTime() < 60_000
              return (<li key={m.id} className={`py-2 flex justify-between gap-2 ${fresh ? 'text-lime-300' : ''}`}>
                <span className="font-mono">{m.kind === 'correction' ? '✏️' : m.source === 'mobile' ? '📱' : '💻'} {m.gid} → {m.position_id}</span>
                <span className="text-white/50 whitespace-nowrap">{m.by} · {fmtDate(m.moved_at)}</span></li>)
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
