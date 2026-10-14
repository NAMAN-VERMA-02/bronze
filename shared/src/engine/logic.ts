import type {
  BuildTarget,
  Card,
  GameAction,
  GameState,
  IndustryType,
  PlacedTile,
  PlayerState,
  SaleOption,
  TileSpec,
} from '../types.js'
import { GameError } from '../types.js'
import {
  CANAL_LINK_COST,
  INCOME_TRACK,
  IRON_MARKET_START,
  IRON_PER_LINK,
  COAL_MARKET_START,
  LOAN_AMOUNT,
  MERCHANT_DECK_SIZE,
  POTTERY_BONUS_VP,
  RAIL_LINK_BASE_COST,
  RAIL_LINK_ESCALATION,
  ROUNDS_PER_ERA,
  coalPrice,
  ironPrice,
  tileSpec,
} from '../data/tiles.js'
import { LINKS, LINK_BY_ID, LOCATION_BY_ID, NEIGHBORS, locationName } from '../data/map.js'
import { deckForEra } from '../data/cards.js'
import { shuffle } from './rng.js'
import { HAND_SIZE } from '../data/tiles.js'
import { addLog, currentPlayer, playerById } from './setup.js'

const SELLABLE: IndustryType[] = ['cotton', 'goods', 'pottery']

export function myNetwork(state: GameState, pid: string): Set<string> {
  const net = new Set<string>()
  for (const [locId, slots] of Object.entries(state.locations)) {
    if (slots.some((t) => t !== null && t.ownerId === pid)) net.add(locId)
  }
  for (const lk of LINKS) {
    if (state.links[lk.id] === pid) {
      net.add(lk.a)
      net.add(lk.b)
    }
  }
  return net
}

const LINK_BETWEEN = new Map<string, string>()
for (const lk of LINKS) {
  const a = lk.a < lk.b ? lk.a : lk.b
  const b = lk.a < lk.b ? lk.b : lk.a
  LINK_BETWEEN.set(`${a}|${b}`, lk.id)
}

export function reachableFrom(state: GameState, pid: string, start: string): Set<string> {
  const seen = new Set<string>([start])
  const queue = [start]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const nb of NEIGHBORS[cur] ?? []) {
      if (seen.has(nb)) continue
      const a = cur < nb ? cur : nb
      const b = cur < nb ? nb : cur
      const linkId = LINK_BETWEEN.get(`${a}|${b}`)
      if (linkId && state.links[linkId] === pid) {
        seen.add(nb)
        queue.push(nb)
      }
    }
  }
  return seen
}

function tileCounts(p: PlayerState): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of p.tilesLeft) m.set(`${t.industry}:${t.level}`, t.count)
  return m
}

export function availableLevels(state: GameState, p: PlayerState, industry: IndustryType): number[] {
  return p.tilesLeft
    .filter(
      (t) =>
        t.industry === industry &&
        t.count > 0 &&
        tileSpec(industry, t.level).era === state.era &&
        (!tileSpec(industry, t.level).developOnly || state.justDeveloped),
    )
    .map((t) => t.level)
    .sort((a, b) => a - b)
}

function freeResourceFromNetwork(
  state: GameState,
  network: Set<string>,
  industry: IndustryType,
): number {
  let total = 0
  for (const locId of network) {
    const slots = state.locations[locId]
    if (!slots) continue
    for (const t of slots) {
      if (t && !t.flipped && t.industry === industry && t.resources > 0) total += t.resources
    }
  }
  return total
}

function takeFreeResource(state: GameState, network: Set<string>, industry: IndustryType, amount: number): void {
  let need = amount
  const orderLocs = [...network]
  for (const locId of orderLocs) {
    if (need <= 0) break
    const slots = state.locations[locId]
    if (!slots) continue
    for (const t of slots) {
      if (need <= 0) break
      if (t && !t.flipped && t.industry === industry && t.resources > 0) {
        const take = Math.min(need, t.resources)
        t.resources -= take
        need -= take
        if (t.resources === 0) t.flipped = true
      }
    }
  }
}

function consumeCoalForBuild(
  state: GameState,
  networkAfter: Set<string>,
  need: number,
  player: PlayerState,
): void {
  const freeAvailable = freeResourceFromNetwork(state, networkAfter, 'coal')
  const freeTaken = Math.min(need, freeAvailable)
  takeFreeResource(state, networkAfter, 'coal', freeTaken)
  const marketNeed = need - freeTaken
  if (marketNeed > 0) {
    const price = coalPrice(state.coalMarket)
    if (state.coalMarket < marketNeed) throw new GameError('Not enough coal in the market')
    state.coalMarket -= marketNeed
    player.money -= price * marketNeed
  }
}

