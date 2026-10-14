// BRONZE rule engine — structure follows the published rules of a well-known Midlands industrial board game.
// Source of truth: Roxley rulebook (rounds by player count, first-round
// single action, spend-based turn order, 8-card hands, mandatory discards,
// industry supply mats with lowest-tile builds, Network/Develop/Sell/Loan/
// Scout, era scoring & cleanup). The UI queries; it never decides.

import { coalPrice, ironPrice, COAL_MARKET_START, IRON_MARKET_START } from '../data/tiles'
export { coalPrice, ironPrice }

export type IndustryType = 'coal' | 'iron' | 'cotton' | 'manufacturer' | 'pottery' | 'brewery'
export type Era = 'canal' | 'rail'
export type CityKind = 'city' | 'merchant' | 'farm-brewery'
export type CardKind = 'location' | 'wild-location' | 'wild-industry'

export interface CityDef {
  id: string
  name: string
  x: number
  z: number
  slots: number
  merchant: boolean
  kind: CityKind
  /** Label placement tweaks (world units) — nodes never move, only labels. */
  lx?: number
  ly?: number
  /** Label prominence scale (1 = full). */
  lp?: number
  /** Official scoring: a TOWN adjacent to a link scores 1 VP, a CITY 2 VP. */
  town?: boolean
}

export const CITIES: CityDef[] = [
  { id: 'stoke', name: 'Stoke-on-Trent', x: -3.8, z: -7.5, slots: 3, merchant: false, kind: 'city', lp: 1.05 },
  { id: 'leek', name: 'Leek', x: -1.2, z: -9.0, slots: 2, merchant: false, kind: 'city', lp: 0.82 , town: true },
  { id: 'stone', name: 'Stone', x: -4.3, z: -5.0, slots: 2, merchant: true, kind: 'city', lp: 0.8 , town: true },
  { id: 'uttoxeter', name: 'Uttoxeter', x: 0.3, z: -6.0, slots: 2, merchant: false, kind: 'city', lp: 0.78 , town: true },
  { id: 'belper', name: 'Belper', x: 3.8, z: -8.5, slots: 2, merchant: false, kind: 'city', lp: 0.78 , town: true },
  { id: 'derby', name: 'Derby', x: 5.8, z: -9.0, slots: 3, merchant: false, kind: 'city', lp: 1.02 },
  { id: 'burton', name: 'Burton-on-Trent', x: 2.8, z: -4.5, slots: 2, merchant: false, kind: 'city', lp: 0.84, lx: 0.15, ly: 1.12 , town: true },
  { id: 'stafford', name: 'Stafford', x: -5.8, z: -3.0, slots: 2, merchant: false, kind: 'city', lp: 0.88 },
  { id: 'cannock', name: 'Cannock', x: -2.8, z: -1.5, slots: 2, merchant: false, kind: 'city', lp: 0.85, lx: -0.35, ly: 1.18 , town: true },
  { id: 'fbwest', name: 'Farm Brewery', x: -5.4, z: -0.9, slots: 1, merchant: false, kind: 'farm-brewery', lp: 0.6, lx: 1.45, ly: 0.1 },
  { id: 'shrewsbury', name: 'Shrewsbury', x: -8.8, z: 0.1, slots: 0, merchant: true, kind: 'merchant', lp: 0.7 },
  { id: 'coalbrookdale', name: 'Coalbrookdale', x: -7.3, z: 2.0, slots: 3, merchant: false, kind: 'city', lp: 0.92, ly: 1.25 , town: true },
  { id: 'wolverhampton', name: 'Wolverhampton', x: -2.3, z: 1.3, slots: 2, merchant: false, kind: 'city', lp: 0.95, lx: -0.4, ly: 1.22 },
  { id: 'walsall', name: 'Walsall', x: -0.3, z: -0.2, slots: 1, merchant: false, kind: 'city', lp: 0.8, lx: 0.15, ly: -0.95 , town: true },
  { id: 'dudley', name: 'Dudley', x: -3.3, z: 3.1, slots: 2, merchant: false, kind: 'city', lp: 0.85, ly: 1.2 , town: true },
  { id: 'kidderminster', name: 'Kidderminster', x: -5.3, z: 4.5, slots: 2, merchant: false, kind: 'city', lp: 0.86, ly: 1.2 , town: true },
  { id: 'fbeast', name: 'Farm Brewery', x: -4.1, z: 5.7, slots: 1, merchant: false, kind: 'farm-brewery', lp: 0.6, lx: 1.55, ly: -0.05 },
  { id: 'worcester', name: 'Worcester', x: -2.8, z: 6.5, slots: 2, merchant: true, kind: 'city', lp: 0.9, lx: 0.3, ly: 1.2 },
  { id: 'gloucester', name: 'Gloucester', x: -6.3, z: 9.0, slots: 0, merchant: true, kind: 'merchant', lp: 0.72 },
  { id: 'birmingham', name: 'Birmingham', x: 1.8, z: 1.7, slots: 3, merchant: false, kind: 'city', lp: 1.12, lx: 0.35, ly: 1.3 },
  { id: 'tamworth', name: 'Tamworth', x: 1.8, z: -2.0, slots: 1, merchant: false, kind: 'city', lp: 0.78, ly: 1.15 , town: true },
  { id: 'nuneaton', name: 'Nuneaton', x: 6.8, z: 0.0, slots: 1, merchant: false, kind: 'city', lp: 0.78, ly: 1.15 , town: true },
  { id: 'coventry', name: 'Coventry', x: 8.8, z: 2.0, slots: 3, merchant: false, kind: 'city', lp: 1.05, ly: 1.28 },
  { id: 'redditch', name: 'Redditch', x: 3.8, z: 4.5, slots: 1, merchant: false, kind: 'city', lp: 0.8, ly: 1.15 , town: true },
  { id: 'oxford', name: 'Oxford', x: 9.3, z: 8.0, slots: 0, merchant: true, kind: 'merchant', lp: 0.75 },
  { id: 'warrington', name: 'Warrington', x: -11.2, z: -9.2, slots: 0, merchant: true, kind: 'merchant', lp: 0.68 },
  { id: 'nottingham', name: 'Nottingham', x: 10.4, z: -6.8, slots: 0, merchant: true, kind: 'merchant', lp: 0.7 },
]

export const CITY_BY_ID: Map<string, CityDef> = new Map(CITIES.map((c) => [c.id, c]))

export interface LinkDef {
  id: string
  a: string
  b: string
  era: Era
}

function link(a: string, b: string, era: Era): LinkDef {
  return { id: `${a}~${b}`, a, b, era }
}

