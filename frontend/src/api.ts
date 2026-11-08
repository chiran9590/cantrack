import { useEffect, useState } from 'react'

export interface User { id: number; name: string; email: string; role: string }
export interface House { code: string; name: string; description: string; platforms: number; columns: number; rows: number; total: number; occupied: number }
export interface Recent { id: number; gid: string; position_id: string; moved_at: string; source: string; kind: string; by: string }
export interface Stats { active_plants: number; removed_plants: number; scans_today: number; rejected_today: number }
export interface Cell { position_id: string; uuid: string; gid: string }
export interface MapData { cells: Cell[]; conflicts: string[] }
export interface Move { id: number; position_id: string; moved_at: string; source: string; kind: string; reason: string | null; by: string; device: string | null; session_id: string | null }
export type Info = Record<string, unknown>
export interface PositionDetail {
  position: string
  plant: { uuid: string; gid: string; sown_date: string | null; phenomeone_id: string | null; info: Info } | null
  history: Move[]
  rejections: { at: string; reason: string; by: string | null }[]
}
export interface PlantHit { uuid: string; gid: string; status: string; sown_date: string | null; position: string | null; total: number; age_days: number | null }
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

// Hardcoded demo data
const HOUSES: House[] = [
  { code: 'L1', name: 'Glasshouse L1', description: 'Main glasshouse', platforms: 4, columns: 6, rows: 53, total: 1272, occupied: 763 },
  { code: 'B2', name: 'Glasshouse B2', description: 'Secondary glasshouse', platforms: 4, columns: 6, rows: 24, total: 576, occupied: 345 },
  { code: 'B3', name: 'Glasshouse B3', description: 'Research glasshouse', platforms: 6, columns: 6, rows: 48, total: 1728, occupied: 1037 },
]

const RECENT: Recent[] = [
  { id: 1, gid: 'GT-1001', position_id: 'L1-P01-C01-R01', moved_at: new Date(Date.now() - 300000).toISOString(), source: 'web', kind: 'scan', by: 'Admin' },
  { id: 2, gid: 'GT-1002', position_id: 'L1-P01-C01-R02', moved_at: new Date(Date.now() - 600000).toISOString(), source: 'mobile', kind: 'scan', by: 'Admin' },
  { id: 3, gid: 'GT-1003', position_id: 'L1-P01-C01-R03', moved_at: new Date(Date.now() - 900000).toISOString(), source: 'web', kind: 'scan', by: 'Admin' },
  { id: 4, gid: 'GT-1004', position_id: 'L1-P01-C02-R01', moved_at: new Date(Date.now() - 1200000).toISOString(), source: 'web', kind: 'correction', by: 'Admin' },
  { id: 5, gid: 'GT-1005', position_id: 'L1-P01-C02-R02', moved_at: new Date(Date.now() - 1500000).toISOString(), source: 'web', kind: 'scan', by: 'Admin' },
]

const STATS: Stats = {
  active_plants: 2145,
  removed_plants: 15,
  scans_today: 127,
  rejected_today: 3,
}

// Generate mock map data
const generateMapData = (code: string, platform: number): MapData => {
  const cells: Cell[] = []
  const house = HOUSES.find(h => h.code === code)
  if (!house) return { cells: [], conflicts: [] }
  
  // Generate all positions for this platform
  for (let c = 1; c <= house.columns; c++) {
    for (let r = 1; r <= house.rows; r++) {
      const posId = `${code}-P${String(platform).padStart(2, '0')}-C${String(c).padStart(2, '0')}-R${String(r).padStart(2, '0')}`
      // Randomly occupy ~60% of positions
      if (Math.random() > 0.4) {
        cells.push({
          position_id: posId,
          uuid: `uuid-${Math.random().toString(36).substr(2, 9)}`,
          gid: `GT-${Math.floor(Math.random() * 40) + 1000}`
        })
      }
    }
  }
  
  return { cells, conflicts: [] }
}

const KEY = 'cantrack_token'
export const token = { get: () => localStorage.getItem(KEY), set: (t: string) => localStorage.setItem(KEY, t), clear: () => localStorage.removeItem(KEY) }
let onUnauthorized = () => {}
export const setUnauthorizedHandler = (f: () => void) => { onUnauthorized = f }

