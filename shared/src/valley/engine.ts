// BRONZE: The Aurel Valley — rules engine.
// Pure and deterministic: apply(state, playerId, action) returns a new state
// or throws RuleError. The UI, the AI and the network host all go through it.

import {
  ACTION_TIME, AGES, AGE_LENGTH, BOND_AMOUNT, BOND_END_VP, BOND_INCOME, BUILDINGS, CONTRACT_AGING,
  CONTRACT_ROW, CONTRACT_TEMPLATES, EVENTS, GOALS, GOAL_VP, GOOD_VALUE, GOOD_VP, GOODS, LAND_COAL,
  LAND_COST, LINKS, LINK_BY_ID, MAX_BONDS, MONEY_PER_VP, PLAYER_COLORS, PRICES, PRICE_START, RECIPES,
  RIVER_COST, START_MONEY, BASE_INCOME, WORKS_AGE, WAIT_CAP, STORAGE_CAP, TICKS, TOLL, TOWNS, TOWN_BY_ID,
  type BuildingKind, type Deposit, type EventDef, type GoalId, type Good,
} from './data'

export * from './data'

export type Level = 1 | 2 | 3
export type AIPersonality = 'balanced' | 'baron' | 'industrialist' | 'trader'
export type AIDifficulty = 'easy' | 'normal' | 'hard'

export interface SeatSpec {
  name: string
  isAI: boolean
  personality?: AIPersonality
  difficulty?: AIDifficulty
}

export type Goods = Partial<Record<Good, number>>

export interface Building {
  owner: string
  kind: BuildingKind
  level: Level
  deposit?: Deposit
  goods: Goods
}

export interface Contract {
  id: string
  town: string
  wants: Goods
  money: number
  vp: number
}

export interface Stats { contracts: number; tolls: number; machines: number; bronze: number }

export interface Player {
  id: string
  name: string
  color: string
  isAI: boolean
  personality: AIPersonality
  difficulty: AIDifficulty
  money: number
  vp: number
  time: number
  arrival: number
  bonds: number
  stock: Record<BuildingKind, number>
  stats: Stats
}

export type Fx =
  | { kind: 'move'; good: Good; path: string[]; from: string | 'exchange'; to: string | 'exchange'; who: string }
  | { kind: 'pay'; from: string; to: string; amount: number; why: 'toll' | 'goods' }
  | { kind: 'build'; town: string; slot: number; who: string; upgrade: boolean }
  | { kind: 'route'; link: string; who: string }
  | { kind: 'produce'; town: string; slot: number; good: Good; n: number }
  | { kind: 'deliver'; contract: Contract; who: string }
  | { kind: 'trade'; good: Good; n: number; earned: number; who: string }
  | { kind: 'tick'; at: number; event: EventDef }
  | { kind: 'payday'; who: string; amount: number }
  | { kind: 'age'; ended: number; scores: Record<string, number> }
  | { kind: 'end' }

export interface LogLine { seq: number; text: string; who?: string }

export interface FinalRow {
  id: string
  name: string
  vp: number
  money: number
  breakdown: { label: string; vp: number }[]
}

export interface GameState {
  version: 1
  rng: number
  players: Player[]
  age: number
  plots: Record<string, (Building | null)[]>
  links: Record<string, string | null>
  priceIdx: Record<Good, number>
  contracts: Contract[]
  decks: Contract[][]
  eventDeck: string[]
  event: EventDef | null
  ticksDone: number[]
  landDiscount: number
  riverSurcharge: number
  goals: GoalId[]
  arrivalSeq: number
  actions: number
  log: LogLine[]
  logSeq: number
  fx: Fx[]
  phase: 'play' | 'ended'
  final: FinalRow[] | null
  /** Running VP earned, for the end-of-game breakdown. */
  earned: Record<string, Record<string, number>>
}

export type Action =
  | { type: 'build'; town: string; slot: number; kind: BuildingKind; level: Level }
  | { type: 'route'; link: string }
  | { type: 'run'; town: string; slot: number }
  | { type: 'deliver'; contract: string }
  | { type: 'trade'; good: Good; qty: number }
  | { type: 'bond' }
  | { type: 'wait' }

export class RuleError extends Error {}

// ---------------------------------------------------------------- utilities

