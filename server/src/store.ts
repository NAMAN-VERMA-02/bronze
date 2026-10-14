import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameState } from '@bronze/shared'

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')

export interface StoredRoom {
  code: string
  started: boolean
  seatNames: string[]
  state: GameState | null
}

export function loadRooms(): StoredRoom[] {
  if (!fs.existsSync(DATA_DIR)) return []
  const out: StoredRoom[] = []
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (!f.endsWith('.json')) continue
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, f), 'utf8')
      const parsed = JSON.parse(raw) as StoredRoom
      if (parsed?.code && parsed.started && Array.isArray(parsed.seatNames)) out.push(parsed)
    } catch {
      continue
    }
  }
  return out
}

export function saveRoom(room: StoredRoom): void {
  if (!room.started) return
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const target = path.join(DATA_DIR, `${room.code}.json`)
  const tmp = `${target}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(room))
  fs.renameSync(tmp, target)
}

export function removeRoom(code: string): void {
  const target = path.join(DATA_DIR, `${code}.json`)
  if (fs.existsSync(target)) fs.unlinkSync(target)
}
