import { useState } from 'react'
import { api, useLoad, type NewPlant } from '../api'
import QR from '../QR'

export default function Plants({ role }: { role: string }) {
  const canRegister = role === 'admin' || role === 'breeder'
  const [tab, setTab] = useState<'plants' | 'positions'>('plants')
  const [tick, setTick] = useState(0)
  const gts = useLoad(() => api.genotypes(''), [tick])
  const fac = useLoad(api.facility)
  const [gid, setGid] = useState(''); const [pid, setPid] = useState('')
  const [gidNew, setGidNew] = useState(''); const [count, setCount] = useState(1); const [sown, setSown] = useState('')
  const [made, setMade] = useState<NewPlant[]>([])
  const [msg, setMsg] = useState('')
  const [gh, setGh] = useState(''); const [plat, setPlat] = useState(1)
  const h = (fac.data ?? []).find(x => x.code === gh) ?? fac.data?.[0]

  const addG = async () => { try { await api.addGenotype(gidNew.trim(), pid.trim()); setMsg(`Genotype ${gidNew} added`); setGid(gidNew.trim()); setGidNew(''); setPid(''); setTick(t => t + 1) } catch (e) { setMsg((e as Error).message) } }
  const reg = async () => { try { setMade(await api.registerPlants(gid.trim(), count, sown)); setMsg('') } catch (e) { setMsg((e as Error).message) } }
  const tabBtn = (id: typeof tab, label: string) => <button onClick={() => setTab(id)} className={`btn-ghost ${tab === id ? 'bg-emerald-400/20 border-emerald-400' : ''}`}>{label}</button>

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-extrabold no-print">Plants &amp; QR labels</h1>
      <div className="flex gap-2 no-print">{tabBtn('plants', 'Register plants')}{tabBtn('positions', 'Position labels')}</div>

      {tab === 'plants' && (<>
        {canRegister ? (
          <div className="grid md:grid-cols-2 gap-4 no-print">
            <div className="card space-y-3">
              <h2 className="font-semibold">1 · Add a genotype (GID)</h2>
              <input className="input" placeholder="GID e.g. GT-2001" value={gidNew} onChange={e => setGidNew(e.target.value)} />
              <input className="input" placeholder="PhenomeOne ID (optional)" value={pid} onChange={e => setPid(e.target.value)} />
              <button className="btn" disabled={!gidNew.trim()} onClick={addG}>Add GID</button>
              <p className="text-xs text-white/50">{(gts.data ?? []).length} GIDs in the database.</p>
            </div>
            <div className="card space-y-3">
              <h2 className="font-semibold">2 · Register physical plants</h2>
              <input className="input" list="gids" placeholder="GID" value={gid} onChange={e => setGid(e.target.value)} />
              <datalist id="gids">{(gts.data ?? []).map(g => <option key={g.gid} value={g.gid} />)}</datalist>
              <div className="grid grid-cols-2 gap-3">
                <input className="input" type="number" min={1} max={200} value={count} onChange={e => setCount(+e.target.value)} />
                <input className="input" type="date" value={sown} onChange={e => setSown(e.target.value)} />
              </div>
              <button className="btn" disabled={!gid.trim() || count < 1} onClick={reg}>Create {count} plant(s) &amp; labels</button>
            </div>
          </div>
        ) : <p className="text-white/50 no-print">Only admins and breeders can register plants.</p>}
        {msg && <p className="text-amber-300 text-sm no-print">{msg}</p>}
        {made.length > 0 && (<>
          <button className="btn no-print" onClick={() => window.print()}>🖨️ Print {made.length} labels</button>
          <div id="print-area" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {made.map(p => (<div key={p.uuid} className="bg-white text-black rounded p-2 flex flex-col items-center gap-1 break-inside-avoid">
              <QR text={p.uuid} size={110} /><div className="font-bold text-sm">{p.gid}</div><div className="font-mono text-[8px] break-all text-center">{p.uuid}</div></div>))}
          </div>
        </>)}
      </>)}

      {tab === 'positions' && h && (<>
        <div className="flex flex-wrap gap-2 no-print">
          {(fac.data ?? []).map(x => <button key={x.code} onClick={() => { setGh(x.code); setPlat(1) }} className={`btn-ghost ${x.code === h.code ? 'bg-emerald-400/20 border-emerald-400' : ''}`}>{x.code}</button>)}
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          {Array.from({ length: h.platforms }, (_, i) => i + 1).map(n => <button key={n} onClick={() => setPlat(n)} className={`btn-ghost text-sm ${n === plat ? 'bg-lime-400/20 border-lime-400' : ''}`}>Platform {n}</button>)}
          <button className="btn" onClick={() => window.print()}>🖨️ Print {h.columns * h.rows} labels</button>
        </div>
        <div id="print-area" className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
          {Array.from({ length: h.columns }, (_, c) => c + 1).flatMap(c => Array.from({ length: h.rows }, (_, r) => r + 1).map(r => {
            const id = `${h.code}-P${String(plat).padStart(2, '0')}-C${String(c).padStart(2, '0')}-R${String(r).padStart(2, '0')}`
            return (<div key={id} className="bg-white text-black rounded p-1.5 flex flex-col items-center break-inside-avoid"><QR text={id} size={80} /><div className="font-mono text-[9px] font-bold mt-0.5">{id}</div></div>)
          }))}
        </div>
      </>)}
    </div>
  )
}