function rand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function shuffle<T>(s: GameState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

function fail(msg: string): never {
  throw new RuleError(msg)
}

export function price(s: GameState, g: Good): number {
  return PRICES[g][s.priceIdx[g]]
}

export function player(s: GameState, id: string): Player {
  const p = s.players.find((x) => x.id === id)
  if (!p) fail(`no player ${id}`)
  return p
}

function log(s: GameState, text: string, who?: string): void {
  s.log.push({ seq: ++s.logSeq, text, who })
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200)
}

export function goodsCount(g: Goods): number {
  let n = 0
  for (const k of GOODS) n += g[k] ?? 0
  return n
}

export function goodsLabel(g: Goods): string {
  return GOODS.filter((k) => g[k]).map((k) => `${g[k]} ${goodName(k)}`).join(' + ')
}

// ------------------------------------------------------------------- setup

function makeContract(s: GameState, age: number, wants: Goods, i: number): Contract {
  const ports = TOWNS.filter((t) => t.port).map((t) => t.id)
  const riverTowns = new Set<string>()
  for (const l of LINKS) if (l.kind === 'river') { riverTowns.add(l.a); riverTowns.add(l.b) }
  const inland = TOWNS.filter((t) => !t.port && (age > 1 || riverTowns.has(t.id))).map((t) => t.id)
  const pool = [...ports, ...ports, ...inland]
  const town = pool[Math.floor(rand(s) * pool.length)]
  const port = TOWN_BY_ID.get(town)!.port
  let money = 0
  let vp = 0
  for (const g of GOODS) {
    money += (wants[g] ?? 0) * GOOD_VALUE[g]
    vp += (wants[g] ?? 0) * GOOD_VP[g]
  }
  return {
    id: `a${age}c${i}`,
    town,
    wants,
    money: Math.round(money * (port ? 1.15 : 1)),
    vp: Math.max(1, Math.round(vp)),
  }
}

export function createGame(seats: SeatSpec[], seed = Date.now()): GameState {
  if (seats.length < 1 || seats.length > 4) fail('1 to 4 seats')
  const s: GameState = {
    version: 1,
    rng: seed | 0,
    players: [],
    age: 1,
    plots: {},
    links: {},
    priceIdx: { coal: PRICE_START, copper: PRICE_START, tin: PRICE_START, bronze: PRICE_START, machine: PRICE_START },
    contracts: [],
    decks: [],
    eventDeck: [],
    event: null,
    ticksDone: [],
    landDiscount: 0,
    riverSurcharge: 0,
    goals: [],
    arrivalSeq: 0,
    actions: 0,
    log: [],
    logSeq: 0,
    fx: [],
    phase: 'play',
    final: null,
    earned: {},
  }
  for (const t of TOWNS) s.plots[t.id] = Array.from({ length: t.plots }, () => null)
  for (const l of LINKS) s.links[l.id] = null
  // A solo seat gets one AI rival so the economy has someone to trade with.
  const all = seats.length === 1 ? [...seats, { name: 'Hesketh', isAI: true }] : seats
  all.forEach((seat, i) => {
    s.players.push({
      id: `p${i}`,
      name: seat.name,
      color: PLAYER_COLORS[i],
      isAI: seat.isAI,
      personality: seat.personality ?? 'balanced',
      difficulty: seat.difficulty ?? 'normal',
      money: START_MONEY,
      vp: 0,
      time: 0,
      arrival: all.length - i,
      bonds: 0,
      stock: { mine: BUILDINGS.mine.stock, smelter: BUILDINGS.smelter.stock, works: BUILDINGS.works.stock },
      stats: { contracts: 0, tolls: 0, machines: 0, bronze: 0 },
    })
    s.earned[`p${i}`] = {}
  })
  s.arrivalSeq = all.length
  s.decks = CONTRACT_TEMPLATES.map((tpls, a) =>
    shuffle(s, tpls.map((w) => ({ ...w }))).map((w, i) => makeContract(s, a + 1, w, i)),
  )
  s.eventDeck = shuffle(s, EVENTS.map((e) => e.id))
  s.goals = shuffle(s, GOALS.map((g) => g.id)).slice(0, 3)
  dealContracts(s)
  log(s, 'Age I begins. The river is open; roads come in Age II.')
  return s
}

function dealContracts(s: GameState): void {
  const deck = s.decks[s.age - 1]
  while (s.contracts.length < CONTRACT_ROW && deck.length) s.contracts.push(deck.shift()!)
}

// ----------------------------------------------------------------- queries