function consumeIron(state: GameState, network: Set<string>, need: number, player: PlayerState): void {
  const freeAvailable = freeResourceFromNetwork(state, network, 'iron')
  const freeTaken = Math.min(need, freeAvailable)
  takeFreeResource(state, network, 'iron', freeTaken)
  const marketNeed = need - freeTaken
  if (marketNeed > 0) {
    const price = ironPrice(state.ironMarket)
    if (state.ironMarket < marketNeed) throw new GameError('Not enough iron in the market')
    state.ironMarket -= marketNeed
    player.money -= price * marketNeed
  }
}

export function canAffordBuild(
  state: GameState,
  player: PlayerState,
  spec: TileSpec,
  locId: string,
  networkBefore: Set<string>,
): boolean {
  if (player.money < spec.cost) return false
  if (spec.coalRequired === 0) return true
  const networkAfter = new Set(networkBefore)
  networkAfter.add(locId)
  const freeAvailable = freeResourceFromNetwork(state, networkAfter, 'coal')
  const marketNeed = Math.max(0, spec.coalRequired - freeAvailable)
  if (state.coalMarket < marketNeed) return false
  return player.money >= spec.cost + marketNeed * coalPrice(state.coalMarket)
}

function permitsCard(card: Card, locId: string, industry: IndustryType): boolean {
  if (card.kind === 'wild') return true
  if (card.kind === 'location') return card.ref === locId
  return card.ref === industry
}

export function legalBuildTargets(state: GameState, pid: string): BuildTarget[] {
  const player = playerById(state, pid)
  const networkBefore = myNetwork(state, pid)
  const counts = tileCounts(player)
  const targets: BuildTarget[] = []
  for (const card of player.hand) {
    for (const loc of LOCATION_BY_ID.values()) {
      const existingSlots = state.locations[loc.id] ?? []
      for (let slotIndex = 0; slotIndex < loc.slots.length; slotIndex++) {
        const slotIndustry = loc.slots[slotIndex]
        if (!permitsCard(card, loc.id, slotIndustry)) continue
        const occupied = existingSlots[slotIndex]
        let levels: number[] = []
        if (!occupied) {
          levels = availableLevels(state, player, slotIndustry).filter((lv) => {
            const spec = tileSpec(slotIndustry, lv)
            return canAffordBuild(state, player, spec, loc.id, networkBefore)
          })
        } else if (state.era === 'rail' && occupied.industry === slotIndustry) {
          levels = availableLevels(state, player, slotIndustry).filter((lv) => {
            if (lv <= occupied.level) return false
            if (occupied.ownerId !== pid && !networkBefore.has(loc.id)) return false
            const spec = tileSpec(slotIndustry, lv)
            return canAffordBuild(state, player, spec, loc.id, networkBefore)
          })
        }
        if (levels.length > 0) {
          targets.push({ cardId: card.id, locationId: loc.id, slotIndex, industry: slotIndustry, levels })
        }
      }
    }
  }
  return targets
}

export function networkCost(state: GameState, pid: string): number {
  const base = state.era === 'canal' ? CANAL_LINK_COST : RAIL_LINK_BASE_COST
  if (state.era === 'rail') {
    const p = playerById(state, pid)
    return base + RAIL_LINK_ESCALATION * p.linksBuiltThisEra
  }
  return base
}

export function legalNetworkLinks(state: GameState, pid: string): string[] {
  const player = playerById(state, pid)
  const network = myNetwork(state, pid)
  const cost = networkCost(state, pid)
  if (player.money < cost + ironPrice(state.ironMarket)) return []
  if (network.size === 0 && !player.hand) return []
  const out: string[] = []
  for (const lk of LINKS) {
    if (state.links[lk.id] !== null) continue
    if (network.size > 0 && !(network.has(lk.a) || network.has(lk.b))) continue
    const ironFree = freeResourceFromNetwork(state, network, 'iron')
    const marketIron = Math.max(0, IRON_PER_LINK - ironFree)
    if (state.ironMarket < marketIron) continue
    if (player.money < cost + marketIron * ironPrice(state.ironMarket)) continue
    out.push(lk.id)
  }
  return out
}

