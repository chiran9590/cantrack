import { company as c } from '../company'

const Head = ({ k, title, text }: { k: string; title: string; text?: string }) => (
  <div className="max-w-6xl mx-auto px-5 pt-16 pb-10"><div className="text-xs uppercase tracking-[.25em] text-lime-400 mb-2">{k}</div>
    <h1 className="font-display text-4xl md:text-5xl font-extrabold">{title}</h1>{text && <p className="text-white/70 text-lg mt-4 max-w-2xl">{text}</p>}</div>
)

export function Careers() {
  return (<>
    <Head k="Careers" title="Grow with us." text="We are still growing. If you like plants, data and getting details right, we would like to hear from you." />
    <div className="max-w-6xl mx-auto px-5 space-y-3">
      {c.jobs.length === 0 && <div className="card text-white/60">There are no open positions listed right now. Send us your CV and a few lines about yourself at <a className="text-lime-300 underline" href={`mailto:${c.contact.email}`}>{c.contact.email}</a>.</div>}
      {c.jobs.map(j => (
        <a key={j.title} href={`mailto:${c.contact.email}?subject=${encodeURIComponent('Application: ' + j.title)}`} className="card flex flex-wrap justify-between gap-2 hover:border-lime-400/40">
          <span className="font-semibold">{j.title}</span><span className="text-white/50 text-sm">{j.place} · {j.type}</span></a>))}
    </div>
  </>)
}

export function Contact() {
  const rows: [string, string, string?][] = [['✉️ Email', c.contact.email, `mailto:${c.contact.email}`], ['📞 Phone', c.contact.phone, `tel:${c.contact.phone.replace(/\s/g, '')}`], ['📍 Address', c.contact.address.join(', ')]]
  return (<>
    <Head k="Contact" title="Let's talk." text="Questions about the platform, access to the dashboard, or working with us? Reach us here." />
    <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-3 gap-4">
      {rows.map(([k, v, href]) => <div key={k} className="card"><div className="text-sm text-white/50">{k}</div>{href ? <a href={href} className="text-lg font-semibold text-lime-300 break-all">{v}</a> : <div className="text-lg font-semibold">{v}</div>}</div>)}
    </div>
  </>)
}

export function Legal({ kind }: { kind: 'privacy' | 'legal' }) {
  const privacy = kind === 'privacy'
  return (<>
    <Head k={privacy ? 'Privacy' : 'Legal'} title={privacy ? 'Privacy Policy' : 'Legal Notice'} />
    <div className="max-w-3xl mx-auto px-5 space-y-4 text-white/70">
      <p className="card !border-amber-400/30 text-amber-200 text-sm">Placeholder text. Replace this page with your company's real {privacy ? 'privacy policy' : 'legal notice'} before the website goes public.</p>
      {privacy ? (<>
        <p>This website stores the details you enter when you register (name, email and a hashed password) and the activity you perform in the dashboard, so that access can be controlled and changes can be traced.</p>
        <p>Data is kept in the company's own database and is not sold or shared with advertisers. To have your account removed, contact {c.contact.email}.</p>
      </>) : (<>
        <p><b className="text-white">{c.legalName}</b><br />{c.contact.address.join(', ')}</p>
        <p>Email: {c.contact.email}<br />Phone: {c.contact.phone}</p>
      </>)}
    </div>
  </>)
}