export function currentPlayer(s: GameState): Player | null {
  if (s.phase !== 'play') return null
  let best: Player | null = null
  for (const p of s.players) {
    if (p.time >= AGE_LENGTH) continue
    if (!best || p.time < best.time || (p.time === best.time && p.arrival > best.arrival)) best = p
  }
  return best
}

export function buildingsOf(s: GameState, pid: string): { town: string; slot: number; b: Building }[] {
  const out: { town: string; slot: number; b: Building }[] = []
  for (const t of TOWNS) s.plots[t.id].forEach((b, slot) => { if (b && b.owner === pid) out.push({ town: t.id, slot, b }) })
  return out
}

export function income(s: GameState, pid: string): number {
  let inc = 0
  for (const { b } of buildingsOf(s, pid)) inc += BUILDINGS[b.kind].income[b.level - 1]
  return BASE_INCOME + inc - player(s, pid).bonds * BOND_INCOME
}

export function network(s: GameState, pid: string): Set<string> {
  const n = new Set<string>()
  for (const { town } of buildingsOf(s, pid)) n.add(town)
  for (const l of LINKS) if (s.links[l.id] === pid) { n.add(l.a); n.add(l.b) }
  return n
}

export interface PathInfo { path: string[]; tolls: { owner: string; n: number }[]; toll: number }

/** Cheapest path over claimed links for `pid` (own links free, others 1 mark). */
export function findPath(s: GameState, pid: string, from: string, to: string | ((t: string) => boolean)): PathInfo | null {
  const isGoal = typeof to === 'string' ? (t: string) => t === to : to
  const dist = new Map<string, number>([[from, 0]])
  const prev = new Map<string, { town: string; link: string }>()
  const dq: string[] = [from]
  while (dq.length) {
    const cur = dq.shift()!
    if (isGoal(cur)) {
      const path = [cur]
      const owners = new Map<string, number>()
      let c = cur
      while (prev.has(c)) {
        const p = prev.get(c)!
        const o = s.links[p.link]!
        if (o !== pid) owners.set(o, (owners.get(o) ?? 0) + 1)
        c = p.town
        path.unshift(c)
      }
      const tolls = [...owners].map(([owner, n]) => ({ owner, n }))
      return { path, tolls, toll: tolls.reduce((a, t) => a + t.n * TOLL, 0) }
    }
    const d = dist.get(cur)!
    for (const l of ADJ.get(cur) ?? []) {
      const owner = s.links[l.id]
      if (!owner) continue
      const nxt = l.a === cur ? l.b : l.a
      const w = owner === pid ? 0 : 1
      if (dist.has(nxt) && dist.get(nxt)! <= d + w) continue
      dist.set(nxt, d + w)
      prev.set(nxt, { town: cur, link: l.id })
      if (w === 0) dq.unshift(nxt)
      else dq.push(nxt)
    }
  }
  return null
}

const ADJ = new Map<string, typeof LINKS>()
for (const l of LINKS) {
  if (!ADJ.has(l.a)) ADJ.set(l.a, [])
  if (!ADJ.has(l.b)) ADJ.set(l.b, [])
  ADJ.get(l.a)!.push(l)
  ADJ.get(l.b)!.push(l)
}

const isPort = (t: string) => !!TOWN_BY_ID.get(t)?.port

export function linkCost(s: GameState, linkId: string): { money: number; coal: number } {
  const l = LINK_BY_ID.get(linkId)!
  if (l.kind === 'river') return { money: RIVER_COST + s.riverSurcharge, coal: 0 }
  return { money: Math.max(2, LAND_COST - s.landDiscount), coal: LAND_COAL }
}

// --------------------------------------------------------------- economy ops

function pay(s: GameState, p: Player, amount: number): void {
  if (p.money < amount) fail(`Not enough money (need ${amount} marks, have ${p.money} marks)`)
  p.money -= amount
}

function payTolls(s: GameState, p: Player, info: PathInfo): void {
  for (const t of info.tolls) {
    const amt = t.n * TOLL
    pay(s, p, amt)
    const o = player(s, t.owner)
    o.money += amt
    o.stats.tolls += amt
    s.fx.push({ kind: 'pay', from: p.id, to: o.id, amount: amt, why: 'toll' })
  }
}

interface SourceChoice { cost: number; town: string; slot: number; owner: string | null; info: PathInfo; exchange: boolean }

