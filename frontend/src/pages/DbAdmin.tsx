import { useState } from 'react'
import { api, useLoad, type DbColumn } from '../api'

const show = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

function Structure() {
  const { data, error } = useLoad(api.dbStructure)
  if (error) return <p className="text-red-400">{error}</p>
  if (!data) return <p className="text-white/50">Loading…</p>
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {data.map(t => (
        <div key={t.table} className="card overflow-x-auto">
          <div className="flex justify-between items-baseline mb-2"><span className="font-mono text-lime-300 text-lg">{t.table}</span><span className="text-xs text-white/50">{t.rows.toLocaleString()} rows · {t.size}</span></div>
          <table className="w-full text-xs text-left">
            <thead className="text-white/50"><tr><th className="py-1">Column</th><th>Type</th><th>Key</th><th>References</th></tr></thead>
            <tbody>{t.columns.map(c => (
              <tr key={c.name} className="border-t border-white/10">
                <td className="py-1 font-mono">{c.name}{!c.nullable && <span className="text-white/30"> *</span>}</td><td className="font-mono text-white/60">{c.type}</td>
                <td>{c.pk ? '🔑 primary' : c.unique ? 'unique' : ''}</td><td className="font-mono text-emerald-300">{c.references ?? ''}</td></tr>))}</tbody>
          </table>
        </div>))}
      <p className="text-xs text-white/40 lg:col-span-2">* = required. Password hashes exist in users.password_hash but are never shown in the editor.</p>
    </div>
  )
}