export function legalSales(state: GameState, pid: string): SaleOption[] {
  const merchants = new Set(
    [...LOCATION_BY_ID.values()].filter((l) => l.merchant).map((l) => l.id),
  )
  const options: SaleOption[] = []
  for (const [locId, slots] of Object.entries(state.locations)) {
    slots.forEach((t, slotIndex) => {
      if (!t || t.ownerId !== pid || t.flipped || !SELLABLE.includes(t.industry)) return
      const reach = reachableFrom(state, pid, locId)
      if (![...reach].some((id) => merchants.has(id))) return
      if (t.industry === 'pottery' && state.merchantDeck <= 0) return
      const near = [locId, ...(NEIGHBORS[locId] ?? [])]
      const beers: SaleOption['beers'] = []
      for (const nLoc of near) {
        const nSlots = state.locations[nLoc]
        if (!nSlots) continue
        nSlots.forEach((bt, bi) => {
          if (bt && bt.industry === 'brewery' && !bt.flipped && bt.resources > 0) {
            beers.push({ locationId: nLoc, slotIndex: bi })
          }
        })
      }
      if (beers.length > 0) options.push({ locationId: locId, slotIndex, beers })
    })
  }
  return options
}

function incomeGain(player: PlayerState, amount: number): void {
  const val = Math.min(INCOME_TRACK[INCOME_TRACK.length - 1], INCOME_TRACK[player.incomeIndex] + amount)
  let idx = 0
  for (let i = 0; i < INCOME_TRACK.length; i++) {
    if (INCOME_TRACK[i] <= val) idx = i
  }
  player.incomeIndex = idx
}

function removeCard(player: PlayerState, cardId: string, discard: Card[]): Card {
  const idx = player.hand.findIndex((c) => c.id === cardId)
  if (idx === -1) throw new GameError('Card not in hand')
  const [card] = player.hand.splice(idx, 1)
  discard.push(card)
  return card
}

function decrementTile(player: PlayerState, industry: IndustryType, level: number): void {
  const entry = player.tilesLeft.find((t) => t.industry === industry && t.level === level)
  if (!entry || entry.count <= 0) throw new GameError(`No ${industry} level ${level} tile on your mat`)
  entry.count--
}

function doBuild(state: GameState, player: PlayerState, action: Extract<GameAction, { type: 'BUILD' }>): void {
  const loc = LOCATION_BY_ID.get(action.locationId)
  if (!loc) throw new GameError('Unknown location')
  if (action.slotIndex < 0 || action.slotIndex >= loc.slots.length) throw new GameError('Invalid slot')
  if (loc.slots[action.slotIndex] !== action.industry) {
    throw new GameError(`${locationName(loc.id)} does not allow ${action.industry} in that slot`)
  }
  const card = player.hand.find((c) => c.id === action.cardId)
  if (!card) throw new GameError('Card not in hand')
  if (!permitsCard(card, loc.id, action.industry)) {
    throw new GameError('That card does not permit this build')
  }
  const spec = tileSpec(action.industry, action.level)
  if (spec.era !== state.era) throw new GameError('That tile belongs to the other era')
  if (spec.developOnly && !state.justDeveloped) {
    throw new GameError('That pottery can only be built right after developing')
  }
  const existing = state.locations[loc.id][action.slotIndex]
  const networkBefore = myNetwork(state, player.id)
  if (existing) {
    if (state.era !== 'rail') throw new GameError('Overbuilding only in the Rail Era')
    if (existing.industry !== action.industry) throw new GameError('Overbuild must match industry')
    if (action.level <= existing.level) throw new GameError('Overbuild needs a higher level tile')
    if (existing.ownerId !== player.id && !networkBefore.has(loc.id)) {
      throw new GameError('You may only overbuild a connected opponent tile')
    }
  }
  if (!availableLevels(state, player, action.industry).includes(action.level)) {
    throw new GameError('That tile is not on your mat')
  }
  if (!canAffordBuild(state, player, spec, loc.id, networkBefore)) {
    throw new GameError('Not enough money or coal')
  }

  const cardPlayed = removeCard(player, action.cardId, state.discardPile)
  decrementTile(player, action.industry, action.level)

  const networkAfter = new Set(networkBefore)
  networkAfter.add(loc.id)
  consumeCoalForBuild(state, networkAfter, spec.coalRequired, player)
  player.money -= spec.cost

  const tile: PlacedTile = {
    locationId: loc.id,
    slotIndex: action.slotIndex,
    industry: action.industry,
    level: action.level,
    ownerId: player.id,
    flipped: false,
    era: state.era,
    resources: 0,
  }
  if (action.industry === 'coal' || action.industry === 'iron') {
    tile.resources = spec.production ?? 0
  }
  if (action.industry === 'brewery') {
    tile.resources = spec.beerCapacity ?? 1
  }
  state.locations[loc.id][action.slotIndex] = tile

  const overNote =
    existing && existing.ownerId !== player.id ? `, overbuilding ${locationName(loc.id)}` : ''
  addLog(
    state,
    `${player.name} built ${action.industry} L${action.level} at ${locationName(loc.id)} [${cardPlayed.kind}]`,
  )
  void overNote
}

