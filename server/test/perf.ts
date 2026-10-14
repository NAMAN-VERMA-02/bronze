import { io, type Socket } from 'socket.io-client'
import { applyAction, createGame, currentPlayer } from '@bronze/shared'
import type { GameState } from '@bronze/shared'

const URL = 'http://localhost:3001'

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

function benchEngine(): void {
  console.log('\n=== PERFORMANCE BENCHMARKS (QA Framework §4.3.1/§5.3) ===')

  const t0 = performance.now()
  let totalActions = 0
  let games = 0
  while (games < 12) {
    let s = createGame(['A', 'B'], (games + 1) * 7919)
    let guard = 0
    while (s.phase === 'playing') {
      if (++guard > 30000) throw new Error('no termination')
      s = applyAction(s, currentPlayer(s).id, { type: 'PASS' })
      totalActions++
    }
    games++
  }
  const elapsed = (performance.now() - t0) / 1000
  console.log(
    `P01 engine throughput: ${games} games in ${elapsed.toFixed(2)}s — ${(games / elapsed).toFixed(1)} games/s, ${(totalActions / elapsed).toFixed(0)} actions/s`,
  )

  let s = createGame(['A', 'B'], 999)
  const latencies: number[] = []
  for (let i = 0; i < 300 && s.phase === 'playing'; i++) {
    const a0 = performance.now()
    s = applyAction(s, currentPlayer(s).id, { type: 'PASS' })
    latencies.push(performance.now() - a0)
  }
  latencies.sort((a, b) => a - b)
  console.log(
    `P02 applyAction latency: p50=${percentile(latencies, 50).toFixed(3)}ms p95=${percentile(latencies, 95).toFixed(3)}ms over ${latencies.length} ops`,
  )
}

async function benchServer(): Promise<void> {
  const a: Socket = io(URL)
  const b: Socket = io(URL)
  let va: GameState | null = null
  a.on('game', (s: GameState) => (va = s))
  const created = await new Promise<{ ok: boolean; code: string }>((res) => a.emit('lobby:create', { name: 'Perf' }, res))
  await new Promise<{ ok: boolean }>((res) => b.emit('lobby:join', { code: created.code, name: 'Perf2' }, res))
  await new Promise<{ ok: boolean }>((res) => a.emit('lobby:start', {}, res))
  await new Promise<void>((res) => {
    const t = setInterval(() => {
      if (va && va.round >= 1) {
        clearInterval(t)
        res()
      }
    }, 50)
  })

  const rtts: number[] = []
  for (let i = 0; i < 20; i++) {
    const view = va!
    if (view.phase !== 'playing') break
    const active = view.order[view.currentTurnIdx]
    const actor = active === 'p0' ? a : b
    const v0 = view.logSeq
    const t0 = performance.now()
    actor.emit('game:action', { action: { type: 'PASS' } })
    const ok = await new Promise<boolean>((res) => {
      const t = setInterval(() => {
        if (!va || va.logSeq > v0) {
          clearInterval(t)
          res(true)
        }
      }, 5)
      setTimeout(() => {
        clearInterval(t)
        res(false)
      }, 5000)
    })
    if (!ok) throw new Error(`action ${i} not acknowledged within 5s`)
    rtts.push(performance.now() - t0)
  }
  rtts.sort((x, y) => x - y)
  console.log(
    `P03 server action round-trip: p50=${rtts.length ? percentile(rtts, 50).toFixed(1) : '-'}ms p95=${rtts.length ? percentile(rtts, 95).toFixed(1) : '-'}ms over ${rtts.length} actions (target p50 < 500ms)`,
  )
  a.close()
  b.close()

  console.log('\n=== BENCH DONE ===')
  process.exit(0)
}

benchEngine()
void benchServer()
