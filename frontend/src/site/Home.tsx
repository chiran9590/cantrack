import { Link } from 'react-router-dom'
import { company as c } from '../company'
import { useAuth } from '../auth'

function Helix() {
  const pts = Array.from({ length: 21 }, (_, i) => i * 20)
  const x = (y: number, s: number) => 70 + s * 46 * Math.sin(y / 38)
  const path = (s: number) => pts.map((y, i) => `${i ? 'L' : 'M'}${x(y, s).toFixed(1)},${y}`).join(' ')
  return (
    <svg viewBox="0 0 140 400" className="h-full w-full" aria-hidden>
      <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a3e635" /><stop offset="1" stopColor="#22c55e" stopOpacity=".2" /></linearGradient></defs>
      {pts.map(y => <line key={y} x1={x(y, 1)} x2={x(y, -1)} y1={y} y2={y} stroke="#4ade80" strokeOpacity=".25" strokeWidth="2" />)}
      <path d={path(1)} fill="none" stroke="url(#hg)" strokeWidth="3" /><path d={path(-1)} fill="none" stroke="url(#hg)" strokeWidth="3" />
      {pts.filter((_, i) => i % 2 === 0).map(y => <g key={y}><circle cx={x(y, 1)} cy={y} r="4" fill="#a3e635" /><circle cx={x(y, -1)} cy={y} r="4" fill="#4ade80" /></g>)}
    </svg>
  )
}

const H2 = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="mb-10"><div className="text-xs uppercase tracking-[.25em] text-lime-400 mb-2">{k}</div><h2 className="font-display text-3xl md:text-4xl font-extrabold max-w-2xl">{children}</h2></div>
)

export default function Home() {
  const { user } = useAuth()
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute -top-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute top-20 -right-32 w-[28rem] h-[28rem] rounded-full bg-lime-400/10 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-5 pt-16 md:pt-24 pb-20 grid md:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div>
            <div className="inline-block text-xs uppercase tracking-[.25em] text-lime-300 border border-lime-400/30 rounded-full px-3 py-1 mb-6">Plant tracking &amp; traceability</div>
            <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-[1.05]">{c.tagline}</h1>
            <p className="mt-6 text-lg text-white/70 max-w-xl">{c.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? <Link to="/app" className="btn">Open dashboard →</Link> : (<><Link to="/register" className="btn">Create an account</Link><Link to="/login" className="btn-ghost !py-[.85rem]">Sign in</Link></>)}
            </div>
          </div>
          <div className="relative h-80 md:h-[26rem]">
            <div className="absolute inset-0 opacity-70"><Helix /></div>
            <div className="floaty absolute left-0 md:-left-6 top-6 card !bg-[#0b1f17]/90 backdrop-blur w-60 shadow-2xl">
              <div className="text-[10px] uppercase tracking-widest text-lime-400">● Live scan</div>
              <div className="font-mono text-lg mt-1">L1-P02-C03-R27</div><div className="text-sm text-white/60">GT-1007 recorded ✓</div></div>
            <div className="floaty absolute right-0 bottom-4 card !bg-[#0b1f17]/90 backdrop-blur w-52 shadow-2xl" style={{ animationDelay: '-3s' }}>
              <div className="text-[10px] uppercase tracking-widest text-white/50">Occupancy</div>
              <div className="font-display text-3xl font-extrabold text-lime-300">61%</div>
              <div className="h-2 mt-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full w-[61%] bg-gradient-to-r from-emerald-500 to-lime-400" /></div></div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {c.stats.map(([n, l]) => <div key={l} className="card text-center"><div className="font-display text-3xl font-extrabold text-lime-300">{n}</div><div className="text-sm text-white/60 mt-1">{l}</div></div>)}
      </div></section>

      <section className="max-w-6xl mx-auto px-5 mt-24 grid md:grid-cols-2 gap-10 items-start">
        <div><div className="text-xs uppercase tracking-[.25em] text-lime-400 mb-2">About us</div>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold">Breeding needs data you can trust.</h2></div>
        <div className="space-y-4 text-white/70 text-lg">{c.about.map(t => <p key={t}>{t}</p>)}</div>
      </section>

      <section className="max-w-6xl mx-auto px-5 mt-24">
        <H2 k="The platform">Everything between the label and the report.</H2>
        <div className="grid md:grid-cols-3 gap-4">
          {c.features.map(f => <div key={f.title} className="card hover:border-lime-400/40 transition"><div className="text-3xl mb-3">{f.icon}</div><div className="font-semibold mb-1">{f.title}</div><p className="text-sm text-white/60">{f.text}</p></div>)}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 mt-24">
        <H2 k="How it works">Three steps from plant to answer.</H2>
        <div className="grid md:grid-cols-3 gap-4">
          {c.steps.map(([t, d], i) => <div key={t} className="card relative overflow-hidden"><div className="absolute -right-2 -top-4 font-display text-8xl font-extrabold text-white/5">{i + 1}</div><div className="font-display text-2xl font-extrabold text-lime-300">{t}</div><p className="text-white/60 mt-2">{d}</p></div>)}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 mt-24">
        <H2 k="Facilities">Our glasshouses.</H2>
        <div className="grid md:grid-cols-3 gap-4">
          {c.facilities.map(f => <div key={f.code} className="card"><div className="font-display text-5xl font-extrabold text-lime-300">{f.code}</div><div className="font-semibold mt-2">{f.name}</div><p className="text-sm text-white/60 mt-1">{f.text}</p></div>)}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 mt-24">
        <div className="rounded-3xl p-8 md:p-12 bg-gradient-to-br from-emerald-600/30 to-lime-500/10 border border-emerald-400/20 flex flex-wrap items-center justify-between gap-6">
          <div><h2 className="font-display text-3xl font-extrabold">Join us or get in touch.</h2><p className="text-white/70 mt-2">We are always interested in people who like plants and clean data.</p></div>
          <div className="flex gap-3"><Link to="/careers" className="btn">Careers</Link><Link to="/contact" className="btn-ghost !py-[.85rem]">Contact</Link></div>
        </div>
      </section>
    </>
  )
}
