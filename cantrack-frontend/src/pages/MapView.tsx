import { useState } from 'react'
import { parsePos, posId, type Store } from '../data'

export default function MapView({ s, focus }: { s: Store; focus: string | null }) {
  const f = focus ? parsePos(focus) : null
  const [g, setG] = useState(f?.g ?? s.houses[0].code)
  const [p, setP] = useState(f?.p ?? 1)
  const [sel, setSel] = useState<string | null>(focus)
  const h = s.houses.find(x => x.code === g) ?? s.houses[0]
  const plant = sel ? s.byPos.get(sel) : undefined
  const hist = plant ? s.moves.filter(m => m.uuid === plant.uuid).sort((a, b) => b.at.localeCompare(a.at)) : []

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold">Glasshouse map</h1>
      <div className="flex flex-wrap gap-2">
        {s.houses.map(x => (<button key={x.code} onClick={() => { setG(x.code); setP(1); setSel(null) }} className={`btn-ghost ${x.code === h.code ? 'bg-emerald-400/20 border-emerald-400' : ''}`}>{x.code}</button>))}
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: h.platforms }, (_, i) => i + 1).map(n => (<button key={n} onClick={() => setP(n)} className={`btn-ghost text-sm ${n === p ? 'bg-lime-400/20 border-lime-400' : ''}`}>Platform {n}</button>))}
      </div>
      <div className="flex gap-4 text-xs text-white/60">
        <span>🟩 occupied</span><span>⬛ empty</span><span>🟨 selected</span>
      </div>
      <div className="grid lg:grid-cols-[1fr_20rem] gap-4">
        <div className="card overflow-x-auto">
          <div className="grid gap-1 w-max" style={{ gridTemplateColumns: `repeat(${h.rows}, 1.5rem)` }}>
            {Array.from({ length: h.columns }, (_, ci) => ci + 1).flatMap(c => Array.from({ length: h.rows }, (_, ri) => ri + 1).map(r => {
              const id = posId(h.code, p, c, r)
              const cls = id === sel ? 'bg-amber-300 scale-110' : s.byPos.has(id) ? 'bg-emerald-500 hover:bg-emerald-300' : 'bg-white/10 hover:bg-white/25'
              return <button key={id} title={id} onClick={() => setSel(id)} className={`h-6 w-6 rounded-md transition ${cls}`} />
            }))}
          </div>
          <p className="text-xs text-white/40 mt-3">Columns run top to bottom (C01–C{String(h.columns).padStart(2, '0')}), rows left to right (R01–R{h.rows}).</p>
        </div>
        <div className="card text-sm space-y-2 h-fit">
          {!sel ? <p className="text-white/50">Select a position to see its record.</p> : (<>
            <div className="font-mono text-lg text-lime-300">{sel}</div>
            {plant ? (<>
              <div>Plant UUID<div className="font-mono text-xs break-all">{plant.uuid}</div></div>
              <div>GID <span className="font-mono">{plant.gid}</span> · Sown {plant.sown}</div>
              <div>Placed {hist[0]?.at.slice(0, 10)} · Previous: <span className="font-mono">{hist[1]?.position ?? '—'}</span></div>
              <div className="pt-2 font-semibold">Movement history</div>
              <ul className="space-y-1">{hist.map(m => (<li key={m.id} className="font-mono text-xs text-white/70">{m.at.slice(0, 10)} {m.position} ({m.by})</li>))}</ul>
            </>) : <p className="text-white/50">Empty position.</p>}
          </>)}
        </div>
      </div>
    </div>
  )
}