export const LINKS: LinkDef[] = [
  link('warrington', 'stone', 'canal'),
  link('nottingham', 'derby', 'rail'),
  link('stafford', 'stone', 'canal'),
  link('stone', 'stoke', 'canal'),
  link('stoke', 'leek', 'canal'),
  link('stone', 'uttoxeter', 'canal'),
  link('stafford', 'wolverhampton', 'canal'),
  link('stafford', 'cannock', 'canal'),
  link('cannock', 'fbwest', 'canal'),
  link('wolverhampton', 'walsall', 'canal'),
  link('walsall', 'birmingham', 'canal'),
  link('wolverhampton', 'dudley', 'canal'),
  link('dudley', 'birmingham', 'canal'),
  link('coalbrookdale', 'shrewsbury', 'canal'),
  link('coalbrookdale', 'dudley', 'canal'),
  link('kidderminster', 'coalbrookdale', 'canal'),
  link('kidderminster', 'worcester', 'canal'),
  link('birmingham', 'redditch', 'canal'),
  link('kidderminster', 'birmingham', 'canal'),
  link('worcester', 'gloucester', 'canal'),
  link('coventry', 'birmingham', 'canal'),
  link('nuneaton', 'coventry', 'canal'),
  link('tamworth', 'nuneaton', 'canal'),
  link('oxford', 'redditch', 'canal'),
  link('stoke', 'uttoxeter', 'rail'),
  link('uttoxeter', 'derby', 'rail'),
  link('belper', 'derby', 'rail'),
  link('burton', 'derby', 'rail'),
  link('burton', 'tamworth', 'rail'),
  link('tamworth', 'walsall', 'rail'),
  link('walsall', 'birmingham', 'rail'),
  link('cannock', 'walsall', 'rail'),
  link('wolverhampton', 'coalbrookdale', 'rail'),
  link('stafford', 'shrewsbury', 'rail'),
  link('kidderminster', 'birmingham', 'rail'),
  link('worcester', 'oxford', 'rail'),
  link('oxford', 'birmingham', 'rail'),
  link('coventry', 'birmingham', 'rail'),
  link('coventry', 'nuneaton', 'rail'),
  link('redditch', 'birmingham', 'rail'),
]

export const LINK_BY_ID: Map<string, LinkDef> = new Map(LINKS.map((l) => [l.id, l]))

export const MAP_AUDIT_EXPECTED = {
  locations: CITIES.length,
  merchants: CITIES.filter((c) => c.kind === 'merchant').length,
  canal: LINKS.filter((l) => l.era === 'canal').length,
  rail: LINKS.filter((l) => l.era === 'rail').length,
  slots: CITIES.reduce((n, c) => n + c.slots, 0),
}

export interface Cost {
  money: number
  iron: number
  beer: number
}

export interface IndustrySpec {
  cost: Cost
  vp: number
  income: number
  grant?: { coal?: number; iron?: number; beer?: number }
  sellable?: boolean
  railOnly?: boolean
  networkRequired?: boolean
}

export const INDUSTRY_SPEC: Record<IndustryType, IndustrySpec[]> = {
  coal: [
    { cost: { money: 5, iron: 1, beer: 0 }, vp: 1, income: 1, grant: { coal: 1 }, networkRequired: false },
    { cost: { money: 7, iron: 1, beer: 0 }, vp: 2, income: 2, grant: { coal: 2 }, networkRequired: false },
  ],
  iron: [
    { cost: { money: 6, iron: 0, beer: 0 }, vp: 2, income: 1, grant: { iron: 1 }, networkRequired: false },
    { cost: { money: 9, iron: 0, beer: 0 }, vp: 3, income: 2, grant: { iron: 2 }, networkRequired: false },
  ],
  cotton: [
    { cost: { money: 12, iron: 0, beer: 0 }, vp: 5, income: 0, sellable: true, networkRequired: false },
    { cost: { money: 16, iron: 0, beer: 0 }, vp: 8, income: 0, sellable: true, networkRequired: false },
  ],
  manufacturer: [
    { cost: { money: 14, iron: 1, beer: 0 }, vp: 4, income: 0, sellable: true, networkRequired: false },
    { cost: { money: 18, iron: 1, beer: 0 }, vp: 6, income: 0, sellable: true, networkRequired: false },
  ],
  pottery: [
    { cost: { money: 16, iron: 0, beer: 1 }, vp: 5, income: 0, sellable: true, railOnly: true, networkRequired: false },
    { cost: { money: 20, iron: 0, beer: 1 }, vp: 7, income: 0, sellable: true, networkRequired: false },
  ],
  brewery: [
    { cost: { money: 10, iron: 0, beer: 0 }, vp: 4, income: 1, grant: { beer: 1 }, networkRequired: true },
    { cost: { money: 12, iron: 0, beer: 0 }, vp: 5, income: 2, grant: { beer: 2 }, networkRequired: true },
  ],
}

// Player-mat industry supply (tile counts per player, level-tiered).
export const SUPPLY_TEMPLATE: Record<IndustryType, { l1: number; l2: number }> = {
  coal: { l1: 4, l2: 3 },
  iron: { l1: 2, l2: 2 },
  cotton: { l1: 6, l2: 5 },
  manufacturer: { l1: 6, l2: 5 },
  pottery: { l1: 2, l2: 3 },
  brewery: { l1: 4, l2: 3 },
}

export const HAND_LIMIT = 8

export function roundsPerEra(players: number): number {
  return players >= 4 ? 8 : players === 3 ? 9 : 10
}

export interface Card {
  id: string
  cityId: string | null // null for wilds / industry cards
  kind: CardKind
  industry?: IndustryType
}

export interface PlacedIndustry {
  key: string
  cityId: string
  slot: number
  kind: IndustryType
  level: 1 | 2
  ownerId: string
  flipped: boolean
  scored: boolean
  resources: number
}

export type AIPersonality = 'industrialist' | 'network-builder' | 'opportunist' | 'aggressive'
export type AIDifficulty = 'easy' | 'normal' | 'hard'

export interface SeatSpec {
  name: string
  isAI: boolean
  personality?: AIPersonality
  difficulty?: AIDifficulty
}

export interface PlayerState {
  id: string
  name: string
  colorHex: number
  css: string
  money: number
  spent: number
  income: number
  vp: number
  coal: number
  iron: number
  beer: number
  hand: Card[]
  developLeft: number
  actionsLeft: number
  supply: Record<IndustryType, { l1: number; l2: number }>
  isAI: boolean
  personality?: AIPersonality
  difficulty?: AIDifficulty
  vpBuilds: number
  vpSells: number
  linksBuilt: number
  vpCanalEnd: number
}

