import { io, type Socket } from 'socket.io-client'
import type { GameState } from '@bronze/shared'

const URL = 'http://localhost:3001'
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
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

async function main(): Promise<void> {
  const a: Socket = io(URL)
  const b: Socket = io(URL)

  let va: View | null = null
  let vb: View | null = null
  a.on('game', (s: View) => (va = s))
  b.on('game', (s: View) => (vb = s))

  const created = await new Promise<{ ok: boolean; code: string }>((res) =>
    a.emit('lobby:create', { name: 'Alice' }, res),
  )
  if (!created.ok) throw new Error('create failed')
  await new Promise<{ ok: boolean }>((res) => b.emit('lobby:join', { code: created.code, name: 'Bob' }, res))
  await new Promise<{ ok: boolean }>((res) => {
    a.emit('lobby:start', {}, (v: { ok: boolean; error?: string }) => {
      if (!v.ok) throw new Error(`start failed: ${v.error}`)
      res(v)
    })
  })
  await until(() => (va && vb ? true : null), 'initial states')
  console.log('phase 1 OK — game started, both clients hold state')

  b.disconnect()
  va = null
  await wait(300)

  const b2: Socket = io(URL)
  let vb2: View | null = null
  b2.on('game', (s: View) => (vb2 = s))
  const joined = await new Promise<{ ok: boolean; seated: boolean }>((res) =>
    b2.emit('lobby:join', { code: created.code, name: 'Bob' }, res),
  )
  if (!joined.ok || !joined.seated) throw new Error(`rejoin failed: ${JSON.stringify(joined)}`)

  const restored = await until(() => vb2, 'restored state after rejoin')
  if (restored.youId !== 'p1') throw new Error(`wrong youId after rejoin: ${restored.youId}`)
  const me2 = restored.players.find((p) => p.id === restored.youId)!
  if (me2.hand.length !== 8) throw new Error(`hand not restored: ${me2.hand.length} cards`)
  if (restored.players.find((p) => p.id === 'p0')!.hand.length !== 0) {
    throw new Error('opponent hand leaked after rejoin')
  }
  console.log('RECONNECT OK — seat reclaimed by name, own hand restored, opponent hand redacted')
  a.close()
  b2.close()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
