import { io, type Socket } from 'socket.io-client'
import type { GameState } from '@bronze/shared'

const URL = 'http://localhost:3001'
type View = GameState & { youId: string }

interface CaseResult {
  id: string
  name: string
  pass: boolean
  detail?: string
}

const results: CaseResult[] = []

async function run(id: string, name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    results.push({ id, name, pass: true })
  } catch (e) {
    results.push({ id, name, pass: false, detail: e instanceof Error ? e.message : String(e) })
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function until<T>(fn: () => T | null | undefined, label: string, timeoutMs = 8000): Promise<T> {
  return new Promise((res, rej) => {
    const t0 = Date.now()
    const t = setInterval(() => {
      const v = fn()
      if (v !== null && v !== undefined) {
        clearInterval(t)
        res(v)
      } else if (Date.now() - t0 > timeoutMs) {
        clearInterval(t)
        rej(new Error(`timeout: ${label}`))
      }
    }, 50)
  })
}

async function setupGame(): Promise<{ a: Socket; b: Socket; code: string; va: () => View | null; vb: () => View | null }> {
  const a: Socket = io(URL)
  const b: Socket = io(URL)
  let va: View | null = null
  let vb: View | null = null
  a.on('game', (s: View) => (va = s))
  b.on('game', (s: View) => (vb = s))
  const created = await new Promise<{ ok: boolean; code: string }>((res) => a.emit('lobby:create', { name: 'Alice' }, res))
  if (!created.ok) throw new Error('create failed')
  await new Promise<{ ok: boolean }>((res) => b.emit('lobby:join', { code: created.code, name: 'Bob' }, res))
  await new Promise<{ ok: boolean; error?: string }>((res) =>
    a.emit('lobby:start', {}, (v) => {
      if (!v.ok) throw new Error(`start failed: ${v.error}`)
      res(v)
    }),
  )
  await until(() => va && vb, 'initial states')
  return { a, b, code: created.code, va: () => va, vb: () => vb }
}

async function main(): Promise<void> {
  // N01 — Rapid Input stress (Table 5): duplicate burst processed exactly once per slot
  await run('N01', 'Rapid duplicate input burst: zero double-processing', async () => {
    const { a, b, va } = await setupGame()
    const view0 = va()!
    const actor = view0.order[view0.currentTurnIdx] === 'p0' ? a : b
    const seq0 = view0.logSeq
    for (let i = 0; i < 12; i++) actor.emit('game:action', { action: { type: 'PASS' } })
    await until(() => {
      const v = va()
      return v && v.logSeq >= seq0 + 2 ? true : null
    }, 'two passes to be logged')
    await wait(400)
    const v2 = va()!
    const passCount = v2.log.filter((l) => l.text.includes('passes')).length
    if (passCount !== 2) throw new Error(`expected exactly 2 passes processed, got ${passCount}`)
    if (v2.actionsLeft !== 2) throw new Error(`actionsLeft corrupted: ${v2.actionsLeft}`)
    a.close()
    b.close()
  })

  // N02 — Out-of-turn action over the wire
  await run('N02', 'Out-of-turn socket action rejected with clean error', async () => {
    const { a, b, vb } = await setupGame()
    const view0 = vb()!
    const notMyTurnSocket = view0.order[view0.currentTurnIdx] === 'p0' ? b : a
    const errors: string[] = []
    notMyTurnSocket.off('action:error')
    notMyTurnSocket.on('action:error', (m: { message: string }) => errors.push(m.message))
    notMyTurnSocket.emit('game:action', { action: { type: 'LOAN' } })
    await until(() => (errors.length > 0 ? true : null), 'error event')
    if (!errors[0].includes('Not your turn')) throw new Error(`wrong error: ${errors[0]}`)
    if (!vb()) throw new Error('state lost')
    a.close()
    b.close()
  })

  // N03 — Spectator must never see hands
  await run('N03', 'Spectator receives fully redacted state (no hands)', async () => {
    const { code, va } = await setupGame()
    const spec: Socket = io(URL)
    let sv: GameState & { youId: string } | null = null
    spec.on('game', (s: GameState & { youId: string }) => (sv = s))
    await new Promise<{ ok: boolean; seated: boolean }>((res) => spec.emit('lobby:join', { code, name: 'Peeping Tom' }, res))
    await until(() => sv, 'spectator state')
    const view = sv!
    for (const p of view.players) {
      if (p.hand.length !== 0) throw new Error(`spectator sees ${p.hand.length} cards of ${p.id}`)
    }
    void va
    spec.close()
  })

  // N04 — Malformed action over the wire must not corrupt or consume
  await run('N04', 'Malformed action rejected server-side without state damage', async () => {
    const { a, va } = await setupGame()
    let errCount = 0
    a.off('action:error')
    a.on('action:error', () => errCount++)
    a.emit('game:action', { action: { type: 'HACK_THE_MARKET' } })
    a.emit('game:action', {})
    a.emit('game:action', 'garbage-string')
    await until(() => (errCount >= 2 ? true : null), 'error events')
    const v = va()!
    if (v.actionsLeft !== 2) throw new Error(`actionsLeft corrupted: ${v.actionsLeft}`)
    a.close()
  })

  // N05 — Lobby constraints
  await run('N05', 'Lobby: start requires 2+ players; 5th joiner is spectator', async () => {
    const a: Socket = io(URL)
    const created = await new Promise<{ ok: boolean; code: string }>((res) => a.emit('lobby:create', { name: 'Host' }, res))
    const startAlone = await new Promise<{ ok: boolean; error?: string }>((res) => a.emit('lobby:start', {}, res))
    if (startAlone.ok) throw new Error('start should fail with one player')
    const sockets: Socket[] = [a]
    for (let i = 2; i <= 4; i++) {
      const s: Socket = io(URL)
      sockets.push(s)
      const j = await new Promise<{ ok: boolean; seated: boolean }>((res) => s.emit('lobby:join', { code: created.code, name: `P${i}` }, res))
      if (!j.seated) throw new Error(`P${i} should get a seat`)
    }
    const fifth: Socket = io(URL)
    sockets.push(fifth)
    const j5 = await new Promise<{ ok: boolean; seated: boolean }>((res) => fifth.emit('lobby:join', { code: created.code, name: 'Latecomer' }, res))
    if (j5.seated) throw new Error('fifth player must not get a seat')
    for (const s of sockets) s.close()
  })

  console.log('\n=== MULTIPLAYER PROTOCOL SUITE (QA Framework §4.4/§4.3.2) ===')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}${r.pass ? '' : ` — ${r.detail}`}`)
  }
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed > 0 ? 1 : 0)
}

void main()
