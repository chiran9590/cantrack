import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { company } from '../company'
import { Logo } from './SiteLayout'

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-screen grid md:grid-cols-[1fr_1.1fr]">
      <div className="hidden md:flex relative overflow-hidden flex-col justify-between p-10 bg-gradient-to-br from-emerald-700/40 via-[#0b1f17] to-[#07130d] border-r border-white/10">
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-lime-400/10 blur-3xl" />
        <Logo size="text-3xl" />
        <div className="relative"><h2 className="font-display text-4xl font-extrabold leading-tight">{company.tagline}</h2><p className="text-white/60 mt-4 max-w-sm">{company.intro}</p></div>
        <Link to="/" className="relative text-sm text-white/50 hover:text-white">← Back to website</Link>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8"><Logo size="text-3xl" /></div>
          <h1 className="font-display text-3xl font-extrabold">{title}</h1>
          <p className="text-white/60 mt-1 mb-6">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  )
}