export const api = {
  login: async (email: string, password: string) => {
    const user: User = { id: 1, name: 'Admin', email, role: 'admin' }
    const tokenStr = btoa(JSON.stringify(user))
    token.set(tokenStr)
    return { token: tokenStr, user }
  },
  register: async (name: string, email: string, password: string) => {
    const user: User = { id: 1, name, email, role: 'admin' }
    const tokenStr = btoa(JSON.stringify(user))
    token.set(tokenStr)
    return { token: tokenStr, user }
  },
  authConfig: async () => ({ registration_open: false }),
  me: async () => {
    const t = token.get()
    if (!t) throw new Error('Not logged in')
    try {
      return JSON.parse(atob(t))
    } catch {
      return { id: 1, name: 'Admin', email: 'admin@demo.com', role: 'admin' }
    }
  },
  changePassword: async () => ({ ok: true }),
  facility: async () => HOUSES,
  addHouse: async (h: { code: string; name: string; description: string; platforms: number; columns: number; rows: number }) => ({ ok: true }),
  dashboard: async () => ({ houses: HOUSES, recent: RECENT, stats: STATS }),
  map: async (code: string, platform: number) => generateMapData(code, platform),
  position: async (id: string): Promise<PositionDetail> => {
    const house = HOUSES.find(h => id.startsWith(h.code))
    if (!house) throw new Error('Position not found')
    const hasPlant = Math.random() > 0.4
    return {
      position: id,
      plant: hasPlant ? {
        uuid: `uuid-${Math.random().toString(36).substr(2, 9)}`,
        gid: `GT-${Math.floor(Math.random() * 40) + 1000}`,
        sown_date: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
        phenomeone_id: `P1-${Math.floor(Math.random() * 100)}`,
        info: { parentage: { mother: 'GT-1000', father: 'GT-1002' } }
      } : null,
      history: [
        { id: 1, position_id: id, moved_at: new Date().toISOString(), source: 'web', kind: 'scan', reason: null, by: 'Admin', device: null, session_id: null }
      ],
      rejections: [
        { at: new Date(Date.now() - 86400000).toISOString(), reason: 'Invalid barcode', by: 'Admin' }
      ]
    }
  },
  search: async (q: string) => {
    const results: PlantHit[] = []
    for (let i = 0; i < 10; i++) {
      results.push({
        uuid: `uuid-${Math.random().toString(36).substr(2, 9)}`,
        gid: `GT-${Math.floor(Math.random() * 40) + 1000}`,
        status: Math.random() > 0.1 ? 'active' : 'removed',
        sown_date: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
        position: `L1-P01-C0${Math.floor(Math.random() * 6) + 1}-R${String(Math.floor(Math.random() * 53) + 1).padStart(2, '0')}`,
        total: Math.floor(Math.random() * 50) + 10,
        age_days: Math.floor(Math.random() * 200) + 10
      })
    }
    return results
  },
  plant: async (uuid: string) => ({
    plant: {
      uuid,
      gid: 'GT-1001',
      status: 'active',
      sown_date: new Date(Date.now() - 10000000000).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      position: 'L1-P01-C01-R01',
      age_days: 100,
      phenomeone_id: 'P1-1001',
      info: { parentage: { mother: 'GT-1000', father: 'GT-1002' } },
      phenomeone_synced_at: null,
      created_by: 'Admin'
    },
    history: [
      { id: 1, position_id: 'L1-P01-C01-R01', moved_at: new Date().toISOString(), source: 'web', kind: 'scan', reason: null, by: 'Admin', device: null, session_id: null }
    ],
    status_history: [
      { at: new Date().toISOString(), from_status: null, to_status: 'active', last_position_id: 'L1-P01-C01-R01', reason: 'Initial registration', by: 'Admin' }
    ]
  }),
  removePlant: async (uuid: string, reason: string) => ({ ok: true }),
  correct: async (uuid: string, position_id: string, reason: string) => ({ ok: true }),
  registerPlants: async (gid: string, count: number, sown_date: string) => {
    const results: NewPlant[] = []
    for (let i = 0; i < count; i++) {
      results.push({
        uuid: `uuid-${Math.random().toString(36).substr(2, 9)}`,
        gid,
        sown_date: sown_date || null
      })
    }
    return results
  },
  genotypes: async (q: string) => {
    const results: GenotypeRow[] = []
    for (let i = 0; i < 40; i++) {
      results.push({
        gid: `GT-${1000 + i}`,
        phenomeone_id: `P1-${1000 + i}`,
        status: 'active',
        active_plants: Math.floor(Math.random() * 50) + 10,
        total_plants: Math.floor(Math.random() * 60) + 10
      })
    }
    return results
  },
  genotype: async (gid: string) => ({
    genotype: {
      gid,
      phenomeone_id: `P1-${gid.replace('GT-', '')}`,
      info: { parentage: { mother: 'GT-1000', father: 'GT-1002' } },
      status: 'active',
      phenomeone_synced_at: null
    },
    plants: [],
    phenomeone_configured: false
  }),
  addGenotype: async (gid: string, phenomeone_id: string) => ({ ok: true }),
  syncGenotype: async (gid: string) => ({ ok: true }),
  scan: async (position_id: string, plant_uuid: string, session_id: string) => ({ message: 'Scan recorded' }),
  report: async (name: string, p: Record<string, string>) => ({ columns: ['id', 'gid', 'position'], rows: [{ id: 1, gid: 'GT-1001', position: 'L1-P01-C01-R01' }], total: 1 }),
  dbTables: async () => [
    { table: 'users', rows: 4, read_only: false, can_insert: true, can_delete: true },
    { table: 'glasshouses', rows: 3, read_only: false, can_insert: true, can_delete: true },
    { table: 'positions', rows: 3576, read_only: false, can_insert: true, can_delete: true },
    { table: 'plants', rows: 2145, read_only: false, can_insert: true, can_delete: true },
  ],
  dbStructure: async () => [
    { table: 'users', rows: 4, size: '16KB', columns: [
      { name: 'id', type: 'int', nullable: false, default: null, pk: true, unique: true, references: null },
      { name: 'name', type: 'varchar', nullable: false, default: null, pk: false, unique: false, references: null },
      { name: 'email', type: 'varchar', nullable: false, default: null, pk: false, unique: true, references: null },
      { name: 'role', type: 'varchar', nullable: false, default: null, pk: false, unique: false, references: null },
    ]},
  ],
  dbRows: async (table: string, q: string, offset: number) => ({ columns: [{ name: 'id', udt: 'int', nullable: false, pk: true, editable: false }], rows: [{ id: 1 }] as Record<string, unknown>[], total: 1, can_insert: true, can_delete: true, insert_columns: ['name', 'email'] }),
  dbUpdate: async (table: string, key: Record<string, string>, values: Record<string, string>) => ({ ok: true }),
  dbInsert: async (table: string, values: Record<string, string>) => ({ ok: true }),
  dbDelete: async (table: string, key: Record<string, string>) => ({ ok: true }),
  overview: async () => ({
    database: { name: 'cantrack', size: '50MB', version: '8.0', host: 'localhost', port: 3306, data_directory: '/usr/local/mysql/data' },
    members: { total: 4, by_role: { admin: 1, manager: 1, breeder: 1, gardener: 1 } },
    users: [
      { id: 1, name: 'Admin', email: 'admin@demo.com', role: 'admin', active: true, created_at: new Date().toISOString(), last_login_at: new Date().toISOString() },
      { id: 2, name: 'Manager', email: 'manager@demo.com', role: 'manager', active: true, created_at: new Date().toISOString(), last_login_at: null },
      { id: 3, name: 'Breeder', email: 'breeder@demo.com', role: 'breeder', active: true, created_at: new Date().toISOString(), last_login_at: null },
      { id: 4, name: 'Gardener', email: 'gardener@demo.com', role: 'gardener', active: true, created_at: new Date().toISOString(), last_login_at: null },
    ],
    tables: [
      { table: 'users', rows: 4, size: '16KB' },
      { table: 'glasshouses', rows: 3, size: '8KB' },
      { table: 'positions', rows: 3576, size: '128KB' },
      { table: 'plants', rows: 2145, size: '256KB' },
    ],
    scans: { total: 5000, today: 127, last_scan: new Date().toISOString() }
  }),
  addUser: async (u: { name: string; email: string; password: string; role: string }) => ({ id: 1, name: u.name, email: u.email, role: u.role, active: true, created_at: new Date().toISOString(), last_login_at: null }),
  patchUser: async (id: number, p: Partial<{ name: string; role: string; active: boolean; password: string }>) => ({ id, name: 'User', email: 'user@test.com', role: 'admin', active: true, created_at: new Date().toISOString(), last_login_at: null }),
}

export async function downloadReport(name: string, p: Record<string, string>, format: 'csv' | 'xlsx') {
  // No-op for demo
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
