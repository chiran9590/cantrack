import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { company } from '../company'
import { useAuth } from '../auth'

export const Logo = ({ size = 'text-2xl' }: { size?: string }) => (
  <Link to="/" className={`font-display font-extrabold ${size}`}>{company.name.slice(0, 3)}<span className="text-lime-400">{company.name.slice(3)}</span> 🌿</Link>
)

export default function SiteLayout() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [pathname])
  const link = ({ isActive }: { isActive: boolean }) => `px-3 py-2 rounded-lg ${isActive ? 'text-lime-300' : 'text-white/70 hover:text-white'}`
  const links = [['/', 'Home'], ['/careers', 'Careers'], ['/contact', 'Contact']]
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur bg-[#07130d]/80 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-1">
            {links.map(([to, label]) => <NavLink key={to} to={to} end className={link}>{label}</NavLink>)}
            {user ? <Link to="/app" className="btn !py-2 ml-3">Open dashboard</Link> : (<>
              <Link to="/login" className="btn-ghost !py-2 ml-3">Sign in</Link>
              <Link to="/register" className="btn !py-2 ml-2">Register</Link></>)}
          </nav>
          <button className="md:hidden text-2xl" onClick={() => setOpen(!open)} aria-label="Menu">{open ? '✕' : '☰'}</button>
        </div>
        {open && (
          <div className="md:hidden px-5 pb-4 flex flex-col gap-1 border-t border-white/10">
            {links.map(([to, label]) => <NavLink key={to} to={to} end className={link}>{label}</NavLink>)}
            {user ? <Link to="/app" className="btn mt-2">Open dashboard</Link> : (<>
              <Link to="/login" className="btn-ghost mt-2">Sign in</Link><Link to="/register" className="btn">Register</Link></>)}
          </div>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-white/10 mt-20">
        <div className="max-w-6xl mx-auto px-5 py-10 grid md:grid-cols-3 gap-8 text-sm">
          <div><Logo /><p className="text-white/50 mt-3 max-w-xs">{company.tagline}</p></div>
          <div className="space-y-1.5"><div className="font-semibold mb-2">Company</div>
            {links.map(([to, label]) => <div key={to}><Link className="text-white/60 hover:text-white" to={to}>{label}</Link></div>)}
            <div><Link className="text-white/60 hover:text-white" to="/login">Sign in</Link></div></div>
          <div className="space-y-1.5 text-white/60"><div className="font-semibold text-white mb-2">Contact</div>
            <div>{company.contact.email}</div><div>{company.contact.phone}</div><div>{company.contact.address.join(', ')}</div></div>
        </div>
        <div className="border-t border-white/10 py-4 text-xs text-white/40 max-w-6xl mx-auto px-5 flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} {company.legalName}</span>
          <span className="flex gap-4"><Link to="/privacy" className="hover:text-white">Privacy Policy</Link><Link to="/legal" className="hover:text-white">Legal Notice</Link></span>
        </div>
      </footer>
    </div>
  )
}
