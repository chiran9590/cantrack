import { useEffect, useState } from 'react'

export interface User { id: number; name: string; email: string; role: string }
export interface House { code: string; name: string; description: string; platforms: number; columns: number; rows: number; total: number; occupied: number }
export interface Recent { id: number; gid: string; position_id: string; moved_at: string; source: string; kind: string; by: string }
export interface Stats { active_plants: number; removed_plants: number; scans_today: number; rejected_today: number }
export interface Cell { position_id: string; uuid: string; gid: string }
export interface MapData { cells: Cell[]; conflicts: string[] }
export interface Move { id: number; position_id: string; moved_at: string; source: string; kind: string; reason: string | null; by: string; device?: string | null; session_id?: string | null }
export type Info = Record<string, unknown>
export interface PositionDetail {
  position: string
  plant: { uuid: string; gid: string; sown_date: string | null; phenomeone_id: string | null; info: Info } | null
  history: Move[]
  rejections: { at: string; reason: string; by: string | null }[]
}
export interface PlantHit { uuid: string; gid: string; status: string; sown_date: string | null; position: string | null; total: number }
export interface PlantFull {
  plant: { uuid: string; gid: string; status: string; sown_date: string | null; created_at: string; position: string | null; age_days: number | null; phenomeone_id: string | null; info: Info; phenomeone_synced_at: string | null; created_by: string | null }
  history: Move[]
  status_history: { at: string; from_status: string | null; to_status: string; last_position_id: string | null; reason: string; by: string }[]
}
export interface GenotypeFull {
  genotype: { gid: string; phenomeone_id: string | null; info: Info; status: string; phenomeone_synced_at: string | null }
  plants: { uuid: string; status: string; sown_date: string | null; age_days: number | null; position: string | null; glasshouse: string | null; platform: number | null; column: number | null; row: number | null }[]
  phenomeone_configured: boolean
}
export interface GenotypeRow { gid: string; phenomeone_id: string | null; status: string; active_plants: number; total_plants: number }
export interface NewPlant { uuid: string; gid: string; sown_date: string | null }
export interface ReportResult { columns: string[]; rows: Record<string, unknown>[]; total: number }
export interface UserRow { id: number; name: string; email: string; role: string; active: boolean; created_at: string; last_login_at: string | null }
export interface Overview {
  database: { name: string; size: string; version: string; host: string | null; port: number; data_directory: string | null }
  members: { total: number; by_role: Record<string, number> }
  users: UserRow[]
  tables: { table: string; rows: number; size: string }[]
  scans: { total: number; today: number; last_scan: string | null }
}

export interface DbTable { table: string; rows: number; read_only: boolean; can_insert: boolean; can_delete: boolean }
export interface DbColumn { name: string; udt: string; nullable: boolean; pk: boolean; editable: boolean }
export interface DbPage { columns: DbColumn[]; rows: Record<string, unknown>[]; total: number; can_insert: boolean; can_delete: boolean; insert_columns: string[] }

export interface DbStructure { table: string; rows: number; size: string | null; columns: { name: string; type: string; nullable: boolean; default: string | null; pk: boolean; unique: boolean; references: string | null }[] }

const KEY = 'cantrack_token'
export const token = { get: () => localStorage.getItem(KEY), set: (t: string) => localStorage.setItem(KEY, t), clear: () => localStorage.removeItem(KEY) }
let onUnauthorized = () => {}
export const setUnauthorizedHandler = (f: () => void) => { onUnauthorized = f }

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const t = token.get()
  const res = await fetch('/api' + path, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && path !== '/auth/login') onUnauthorized()
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data as T
}
const qs = (p: Record<string, string>) => new URLSearchParams(Object.entries(p).filter(([, v]) => v !== '')).toString()