export default function DbAdmin() {
  const [view, setView] = useState<'data' | 'structure'>('data')
  const [tick, setTick] = useState(0)
  const [table, setTable] = useState('users')
  const [term, setTerm] = useState('')
  const [offset, setOffset] = useState(0)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const tables = useLoad(api.dbTables, [tick])
  const page = useLoad(() => api.dbRows(table, term, offset), [table, term, offset, tick])
  const info = tables.data?.find(t => t.table === table)
  const d = page.data
  const pkOf = (row: Record<string, unknown>, cols: DbColumn[]) => Object.fromEntries(cols.filter(c => c.pk).map(c => [c.name, show(row[c.name])]))

  const run = async (fn: () => Promise<unknown>, done: string) => {
    try { await fn(); setMsg({ ok: true, text: done }); setEditKey(null); setTick(t => t + 1) } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  const pick = (t: string) => { setTable(t); setTerm(''); setOffset(0); setEditKey(null); setAdding({}); setMsg(null) }
  const startEdit = (row: Record<string, unknown>) => {
    setEditKey(JSON.stringify(pkOf(row, d!.columns)))
    setDraft(Object.fromEntries(d!.columns.filter(c => c.editable).map(c => [c.name, show(row[c.name])])))
  }
  const save = (row: Record<string, unknown>) => {
    const changed = Object.fromEntries(Object.entries(draft).filter(([k, v]) => v !== show(row[k])))
    if (!Object.keys(changed).length) { setEditKey(null); return }
    if (window.confirm(`Save these changes to ${table}?\n\n${Object.entries(changed).map(([k, v]) => `${k}: "${show(row[k])}" → "${v}"`).join('\n')}`))
      run(() => api.dbUpdate(table, pkOf(row, d!.columns), changed), 'Saved. The change is recorded in the audit log.')
  }
  const del = (row: Record<string, unknown>) => {
    if (window.confirm(`Delete this row from ${table}? This cannot be undone.\n\n${JSON.stringify(pkOf(row, d!.columns))}`))
      run(() => api.dbDelete(table, pkOf(row, d!.columns)), 'Row deleted.')
  }
  const input = (c: DbColumn, v: string, set: (x: string) => void) =>
    c.udt === 'bool' ? <select className="bg-black/50 rounded px-2 py-1" value={v} onChange={e => set(e.target.value)}><option>true</option><option>false</option></select>
      : <input className="bg-black/50 rounded px-2 py-1 font-mono text-xs w-full min-w-24" type={c.udt === 'date' ? 'date' : 'text'} value={v} onChange={e => set(e.target.value)} />

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold">Admin · database editor</h1>
      <p className="text-sm text-white/60">Edit PostgreSQL data directly. Every change asks for confirmation and is recorded in the audit log. History, audit and password data are locked on purpose, and a plant's position or status only changes through scans, corrections and removals.</p>
      <div className="flex gap-2">
        <button onClick={() => setView('data')} className={`btn-ghost ${view === 'data' ? 'bg-emerald-400/20 border-emerald-400' : ''}`}>Data</button>
        <button onClick={() => setView('structure')} className={`btn-ghost ${view === 'structure' ? 'bg-emerald-400/20 border-emerald-400' : ''}`}>Structure (all tables &amp; relationships)</button>
      </div>
      {view === 'structure' && <Structure />}
      {view === 'data' && <div className="flex flex-wrap gap-2">
        {(tables.data ?? []).map(t => (
          <button key={t.table} onClick={() => pick(t.table)} className={`btn-ghost text-xs ${t.table === table ? 'bg-emerald-400/20 border-emerald-400' : ''}`}>
            {t.read_only && '🔒 '}{t.table} <span className="text-white/40">{t.rows.toLocaleString()}</span></button>
        ))}
      </div>}
      {msg && view === 'data' && <p className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-400'}`}>{msg.text}</p>}
      {page.error && <p className="text-red-400 text-sm">{page.error}</p>}
      {view === 'data' && d && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input className="input !py-2 max-w-xs !font-sans" placeholder={`Search ${table}…`} value={term} onChange={e => { setTerm(e.target.value); setOffset(0) }} />
            <span className="text-sm text-white/50">{d.total.toLocaleString()} row(s){info?.read_only && ' · read-only'}</span>
            <div className="ml-auto flex gap-2">
              <button className="btn-ghost !py-1 text-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>← Prev</button>
              <button className="btn-ghost !py-1 text-sm" disabled={offset + 50 >= d.total} onClick={() => setOffset(offset + 50)}>Next →</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-white/50"><tr>
                {d.columns.map(c => <th key={c.name} className="py-1 pr-3 whitespace-nowrap">{c.pk && '🔑 '}{c.name}{c.editable && ' ✏️'}</th>)}<th></th></tr></thead>
              <tbody>{d.rows.map((row, i) => {
                const key = JSON.stringify(pkOf(row, d.columns))
                const editing = editKey === key
                return (
                  <tr key={i} className={`border-t border-white/10 ${editing ? 'bg-amber-300/10' : ''}`}>
                    {d.columns.map(c => (
                      <td key={c.name} className={`py-1.5 pr-3 font-mono align-top ${c.editable ? '' : 'text-white/50'} ${editing && c.editable ? '' : 'max-w-64 truncate'}`}>
                        {editing && c.editable ? input(c, draft[c.name] ?? '', v => setDraft({ ...draft, [c.name]: v })) : show(row[c.name]) || <span className="text-white/20">∅</span>}
                      </td>))}
                    <td className="whitespace-nowrap py-1.5">
                      {editing ? (<><button className="btn !py-1 !px-3 text-xs mr-2" onClick={() => save(row)}>Save</button><button className="btn-ghost !py-1 text-xs" onClick={() => setEditKey(null)}>Cancel</button></>) : (<>
                        {d.columns.some(c => c.editable) && <button className="btn-ghost !py-1 text-xs mr-2" onClick={() => startEdit(row)}>Edit</button>}
                        {d.can_delete && <button className="btn-ghost !py-1 text-xs text-red-300" onClick={() => del(row)}>Delete</button>}</>)}
                    </td>
                  </tr>)
              })}</tbody>
            </table>
          </div>
          {d.can_insert && (
            <div className="pt-3 border-t border-white/10">
              <div className="font-semibold text-sm mb-2">Add a row to {table}</div>
              <div className="grid md:grid-cols-4 gap-2">
                {d.insert_columns.map(n => { const c = d.columns.find(x => x.name === n)!; return (
                  <label key={n} className="text-xs text-white/50">{n}{c.pk && ' (required)'}
                    <div className="mt-1">{input(c.udt === 'bool' ? c : { ...c, udt: c.udt === 'date' ? 'date' : 'text' }, adding[n] ?? '', v => setAdding({ ...adding, [n]: v }))}</div></label>) })}
              </div>
              <button className="btn !py-2 mt-3 text-sm" onClick={() => run(async () => { await api.dbInsert(table, adding); setAdding({}) }, 'Row added.')}>Add row</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
