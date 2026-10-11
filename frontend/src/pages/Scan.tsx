import { useRef, useState } from 'react'
import { api } from '../api'

interface Entry { ok: boolean; msg: string }
const POS_RE = /^[A-Z0-9]{1,4}-P\d+-C\d+-R\d+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function Scan() {
  const [pos, setPos] = useState('')
  const [uuid, setUuid] = useState('')
  const [log, setLog] = useState<Entry[]>([])
  const [busy, setBusy] = useState(false)
  const session = useRef(`S-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`).current
  const posRef = useRef<HTMLInputElement>(null)
  const uRef = useRef<HTMLInputElement>(null)
  const posOk = POS_RE.test(pos)
  const uuidOk = UUID_RE.test(uuid.trim())

  const submit = async () => {
    setBusy(true)
    let e: Entry
    try { e = { ok: true, msg: (await api.scan(pos, uuid.trim(), session)).message } }
    catch (x) { e = { ok: false, msg: (x as Error).message } }
    setBusy(false); setLog(l => [e, ...l])
    if (e.ok) { setPos(''); setUuid(''); posRef.current?.focus() } else { setUuid(''); uRef.current?.focus() }
  }
  const last = log[0]
  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-end justify-between"><h1 className="font-display text-3xl font-extrabold">Scan</h1><span className="font-mono text-xs text-white/50">{session}</span></div>
      <div className="space-y-1"><label className="text-sm text-white/60">1 · Position ID</label>
        <input ref={posRef} className="input text-lg" placeholder="L1-P01-C03-R27" value={pos} autoFocus
          onChange={e => setPos(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && posOk && uRef.current?.focus()} />
        {pos && <p className={`text-xs ${posOk ? 'text-emerald-300' : 'text-red-400'}`}>{posOk ? '✓ Format OK' : '✗ Not a position ID format'}</p>}
      </div>
      <div className="space-y-1"><label className="text-sm text-white/60">2 · Plant UUID</label>
        <input ref={uRef} className="input text-lg" placeholder="scan plant QR" value={uuid}
          onChange={e => setUuid(e.target.value)} onKeyDown={e => e.key === 'Enter' && posOk && uuidOk && !busy && submit()} />
        {uuid && !uuidOk && <p className="text-xs text-red-400">✗ Not a UUID</p>}
      </div>
      <button className="btn w-full text-lg py-5" disabled={!posOk || !uuidOk || busy} onClick={submit}>{busy ? 'Saving…' : 'Record'}</button>
      {last && <div className={`rounded-2xl p-5 text-lg font-semibold ${last.ok ? 'bg-emerald-500/25 text-emerald-200' : 'bg-red-500/25 text-red-200'}`}>{last.ok ? '✓ ' : '⚠ '}{last.msg}</div>}
      <div className="text-sm text-white/50">This session: {log.filter(l => l.ok).length} recorded · {log.filter(l => !l.ok).length} errors</div>
    </div>
  )
}
