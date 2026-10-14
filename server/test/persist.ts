import { io, type Socket } from 'socket.io-client'
import type { GameState } from '@bronze/shared'

const URL = 'http://localhost:3001'
const mode = process.argv[2]
type View = GameState & { youId: string }

function until<T>(fn: () => T | null, label: string): Promise<T> {
  return new Promise((res, rej) => {
    let n = 0
    const t = setInterval(() => {
      const v = fn()
      if (v !== null && v !== undefined) {
        clearInterval(t)
        res(v)
      } else if (++n > 100) {
        clearInterval(t)
        rej(new Error(`timeout: ${label}`))
      }
    }, 100)
  })
}

function fail(msg: string): never {
  console.error(`PERSIST FAIL — ${msg}`)
  process.exit(1)
}

async function phaseA(): Promise<void> {
  const a: Socket = io(URL)
  const b: Socket = io(URL)
  let va: View | null = null
  a.on('game', (s: View) => (va = s))

  const created = await new Promise<{ ok: boolean; code: string }>((res) =>
    a.emit('lobby:create', { name: 'Alice' }, res),
  )
  if (!created.ok) fail('create failed')
  await new Promise<{ ok: boolean }>((res) => b.emit('lobby:join', { code: created.code, name: 'Bob' }, res))
  await new Promise<{ ok: boolean }>((res) => {
    a.emit('lobby:start', {}, (v: { ok: boolean; error?: string }) => {
      if (!v.ok) fail(`start failed: ${v.error}`)
      res(v)
    })
  })
  await until(() => va, 'initial state')
  const cur = va!.order[va!.currentTurnIdx]
  const actor = cur === 'p0' ? a : b
  actor.emit('game:action', { action: { type: 'LOAN' } })
  await until(() => (va && va.players.some((p) => p.loans === 1) ? true : null), 'loan applied')
  console.log(created.code)
  a.close()
  b.close()
  process.exit(0)
}

async function phaseB(code: string): Promise<void> {
  const b2: Socket = io(URL)
  let v: View | null = null
  b2.on('game', (s: View) => (v = s))
  const joined = await new Promise<{ ok: boolean; seated: boolean }>((res) =>
    b2.emit('lobby:join', { code, name: 'Bob' }, res),
  )
  if (!joined.ok || !joined.seated) fail(`rejoin failed: ${JSON.stringify(joined)}`)
  const restored = await until(() => v, 'restored state')
  const loaner = restored.players.find((p) => p.loans >= 1)
  if (!loaner) fail('loan not preserved across restart')
  const me2 = restored.players.find((p) => p.id === restored.youId)!
  if (me2.hand.length !== 8) fail(`hand not restored (${me2.hand.length})`)
  if (restored.era !== 'canal' || restored.round < 1) fail('state fields corrupted')
  console.log(`PERSIST OK — game ${code} survived restart: loans=${loaner.loans}, round=${restored.round}, hand intact`)
  b2.close()
  process.exit(0)
}

if (mode === 'a') void phaseA()
else if (mode === 'b') void phaseB(process.argv[3] ?? '')
else fail('pass mode a|b with room code for b')