function doNetwork(state: GameState, player: PlayerState, linkId: string): void {
  const lk = LINK_BY_ID.get(linkId)
  if (!lk) throw new GameError('Unknown link')
  if (state.links[linkId] !== null) throw new GameError('Link already built')
  const network = myNetwork(state, player.id)
  if (network.size > 0 && !(network.has(lk.a) || network.has(lk.b))) {
    throw new GameError('Link must connect to your network')
  }
  const cost = networkCost(state, player.id)
  if (player.money < cost) throw new GameError('Not enough money for a link')
  consumeIron(state, network, IRON_PER_LINK, player)
  player.money -= cost
  state.links[linkId] = player.id
  player.linksBuiltThisEra++
  addLog(state, `${player.name} laid a link between ${locationName(lk.a)} and ${locationName(lk.b)}`)
}

function doDevelop(
  state: GameState,
  player: PlayerState,
  tiles: { industry: IndustryType; level: number }[],
): void {
  if (tiles.length < 1 || tiles.length > 2) throw new GameError('Develop discards one or two tiles')
  const seen = new Set<string>()
  for (const t of tiles) {
    const key = `${t.industry}:${t.level}`
    if (seen.has(key)) throw new GameError('Cannot develop the same tile twice')
    seen.add(key)
  }
  consumeIron(state, myNetwork(state, player.id), tiles.length, player)
  for (const t of tiles) decrementTile(player, t.industry, t.level)
  state.justDeveloped = true
  addLog(state, `${player.name} developed ${tiles.map((t) => `${t.industry} L${t.level}`).join(' + ')}`)
}

function doLoan(state: GameState, player: PlayerState): void {
  if (player.incomeIndex === 0) throw new GameError('Income is already at its lowest')
  player.money += LOAN_AMOUNT
  player.incomeIndex = Math.max(0, player.incomeIndex - 4)
  player.loans++
  addLog(state, `${player.name} took a loan (+£30, income down)`)
}

function doSell(state: GameState, player: PlayerState, action: Extract<GameAction, { type: 'SELL' }>): void {
  const options = legalSales(state, player.id)
  const opt = options.find(
    (o) => o.locationId === action.locationId && o.slotIndex === action.slotIndex,
  )
  if (!opt) throw new GameError('That industry cannot be sold now')
  const beerOpt = opt.beers.find(
    (b) => b.locationId === action.beerLocationId && b.slotIndex === action.beerSlotIndex,
  )
  if (!beerOpt) throw new GameError('Choose an adjacent brewery with beer')
  const tile = state.locations[action.locationId][action.slotIndex]
  if (!tile) throw new GameError('No tile there')
  const beer = state.locations[action.beerLocationId][action.beerSlotIndex]
  if (!beer) throw new GameError('No beer tile there')

  tile.flipped = true
  beer.resources -= 1
  beer.flipped = beer.resources <= 0 || beer.flipped

  const spec = tileSpec(tile.industry, tile.level)
  if (tile.industry === 'cotton') {
    incomeGain(player, spec.sellIncome ?? 5)
    addLog(state, `${player.name} sold cotton L${tile.level} at ${locationName(tile.locationId)} (income up)`)
  } else {
    player.money += spec.sellMoney ?? 14
    if (tile.industry === 'pottery') {
      state.merchantDeck--
      player.soldPottery++
      addLog(
        state,
        `${player.name} sold pottery L${tile.level} to a merchant (+£${spec.sellMoney})`,
      )
    } else {
      addLog(state, `${player.name} sold goods L${tile.level} at ${locationName(tile.locationId)}`)
    }
  }
}