export interface LogEntry {
  text: string
  tone?: 'brass' | 'event'
}

export interface GameState {
  players: PlayerState[]
  order: string[]
  turnIdx: number
  round: number
  era: Era
  placed: PlacedIndustry[]
  linksOwned: Record<string, string>
  log: LogEntry[]
  over: boolean
  deck: Card[]
  discard: Card[]
  wildLocPool: number
  wildIndPool: number
  seed: number
  dealRandom: () => number
  doubleRailArmed: boolean
  pendingDoubleLink: string | null
  /** One-time merchant bonuses, keyed by merchant id. */
  merchantBonusUsed: Record<string, string>
  /** Units of coal / iron sitting in the shared market. */
  coalMarket: number
  ironMarket: number
}

let cardSeq = 0

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildDeck(players: number, rand: () => number): Card[] {
  // Location cards scale with player count; wilds live in their own pools.
  const copies = players <= 2 ? 2 : players === 3 ? 3 : 3
  const deck: Card[] = []
  for (const c of CITIES) {
    if (c.slots === 0 && c.kind === 'merchant') continue
    for (let i = 0; i < Math.max(1, copies - (c.slots <= 1 ? 1 : 0)); i++) {
      deck.push({ id: `card${cardSeq++}`, cityId: c.id, kind: 'location' })
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export function createInitialGameState(seats?: SeatSpec[], seed?: number): GameState {
  return createState(seats, seed)
}

export function createState(seats?: SeatSpec[], seed?: number): GameState {
  cardSeq = 0
  const rand = seed !== undefined ? mulberry32(seed) : Math.random
  const specs: SeatSpec[] =
    seats && seats.length >= 2
      ? seats.slice(0, 4)
      : [
          { name: 'Alex', isAI: false },
          { name: 'Jordan', isAI: false },
          { name: 'Sam', isAI: false },
        ]
  const baseCols = [0xc79a3f, 0x8e3b34, 0x476c7a, 0x5a7444]
  const cssCols = ['#c79a3f', '#8e3b34', '#476c7a', '#5a7444']
  const startMoney = [17, 17, 21, 24][specs.length - 1] ?? 17
  const players: PlayerState[] = specs.map((sp, i) => ({
    id: `p${i + 1}`,
    name: sp.name,
    colorHex: baseCols[i],
    css: cssCols[i],
    money: startMoney,
    spent: 0,
    income: 0,
    vp: 0,
    coal: 0,
    iron: 0,
    beer: 0,
    hand: [],
    developLeft: 2,
    actionsLeft: 1, // first Canal round: one action each
    supply: JSON.parse(JSON.stringify(SUPPLY_TEMPLATE)),
    isAI: sp.isAI,
    personality: sp.personality,
    difficulty: sp.difficulty,
    vpBuilds: 0,
    vpSells: 0,
    linksBuilt: 0,
    vpCanalEnd: 0,
  }))
  const state: GameState = {
    players,
    order: players.map((p) => p.id),
    turnIdx: 0,
    round: 1,
    era: 'canal',
    placed: [],
    linksOwned: {},
    log: [],
    over: false,
    deck: [],
    discard: [],
    wildLocPool: 4,
    wildIndPool: 4,
    seed: seed ?? -1,
    dealRandom: rand,
    doubleRailArmed: false,
    pendingDoubleLink: null,
    merchantBonusUsed: {},
    coalMarket: COAL_MARKET_START,
    ironMarket: IRON_MARKET_START,
  }
  state.deck = buildDeck(players.length, rand)
  for (const p of players) refillHand(state, p)
  // Official setup: first-round seating is drawn, not creation order.
  // Seeded so RESET reproduces the exact same deal + order.
  for (let i = s_orderLen(players) - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[players[i], players[j]] = [players[j], players[i]]
  }
  s_orderReassign(state, players)
  addLog(state, `The Midlands survey opens — ${players.length} industrialists, Canal Era.`)
  addLog(state, 'First round: one action each.', 'event')
  return state
}

function s_orderLen(players: PlayerState[]): number {
  return players.length
}
function s_orderReassign(state: GameState, players: PlayerState[]): void {
  state.players = players
  state.order = players.map((p) => p.id)
}

// ------------------------------ Cards --------------------------------------

function drawOne(s: GameState): Card | null {
  if (s.deck.length === 0) {
    if (s.discard.length === 0) return null
    s.deck = s.discard
    s.discard = []
    for (let i = s.deck.length - 1; i > 0; i--) {
      const j = Math.floor(s.dealRandom() * (i + 1))
      ;[s.deck[i], s.deck[j]] = [s.deck[j], s.deck[i]]
    }
    addLog(s, 'The discard pile is shuffled into the draw deck.', 'event')
  }
  return s.deck.pop() ?? null
}

export function refillHand(s: GameState, p: PlayerState): void {
  while (p.hand.length < HAND_LIMIT) {
    const c = drawOne(s)
    if (!c) break
    p.hand.push(c)
  }
}

// Every action consumes one card. Auto-discards use the leftmost non-wild.
function discardForAction(s: GameState, p: PlayerState, specificId?: string): string | null {
  let card: Card | undefined
  if (specificId) card = p.hand.find((c) => c.id === specificId)
  if (!card) card = p.hand.find((c) => c.kind === 'location') ?? p.hand[0]
  if (!card) return 'No card to discard.'
  p.hand = p.hand.filter((c) => c.id !== card!.id)
  if (card.kind !== 'wild-location' && card.kind !== 'wild-industry') s.discard.push(card)
  // Wilds return to their pools when discarded, per the rules.
  else if (card.kind === 'wild-location') s.wildLocPool++
  else s.wildIndPool++
  return null
}

// ------------------------------ Queries ------------------------------------

export function currentPlayer(s: GameState): PlayerState {
  return s.players.find((p) => p.id === s.order[s.turnIdx])!
}

export function playerById(s: GameState, id: string): PlayerState {
  return s.players.find((p) => p.id === id)!
}

export function addLog(s: GameState, text: string, tone?: LogEntry['tone']): void {
  s.log.push({ text, tone })
  if (s.log.length > 80) s.log.shift()
}

export function industriesAt(s: GameState, cityId: string): PlacedIndustry[] {
  return s.placed.filter((t) => t.cityId === cityId)
}

export function freeSlot(s: GameState, cityId: string): number | null {
  const city = CITY_BY_ID.get(cityId)
  if (!city) return null
  const used = new Set(industriesAt(s, cityId).map((t) => t.slot))
  for (let i = 0; i < city.slots; i++) if (!used.has(i)) return i
  return null
}

function lowestAvailableLevel(p: PlayerState, kind: IndustryType): 1 | 2 | null {
  const sup = p.supply[kind]
  if (sup.l1 > 0) return 1
  if (sup.l2 > 0) return 2
  return null
}

/** Locations reachable from the player's empire via ANY built links. */
function networkCitiesOf(s: GameState, playerId: string): Set<string> {
  const own = new Set<string>()
  for (const t of s.placed) if (t.ownerId === playerId) own.add(t.cityId)
  for (const l of LINKS) if (s.linksOwned[l.id] === playerId) {
    own.add(l.a)
    own.add(l.b)
  }
  // Expand across all built links (any owner).
  const seen = new Set(own)
  let grew = true
  while (grew) {
    grew = false
    for (const l of LINKS) {
      if (!s.linksOwned[l.id]) continue
      if (seen.has(l.a) && !seen.has(l.b)) {
        seen.add(l.b)
        grew = true
      } else if (seen.has(l.b) && !seen.has(l.a)) {
        seen.add(l.a)
        grew = true
      }
    }
  }
  return seen
}


// --------------------------- Coal / iron market ----------------------------
// Mines and works hold their resources on the tile. Building one sells what
// fits into the shared market for money. Buying draws from connected tiles
// first (coal) or any tile (iron), then from the market at its current price;
// an empty market still sells at the top price. Coal from the market needs a
// connection to a merchant.

export const COAL_MARKET_MAX = 14
export const IRON_MARKET_MAX = 10

type ResKind = 'coal' | 'iron'

function spanFrom(s: GameState, cities: string[]): Map<string, number> {
  const dist = new Map<string, number>()
  for (const c of cities) dist.set(c, 0)
  const queue = [...cities]
  while (queue.length) {
    const cur = queue.shift()!
    for (const l of LINKS) {
      if (!s.linksOwned[l.id]) continue
      const next = l.a === cur ? l.b : l.b === cur ? l.a : null
      if (next && !dist.has(next)) {
        dist.set(next, dist.get(cur)! + 1)
        queue.push(next)
      }
    }
  }
  return dist
}

function resourceTiles(s: GameState, kind: ResKind, within?: Map<string, number>): PlacedIndustry[] {
  return s.placed.filter(
    (t) => t.kind === kind && !t.flipped && t.resources > 0 && (!within || within.has(t.cityId)),
  )
}

export function resourceOnBoard(s: GameState, kind: ResKind): number {
  return resourceTiles(s, kind).reduce((n, t) => n + t.resources, 0)
}

function marketBuyCost(units: number, market: number, price: (n: number) => number): number {
  let m = market
  let total = 0
  for (let i = 0; i < units; i++) {
    total += price(m)
    if (m > 0) m--
  }
  return total
}

export interface ResourcePlan {
  tiles: number
  market: number
  money: number
}

/** Cost of getting `n` coal for something happening at `cities`, or null if impossible. */
export function coalPlan(s: GameState, cities: string[], n: number): ResourcePlan | null {
  if (n <= 0) return { tiles: 0, market: 0, money: 0 }
  const reach = spanFrom(s, cities)
  const onTiles = resourceTiles(s, 'coal', reach).reduce((a, t) => a + t.resources, 0)
  const tiles = Math.min(n, onTiles)
  const market = n - tiles
  if (market > 0 && ![...reach.keys()].some((id) => CITY_BY_ID.get(id)?.merchant)) return null
  return { tiles, market, money: marketBuyCost(market, s.coalMarket, coalPrice) }
}

/** Cost of getting `n` iron (any tile on the board, then the market). */
export function ironPlan(s: GameState, n: number): ResourcePlan {
  if (n <= 0) return { tiles: 0, market: 0, money: 0 }
  const tiles = Math.min(n, resourceOnBoard(s, 'iron'))
  const market = n - tiles
  return { tiles, market, money: marketBuyCost(market, s.ironMarket, ironPrice) }
}

function flipIfEmpty(t: PlacedIndustry): void {
  if (t.resources <= 0) t.flipped = true
}

/** Removes the resources a plan promised. Money is the caller's to charge. */
function consumeResource(
  s: GameState,
  kind: ResKind,
  playerId: string,
  cities: string[],
  plan: ResourcePlan,
): void {
  let need = plan.tiles
  const dist = kind === 'coal' ? spanFrom(s, cities) : undefined
  const sources = resourceTiles(s, kind, dist).sort((a, b) => {
    const da = dist ? dist.get(a.cityId)! : a.ownerId === playerId ? 0 : 1
    const db = dist ? dist.get(b.cityId)! : b.ownerId === playerId ? 0 : 1
    return da - db
  })
  for (const t of sources) {
    if (need <= 0) break
    const take = Math.min(need, t.resources)
    t.resources -= take
    need -= take
    flipIfEmpty(t)
  }
  if (kind === 'coal') s.coalMarket = Math.max(0, s.coalMarket - plan.market)
  else s.ironMarket = Math.max(0, s.ironMarket - plan.market)
}

/** A fresh mine/works moves what fits into the market and is paid for it. */
function sellToMarket(s: GameState, p: PlayerState, t: PlacedIndustry): void {
  if (t.kind !== 'coal' && t.kind !== 'iron') return
  const isCoal = t.kind === 'coal'
  let sold = 0
  let earned = 0
  while (t.resources > 0 && (isCoal ? s.coalMarket < COAL_MARKET_MAX : s.ironMarket < IRON_MARKET_MAX)) {
    if (isCoal) s.coalMarket++
    else s.ironMarket++
    earned += isCoal ? coalPrice(s.coalMarket) : ironPrice(s.ironMarket)
    t.resources--
    sold++
  }
  if (sold > 0) {
    p.money += earned
    addLog(s, `${p.name} sold ${sold} ${t.kind} to the market (+£${earned}).`)
  }
  flipIfEmpty(t)
}

/** Coal and iron on a player's own tiles (for the HUD). */
export function syncResources(s: GameState): void {
  for (const p of s.players) {
    const own = (kind: ResKind) =>
      s.placed
        .filter((t) => t.ownerId === p.id && t.kind === kind && !t.flipped)
        .reduce((n, t) => n + t.resources, 0)
    p.coal = own('coal')
    p.iron = own('iron')
  }
}

/** Money needed beyond the printed price to supply `n` iron. */
export function ironCost(s: GameState, n: number): number {
  return ironPlan(s, n).money
}

export interface BuildOption {
  cardId: string
  cityId: string
  kind: IndustryType
  level: 1 | 2
  cost: Cost
  spec: IndustrySpec
  inNetwork: boolean
  /** Set when this build legally OVERBUILDS the player's own tile. */
  overbuildKey?: string
}

export function getLegalCards(s: GameState, playerId: string): Card[] {
  void s
  return playerById(s, playerId).hand
}

export function canBuildWithCard(s: GameState, playerId: string, card: Card): BuildOption[] {
  const p = playerById(s, playerId)
  const net = networkCitiesOf(s, playerId)
  const out: BuildOption[] = []

  const tryCity = (cityId: string | null, kind: IndustryType): void => {
    const city = CITY_BY_ID.get(cityId ?? '')
    if (!city || city.slots === 0) return
    if (city.kind === 'farm-brewery' && kind !== 'brewery') return
    let slotIdx = freeSlot(s, cityId!)
    let overbuildKey: string | undefined
    if (slotIdx === null) {
      // Official overbuild: replace your OWN same-industry tile with a
      // higher level, paying the new tile's full cost.
      let own = s.placed.find(
        (t) => t.cityId === cityId && t.ownerId === playerId && t.kind === kind,
      )
      // Rivals' coal mines / iron works may be overbuilt once none is left on the board.
      if (!own && (kind === 'coal' || kind === 'iron') && resourceOnBoard(s, kind) === 0) {
        own = s.placed.find((t) => t.cityId === cityId && t.ownerId !== playerId && t.kind === kind)
      }
      const lvl = lowestAvailableLevel(p, kind)
      if (!own || !lvl || own.level >= lvl) return
      slotIdx = own.slot
      overbuildKey = own.key
    }
    const level = lowestAvailableLevel(p, kind)
    if (!level) return
    const spec = INDUSTRY_SPEC[kind][level - 1]
    if (spec.railOnly && s.era !== 'rail') return
    if (spec.networkRequired && !net.has(cityId!)) return
    const ironExtra = ironCost(s, spec.cost.iron)
    if (p.money < spec.cost.money + ironExtra || p.beer < spec.cost.beer) return
    out.push({
      cardId: card.id,
      cityId: cityId!,
      kind,
      level,
      cost: { ...spec.cost, money: spec.cost.money + ironExtra },
      spec,
      inNetwork: net.has(cityId!),
      overbuildKey,
    })
  }

  if (card.kind === 'wild-location') {
    for (const c of CITIES) {
      for (const kind of Object.keys(INDUSTRY_SPEC) as IndustryType[]) {
        tryCity(c.id, kind)
      }
    }
  } else if (card.kind === 'wild-industry') {
    // Wild Industry: any industry type in a location connected to your network.
    const kinds = card.industry ? [card.industry] : (Object.keys(INDUSTRY_SPEC) as IndustryType[])
    for (const cid of net) {
      for (const kind of kinds) tryCity(cid, kind)
    }
  } else {
    // Location card.
    for (const kind of Object.keys(INDUSTRY_SPEC) as IndustryType[]) {
      tryCity(card.cityId, kind)
    }
  }
  return out.sort((a, b) => a.cost.money - b.cost.money)
}

/** All buildable (card × city × lowest-level) options for UI trays/AI. */
export function allBuildOptions(s: GameState, playerId: string): BuildOption[] {
  const p = playerById(s, playerId)
  const out: BuildOption[] = []
  for (const card of p.hand) {
    for (const o of canBuildWithCard(s, playerId, card)) out.push(o)
  }
  return out
}

/** Back-compat: options restricted to one city (deduped by kind+level). */
export function buildOptionsForCity(s: GameState, playerId: string, cityId: string): BuildOption[] {
  const dedup = new Map<string, BuildOption>()
  for (const o of allBuildOptions(s, playerId)) {
    if (o.cityId !== cityId) continue
    dedup.set(`${o.kind}:${o.level}`, o)
  }
  return [...dedup.values()].sort((a, b) => a.cost.money - b.cost.money)
}

export function legalNetworkLinks(s: GameState, playerId: string): LinkDef[] {
  const p = playerById(s, playerId)
  const net = networkCitiesOf(s, playerId)
  const hasAnythingOnBoard =
    s.placed.some((t) => t.ownerId === playerId) ||
    Object.values(s.linksOwned).some((o) => o === playerId)
  return LINKS.filter((l) => {
    if (l.era !== s.era || s.linksOwned[l.id]) return false
    if (p.money < linkCost(s, l)) return false
    if (l.era === 'rail') {
      const cp = coalPlan(s, [l.a, l.b], 1)
      if (!cp || p.money < linkCost(s, l) + cp.money) return false
    }
    if (!hasAnythingOnBoard) return true
    return net.has(l.a) || net.has(l.b)
  })
}

export function linkCost(_s: GameState, l: LinkDef): number {
  void _s
  return l.era === 'canal' ? 3 : 5
}

/** Alias kept for existing call sites. */
export const legalLinks = legalNetworkLinks

export function canDoubleRail(s: GameState, playerId: string): boolean {
  if (s.era !== 'rail') return false
  const p = playerById(s, playerId)
  return (
    p.money >= 15 &&
    p.beer >= 1 &&
    legalNetworkLinks(s, playerId).length >= 2 &&
    hasBreweryOnNetwork(s, playerId)
  )
}

function hasBreweryOnNetwork(s: GameState, playerId: string): boolean {
  const net = networkCitiesOf(s, playerId)
  return s.placed.some(
    (t) => t.ownerId === playerId && t.kind === 'brewery' && net.has(t.cityId),
  )
}

export function connectedToMerchant(s: GameState, cityId: string): boolean {
  return reachableSet(s, cityId).size > 0
}

function reachableSet(s: GameState, cityId: string): Set<string> {
  const seen = new Set([cityId])
  let grew = true
  while (grew) {
    grew = false
    for (const l of LINKS) {
      if (!s.linksOwned[l.id]) continue
      if (seen.has(l.a) && !seen.has(l.b)) {
        seen.add(l.b)
        grew = true
      } else if (seen.has(l.b) && !seen.has(l.a)) {
        seen.add(l.a)
        grew = true
      }
    }
  }
  return seen
}

/** Official merchant bonuses, granted once per merchant per game on the
 *  first qualifying sale through that beacon. */
const MERCHANT_BONUS: Record<string, { vp?: number; money?: number; income?: number }> = {
  warrington: { money: 5 },
  nottingham: { vp: 2 },
  shrewsbury: { vp: 1 },
  gloucester: { income: 1 },
  oxford: { income: 2 },
}

/** Set of merchant location ids reachable from cityId via built links. */
function reachableMerchants(s: GameState, cityId: string): string[] {
  const out: string[] = []
  for (const id of reachableSet(s, cityId)) {
    const c = CITY_BY_ID.get(id)
    if (c?.kind === 'merchant') out.push(id)
  }
  return out
}

export function getLegalDevelopments(s: GameState, playerId: string): { kind: IndustryType; level: 1 | 2; iron: number }[] {
  const p = playerById(s, playerId)
  const out: { kind: IndustryType; level: 1 | 2; iron: number }[] = []
  for (const kind of Object.keys(SUPPLY_TEMPLATE) as IndustryType[]) {
    // Pottery may not be developed away during the Canal Era.
    if (kind === 'pottery' && s.era === 'canal') continue
    const lvl = lowestAvailableLevel(p, kind)
    if (!lvl) continue
    out.push({ kind, level: lvl, iron: 1 })
  }
  return out
}

export function sellableIndustries(s: GameState, playerId: string): PlacedIndustry[] {
  return s.placed.filter((t) => {
    if (t.ownerId !== playerId || t.flipped) return false
    const spec = INDUSTRY_SPEC[t.kind][t.level - 1]
    if (!spec.sellable) return false
    // Beer source: own connected brewery, own stock, or merchant beer —
    // the latter requires the industry's town to reach a merchant beacon.
    const net = networkCitiesOf(s, playerId)
    const ownBrewery = s.placed.some(
      (b) => b.ownerId === playerId && b.kind === 'brewery' && !b.flipped && net.has(b.cityId),
    )
    return connectedToMerchant(s, t.cityId) && (ownBrewery || playerById(s, playerId).beer >= 1 || true)
  })
}

export type ActionType =
  | 'BUILD'
  | 'NETWORK'
  | 'DEVELOP'
  | 'SELL'
  | 'LOAN'
  | 'SCOUT'
  | 'PASS'

export function legalActions(s: GameState, playerId: string): Record<ActionType, boolean> {
  const p = playerById(s, playerId)
  const holdsWild = p.hand.some((c) => c.kind.startsWith('wild'))
  const anyBuild = p.hand.some((c) => canBuildWithCard(s, playerId, c).length > 0)
  return {
    BUILD: anyBuild,
    NETWORK: legalNetworkLinks(s, playerId).length > 0,
    DEVELOP:
      p.developLeft > 0 && getLegalDevelopments(s, playerId).length > 0 && p.hand.length > 0,
    SELL: sellableIndustries(s, playerId).length > 0,
    LOAN: p.income - 3 >= -10 && p.hand.length > 0,
    SCOUT: !holdsWild && p.hand.length >= 3 && s.wildLocPool > 0 && s.wildIndPool > 0,
    PASS: p.hand.length > 0,
  }
}

// ------------------------------ Mutations ----------------------------------

function payFrom(p: PlayerState, c: Cost): void {
  p.money -= c.money
  p.spent += c.money
  p.beer -= c.beer
}

export function resolveBuild(
  s: GameState,
  playerId: string,
  cardId: string,
  cityId: string,
  kind: IndustryType,
): string | null {
  const p = playerById(s, playerId)
  const card = p.hand.find((c) => c.id === cardId)
  if (!card) return 'Choose one of your cards.'
  const option = canBuildWithCard(s, playerId, card).find(
    (o) => o.cityId === cityId && o.kind === kind,
  )
  if (!option) return 'That build is not legal with this card.'
  const level = option.level
  let slotIdx: number
  if (option.overbuildKey) {
    const old = s.placed.find((t) => t.key === option.overbuildKey)
    if (!old) return 'Overbuild target vanished.'
    slotIdx = old.slot
    s.placed = s.placed.filter((t) => t.key !== option.overbuildKey)
  } else {
    slotIdx = freeSlot(s, cityId)!
    if (Number.isNaN(slotIdx)) return 'No free industry slot there.'
  }

  const dErr = discardForAction(s, p, cardId)
  if (dErr) return dErr
  p.supply[kind][level === 1 ? 'l1' : 'l2']--
  consumeResource(s, 'iron', playerId, [], ironPlan(s, option.cost.iron))
  payFrom(p, option.cost)
  p.income += option.spec.income
  if (option.spec.grant?.beer) p.beer += option.spec.grant.beer
  const slot = slotIdx
  const placedTile: PlacedIndustry = {
    key: `${cityId}:${slot}`,
    cityId,
    slot,
    kind,
    level,
    ownerId: playerId,
    flipped: false,
    scored: false,
    resources:
      kind === 'coal' ? level + 1 : kind === 'iron' ? level + 1 : kind === 'brewery' ? level : 0,
  }
  s.placed.push(placedTile)
  sellToMarket(s, p, placedTile)
  syncResources(s)
  addLog(
    s,
    `${p.name} built ${labelOf(kind)} L${level} in ${CITY_BY_ID.get(cityId)!.name}.`,
    'brass',
  )
  void card
  return null
}

function labelOf(kind: IndustryType): string {
  switch (kind) {
    case 'coal': return 'a Coal Mine'
    case 'iron': return 'an Iron Works'
    case 'cotton': return 'a Cotton Mill'
    case 'manufacturer': return 'a Manufacturer'
    case 'pottery': return 'a Pottery'
    case 'brewery': return 'a Brewery'
  }
}

export function applyBuild(
  s: GameState,
  playerId: string,
  cardId: string,
  cityId: string,
  kind: IndustryType,
  _level: 1 | 2 = 1,
): string | null {
  void _level
  return resolveBuild(s, playerId, cardId, cityId, kind)
}

export function resolveNetwork(
  s: GameState,
  playerId: string,
  linkId: string,
  consumeCardId?: string,
): string | null {
  const l = LINK_BY_ID.get(linkId)
  if (!l) return 'Unknown route.'
  if (s.linksOwned[linkId]) return 'Route already built.'
  if (l.era !== s.era) return 'Wrong era for that route.'
  const p = playerById(s, playerId)
  const cost = linkCost(s, l)
  const coal = l.era === 'rail' ? coalPlan(s, [l.a, l.b], 1) : { tiles: 0, market: 0, money: 0 }
  if (!coal) return 'Rail links need coal: connect to a coal mine or a merchant.'
  if (p.money < cost + coal.money) return 'Not enough money.'
  if (!legalNetworkLinks(s, playerId).some((x) => x.id === linkId)) return 'That line is not connected to your network.'
  const dErr = discardForAction(s, p, consumeCardId)
  if (dErr) return dErr
  p.money -= cost + coal.money
  p.spent += cost + coal.money
  if (l.era === 'rail') consumeResource(s, 'coal', playerId, [l.a, l.b], coal)
  s.linksOwned[linkId] = playerId
  p.linksBuilt++
  addLog(s, `${p.name} connected ${CITY_BY_ID.get(l.a)!.name} → ${CITY_BY_ID.get(l.b)!.name}.`, 'brass')
  syncResources(s)
  return null
}

export function applyNetwork(
  s: GameState,
  playerId: string,
  linkId: string,
  consumeCardId?: string,
): string | null {
  return resolveNetwork(s, playerId, linkId, consumeCardId)
}

/** Rail Era special: two rails for £15 total, 2 coal, 1 brewery beer. */
export function applyNetworkDouble(
  s: GameState,
  playerId: string,
  linkA: string,
  linkB: string,
): string | null {
  if (s.era !== 'rail') return 'Double-rail is a Railway action.'
  const p = playerById(s, playerId)
  if (p.money < 15) return '£15 required.'
  if (!hasBreweryOnNetwork(s, playerId)) return 'The double-rail needs brewery beer on your network.'
  const la = LINK_BY_ID.get(linkA)
  const lb = LINK_BY_ID.get(linkB)
  if (!la || !lb) return 'Unknown route.'
  const ends = [la.a, la.b, lb.a, lb.b]
  const coal = coalPlan(s, ends, 2)
  if (!coal) return 'Two rails consume 2 coal: connect to a coal mine or a merchant.'
  if (p.money < 15 + coal.money) return `£${15 + coal.money} required.`
  const dErr = discardForAction(s, p)
  if (dErr) return dErr
  p.money -= 15 + coal.money
  p.spent += 15 + coal.money
  consumeResource(s, 'coal', playerId, ends, coal)
  p.beer -= 1
  for (const id of [linkA, linkB]) {
    const l = LINK_BY_ID.get(id)
    if (!l || s.linksOwned[id]) return 'Route already taken.'
    s.linksOwned[id] = playerId
    p.linksBuilt++
    addLog(s, `${p.name} connected ${CITY_BY_ID.get(l.a)!.name} → ${CITY_BY_ID.get(l.b)!.name}.`, 'brass')
  }
  syncResources(s)
  return null
}

export function resolveDevelop(
  s: GameState,
  playerId: string,
  kinds: IndustryType[],
): string | null {
  const p = playerById(s, playerId)
  if (kinds.length < 1 || kinds.length > 2) return 'Develop removes one or two industries.'
  if (p.developLeft <= 0) return 'No developments remain this era.'
  const ironNeeded = kinds.length
  const ironP = ironPlan(s, ironNeeded)
  if (p.money < ironP.money) return `Develop needs £${ironP.money} for iron.`
  const legal = getLegalDevelopments(s, playerId)
  for (const k of kinds) {
    if (!legal.some((d) => d.kind === k)) return `${labelOf(k)} cannot be developed now.`
  }
  const dErr = discardForAction(s, p)
  if (dErr) return dErr
  for (const k of kinds) {
    const lvl = lowestAvailableLevel(p, k)!
    p.supply[k][lvl === 1 ? 'l1' : 'l2']--
    p.developLeft--
  }
  consumeResource(s, 'iron', playerId, [], ironP)
  p.money -= ironP.money
  p.spent += ironP.money
  syncResources(s)
  addLog(s, `${p.name} developed ${kinds.length === 2 ? 'two industries' : 'an industry'} (${kinds.join(', ')}).`)
  return null
}

export function applyDevelop(
  s: GameState,
  playerId: string,
  industryKey: string,
): string | null {
  // Legacy board-click path: map an owned tile to its mat kind and remove it
  // visually by flipping the placed tile (kept for tactile interaction).
  const t = s.placed.find((x) => x.key === industryKey)
  if (t) {
    const err = resolveDevelop(s, playerId, [t.kind])
    if (err) return err
    t.flipped = true
    return null
  }
  return resolveDevelop(s, playerId, [])
}

export function sellValue(t: PlacedIndustry): number {
  return 5 + t.level * 5
}

export function resolveSell(s: GameState, playerId: string, industryKey: string): string | null {
  const targets = sellableIndustries(s, playerId)
  const t = targets.find((x) => x.key === industryKey)
  if (!t) return 'Nothing sellable there.'
  const p = playerById(s, playerId)
  const net = networkCitiesOf(s, playerId)
  const ownBeerOnNet = s.placed.some(
    (b) =>
      b.ownerId === playerId &&
      b.kind === 'brewery' &&
      !b.flipped &&
      net.has(b.cityId),
  )
  if (ownBeerOnNet) {
    // Consume beer from that connected brewery tile.
    const brew = s.placed.find(
      (b) => b.ownerId === playerId && b.kind === 'brewery' && !b.flipped && net.has(b.cityId),
    )!
    brew.resources = Math.max(0, brew.resources - 1)
    if (brew.resources === 0) {
      brew.flipped = true // last barrel leaves: the brewery flips
    }
  } else if (p.beer >= 1) {
    p.beer -= 1
  }
  const dErr = discardForAction(s, p)
  if (dErr) return dErr
  const gain = sellValue(t)
  const earnedVp = INDUSTRY_SPEC[t.kind][t.level - 1].vp
  // Official merchant interaction: with no connected brewery stock the sale
  // draws merchant beer — that beacon's one-time bonus then applies.
  let bonusText = ''
  if (!ownBeerOnNet) {
    for (const mid of reachableMerchants(s, t.cityId)) {
      if (s.merchantBonusUsed[mid]) continue
      s.merchantBonusUsed[mid] = playerId
      const b = MERCHANT_BONUS[mid]
      if (!b) continue
      p.vp += b.vp ?? 0
      p.money += b.money ?? 0
      p.income += b.income ?? 0
      bonusText =
        b.vp ? ` +${b.vp} VP` : b.money ? ` +£${b.money}` : ` +${b.income} income`
      break
    }
  }
  p.money += gain
  p.vp += earnedVp
  p.vpSells += earnedVp
  t.flipped = true
  addLog(
    s,
    `${p.name} sold goods in ${CITY_BY_ID.get(t.cityId)!.name} (+£${gain}, +${earnedVp} VP${bonusText}).`,
    'brass',
  )
  return null
}

export function applySell(s: GameState, playerId: string, industryKey: string): string | null {
  return resolveSell(s, playerId, industryKey)
}

export function resolveLoan(s: GameState, playerId: string): string | null {
  const p = playerById(s, playerId)
  if (p.income < -6) return 'Income cannot fall further.'
  const dErr = discardForAction(s, p)
  if (dErr) return dErr
  p.money += 30
  p.income -= 3
  addLog(s, `${p.name} took a loan (+£30, income −3 levels).`, 'brass')
  return null
}

export function applyLoan(s: GameState, playerId: string): string | null {
  return resolveLoan(s, playerId)
}

export function resolveScout(s: GameState, playerId: string): string | null {
  const p = playerById(s, playerId)
  if (p.hand.some((c) => c.kind.startsWith('wild'))) return 'You already hold a Wild card.'
  if (p.hand.length < 3) return 'Scout requires three cards.'
  if (s.wildLocPool < 1 || s.wildIndPool < 1) return 'The Wild pools are exhausted.'
  const dErr = discardForAction(s, p)
  if (dErr) return dErr
  // Discard two more (three total), wilds among them return to pools.
  for (let i = 0; i < 2; i++) discardForAction(s, p)
  s.wildLocPool--
  s.wildIndPool--
  p.hand.push({ id: `card${cardSeq++}`, cityId: null, kind: 'wild-location' })
  p.hand.push({ id: `card${cardSeq++}`, cityId: null, kind: 'wild-industry' })
  addLog(s, `${p.name} scouted for wild opportunities.`, 'brass')
  return null
}

export function resolvePass(s: GameState, playerId: string): string | null {
  const p = playerById(s, playerId)
  const dErr = discardForAction(s, p)
  if (dErr) return dErr
  addLog(s, `${p.name} passed.`)
  return null
}

// --------------------------- Turn / round flow ------------------------------

/**
 * One performed ACTION. Handles the 1-action first canal round, then the
 * two-action rhythm, spend-based re-ordering at end of round, wages,
 * refills, era transitions and scoring.
 */
export function advanceTurn(s: GameState): void {
  if (s.over) return
  const cur = currentPlayer(s)
  cur.actionsLeft -= 1

  if (cur.actionsLeft > 0) {
    // Same player acts again.
    return
  }

  // This player's turn is over — refill their hand toward eight.
  refillHand(s, cur)

  // Find next player in the CURRENT order sequence.
  const idx = s.order.indexOf(cur.id)
  for (let step = 1; step <= s.order.length; step++) {
    const nid = s.order[(idx + step) % s.order.length]
    const np = playerById(s, nid)
    if (np.actionsLeft > 0) {
      s.turnIdx = s.order.indexOf(nid)
      return
    }
  }

  // Everyone is done → END OF ROUND.
  endRound(s)
}

function endRound(s: GameState): void {
  // 1) New character order: ascending money spent, ties keep order.
  const sorted = [...s.order].sort((a, b) => {
    const pa = playerById(s, a).spent
    const pb = playerById(s, b).spent
    return pa - pb
  })
  s.order = sorted
  s.turnIdx = 0

  // 2) Spent money was banked as it was spent (tracked for ordering only).
  // 3) Income — with shortfall handling.
  for (const p of s.players) {
    p.money += p.income
    if (p.income < 0) {
      p.vp += p.income // shortfall costs VP
      addLog(s, `${p.name} suffers an income shortfall (${p.income}).`, 'event')
    }
    p.spent = 0
  }

  // 4) Round advance & era boundary.
  const rpEra = roundsPerEra(s.players.length)
  s.round++
  if (s.round > rpEra) {
    if (s.era === 'canal') {
      endCanalEra(s)
    } else {
      endRailEra(s)
      return
    }
  }

  // 5) Fresh action allowance (first canal round = 1 action).
  const firstRound = s.era === 'canal' && s.round === 1
  for (const p of s.players) {
    p.actionsLeft = firstRound ? 1 : 2
    refillHand(s, p)
  }
  addLog(
    s,
    `Round ${s.round} — order by spending: ${s.order.map((id) => playerById(s, id).name).join(' → ')}`,
    'event',
  )
}

function scoreFlippedIndustries(s: GameState): void {
  for (const t of s.placed) {
    if (t.flipped && !t.scored) {
      const p = playerById(s, t.ownerId)
      const vp = INDUSTRY_SPEC[t.kind][t.level - 1].vp
      p.vp += vp
      p.vpSells += vp
      t.scored = true
    }
  }
}

/** Official era scoring: each owned link scores 1 VP per adjacent TOWN
 *  and 2 VP per adjacent CITY. Merchant beacons & farm breweries count as
 *  towns for this purpose. */
function scoreLinks(s: GameState): void {
  for (const [lid, owner] of Object.entries(s.linksOwned)) {
    const l = LINK_BY_ID.get(lid)!
    const p = playerById(s, owner)
    for (const end of [l.a, l.b]) {
      const c = CITY_BY_ID.get(end)
      if (!c) continue
      const isTown = c.town || c.kind === 'merchant' || c.kind === 'farm-brewery'
      p.vp += isTown ? 1 : 2
    }
    void lid
  }
}

function endCanalEra(s: GameState): void {
  scoreLinks(s)
  scoreFlippedIndustries(s)
  // Obsolete L1 industries leave the board.
  const obsolete = s.placed.filter((t) => t.level === 1)
  s.placed = s.placed.filter((t) => t.level > 1)
  void obsolete
  for (const p of s.players) {
    p.developLeft = 2
    p.vpCanalEnd = p.vp
  }
  // Merchant beer resets implicitly (not tracked globally here).
  s.era = 'rail'
  s.round = 0 // endRound will ++ to 1
  addLog(s, 'CANAL ERA SCORED — the railways arrive.', 'event')
}

function endRailEra(s: GameState): void {
  scoreLinks(s)
  scoreFlippedIndustries(s)
  s.round = rpClamp(s)
  s.over = true
  addLog(s, 'THE INDUSTRIAL AGE CONCLUDES.', 'event')
}

function rpClamp(s: GameState): number {
  return roundsPerEra(s.players.length)
}

// --------------------------- Save / Resume ---------------------------------
// GameState is plain serializable data; only the seeded RNG function is
// reconstructed on load, which keeps saved deals reproducible.

export type SerializedGame = Omit<GameState, 'dealRandom'>

export function serializeGameState(s: GameState): SerializedGame {
  const { dealRandom: _dr, ...rest } = s
  void _dr
  return JSON.parse(JSON.stringify(rest)) as SerializedGame
}

export function hydrateGameState(raw: SerializedGame): GameState {
  const s = raw as unknown as GameState
  s.dealRandom = raw.seed >= 0 ? mulberry32(raw.seed) : Math.random
  // Saves from before the shared market existed.
  if (typeof s.coalMarket !== 'number') s.coalMarket = COAL_MARKET_START
  if (typeof s.ironMarket !== 'number') s.ironMarket = IRON_MARKET_START
  s.merchantBonusUsed ??= {}
  return s
}
