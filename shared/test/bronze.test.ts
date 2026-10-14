import {
  createInitialGameState,
  currentPlayer,
  advanceTurn,
  legalActions,
  allBuildOptions,
  resolveBuild,
  resolveScout,
  ironPlan,
  coalPlan,
  resourceOnBoard,
  COAL_MARKET_MAX,
  IRON_MARKET_MAX,
  playerById,
  type PlacedIndustry,
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
  if (s.coalMarket < 0 || s.coalMarket > COAL_MARKET_MAX) return `coal market ${s.coalMarket} out of range`
  if (s.ironMarket < 0 || s.ironMarket > IRON_MARKET_MAX) return `iron market ${s.ironMarket} out of range`
  for (const t of s.placed) if (t.resources < 0) return `negative resources at ${t.cityId}`
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


// ---------------------- Coal / iron market rules ----------------------
function tile(over: Partial<PlacedIndustry>): PlacedIndustry {
  return { key: 'x:0', cityId: 'stoke', slot: 0, kind: 'coal', level: 1, ownerId: 'p2', flipped: false, scored: false, resources: 2, ...over }
}
{
  const s = createInitialGameState(seats(2), 7)
  s.placed = []
  s.ironMarket = 0
  check('iron from an empty market costs the top price', ironPlan(s, 1).money === 4 && ironPlan(s, 1).market === 1)
  s.ironMarket = 8
  check('iron from a stocked market is cheap', ironPlan(s, 1).money === 1)
  s.placed = [tile({ kind: 'iron', cityId: 'derby', resources: 1 })]
  check('iron on any tile is taken before the market', ironPlan(s, 1).market === 0 && ironPlan(s, 1).money === 0)
  s.placed = []
  check('coal needs a merchant connection to use the market', coalPlan(s, ['birmingham'], 1) === null)
  check('coal market is usable from a merchant town', coalPlan(s, ['stone'], 1) !== null)
}
{
  const s = createInitialGameState(seats(2), 11)
  const pid = currentPlayer(s).id
  const p = playerById(s, pid)
  p.hand.push({ id: 'wild-t', cityId: null, kind: 'wild-location' })
  p.money = 50
  s.placed = []
  s.coalMarket = 10
  const before = p.money
  const opt = allBuildOptions(s, pid).find((o) => o.kind === 'coal' && o.cardId === 'wild-t')
  const err = opt ? resolveBuild(s, pid, 'wild-t', opt.cityId, 'coal') : 'no option'
  const t = s.placed[0]
  check('building a coal mine sells its coal into the market', !err && s.coalMarket === 12 && t.resources === 0 && t.flipped && p.money > before - opt!.cost.money, String(err ?? ''))
}
{
  const s = createInitialGameState(seats(2), 13)
  const pid = currentPlayer(s).id
  const p = playerById(s, pid)
  p.hand.push({ id: 'wild-o', cityId: null, kind: 'wild-location' })
  p.money = 50
  const rival = p.id === 'p1' ? 'p2' : 'p1'
  p.supply.coal.l1 = 0 // overbuilding needs a higher level than the tile it replaces
  // Stoke is full, so the only way in is to overbuild.
  s.placed = [
    tile({ ownerId: rival, level: 1, resources: 1 }),
    tile({ key: 'stoke:1', slot: 1, kind: 'cotton', ownerId: rival, resources: 0 }),
    tile({ key: 'stoke:2', slot: 2, kind: 'cotton', ownerId: rival, resources: 0 }),
  ]
  const canOver = () => allBuildOptions(s, pid).some((o) => o.cityId === 'stoke' && o.kind === 'coal' && o.overbuildKey && o.cardId === 'wild-o')
  check('rival coal mine cannot be overbuilt while coal remains', !canOver() && resourceOnBoard(s, 'coal') === 1)
  s.placed[0].resources = 0
  s.placed[0].flipped = true
  check('rival coal mine can be overbuilt once no coal is left', canOver())
}

// ------------------------------ Scout rule ------------------------------
{
  const s = createInitialGameState(seats(2), 21)
  const pid = currentPlayer(s).id
  const p = playerById(s, pid)
  const before = p.hand.length
  const err = resolveScout(s, pid)
  check('scouting trades three cards for a wild location and a wild industry',
    !err && p.hand.length === before - 3 + 2 && p.hand.some((c) => c.kind === 'wild-location') && p.hand.some((c) => c.kind === 'wild-industry'), String(err ?? ''))
  check('scouting again while holding a wild is refused', resolveScout(s, pid) !== null)
  s.placed = [tile({ ownerId: pid, cityId: 'birmingham', key: 'birmingham:0', kind: 'cotton', resources: 0 })]
  p.money = 60
  const wildInd = p.hand.find((c) => c.kind === 'wild-industry')!
  const kinds = new Set(allBuildOptions(s, pid).filter((o) => o.cardId === wildInd.id).map((o) => o.kind))
  check('a wild industry card can build more than just coal', kinds.size > 1 && [...kinds].some((k) => k !== 'coal'), [...kinds].join(','))
  s.wildLocPool = 0
  p.hand = p.hand.filter((c) => !c.kind.startsWith('wild'))
  check('scouting is not offered when a wild pool is empty', !legalActions(s, pid).SCOUT)
}

const s0 = createInitialGameState(seats(2), 42)
check('legal actions are reported for the first player', Object.values(legalActions(s0, currentPlayer(s0).id)).some(Boolean))

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nBronze engine tests passed')
