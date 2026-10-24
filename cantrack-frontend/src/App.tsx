import { useMemo, useState } from 'react'
import { INITIAL_HOUSES, seedData, isValidPos, type Glasshouse, type Store } from './data'
import Dashboard from './pages/Dashboard'
import MapView from './pages/MapView'
import Search from './pages/Search'
import Scan from './pages/Scan'
import Admin from './pages/Admin'

type Tab = 'dash' | 'map' | 'search' | 'scan' | 'admin'
const TABS: [Tab, string, string][] = [['dash', '📊', 'Dashboard'], ['map', '🗺️', 'Map'], ['search', '🔎', 'Search'], ['scan', '📷', 'Scan'], ['admin', '⚙️', 'Facility']]

export default function App() {
  const seed = useMemo(() => seedData(INITIAL_HOUSES), [])
  const [houses, setHouses] = useState<Glasshouse[]>(INITIAL_HOUSES)
  const [plants, setPlants] = useState(seed.plants)
  const [moves, setMoves] = useState(seed.moves)
  const [tab, setTab] = useState<Tab>('dash')
  const [focus, setFocus] = useState<string | null>(null)
  const byPos = useMemo(() => new Map(plants.filter(p => p.status === 'active').map(p => [p.position, p])), [plants])

  const s: Store = {
    houses, plants, moves, byPos,
    record: (uuid, pos, session) => {
      const pl = plants.find(p => p.uuid === uuid)
      if (!isValidPos(houses, pos)) return { ok: false, msg: `Invalid position ${pos || '(empty)'}` }
      if (!pl) return { ok: false, msg: 'Unknown plant UUID' }
      const other = byPos.get(pos)
      if (other && other.uuid !== uuid) return { ok: false, msg: `${pos} already holds plant ${other.uuid.slice(0, 8)}…` }
      if (pl.position === pos) return { ok: false, msg: 'Plant is already at this position' }
      setPlants(ps => ps.map(p => (p.uuid === uuid ? { ...p, position: pos } : p)))
      setMoves(ms => [...ms, { id: ms.length + 1, uuid, gid: pl.gid, position: pos, at: new Date().toISOString(), by: 'You', source: 'web', session }])
      return { ok: true, msg: `${pl.gid} → ${pos}` }
    },
    addHouse: h => {
      if (!/^[A-Z0-9]{1,4}$/.test(h.code)) return 'Code must be 1–4 letters/digits'
      if (houses.some(x => x.code === h.code)) return 'Code already exists'
      if ([h.platforms, h.columns, h.rows].some(n => !(n >= 1))) return 'Platforms, columns and rows must be at least 1'
      setHouses(hs => [...hs, h]); return null
    },
  }

  const go = (t: Tab) => { setTab(t); if (t !== 'map') setFocus(null) }
  return (
    <div className="md:flex">
      <aside className="hidden md:flex md:flex-col md:w-60 md:h-screen md:sticky md:top-0 p-5 gap-1 border-r border-white/10">
        <div className="font-display text-3xl font-extrabold mb-8">Can<span className="text-lime-400">Track</span> 🌿</div>
        {TABS.map(([id, ic, label]) => (
          <button key={id} onClick={() => go(id)} className={`text-left rounded-xl px-4 py-3 ${tab === id ? 'bg-emerald-400/20 text-emerald-300' : 'hover:bg-white/5'}`}>{ic} {label}</button>
        ))}
        <p className="mt-auto text-xs text-white/40">Demo data · no backend yet</p>
      </aside>
      <main className="flex-1 p-4 md:p-8 pb-28 md:pb-8 max-w-6xl">
        <div className="md:hidden font-display text-2xl font-extrabold mb-4">Can<span className="text-lime-400">Track</span> 🌿</div>
        {tab === 'dash' && <Dashboard s={s} />}
        {tab === 'map' && <MapView key={focus ?? 'none'} s={s} focus={focus} />}
        {tab === 'search' && <Search s={s} onLocate={p => { setFocus(p); setTab('map') }} />}
        {tab === 'scan' && <Scan s={s} />}
        {tab === 'admin' && <Admin s={s} />}
      </main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 grid grid-cols-5 bg-[#07130d]/95 border-t border-white/10 backdrop-blur">
        {TABS.map(([id, ic, label]) => (
          <button key={id} onClick={() => go(id)} className={`py-3 text-xs ${tab === id ? 'text-emerald-300' : 'text-white/60'}`}><div className="text-xl">{ic}</div>{label}</button>
        ))}
      </nav>
    </div>
  )
}
