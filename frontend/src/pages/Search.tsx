import { useEffect, useState } from 'react'
import { api, fmtDate, infoText, useLoad, type PlantHit } from '../api'

function GenotypeCard({ gid, role, onLocate }: { gid: string; role: string; onLocate: (p: string) => void }) {
  const [tick, setTick] = useState(0)
  const [msg, setMsg] = useState('')
  const { data, error } = useLoad(() => api.genotype(gid), [gid, tick])
  if (error || !data) return null
  const g = data.genotype
  const sync = async () => { try { await api.syncGenotype(gid); setMsg('Synced from PhenomeOne'); setTick(t => t + 1) } catch (e) { setMsg((e as Error).message) } }
  return (
    <div className="card space-y-2 text-sm">
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <div><span className="font-mono text-lime-300 text-lg">{g.gid}</span> <span className="text-white/50">PhenomeOne ID {g.phenomeone_id ?? '—'}</span></div>
        {(role === 'admin' || role === 'breeder') && <button className="btn-ghost text-xs" onClick={sync}>Sync from PhenomeOne</button>}
      </div>
      {msg && <p className="text-xs text-amber-300">{msg}</p>}
      {infoText(g.info) && <div className="font-mono text-xs text-white/60 break-all">Genotype / parentage: {infoText(g.info)}</div>}
      <div className="text-white/60">{data.plants.length} physical plant(s) with this GID</div>
      <ul className="divide-y divide-white/10">
        {data.plants.slice(0, 60).map(p => (
          <li key={p.uuid} className="py-1.5 flex flex-wrap justify-between gap-2">
            <span className="font-mono text-xs">{p.uuid.slice(0, 13)}… · {p.status} · age {p.age_days ?? '—'} d</span>
            {p.position ? <button className="text-lime-300 text-xs font-mono underline" onClick={() => onLocate(p.position!)}>{p.position}</button> : <span className="text-white/40 text-xs">removed</span>}
          </li>))}
      </ul>
    </div>
  )
}

function PlantPanel({ uuid, role, onLocate, onChanged }: { uuid: string; role: string; onLocate: (p: string) => void; onChanged: () => void }) {
  const [tick, setTick] = useState(0)
  const [err, setErr] = useState('')
  const { data, error } = useLoad(() => api.plant(uuid), [uuid, tick])
  if (error) return <p className="text-red-400 text-sm">{error}</p>
  if (!data) return <p className="text-white/50 text-sm">Loading…</p>
  const p = data.plant
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); setErr(''); setTick(t => t + 1); onChanged() } catch (e) { setErr((e as Error).message) } }
  const remove = () => { const r = window.prompt('Reason for removing this plant?'); if (r) run(() => api.removePlant(uuid, r)) }
  const correct = () => {
    const pos = window.prompt('Correct position ID (e.g. L1-P01-C03-R27)?'); if (!pos) return
    const r = window.prompt('Reason for the correction?'); if (r) run(() => api.correct(uuid, pos, r))
  }
  const canRemove = ['admin', 'manager', 'breeder'].includes(role) && p.status === 'active'
  const canCorrect = ['admin', 'manager'].includes(role) && p.status === 'active'
  return (
    <div className="mt-3 pt-3 border-t border-white/10 text-sm space-y-2">
      <div>Status <b className={p.status === 'active' ? 'text-emerald-300' : 'text-red-300'}>{p.status}</b> · Sown {p.sown_date?.slice(0, 10) ?? '—'} · Age {p.age_days ?? '—'} days · Created {fmtDate(p.created_at)}{p.created_by && ` by ${p.created_by}`}</div>
      {p.position && <button className="btn-ghost text-xs" onClick={() => onLocate(p.position!)}>Open {p.position} on map →</button>}
      {infoText(p.info) && <div className="font-mono text-xs text-white/60 break-all">{infoText(p.info)}</div>}
      <div className="font-semibold">Location history</div>
      <ul className="space-y-1">{data.history.map(m => (<li key={m.id} className="font-mono text-xs text-white/70">{fmtDate(m.moved_at)} → {m.position_id} · {m.by} · {m.source}{m.device && `/${m.device}`}{m.kind === 'correction' && ` ✏️ correction: ${m.reason}`}</li>))}</ul>
      {data.status_history.length > 0 && (<>
        <div className="font-semibold">Status history</div>
        <ul className="space-y-1">{data.status_history.map((s, i) => (<li key={i} className="text-xs text-white/70">{fmtDate(s.at)} · {s.from_status} → {s.to_status} · {s.by} · {s.reason}{s.last_position_id && ` (last at ${s.last_position_id})`}</li>))}</ul>
      </>)}
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <div className="flex gap-2">
        {canCorrect && <button className="btn-ghost text-xs" onClick={correct}>Correct location</button>}
        {canRemove && <button className="btn-ghost text-xs text-red-300" onClick={remove}>Remove plant</button>}
      </div>
    </div>
  )
}

export default function Search({ role, onLocate }: { role: string; onLocate: (pos: string) => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PlantHit[]>([])
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!q.trim()) { setHits([]); return }
    const t = setTimeout(() => api.search(q.trim()).then(h => { setHits(h); setErr('') }).catch(e => setErr(e.message)), 250)
    return () => clearTimeout(t)
  }, [q, tick])
  const gidMatch = hits.find(h => h.gid.toLowerCase() === q.trim().toLowerCase())?.gid
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold">Search</h1>
      <input className="input" placeholder="GID, plant UUID, position ID, or glasshouse/platform (e.g. GT-1007, L1-P01)" value={q} onChange={e => setQ(e.target.value)} autoFocus />
      {err && <p className="text-red-400 text-sm">{err}</p>}
      {gidMatch && <GenotypeCard gid={gidMatch} role={role} onLocate={onLocate} />}
      {q.trim() && <p className="text-sm text-white/50">{hits[0]?.total ?? 0} plant(s) found{(hits[0]?.total ?? 0) > 50 && ' — showing first 50'}</p>}
      <div className="space-y-2">
        {hits.map(p => (
          <div key={p.uuid} className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-lime-300">{p.gid} <span className="text-white/40">·</span> {p.position ?? <span className="text-red-300">removed</span>}</div>
                <div className="font-mono text-xs text-white/50 break-all">{p.uuid}</div>
              </div>
              <div className="flex gap-2">
                {p.position && <button className="btn-ghost text-sm" onClick={() => onLocate(p.position!)}>Map →</button>}
                <button className="btn-ghost text-sm" onClick={() => setOpen(open === p.uuid ? null : p.uuid)}>{open === p.uuid ? 'Hide' : 'Details'}</button>
              </div>
            </div>
            {open === p.uuid && <PlantPanel uuid={p.uuid} role={role} onLocate={onLocate} onChanged={() => setTick(t => t + 1)} />}
          </div>
        ))}
      </div>
    </div>
  )
}
