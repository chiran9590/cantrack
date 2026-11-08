import { useState } from 'react'
import { api, downloadReport, fmtDate, useLoad, type ReportResult } from '../api'

const REPORTS: Record<string, { label: string; filters: string[] }> = {
  plants: { label: 'Plants (by glasshouse / platform / GID)', filters: ['glasshouse', 'platform', 'gid', 'status'] },
  movements: { label: 'Movement history', filters: ['glasshouse', 'platform', 'gid', 'date'] },
  moved: { label: 'Plants moved in a period', filters: ['glasshouse', 'platform', 'gid', 'date'] },
  positions: { label: 'Empty & occupied positions', filters: ['glasshouse', 'platform', 'gid', 'state'] },
  occupancy: { label: 'Occupancy by platform', filters: ['glasshouse', 'platform'] },
  turnover: { label: 'Plant turnover (by month)', filters: ['glasshouse', 'date'] },
  scanning: { label: 'Scanning activity by user', filters: ['date'] },
  sessions: { label: 'Scan sessions', filters: ['date'] },
  rejections: { label: 'Rejected scans', filters: ['date'] },
  audit: { label: 'Audit history', filters: ['date'] },
}

export default function Reports() {
  const fac = useLoad(api.facility)
  const [name, setName] = useState('plants')
  const [v, setV] = useState<Record<string, string>>({})
  const [res, setRes] = useState<ReportResult | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const R = REPORTS[name]
  const set = (k: string, val: string) => setV(x => ({ ...x, [k]: val }))
  const params = () => Object.fromEntries(R.filters.flatMap(f => (f === 'date' ? ['date_from', 'date_to'] : [f])).map(k => [k, v[k] ?? '']))
  const run = async () => { setBusy(true); setErr(''); try { setRes(await api.report(name, params())) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } }
  const dl = async (f: 'csv' | 'xlsx') => { try { await downloadReport(name, params(), f) } catch (e) { setErr((e as Error).message) } }
  const show = (x: unknown) => (x === null || x === undefined ? '' : typeof x === 'string' && /^\d{4}-\d\d-\d\dT/.test(x) ? fmtDate(x) : String(x))
  const sel = 'input !font-sans'
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold">Reports</h1>
      <div className="card space-y-3">
        <select className={sel} value={name} onChange={e => { setName(e.target.value); setRes(null) }}>
          {Object.entries(REPORTS).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
        </select>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {R.filters.includes('glasshouse') && <select className={sel} value={v.glasshouse ?? ''} onChange={e => set('glasshouse', e.target.value)}><option value="">All glasshouses</option>{(fac.data ?? []).map(h => <option key={h.code} value={h.code}>{h.code}</option>)}</select>}
          {R.filters.includes('platform') && <input className={sel} type="number" min={1} placeholder="Platform #" value={v.platform ?? ''} onChange={e => set('platform', e.target.value)} />}
          {R.filters.includes('gid') && <input className={sel} placeholder="GID contains…" value={v.gid ?? ''} onChange={e => set('gid', e.target.value)} />}
          {R.filters.includes('status') && <select className={sel} value={v.status ?? ''} onChange={e => set('status', e.target.value)}><option value="">Active &amp; removed</option><option value="active">Active</option><option value="removed">Removed</option></select>}
          {R.filters.includes('state') && <select className={sel} value={v.state ?? ''} onChange={e => set('state', e.target.value)}><option value="">Empty &amp; occupied</option><option value="occupied">Occupied</option><option value="empty">Empty</option></select>}
          {R.filters.includes('date') && (<>
            <label className="text-xs text-white/50">From<input className={sel} type="date" value={v.date_from ?? ''} onChange={e => set('date_from', e.target.value)} /></label>
            <label className="text-xs text-white/50">To<input className={sel} type="date" value={v.date_to ?? ''} onChange={e => set('date_to', e.target.value)} /></label>
          </>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run report'}</button>
          <button className="btn-ghost" onClick={() => dl('csv')}>⬇ CSV</button>
          <button className="btn-ghost" onClick={() => dl('xlsx')}>⬇ Excel</button>
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>
      {res && (
        <div className="card overflow-x-auto">
          <p className="text-sm text-white/60 mb-2">{res.total.toLocaleString()} row(s){res.total > 200 && ' — preview of the first 200; download for everything'}</p>
          <table className="w-full text-xs text-left">
            <thead className="text-white/50"><tr>{res.columns.map(c => <th key={c} className="py-1 pr-4 whitespace-nowrap">{c}</th>)}</tr></thead>
            <tbody>{res.rows.map((r, i) => (<tr key={i} className="border-t border-white/10">{res.columns.map(c => <td key={c} className="py-1.5 pr-4 font-mono whitespace-nowrap">{show(r[c])}</td>)}</tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