/** Cheapest way to get one unit of `g` to `dest` for player `p`. */
export function cheapestSource(s: GameState, p: Player, g: Good, dest: string, allowExchange: boolean): SourceChoice | null {
  let best: SourceChoice | null = null
  for (const t of TOWNS) {
    s.plots[t.id].forEach((b, slot) => {
      if (!b || !(b.goods[g] ?? 0)) return
      const info = findPath(s, p.id, t.id, dest)
      if (!info) return
      const cost = (b.owner === p.id ? 0 : price(s, g)) + info.toll
      // Prefer own goods on ties so rivals are only paid when needed.
      if (!best || cost < best.cost || (cost === best.cost && b.owner === p.id && best.owner !== p.id)) {
        best = { cost, town: t.id, slot, owner: b.owner, info, exchange: false }
      }
    })
  }
  if (allowExchange) {
    const info = findPath(s, p.id, dest, isPort)
    if (info) {
      const cost = price(s, g) + info.toll
      if (!best || cost < (best as SourceChoice).cost) best = { cost, town: info.path[info.path.length - 1], slot: -1, owner: null, info, exchange: true }
    }
  }
  return best
}

function takeUnit(s: GameState, p: Player, g: Good, dest: string, allowExchange: boolean): void {
  const c = cheapestSource(s, p, g, dest, allowExchange)
  if (!c) fail(`No ${g} can reach ${TOWN_BY_ID.get(dest)!.name}`)
  payTolls(s, p, c.info)
  if (c.exchange) {
    pay(s, p, price(s, g))
    s.priceIdx[g] = Math.min(7, s.priceIdx[g] + 1)
    s.fx.push({ kind: 'move', good: g, path: [...c.info.path].reverse(), from: 'exchange', to: dest, who: p.id })
    return
  }
  const b = s.plots[c.town][c.slot]!
  if (b.owner !== p.id) {
    const amt = price(s, g)
    pay(s, p, amt)
    player(s, b.owner).money += amt
    s.fx.push({ kind: 'pay', from: p.id, to: b.owner, amount: amt, why: 'goods' })
  }
  b.goods[g] = (b.goods[g] ?? 0) - 1
  s.fx.push({ kind: 'move', good: g, path: c.info.path, from: c.town, to: dest, who: p.id })
}

function addVP(s: GameState, p: Player, n: number, label: string): void {
  p.vp += n
  const e = s.earned[p.id]
  e[label] = (e[label] ?? 0) + n
}

// --------------------------------------------------------------- time track

function advance(s: GameState, p: Player, dt: number): void {
  const old = p.time
  const next = Math.min(AGE_LENGTH, old + dt)
  p.time = next
  p.arrival = ++s.arrivalSeq
  for (const T of TICKS) {
    if (old < T && next >= T) {
      if (!s.ticksDone.includes(T)) marketTick(s, T)
      payday(s, p)
    }
  }
}

function payday(s: GameState, p: Player): void {
  const inc = income(s, p.id)
  p.money += inc
  s.fx.push({ kind: 'payday', who: p.id, amount: inc })
  if (p.money < 0) {
    addVP(s, p, p.money, 'Debts')
    log(s, `${p.name} could not cover ${-p.money} marks of upkeep and lost ${-p.money} glory.`, p.id)
    p.money = 0
  }
}

function marketTick(s: GameState, T: number): void {
  s.ticksDone.push(T)
  s.landDiscount = 0
  s.riverSurcharge = 0
  for (const g of GOODS) {
    if (s.priceIdx[g] > PRICE_START) s.priceIdx[g]--
    else if (s.priceIdx[g] < PRICE_START) s.priceIdx[g]++
  }
  for (const c of s.contracts) c.money += CONTRACT_AGING
  if (s.contracts.length) {
    const gone = s.contracts.shift()!
    log(s, `The ${goodsLabel(gone.wants)} contract for ${TOWN_BY_ID.get(gone.town)!.name} lapsed.`)
  }
  dealContracts(s)
  if (!s.eventDeck.length) s.eventDeck = shuffle(s, EVENTS.map((e) => e.id))
  const id = s.eventDeck.shift()
  const ev = EVENTS.find((e) => e.id === id)!
  if (!ev) throw new Error(`bad event ${String(id)} deck=${JSON.stringify(s.eventDeck)}`)
  s.event = ev
  const fx = ev.effect
  if (fx.kind === 'price') s.priceIdx[fx.good] = Math.max(0, Math.min(7, s.priceIdx[fx.good] + fx.steps))
  if (fx.kind === 'landDiscount') s.landDiscount = fx.amount
  if (fx.kind === 'riverSurcharge') s.riverSurcharge = fx.amount
  if (fx.kind === 'contractBonus') for (const c of s.contracts) c.money += fx.amount
  if (fx.kind === 'reliefLowest') {
    const low = [...s.players].sort((a, b) => a.vp - b.vp)[0]
    low.money += fx.amount
  }
  s.fx.push({ kind: 'tick', at: T, event: ev })
  log(s, `Market tick at ${T}: ${ev.title}. ${ev.text}`)
}