export function endTurn(state: GameState, refillCard: boolean): void {
  state.justDeveloped = false
  if (refillCard && state.drawPile.length > 0) {
    const card = state.drawPile.shift()
    if (card) currentPlayer(state).hand.push(card)
  }
  state.currentTurnIdx++
  if (state.currentTurnIdx >= state.order.length) {
    endRound(state)
  } else {
    state.actionsLeft = 2
  }
}

function endRound(state: GameState): void {
  const spentOrder = state.order.map((id) => ({
    id,
    spent: playerById(state, id).spentThisRound,
  }))
  for (const p of state.players) {
    p.money += INCOME_TRACK[p.incomeIndex]
    p.spentThisRound = 0
    p.linksBuiltThisEra = 0
  }
  addLog(state, `Round ${state.round} ends — income collected`)
  if (state.era === 'rail') {
    state.ironMarket = Math.max(state.ironMarket, 4)
  }

  if (state.round >= ROUNDS_PER_ERA) {
    if (state.era === 'canal') {
      eraTransition(state)
    } else {
      finishGame(state)
    }
    return
  }

  spentOrder.sort((a, b) => a.spent - b.spent)
  state.order = spentOrder.map((o) => o.id)
  state.round++
  state.currentTurnIdx = 0
  state.actionsLeft = 2
  addLog(state, `Round ${state.round} begins — turn order by lowest spend`)
}

function eraTransition(state:GameState): void {
  state.era = 'rail'
  for (const slots of Object.values(state.locations)) {
    for (let i = 0; i < slots.length; i++) {
      const t = slots[i]
      if (t && !t.flipped) slots[i] = null
    }
  }
  for (const id of Object.keys(state.links)) state.links[id] = null
  state.coalMarket = COAL_MARKET_START
  state.ironMarket = IRON_MARKET_START
  state.drawPile = deckForEra('rail')
  state.discardPile = []
  state.merchantDeck = MERCHANT_DECK_SIZE
  state.round = 1
  state.currentTurnIdx = 0
  state.actionsLeft = 2
  state.justDeveloped = false
  shuffle(state, state.drawPile)
  for (const p of state.players) {
    p.hand = state.drawPile.splice(0, HAND_SIZE)
  }
  addLog(state, `— The Rail Era dawns. Unflipped industries crumble, canals give way to rails —`)
}

export function scorePlayer(state: GameState, pid: string): number {
  const p = playerById(state, pid)
  let vp = 0
  for (const slots of Object.values(state.locations)) {
    for (const t of slots) {
      if (t && t.ownerId === pid) vp += tileSpec(t.industry, t.level).vp
    }
  }
  vp += p.soldPottery * POTTERY_BONUS_VP
  let linksOwned = 0
  for (const owner of Object.values(state.links)) if (owner === pid) linksOwned++
  vp += linksOwned
  if (p.money < 0) vp += Math.ceil(p.money / 10)
  return vp
}

function finishGame(state: GameState): void {
  state.phase = 'game_end'
  state.finalScores = state.players
    .map((p) => ({ playerId: p.id, name: p.name, vp: scorePlayer(state, p.id), money: p.money }))
    .sort((a, b) => b.vp - a.vp || b.money - a.money)
  addLog(state, `Final whistle — ${state.finalScores[0].name} masters Birmingham`)
}

export function applyAction(state: GameState, playerId: string, action: GameAction): GameState {
  if (state.phase !== 'playing') throw new GameError('Game is over')
  const cur = currentPlayer(state)
  if (cur.id !== playerId) throw new GameError('Not your turn')
  const s: GameState = structuredClone(state)
  const player = playerById(s, playerId)
  const handBefore = player.hand.length

  switch (action.type) {
    case 'BUILD':
      doBuild(s, player, action)
      break
    case 'NETWORK':
      doNetwork(s, player, action.linkId)
      break
    case 'DEVELOP':
      doDevelop(s, player, action.tiles)
      break
    case 'LOAN':
      doLoan(s, player)
      break
    case 'SELL':
      doSell(s, player, action)
      break
    case 'PASS':
      addLog(s, `${player.name} passes`)
      break
    default:
      throw new GameError('Unknown action')
  }

  const playedCard = player.hand.length < handBefore
  s.actionsLeft--
  if (s.actionsLeft <= 0) endTurn(s, playedCard)
  return s
}