export const api = {
  login: (email: string, password: string) => call<{ token: string; user: User }>('/auth/login', 'POST', { email, password }),
  register: (name: string, email: string, password: string) => call<{ token: string; user: User }>('/auth/register', 'POST', { name, email, password }),
  authConfig: () => call<{ registration_open: boolean }>('/auth/config'),
  me: () => call<User>('/auth/me'),
  changePassword: (current_password: string, new_password: string) => call('/auth/change-password', 'POST', { current_password, new_password }),
  facility: () => call<House[]>('/facility'),
  addHouse: (h: { code: string; name: string; description: string; platforms: number; columns: number; rows: number }) => call('/glasshouses', 'POST', h),
  dashboard: () => call<{ houses: House[]; recent: Recent[]; stats: Stats }>('/dashboard'),
  map: (code: string, platform: number) => call<MapData>(`/map/${code}/${platform}`),
  position: (id: string) => call<PositionDetail>(`/positions/${id}`),
  search: (q: string) => call<PlantHit[]>(`/plants?q=${encodeURIComponent(q)}`),
  plant: (uuid: string) => call<PlantFull>(`/plants/${uuid}`),
  removePlant: (uuid: string, reason: string) => call(`/plants/${uuid}/remove`, 'POST', { reason }),
  correct: (uuid: string, position_id: string, reason: string) => call(`/plants/${uuid}/correction`, 'POST', { position_id, reason }),
  registerPlants: (gid: string, count: number, sown_date: string) => call<NewPlant[]>('/plants', 'POST', { gid, count, sown_date: sown_date || null }),
  genotypes: (q: string) => call<GenotypeRow[]>(`/genotypes?q=${encodeURIComponent(q)}`),
  genotype: (gid: string) => call<GenotypeFull>(`/genotypes/${encodeURIComponent(gid)}`),
  addGenotype: (gid: string, phenomeone_id: string) => call('/genotypes', 'POST', { gid, phenomeone_id: phenomeone_id || null }),
  syncGenotype: (gid: string) => call(`/genotypes/${encodeURIComponent(gid)}/sync`, 'POST'),
  scan: (position_id: string, plant_uuid: string, session_id: string) => call<{ message: string }>('/scans', 'POST', { position_id, plant_uuid, session_id }),
  report: (name: string, p: Record<string, string>) => call<ReportResult>(`/reports/${name}?${qs(p)}`),
  dbTables: () => call<DbTable[]>('/admin/db'),
  dbStructure: () => call<DbStructure[]>('/admin/db/_structure'),
  dbRows: (table: string, q: string, offset: number) => call<DbPage>(`/admin/db/${table}?q=${encodeURIComponent(q)}&offset=${offset}`),
  dbUpdate: (table: string, key: Record<string, string>, values: Record<string, string>) => call(`/admin/db/${table}/update`, 'POST', { key, values }),
  dbInsert: (table: string, values: Record<string, string>) => call(`/admin/db/${table}/insert`, 'POST', { values }),
  dbDelete: (table: string, key: Record<string, string>) => call(`/admin/db/${table}/delete`, 'POST', { key }),
  overview: () => call<Overview>('/admin/overview'),
  addUser: (u: { name: string; email: string; password: string; role: string }) => call<UserRow>('/users', 'POST', u),
  patchUser: (id: number, p: Partial<{ name: string; role: string; active: boolean; password: string }>) => call<UserRow>(`/users/${id}`, 'PATCH', p),
}

export async function downloadReport(name: string, p: Record<string, string>, format: 'csv' | 'xlsx') {
  const res = await fetch(`/api/reports/${name}?${qs({ ...p, format })}`, { headers: { Authorization: `Bearer ${token.get()}` } })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Download failed')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(await res.blob())
  a.download = `cantrack_${name}.${format}`
  a.click()
  URL.revokeObjectURL(a.href)
}

const pad = (n: number) => String(n).padStart(2, '0')
export const posId = (g: string, p: number, c: number, r: number) => `${g}-P${pad(p)}-C${pad(c)}-R${pad(r)}`
export const parsePos = (id: string) => {
  const m = /^([A-Z0-9]+)-P(\d+)-C(\d+)-R(\d+)$/.exec(id.trim().toUpperCase())
  return m ? { g: m[1], p: +m[2], c: +m[3], r: +m[4] } : null
}
export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
export const infoText = (i: Info) => (Object.keys(i).length ? JSON.stringify(i) : '')

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    setError('')
    fn().then(d => live && setData(d)).catch(e => live && setError(e.message))
    return () => { live = false }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error }
}