function endAge(s: GameState): void {
  const scores: Record<string, number> = {}
  for (const p of s.players) scores[p.id] = 0
  for (const t of TOWNS) for (const b of s.plots[t.id]) {
    if (!b) continue
    const v = BUILDINGS[b.kind].vp[b.level - 1]
    addVP(s, player(s, b.owner), v, 'Buildings')
    scores[b.owner] += v
  }
  for (const l of LINKS) {
    const o = s.links[l.id]
    if (!o) continue
    // 1 VP only when both end towns are busy: a link must join two working places.
    const v = s.plots[l.a].some(Boolean) && s.plots[l.b].some(Boolean) ? 1 : 0
    if (!v) continue
    addVP(s, player(s, o), v, 'Links')
    scores[o] += v
  }
  s.fx.push({ kind: 'age', ended: s.age, scores })
  log(s, `Age ${roman(s.age)} ends. ${s.players.map((p) => `${p.name} +${scores[p.id]}`).join(', ')}.`)
  if (s.age >= AGES) return endGame(s)
  s.age++
  s.ticksDone = []
  s.landDiscount = 0
  s.riverSurcharge = 0
  s.contracts = []
  dealContracts(s)
  // Lowest score acts first in the new Age.
  const order = [...s.players].sort((a, b) => b.vp - a.vp)
  order.forEach((p) => { p.time = 0; p.arrival = ++s.arrivalSeq })
  log(s, s.age === 2 ? 'Age II begins. Land links (rail) can now be built.' : 'Age III begins. Level III buildings unlock.')
}

export function roman(n: number): string {
  return ['I', 'II', 'III'][n - 1] ?? String(n)
}

export function goalMetric(s: GameState, id: GoalId, pid: string): number {
  const p = player(s, pid)
  const own = buildingsOf(s, pid)
  switch (id) {
    case 'contracts': return p.stats.contracts
    case 'routes': return LINKS.filter((l) => s.links[l.id] === pid).length
    case 'tolls': return p.stats.tolls
    case 'level3': return own.filter((o) => o.b.level === 3).length
    case 'machines': return p.stats.machines
    case 'deposits': return new Set(own.filter((o) => o.b.kind === 'mine').map((o) => o.b.deposit)).size
    case 'ports': return TOWNS.filter((t) => t.port && LINKS.some((l) => s.links[l.id] === pid && (l.a === t.id || l.b === t.id))).length
    case 'bronze': return p.stats.bronze
  }
}

function endGame(s: GameState): void {
  for (const p of s.players) {
    addVP(s, p, Math.floor(p.money / MONEY_PER_VP), 'Money')
    if (p.bonds) addVP(s, p, -p.bonds * BOND_END_VP, 'Bonds')
  }
  for (const gid of s.goals) {
    const vals = s.players.map((p) => goalMetric(s, gid, p.id))
    const distinct = [...new Set(vals.filter((v) => v > 0))].sort((a, b) => b - a)
    const title = GOALS.find((g) => g.id === gid)!.title
    s.players.forEach((p, i) => {
      if (distinct[0] !== undefined && vals[i] === distinct[0]) addVP(s, p, GOAL_VP[0], title)
      else if (distinct[1] !== undefined && vals[i] === distinct[1]) addVP(s, p, GOAL_VP[1], title)
    })
  }
  s.phase = 'ended'
  s.final = [...s.players]
    .sort((a, b) => b.vp - a.vp || b.money - a.money)
    .map((p) => ({
      id: p.id,
      name: p.name,
      vp: p.vp,
      money: p.money,
      breakdown: Object.entries(s.earned[p.id]).map(([label, vp]) => ({ label, vp })),
    }))
  s.fx.push({ kind: 'end' })
  log(s, `The valley falls quiet. ${s.final[0].name} wins with ${s.final[0].vp} glory.`)
}

// ------------------------------------------------------------------ actions

export function actionTime(s: GameState, pid: string, a: Action): number {
  if (a.type === 'wait') {
    const p = player(s, pid)
    return waitTarget(s, p) - p.time
  }
  return ACTION_TIME[a.type]
}

