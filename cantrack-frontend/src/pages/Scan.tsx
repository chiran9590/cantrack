import { useRef, useState } from 'react'
import { isValidPos, posId, type Result, type Store } from '../data'

export default function Scan({ s }: { s: Store }) {
  const [pos, setPos] = useState('')
  const [uuid, setUuid] = useState('')
  const [log, setLog] = useState<Result[]>([])
  const session = useRef(`S-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`).current
  const posRef = useRef<HTMLInputElement>(null)
  const uRef = useRef<HTMLInputElement>(null)
  const posOk = isValidPos(s.houses, pos)

  const submit = () => {
    const r = s.record(uuid.trim(), pos.trim().toUpperCase(), session)
    setLog([r, ...log])
    if (r.ok) { setPos(''); setUuid(''); posRef.current?.focus() } else { setUuid(''); uRef.current?.focus() }
  }
  const simulate = () => { // demo only: stands in for the camera QR scanner
    const pl = s.plants[Math.floor(Math.random() * s.plants.length)]
    for (let i = 0; i < 200; i++) {
      const h = s.houses[Math.floor(Math.random() * s.houses.length)]
      const id = posId(h.code, 1 + Math.floor(Math.random() * h.platforms), 1 + Math.floor(Math.random() * h.columns), 1 + Math.floor(Math.random() * h.rows))
      if (!s.byPos.has(id)) { setPos(id); setUuid(pl.uuid); return }
    }
  }
  const last = log[0]
  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-end justify-between"><h1 className="font-display text-3xl font-extrabold">Scan</h1><span className="font-mono text-xs text-white/50">{session}</span></div>
      <div className="space-y-1"><label className="text-sm text-white/60">1 · Position ID</label>
        <input ref={posRef} className="input text-lg" placeholder="L1-P01-C03-R27" value={pos} autoFocus
          onChange={e => setPos(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && posOk && uRef.current?.focus()} />
        {pos && <p className={`text-xs ${posOk ? 'text-emerald-300' : 'text-red-400'}`}>{posOk ? '✓ Valid position' : '✗ Not a valid position'}</p>}
      </div>
      <div className="space-y-1"><label className="text-sm text-white/60">2 · Plant UUID</label>
        <input ref={uRef} className="input text-lg" placeholder="scan plant QR" value={uuid}
          onChange={e => setUuid(e.target.value)} onKeyDown={e => e.key === 'Enter' && posOk && uuid && submit()} />
      </div>
      <button className="btn w-full text-lg py-5" disabled={!posOk || !uuid} onClick={submit}>Record</button>
      <button className="btn-ghost w-full text-sm" onClick={simulate}>Demo: simulate QR scans</button>
      {last && <div className={`rounded-2xl p-5 text-lg font-semibold ${last.ok ? 'bg-emerald-500/25 text-emerald-200' : 'bg-red-500/25 text-red-200'}`}>{last.ok ? '✓ ' : '⚠ '}{last.msg}</div>}
      <div className="text-sm text-white/50">This session: {log.filter(l => l.ok).length} recorded · {log.filter(l => !l.ok).length} errors</div>
    </div>
  )
}
