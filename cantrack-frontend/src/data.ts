// Mock data layer. Swap these for API calls once the backend exists.
export interface Glasshouse { code: string; name: string; platforms: number; columns: number; rows: number }
export interface Plant { uuid: string; gid: string; position: string; status: 'active' | 'removed'; sown: string }
export interface Move { id: number; uuid: string; gid: string; position: string; at: string; by: string; source: string; session: string }
export interface Result { ok: boolean; msg: string }
export interface Store {
  houses: Glasshouse[]; plants: Plant[]; moves: Move[]; byPos: Map<string, Plant>
  record: (uuid: string, pos: string, session: string) => Result
  addHouse: (h: Glasshouse) => string | null
}

const pad = (n: number) => String(n).padStart(2, '0')
export const posId = (g: string, p: number, c: number, r: number) => `${g}-P${pad(p)}-C${pad(c)}-R${pad(r)}`
export const parsePos = (id: string) => {
  const m = /^([A-Z0-9]+)-P(\d+)-C(\d+)-R(\d+)$/.exec(id.trim().toUpperCase())
  return m ? { g: m[1], p: +m[2], c: +m[3], r: +m[4] } : null
}
export const capacity = (h: Glasshouse) => h.platforms * h.columns * h.rows
export const isValidPos = (hs: Glasshouse[], id: string) => {
  const x = parsePos(id); const h = x && hs.find(h => h.code === x.g)
  return !!(x && h && x.p >= 1 && x.p <= h.platforms && x.c >= 1 && x.c <= h.columns && x.r >= 1 && x.r <= h.rows)
}

export const INITIAL_HOUSES: Glasshouse[] = [
  { code: 'L1', name: 'Glasshouse L1', platforms: 4, columns: 6, rows: 53 },
  { code: 'B2', name: 'Glasshouse B2', platforms: 4, columns: 6, rows: 24 },
  { code: 'B3', name: 'Glasshouse B3', platforms: 6, columns: 6, rows: 48 },
]

export function seedData(hs: Glasshouse[]) {
  let seed = 7
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('')
  const day = (d: number) => new Date(Date.now() - d * 864e5).toISOString()
  const users = ['Asha', 'Ravi', 'Meena']
  const plants: Plant[] = []; const moves: Move[] = []
  for (const h of hs) for (let p = 1; p <= h.platforms; p++) for (let c = 1; c <= h.columns; c++) for (let r = 1; r <= h.rows; r++) {
    if (rnd() > 0.6) continue
    const pos = posId(h.code, p, c, r)
    const uuid = `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`
    const gid = `GT-${1000 + Math.floor(rnd() * 40)}`
    plants.push({ uuid, gid, position: pos, status: 'active', sown: day(40 + Math.floor(rnd() * 120)).slice(0, 10) })
    const by = users[Math.floor(rnd() * 3)]
    if (rnd() < 0.25) moves.push({ id: moves.length + 1, uuid, gid, position: posId(h.code, 1, 1, 1 + Math.floor(rnd() * h.rows)), at: day(21), by, source: 'mobile', session: 'S-SEED' })
    moves.push({ id: moves.length + 1, uuid, gid, position: pos, at: day(Math.floor(rnd() * 14)), by, source: 'mobile', session: 'S-SEED' })
  }
  return { plants, moves }
}
