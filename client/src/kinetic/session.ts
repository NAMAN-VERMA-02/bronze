import type { SeatSpec } from './state'

// Local game-session registry. Real multiplayer can later swap the
// registry backing for WebSocket rooms without touching callers.

export type Phase = 'home' | 'lobby' | 'game' | 'results'

export interface TableRecord {
  code: string
  hostName: string
  seats: SeatSpec[]
  createdAt: number
  started: boolean
}

const KEY = 'kinetic.tables'

function loadAll(): TableRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as TableRecord[]
  } catch {
    return []
  }
}

function saveAll(tables: TableRecord[]): void {
  localStorage.setItem(KEY, JSON.stringify(tables.slice(-20)))
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateTableCode(): string {
  let c = ''
  for (let i = 0; i < 5; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return c
}

export function createTable(hostName: string): TableRecord {
  const tables = loadAll()
  let code = generateTableCode()
  while (tables.some((t) => t.code === code)) code = generateTableCode()
  const rec: TableRecord = {
    code,
    hostName: hostName.trim() || 'Industrialist',
    seats: [{ name: rec0(hostName), isAI: false }],
    createdAt: Date.now(),
    started: false,
  }
  tables.push(rec)
  saveAll(tables)
  return rec
}

function rec0(name: string): string {
  return name.trim() || 'Industrialist'
}

export type JoinResult =
  | { ok: true; table: TableRecord }
  | { ok: false; reason: 'format' | 'notfound' | 'full' | 'duplicate' }

export function joinTable(code: string, name: string): JoinResult {
  const clean = code.trim().toUpperCase()
  if (!/^[A-Z2-9]{5}$/.test(clean)) return { ok: false, reason: 'format' }
  const tables = loadAll()
  const t = tables.find((x) => x.code === clean)
  if (!t) return { ok: false, reason: 'notfound' }
  if (t.seats.length >= 4 || t.started) return { ok: false, reason: 'full' }
  const cleanName = name.trim() || 'Industrialist'
  if (t.seats.some((s) => s.name.toLowerCase() === cleanName.toLowerCase())) {
    return { ok: false, reason: 'duplicate' }
  }
  t.seats.push({ name: cleanName, isAI: false })
  saveAll(tables)
  return { ok: true, table: t }
}

export function addAI(table: TableRecord, personality?: string): boolean {
  if (table.seats.length >= 4) return false
  const names = ['Boulton', 'Watt', 'Arkwright', 'Wedgwood']
  const taken = new Set(table.seats.map((s) => s.name))
  const name = names.find((n) => !taken.has(n)) ?? `AI ${table.seats.length}`
  table.seats.push({
    name,
    isAI: true,
    personality: (personality as SeatSpec['personality']) ?? 'industrialist',
    difficulty: 'normal',
  })
  persist(table)
  return true
}

export function removeAI(table: TableRecord): boolean {
  const idx = table.seats.map((s) => s.isAI).lastIndexOf(true)
  if (idx <= 0) return false
  table.seats.splice(idx, 1)
  persist(table)
  return true
}

export function markStarted(table: TableRecord): void {
  table.started = true
  persist(table)
}

function persist(table: TableRecord): void {
  const tables = loadAll()
  const i = tables.findIndex((t) => t.code === table.code)
  if (i >= 0) tables[i] = table
  else tables.push(table)
  saveAll(tables)
}
