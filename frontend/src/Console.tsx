import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './auth'
import { Logo } from './site/SiteLayout'
import Dashboard from './pages/Dashboard'
import MapView from './pages/MapView'
import Search from './pages/Search'
import Scan from './pages/Scan'
import Plants from './pages/Plants'
import Reports from './pages/Reports'
import Admin from './pages/Admin'
import System from './pages/System'
import DbAdmin from './pages/DbAdmin'

const ALL = ['admin', 'manager', 'breeder', 'gardener', 'member']
const WORK = ['admin', 'manager', 'breeder', 'gardener']
const STAFF = ['admin', 'manager', 'breeder']
const TABS: [string, string, string, string[]][] = [
  ['dash', '📊', 'Dashboard', ALL], ['map', '🗺️', 'Map', ALL], ['search', '🔎', 'Search', ALL], ['scan', '⌨️', 'Scan', WORK],
  ['plants', '🏷️', 'Plants', STAFF], ['reports', '📑', 'Reports', STAFF], ['admin', '⚙️', 'Facility', ['admin']],
  ['system', '🗄️', 'Database', ['admin']], ['dbadmin', '🛠️', 'Admin', ['admin']],
]

export default function Console() {
  const { user, signOut } = useAuth()
  const { tab = 'dash' } = useParams()
  const nav = useNavigate()
  const focus = (useLocation().state as { focus?: string } | null)?.focus ?? null
  if (!user) return null
  const tabs = TABS.filter(t => t[3].includes(user.role))
  if (!tabs.some(t => t[0] === tab)) return <Navigate to="/app/dash" replace />
  const go = (t: string) => nav(`/app/${t}`)
  const out = () => { signOut(); nav('/') }
  return (
    <div className="md:flex">
      <aside className="no-print hidden md:flex md:flex-col md:w-60 md:h-screen md:sticky md:top-0 p-5 gap-1 border-r border-white/10">
        <div className="mb-8"><Logo size="text-3xl" /></div>
        {tabs.map(([id, ic, label]) => (
          <button key={id} onClick={() => go(id)} className={`text-left rounded-xl px-4 py-3 ${tab === id ? 'bg-emerald-400/20 text-emerald-300' : 'hover:bg-white/5'}`}>{ic} {label}</button>
        ))}
        <div className="mt-auto text-sm"><div>{user.name}</div><div className="text-xs text-white/40 capitalize">{user.role}</div>
          <div className="flex gap-2 mt-3"><Link to="/" className="btn-ghost text-xs">Website</Link><button onClick={out} className="btn-ghost text-xs">Sign out</button></div></div>
      </aside>
      <main className="flex-1 min-w-0 p-4 md:p-8 pb-28 md:pb-8 max-w-6xl">
        <div className="no-print md:hidden flex justify-between items-center mb-4">
          <Logo /><button onClick={out} className="text-xs text-white/50">Sign out</button>
        </div>
        {user.role === 'member' && <p className="no-print card !border-amber-400/30 text-amber-200 text-sm mb-4">You have view-only access. Ask an administrator if you need to scan or edit.</p>}
        {tab === 'dash' && <Dashboard />}
        {tab === 'map' && <MapView key={focus ?? 'none'} focus={focus} />}
        {tab === 'search' && <Search role={user.role} onLocate={p => nav('/app/map', { state: { focus: p } })} />}
        {tab === 'scan' && <Scan />}
        {tab === 'plants' && <Plants role={user.role} />}
        {tab === 'reports' && <Reports />}
        {tab === 'admin' && <Admin />}
        {tab === 'system' && <System me={user} />}
        {tab === 'dbadmin' && <DbAdmin />}
      </main>
      <nav className="no-print md:hidden fixed bottom-0 inset-x-0 flex overflow-x-auto bg-[#07130d]/95 border-t border-white/10 backdrop-blur">
        {tabs.map(([id, ic, label]) => (
          <button key={id} onClick={() => go(id)} className={`shrink-0 px-4 py-3 text-xs ${tab === id ? 'text-emerald-300' : 'text-white/60'}`}><div className="text-xl">{ic}</div>{label}</button>
        ))}
      </nav>
    </div>
  )
}
