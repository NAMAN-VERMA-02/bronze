import {
  createInitialGameState,
  currentPlayer,
  advanceTurn,
  legalActions,
  type GameState,
  type SeatSpec,
} from '../src/bronze/state.js'
import { aiAct } from '../src/bronze/ai.js'

let failed = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

function seats(n: number): SeatSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `P${i + 1}`,
    isAI: true,
    difficulty: (['easy', 'normal', 'hard'] as const)[i % 3],
    personality: (['industrialist', 'network-builder', 'opportunist', 'aggressive'] as const)[i % 4],
  })) as SeatSpec[]
}

function invariants(s: GameState): string | null {
  for (const p of s.players) {
    if (!Number.isFinite(p.money)) return `${p.name} money not finite`
    if (p.hand.length > 8) return `${p.name} hand ${p.hand.length} > 8`
  }
  const slots = new Set<string>()
  for (const t of s.placed) {
    const k = `${t.cityId}:${t.slot}`
    if (slots.has(k)) return `double-occupied slot ${k}`
    slots.add(k)
  }
  return null
}

function playout(n: number, seed: number): { ok: boolean; why: string; steps: number } {
  const s = createInitialGameState(seats(n), seed)
  let steps = 0
  while (!s.over && steps < 4000) {
    const p = currentPlayer(s)
    const res = aiAct(s, p.id)
    void res
    advanceTurn(s)
    steps++
    const bad = invariants(s)
    if (bad) return { ok: false, why: bad, steps }
  }
  if (!s.over) return { ok: false, why: `did not finish in ${steps} steps (era ${s.era}, round ${s.round})`, steps }
  return { ok: true, why: '', steps }
}

for (const n of [2, 3, 4]) {
  let bad = ''
  let total = 0
  for (let seed = 1; seed <= 15; seed++) {
    const r = playout(n, seed * 7919)
    total += r.steps
    if (!r.ok) {
      bad = `seed ${seed * 7919}: ${r.why}`
      break
    }
  }
  check(`${n}-player AI playouts finish with valid state`, bad === '', bad || `avg ${(total / 15) | 0} turns`)
}

const s0 = createInitialGameState(seats(2), 42)
check('legal actions are reported for the first player', Object.values(legalActions(s0, currentPlayer(s0).id)).some(Boolean))

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nBronze engine tests passed')