function waitTarget(s: GameState, p: Player): number {
  const others = s.players.filter((o) => o.id !== p.id && o.time < AGE_LENGTH).map((o) => o.time)
  const next = others.length ? Math.min(...others) : AGE_LENGTH
  return Math.min(AGE_LENGTH, Math.max(p.time + 1, next + 1))
}

/** Apply an action for `pid`. Returns a new state; throws RuleError if illegal. */
export function apply(prev: GameState, pid: string, a: Action): GameState {
  if (prev.phase !== 'play') fail('The game is over')
  const cur = currentPlayer(prev)
  if (!cur || cur.id !== pid) fail('Not your turn')
  const s = clone(prev)
  s.fx = []
  const p = player(s, pid)
  switch (a.type) {
    case 'build': doBuild(s, p, a); break
    case 'route': doRoute(s, p, a.link); break
    case 'run': doRun(s, p, a.town, a.slot); break
    case 'deliver': doDeliver(s, p, a.contract); break
    case 'trade': doTrade(s, p, a.good, a.qty); break
    case 'bond': {
      if (p.bonds >= MAX_BONDS) fail('No more bonds allowed')
      p.bonds++
      p.money += BOND_AMOUNT
      log(s, `${p.name} issued a bond for ${BOND_AMOUNT} marks (income −${BOND_INCOME}).`, p.id)
      break
    }
    case 'wait': {
      const target = waitTarget(s, p)
      const steps = target - p.time
      // Capped so the last player in an Age can't bank a long jump.
      const gain = Math.min(steps, WAIT_CAP)
      p.money += gain
      log(s, `${p.name} waited ${steps} and collected ${gain} mark${gain === 1 ? '' : 's'}.`, p.id)
      advance(s, p, steps)
      break
    }
    default: fail('Unknown action')
  }
  // doRun may restore a snapshot, so re-read the player object.
  if (a.type !== 'wait') advance(s, player(s, pid), ACTION_TIME[a.type])
  s.actions++
  if (s.players.every((x) => x.time >= AGE_LENGTH)) endAge(s)
  return s
}

export function check(s: GameState, pid: string, a: Action): string | null {
  try {
    apply(s, pid, a)
    return null
  } catch (e) {
    if (e instanceof RuleError) return e.message
    throw e
  }
}

function doBuild(s: GameState, p: Player, a: Extract<Action, { type: 'build' }>): void {
  const town = TOWN_BY_ID.get(a.town)
  if (!town) fail('No such town')
  if (a.slot < 0 || a.slot >= town.plots) fail('No such plot')
  if (a.level > s.age) fail(`Level ${roman(a.level)} unlocks in Age ${roman(a.level)}`)
  const net = network(s, p.id)
  const spec = BUILDINGS[a.kind]
  const existing = s.plots[a.town][a.slot]
  if (existing) {
    if (existing.owner !== p.id) fail('That plot belongs to a rival')
    if (existing.kind !== a.kind) fail('Upgrades must keep the building type')
    if (a.level <= existing.level) fail('Upgrades must raise the level')
    const cost = spec.cost[a.level - 1] - spec.cost[existing.level - 1]
    pay(s, p, cost)
    existing.level = a.level
    s.fx.push({ kind: 'build', town: a.town, slot: a.slot, who: p.id, upgrade: true })
    log(s, `${p.name} upgraded a ${kindName(a.kind)} in ${town.name} to level ${roman(a.level)} (${cost} marks).`, p.id)
    return
  }
  if (a.kind === 'works' && s.age < WORKS_AGE) fail(`Forges open in Age ${roman(WORKS_AGE)}`)
  if (net.size && !reach(net).has(a.town)) fail(`${town.name} is not in or next to your network`)
  if (p.stock[a.kind] <= 0) fail(`No ${a.kind}s left in your stock`)
  if (a.kind === 'mine' && !town.deposit) fail(`${town.name} has no deposit`)
  const cost = spec.cost[a.level - 1]
  pay(s, p, cost)
  p.stock[a.kind]--
  s.plots[a.town][a.slot] = {
    owner: p.id,
    kind: a.kind,
    level: a.level,
    deposit: a.kind === 'mine' ? town.deposit : undefined,
    goods: {},
  }
  s.fx.push({ kind: 'build', town: a.town, slot: a.slot, who: p.id, upgrade: false })
  const what = a.kind === 'mine' ? `${town.deposit} mine` : kindName(a.kind)
  log(s, `${p.name} built a level ${roman(a.level)} ${what} in ${town.name} (${cost} marks).`, p.id)
}

