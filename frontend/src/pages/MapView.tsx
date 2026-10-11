import { useEffect, useMemo, useState } from 'react'
import { api, fmtDate, infoText, parsePos, posId, useLoad, type MapData } from '../api'

export default function MapView({ focus }: { focus: string | null }) {
  const fac = useLoad(api.facility)
  const [tick, setTick] = useState(0)
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 4000); return () => clearInterval(i) }, []) // live refresh
  const f = focus ? parsePos(focus) : null
  const [g, setG] = useState(f?.g ?? '')
  const [p, setP] = useState(f?.p ?? 1)
  const [sel, setSel] = useState<string | null>(focus)
  const houses = fac.data ?? []
  const h = houses.find(x => x.code === g) ?? houses[0]
  const map = useLoad<MapData>(() => (h ? api.map(h.code, p) : Promise.resolve({ cells: [], conflicts: [] })), [h?.code, p, tick])
  const occ = useMemo(() => new Set((map.data?.cells ?? []).map(c => c.position_id)), [map.data])
  const bad = useMemo(() => new Set(map.data?.conflicts ?? []), [map.data])
  const det = useLoad(() => (sel ? api.position(sel) : Promise.resolve(null)), [sel, tick])
  if (fac.error) return <p className="text-red-400">{fac.error}</p>
  if (!h) return <p className="text-white/50">Loading…</p>
  const d = det.data

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold">Glasshouse map</h1>
      <div className="flex flex-wrap gap-2">
        {houses.map(x => (<button key={x.code} onClick={() => { setG(x.code); setP(1); setSel(null) }} className={`btn-ghost ${x.code === h.code ? 'bg-emerald-400/20 border-emerald-400' : ''}`}>{x.code}</button>))}
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: h.platforms }, (_, i) => i + 1).map(n => (<button key={n} onClick={() => setP(n)} className={`btn-ghost text-sm ${n === p ? 'bg-lime-400/20 border-lime-400' : ''}`}>Platform {n}</button>))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-white/60"><span>🟩 occupied</span><span>⬛ empty</span><span>🟨 selected</span><span>🟥 rejected scan (last 24 h)</span></div>
      <div className="grid lg:grid-cols-[1fr_20rem] gap-4">
        <div className="card overflow-x-auto">
          <div className="grid gap-1 w-max" style={{ gridTemplateColumns: `repeat(${h.rows}, 1.5rem)` }}>
            {Array.from({ length: h.columns }, (_, ci) => ci + 1).flatMap(c => Array.from({ length: h.rows }, (_, ri) => ri + 1).map(r => {
              const id = posId(h.code, p, c, r)
              const cls = id === sel ? 'bg-amber-300 scale-110' : bad.has(id) ? 'bg-red-500 hover:bg-red-400' : occ.has(id) ? 'bg-emerald-500 hover:bg-emerald-300' : 'bg-white/10 hover:bg-white/25'
              return <button key={id} title={id} onClick={() => setSel(id)} className={`h-6 w-6 rounded-md transition ${cls}`} />
            }))}
          </div>
          <p className="text-xs text-white/40 mt-3">Columns run top to bottom, rows left to right. {h.description}</p>
        </div>
        <div className="card text-sm space-y-2 h-fit">
          {!sel ? <p className="text-white/50">Select a position to see its record.</p> : (<>
            <div className="font-mono text-lg text-lime-300">{sel}</div>
            {det.error && <p className="text-red-400">{det.error}</p>}
            {d && (d.plant ? (<>
              <div>Plant UUID<div className="font-mono text-xs break-all">{d.plant.uuid}</div></div>
              <div>GID <span className="font-mono">{d.plant.gid}</span>{d.plant.phenomeone_id && <> · PhenomeOne <span className="font-mono">{d.plant.phenomeone_id}</span></>}</div>
              {infoText(d.plant.info) && <div className="font-mono text-xs text-white/60 break-all">{infoText(d.plant.info)}</div>}
              <div>Sown {d.plant.sown_date?.slice(0, 10) ?? '—'} · Placed {fmtDate(d.history[0]?.moved_at)}</div>
              <div>Previous: <span className="font-mono">{d.history[1]?.position_id ?? '—'}</span></div>
              <div className="pt-2 font-semibold">Movement history</div>
              <ul className="space-y-1">{d.history.map(m => (<li key={m.id} className="font-mono text-xs text-white/70">{m.moved_at.slice(0, 10)} {m.position_id} ({m.by}){m.kind === 'correction' && ` ✏️ ${m.reason}`}</li>))}</ul>
            </>) : <p className="text-white/50">Empty position.</p>)}
            {d && d.rejections.length > 0 && (<>
              <div className="pt-2 font-semibold text-red-300">Recent rejected scans</div>
              <ul className="space-y-1">{d.rejections.map((r, i) => (<li key={i} className="text-xs text-red-200/80">{fmtDate(r.at)} · {r.by ?? '?'} · {r.reason}</li>))}</ul>
            </>)}
          </>)}
        </div>
      </div>
    </div>
  )
}
