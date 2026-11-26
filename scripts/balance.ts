// AI-vs-AI balance report. Run: npm run balance [games]
import { apply, createGame, currentPlayer, type AIPersonality } from '../shared/src/valley/engine'
import { chooseAction } from '../shared/src/valley/ai'

const N = Number(process.argv[2] ?? 60)
const kinds: AIPersonality[] = process.env.SAME ? ['balanced', 'balanced', 'balanced', 'balanced'] : ['balanced', 'baron', 'industrialist', 'trader']
const wins: Record<string, number> = {}
const seatWins = [0, 0, 0, 0]
const vps: number[] = []
const margins: number[] = []
const actions: number[] = []
const parts: Record<string, number> = {}
const acts: Record<string, number> = {}
const seatVp = [0, 0, 0, 0]
for (const k of kinds) wins[k] = 0

for (let g = 0; g < N; g++) {
  // Rotate personalities through seats so seat order doesn't bias results.
  const seats = kinds.map((_, i) => kinds[(i + g) % 4]).map((k) => ({ name: k, isAI: true, personality: k }))
  let s = createGame(seats, 1000 + g)
  while (s.phase === 'play') {
    const p = currentPlayer(s)!
    const a = chooseAction(s, p.id)
    acts[a.type] = (acts[a.type] ?? 0) + 1
    s = apply(s, p.id, a)
  }
  for (const r of s.final!) seatVp[Number(r.id.slice(1))] += r.vp / N
  const f = s.final!
  wins[f[0].name]++
  seatWins[Number(f[0].id.slice(1))]++
  vps.push(...f.map((r) => r.vp))
  margins.push(f[0].vp - f[1].vp)
  actions.push(s.actions)
  for (const r of f) for (const b of r.breakdown) parts[b.label] = (parts[b.label] ?? 0) + b.vp
}

const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)
console.log(`${N} four-player AI games`)
console.log('wins by personality', wins)
console.log('wins by seat', seatWins)
console.log(`avg VP ${avg(vps)}, avg winning margin ${avg(margins)}, avg actions/game ${avg(actions)}`)
console.log('actions', acts, 'avg VP by seat', seatVp.map((v) => v.toFixed(1)))
const total = Object.values(parts).reduce((a, b) => a + b, 0)
console.log('VP sources', Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, `${((100 * v) / total).toFixed(0)}%`])))