function doRoute(s: GameState, p: Player, linkId: string): void {
  const l = LINK_BY_ID.get(linkId)
  if (!l) fail('No such link')
  if (s.links[linkId]) fail('That link is already owned')
  if (l.kind === 'land' && s.age < 2) fail('Land links (rail) open in Age II')
  const net = network(s, p.id)
  if (net.size && !net.has(l.a) && !net.has(l.b)) fail('The link must touch your network')
  const cost = linkCost(s, linkId)
  pay(s, p, cost.money)
  if (cost.coal) {
    const end = net.has(l.a) ? l.a : net.has(l.b) ? l.b : l.a
    for (let i = 0; i < cost.coal; i++) takeUnit(s, p, 'coal', end, true)
  }
  s.links[linkId] = p.id
  s.fx.push({ kind: 'route', link: linkId, who: p.id })
  log(s, `${p.name} opened the ${l.kind === 'river' ? 'river' : 'rail'} link ${TOWN_BY_ID.get(l.a)!.name}–${TOWN_BY_ID.get(l.b)!.name}.`, p.id)
}

function doRun(s: GameState, p: Player, town: string, slot: number): void {
  const b = s.plots[town]?.[slot]
  if (!b || b.owner !== p.id) fail('Not your building')
  const name = TOWN_BY_ID.get(town)!.name
  const room = () => STORAGE_CAP - goodsCount(b.goods)
  if (b.kind === 'mine') {
    const n = Math.min(BUILDINGS.mine.output[b.level - 1], room())
    if (n <= 0) fail('The mine is full; sell or deliver first')
    b.goods[b.deposit!] = (b.goods[b.deposit!] ?? 0) + n
    s.fx.push({ kind: 'produce', town, slot, good: b.deposit!, n })
    log(s, `${p.name}'s mine in ${name} raised ${n} ${b.deposit}.`, p.id)
    return
  }
  const recipe = RECIPES[b.kind]
  const max = BUILDINGS[b.kind].output[b.level - 1]
  let made = 0
  let reason = ''
  for (let i = 0; i < max && room() > 0; i++) {
    const snap = clone(s)
    try {
      for (const g of GOODS) for (let k = 0; k < (recipe.in[g] ?? 0); k++) takeUnit(s, p, g, town, true)
      const bb = s.plots[town][slot]!
      bb.goods[recipe.out] = (bb.goods[recipe.out] ?? 0) + 1
      made++
    } catch (e) {
      if (!(e instanceof RuleError)) throw e
      Object.assign(s, snap)
      reason = e.message
      break
    }
  }
  if (!made) fail(reason || 'The building is full')
  const bb = s.plots[town][slot]!
  if (recipe.out === 'bronze') player(s, p.id).stats.bronze += made
  s.fx.push({ kind: 'produce', town, slot, good: recipe.out, n: made })
  log(s, `${p.name}'s ${kindName(bb.kind)} in ${name} made ${made} ${goodName(recipe.out)}.`, p.id)
}

function doDeliver(s: GameState, p: Player, id: string): void {
  const idx = s.contracts.findIndex((c) => c.id === id)
  if (idx < 0) fail('That contract is gone')
  const c = s.contracts[idx]
  for (const g of GOODS) for (let k = 0; k < (c.wants[g] ?? 0); k++) takeUnit(s, p, g, c.town, false)
  const pp = player(s, p.id)
  pp.money += c.money
  addVP(s, pp, c.vp, 'Contracts')
  pp.stats.contracts++
  pp.stats.machines += c.wants.machine ?? 0
  s.contracts.splice(idx, 1)
  dealContracts(s)
  s.fx.push({ kind: 'deliver', contract: c, who: p.id })
  log(s, `${p.name} delivered ${goodsLabel(c.wants)} to ${TOWN_BY_ID.get(c.town)!.name} for ${c.money} marks and ${c.vp} glory.`, p.id)
}

function doTrade(s: GameState, p: Player, g: Good, qty: number): void {
  if (!Number.isInteger(qty) || qty < 1) fail('Sell at least one')
  let earned = 0
  for (let i = 0; i < qty; i++) {
    let best: { town: string; slot: number; info: PathInfo } | null = null
    for (const o of buildingsOf(s, p.id)) {
      if (!(o.b.goods[g] ?? 0)) continue
      const info = findPath(s, p.id, o.town, isPort)
      if (info && (!best || info.toll < best.info.toll)) best = { town: o.town, slot: o.slot, info }
    }
    if (!best) fail(i ? 'No more to sell' : `You have no ${g} connected to a port`)
    payTolls(s, p, best.info)
    s.plots[best.town][best.slot]!.goods[g]!--
    const amt = price(s, g)
    p.money += amt
    earned += amt
    s.priceIdx[g] = Math.max(0, s.priceIdx[g] - 1)
    s.fx.push({ kind: 'move', good: g, path: best.info.path, from: best.town, to: 'exchange', who: p.id })
  }
  s.fx.push({ kind: 'trade', good: g, n: qty, earned, who: p.id })
  log(s, `${p.name} sold ${qty} ${goodName(g)} to the exchange for ${earned} marks.`, p.id)
}

// --------------------------------------------------------------- enumeration

/** Every legal action for the current player (used by the AI and UI hints). */
export function legalActions(s: GameState, pid: string): Action[] {
  const cur = currentPlayer(s)
  if (!cur || cur.id !== pid) return []
  const p = cur
  const net = network(s, pid)
  const reachNet = reach(net)
  const cands: Action[] = []
  for (const t of TOWNS) {
    if (!t.plots) continue
    s.plots[t.id].forEach((b, slot) => {
      for (let lv = 1 as Level; lv <= Math.min(3, s.age); lv = (lv + 1) as Level) {
        if (b) {
          if (b.owner === pid && lv > b.level) cands.push({ type: 'build', town: t.id, slot, kind: b.kind, level: lv })
        } else if (!net.size || reachNet.has(t.id)) {
          if (t.deposit) cands.push({ type: 'build', town: t.id, slot, kind: 'mine', level: lv })
          cands.push({ type: 'build', town: t.id, slot, kind: 'smelter', level: lv })
          cands.push({ type: 'build', town: t.id, slot, kind: 'works', level: lv })
        }
      }
    })
  }
  for (const l of LINKS) if (!s.links[l.id]) cands.push({ type: 'route', link: l.id })
  for (const o of buildingsOf(s, pid)) cands.push({ type: 'run', town: o.town, slot: o.slot })
  for (const c of s.contracts) cands.push({ type: 'deliver', contract: c.id })
  const held: Goods = {}
  for (const o of buildingsOf(s, pid)) for (const g of GOODS) held[g] = (held[g] ?? 0) + (o.b.goods[g] ?? 0)
  for (const g of GOODS) {
    const n = held[g] ?? 0
    if (n) for (const q of new Set([1, Math.ceil(n / 2), n])) cands.push({ type: 'trade', good: g, qty: q })
  }
  if (p.bonds < MAX_BONDS) cands.push({ type: 'bond' })
  cands.push({ type: 'wait' })
  return cands.filter((a) => check(s, pid, a) === null)
}

export function describe(s: GameState, a: Action): string {
  switch (a.type) {
    case 'build': return `Build ${a.kind} ${roman(a.level)} in ${TOWN_BY_ID.get(a.town)!.name}`
    case 'route': {
      const l = LINK_BY_ID.get(a.link)!
      return `Open ${l.kind} link ${TOWN_BY_ID.get(l.a)!.name}–${TOWN_BY_ID.get(l.b)!.name}`
    }
    case 'run': return `Run ${s.plots[a.town][a.slot]?.kind ?? 'building'} in ${TOWN_BY_ID.get(a.town)!.name}`
    case 'deliver': {
      const c = s.contracts.find((x) => x.id === a.contract)
      return c ? `Deliver ${goodsLabel(c.wants)} to ${TOWN_BY_ID.get(c.town)!.name}` : 'Deliver'
    }
    case 'trade': return `Sell ${a.qty} ${a.good}`
    case 'bond': return `Issue a bond (+${BOND_AMOUNT} marks)`
    case 'wait': return 'Wait'
  }
}

/** Towns you may build in: your network plus every town one link away. */
export function reach(net: Set<string>): Set<string> {
  const out = new Set(net)
  for (const t of net) for (const l of ADJ.get(t) ?? []) out.add(l.a === t ? l.b : l.a)
  return out
}

/** Display names used in log text. */
export function goodName(g: Good): string {
  return g === 'machine' ? 'arms' : g
}
export function kindName(k: BuildingKind): string {
  return k === 'works' ? 'forge' : k
}
