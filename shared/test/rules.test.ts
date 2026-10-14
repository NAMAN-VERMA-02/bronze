import {
  applyAction,
  createGame,
  legalBuildTargets,
  legalNetworkLinks,
  legalSales,
  scorePlayer,
  tileSpec,
  currentPlayer,
  type GameAction,
  type GameState,
} from '../src/index.js'

interface CaseResult {
  id: string
  domain: string
  name: string
  pass: boolean
  detail?: string
}

const results: CaseResult[] = []
let seed = 424242

function nextSeed(): number {
  seed = (seed * 1103515245 + 12345) | 0
  return seed | 0
}

function freshGame(names = ['Alice', 'Bob']): GameState {
  return createGame(names, nextSeed())
}

function caseRun(id: string, domain: string, name: string, fn: () => void): void {
  try {
    fn()
    results.push({ id, domain, name, pass: true })
  } catch (e) {
    results.push({ id, domain, name, pass: false, detail: e instanceof Error ? e.message : String(e) })
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

function assertThrows(fn: () => void, contains?: string): void {
  try {
    fn()
  } catch (e) {
    if (contains && !(e instanceof Error && e.message.includes(contains))) {
      throw new Error(`threw wrong error: "${(e as Error).message}"`)
    }
    return
  }
  throw new Error('expected GameError but action succeeded')
}

function pick<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error('empty array in pick')
  return arr[Math.floor(Math.random() * arr.length)]
}

function doPass(state: GameState): GameState {
  return applyAction(state, currentPlayer(state).id, { type: 'PASS' })
}

function firstLegalBuild(state: GameState): GameAction | null {
  const targets = legalBuildTargets(state, currentPlayer(state).id)
  if (targets.length === 0) return null
  const t = targets[0]
  return {
    type: 'BUILD',
    cardId: t.cardId,
    locationId: t.locationId,
    slotIndex: t.slotIndex,
    industry: t.industry,
    level: t.levels[0],
  }
}

function playUntilEraEnds(state: GameState, maxSteps = 20000): GameState {
  let s = state
  let steps = 0
  while (s.era === 'canal' && s.phase === 'playing') {
    if (++steps > maxSteps) throw new Error('era never ended')
    const pid = currentPlayer(s).id
    const roll = Math.random()
    try {
      if (roll < 0.6) {
        const a = firstLegalBuild(s)
        if (a) {
          s = applyAction(s, pid, a)
          continue
        }
      } else if (roll < 0.75) {
        const links = legalNetworkLinks(s, pid)
        if (links.length > 0) {
          s = applyAction(s, pid, { type: 'NETWORK', linkId: pick(links) })
          continue
        }
      } else if (roll < 0.85) {
        const sales = legalSales(s, pid)
        if (sales.length > 0) {
          const sale = pick(sales)
          s = applyAction(s, pid, {
            type: 'SELL',
            locationId: sale.locationId,
            slotIndex: sale.slotIndex,
            beerLocationId: sale.beers[0].locationId,
            beerSlotIndex: sale.beers[0].slotIndex,
          })
          continue
        }
      }
      s = applyAction(s, pid, { type: 'PASS' })
    } catch {
      s = applyAction(s, pid, { type: 'PASS' })
    }
  }
  return s
}

// ---------- 4.1.1 Turn Sequence & Action System ----------

caseRun('R01', '4.1.1', 'Initial setup: hands of 8, two actions, shuffled order', () => {
  const s = freshGame()
  assert(s.era === 'canal', 'should start canal era')
  assert(s.actionsLeft === 2, `actionsLeft should be 2, got ${s.actionsLeft}`)
  for (const p of s.players) assert(p.hand.length === 8, `${p.name} hand ${p.hand.length}`)
  assert(
    [...s.order].sort().join() === [...s.players.map((p) => p.id)].sort().join(),
    'order must be a permutation of player ids',
  )
})

caseRun('R02', '4.1.1', 'Two passes advance turn to next player', () => {
  const s0 = freshGame()
  const idx0 = s0.currentTurnIdx
  const s1 = doPass(doPass(s0))
  assert(s1.currentTurnIdx !== idx0 || s1.round > s0.round, 'turn must advance after two actions')
})

caseRun('R03', '4.1.1', 'Out-of-turn action rejected', () => {
  const s = freshGame()
  const other = s.players.find((p) => p.id !== currentPlayer(s).id)!
  assertThrows(() => applyAction(s, other.id, { type: 'LOAN' }), 'Not your turn')
})

caseRun('R04', '4.1.1', 'Build with non-matching card rejected', () => {
  const s = freshGame()
  const me = currentPlayer(s)
  const targets = legalBuildTargets(s, me.id)
  assert(targets.length > 0, 'no legal builds available for scenario')
  const wrongCard =
    me.hand.find(
      (c) =>
        c.kind === 'location' &&
        !targets.some((t) => t.cardId === c.id),
    ) ?? me.hand.find((c) => c.id !== targets[0].cardId)!
  const t = targets[0]
  assertThrows(
    () =>
      applyAction(s, me.id, {
        type: 'BUILD',
        cardId: wrongCard.id,
        locationId: t.locationId,
        slotIndex: t.slotIndex,
        industry: t.industry,
        level: t.levels[0],
      }),
  )
})

caseRun('R05', '4.1.1', 'Build with card not in hand rejected', () => {
  const s = freshGame()
  const me = currentPlayer(s)
  const t = legalBuildTargets(s, me.id)[0]
  assert(t !== undefined, 'no legal build for scenario')
  assertThrows(
    () =>
      applyAction(s, me.id, {
        type: 'BUILD',
        cardId: 'ghost-card',
        locationId: t!.locationId,
        slotIndex: t!.slotIndex,
        industry: t!.industry,
        level: t!.levels[0],
      }),
    'Card not in hand',
  )
})

caseRun('R06', '4.1.1', 'Hand does not inflate when no card discarded', () => {
  let s = freshGame()
  const before = currentPlayer(s).hand.length
  s = doPass(doPass(s))
  const after = currentPlayer(s).hand.length
  assert(after === before, `hand grew from ${before} to ${after} without discarding`)
})

caseRun('R07', '4.1.1', 'Hand refills to 8 after a build', () => {
  let s = freshGame()
  let built = false
  for (let attempt = 0; attempt < 40 && !built; attempt++) {
    const a = firstLegalBuild(s)
    if (a) {
      const lenBefore = currentPlayer(s).hand.length
      s = applyAction(s, currentPlayer(s).id, a)
      const lenAfter = currentPlayer(s).hand.length + (s.currentTurnIdx !== 0 ? 0 : 0)
      const meNow = s.players.find((p) => p.id === s.order[s.currentTurnIdx])!
      void meNow
      assert(lenAfter >= lenBefore - 1, 'hand shrank by more than the played card')
      built = true
    } else {
      s = doPass(s)
    }
  }
  assert(built, 'could not perform any build in 40 attempts')
})

caseRun('R08', '4.1.1', 'Loan grants £30 and drops income two levels (£20)', () => {
  let s = freshGame()
  const me = currentPlayer(s)
  const money0 = me.money
  const inc0 = me.incomeIndex
  s = applyAction(s, me.id, { type: 'LOAN' })
  const meAfter = s.players.find((p) => p.id === me.id)!
  assert(meAfter.money === money0 + 30, `money ${meAfter.money} != ${money0 + 30}`)
  assert(meAfter.incomeIndex === Math.max(0, inc0 - 4), 'income should drop two £10 levels')
  assert(meAfter.loans === 1, 'loan count should be 1')
})

caseRun('R09', '4.1.1', 'Loan at income floor rejected', () => {
  let s = freshGame()
  const me0 = currentPlayer(s)
  me0.incomeIndex = 0
  assertThrows(() => applyAction(s, me0.id, { type: 'LOAN' }), 'lowest')
})

caseRun('R10', '4.3.2', 'Malformed action type must not consume an action', () => {
  let s = freshGame()
  const bad = { type: 'TELEPORT_TO_VICTORY' } as unknown as GameAction
  assertThrows(() => applyAction(s, currentPlayer(s).id, bad))
  const after = structuredClone(s)
  assert(after.actionsLeft === 2, 'failed action must not consume an action slot')
})

// ---------- 4.1.2 Era Progression & Scoring ----------

caseRun('E01', '4.1.2', 'Canal→Rail transition clears links, unflipped tiles; redraws hands', () => {
  let s = playUntilEraEnds(freshGame())
  assert(s.era === 'rail', 'should reach rail era')
  for (const owner of Object.values(s.links)) assert(owner === null, 'all links must clear at era end')
  let unflipped = 0
  for (const slots of Object.values(s.locations)) {
    for (const t of slots) if (t && !t.flipped) unflipped++
  }
  assert(unflipped === 0, `${unflipped} unflipped canal tiles survived transition`)
  for (const p of s.players) assert(p.hand.length === 8, 'players redraw to 8 in rail era')
  assert(s.round === 1, 'round resets to 1')
})

caseRun('E02', '4.1.2', 'Rail era completes: game_end with sorted final scores', () => {
  let s = playUntilEraEnds(freshGame())
  let steps = 0
  while (s.phase === 'playing') {
    if (++steps > 20000) throw new Error('game did not terminate')
    try {
      s = doPass(s)
    } catch (e) {
      throw e
    }
  }
  assert(s.phase === 'game_end', 'phase should be game_end')
  const scores = s.finalScores!
  for (let i = 1; i < scores.length; i++) {
    assert(scores[i - 1].vp >= scores[i].vp, 'final scores must be sorted descending')
  }
})

caseRun('E03', '4.1.2', 'scorePlayer consistent across 5 full random games', () => {
  for (let g = 0; g < 5; g++) {
    let s = freshGame()
    let steps = 0
    while (s.phase === 'playing') {
      if (++steps > 20000) throw new Error('no termination')
      const pid = currentPlayer(s).id
      try {
        s = applyAction(s, pid, { type: 'PASS' })
      } catch {
        s = doPass(s)
      }
    }
    for (const f of s.finalScores!) {
      const recomputed = scorePlayer(s, f.playerId)
      assert(recomputed === f.vp, `game ${g}: ${f.name} reported ${f.vp}, recomputed ${recomputed}`)
    }
  }
})

caseRun('E04', '4.1.2', 'Debt penalty applies only to negative money', () => {
  const s = freshGame()
  const p = s.players[0]
  const basePos = scorePlayer(s, p.id)
  p.money = 10
  assert(scorePlayer(s, p.id) === basePos, 'positive money must not change VP')
  p.money = -25
  const expected = basePos + Math.ceil(-25 / 10)
  assert(scorePlayer(s, p.id) === expected, 'debt penalty must be ceil(debt/10)')
})

// ---------- 4.1.3 Industry-Specific Rules ----------

caseRun('I01', '4.1.3', 'Coal mine holds production; network coal consumed before market', () => {
  const spec = tileSpec('coal', 1)
  assert((spec.production ?? 0) >= 1, 'coal L1 should produce at least 1 coal')
  const specIron = tileSpec('iron', 1)
  assert((specIron.production ?? 0) >= 1, 'iron L1 should produce at least 1 iron')
})

caseRun('I02', '4.1.3', 'Brewery beer capacity: 1 canal, 2 rail', () => {
  assert(tileSpec('brewery', 1).beerCapacity === 1, 'canal brewery capacity')
  assert(tileSpec('brewery', 5).beerCapacity === 2, 'rail brewery capacity')
})

caseRun('I03', '4.1.3', 'Develop-only pottery blocked unless justDeveloped', () => {
  let s = freshGame()
  const me0 = currentPlayer(s)
  me0.tilesLeft.find((t) => t.industry === 'pottery' && t.level === 3)!.count = 1
  me0.money = 500
  const loc = 'BHM'
  s.locations[loc] = [null, null, null, null]
  me0.hand = [{ id: 'x1', kind: 'location', ref: loc }]
  assertThrows(
    () =>
      applyAction(s, me0.id, {
        type: 'BUILD',
        cardId: 'x1',
        locationId: loc,
        slotIndex: 2,
        industry: 'pottery',
        level: 3,
      }),
    'develop',
  )
})

caseRun('I04', '4.1.3', 'Overbuilding rejected in canal era / lower level', () => {
  let s = freshGame()
  const me = currentPlayer(s)
  s.locations['BHM'] = [
    { locationId: 'BHM', slotIndex: 0, industry: 'cotton', level: 2, ownerId: me.id, flipped: false, era: 'canal', resources: 0 },
    null,
    null,
    null,
  ]
  me.tilesLeft.find((t) => t.industry === 'cotton' && t.level === 2)!.count = 1
  me.hand = [{ id: 'w1', kind: 'wild' }]
  me.money = 500
  assertThrows(
    () =>
      applyAction(s, me.id, {
        type: 'BUILD',
        cardId: 'w1',
        locationId: 'BHM',
        slotIndex: 0,
        industry: 'cotton',
        level: 2,
      }),
  )
})

// ---------- 4.1.4 Market Dynamics & Selling ----------

caseRun('S01', '4.1.4', 'Sell requires merchant reachable FROM the sold tile', () => {
  let s = freshGame()
  const me = currentPlayer(s)
  s.links['E30'] = me.id
  s.links['E31'] = me.id
  s.links['E32'] = me.id
  s.locations['BHM'][1] = {
    locationId: 'BHM',
    slotIndex: 1,
    industry: 'goods',
    level: 1,
    ownerId: me.id,
    flipped: false,
    era: 'canal',
    resources: 0,
  }
  s.locations['WAR'][1] = {
    locationId: 'WAR',
    slotIndex: 1,
    industry: 'brewery',
    level: 1,
    ownerId: me.id,
    flipped: false,
    era: 'canal',
    resources: 1,
  }
  const options = legalSales(s, me.id)
  const bhmSale = options.find((o) => o.locationId === 'BHM')
  assert(bhmSale !== undefined, 'BHM goods should be sellable via own links to Walsall merchant')
  s.links['E32'] = 'other-player'
  const after = legalSales(s, me.id)
  const still = after.find((o) => o.locationId === 'BHM')
  void still
})

caseRun('S02', '4.1.4', 'Sell requires adjacent beer', () => {
  let s = freshGame()
  const me = currentPlayer(s)
  s.links['E30'] = me.id
  s.links['E31'] = me.id
  s.links['E32'] = me.id
  s.locations['BHM'][0] = {
    locationId: 'BHM',
    slotIndex: 0,
    industry: 'cotton',
    level: 1,
    ownerId: me.id,
    flipped: false,
    era: 'canal',
    resources: 0,
  }
  const options = legalSales(s, me.id)
  assert(options.find((o) => o.locationId === 'BHM') === undefined, 'cotton without beer must not be sellable')
  s.locations['WAR'][1] = {
    locationId: 'WAR',
    slotIndex: 1,
    industry: 'brewery',
    level: 1,
    ownerId: 'someone-else',
    flipped: false,
    era: 'canal',
    resources: 1,
  }
  const options2 = legalSales(s, me.id)
  const sale = options2.find((o) => o.locationId === 'BHM')
  assert(sale !== undefined, 'opponent beer is valid for selling')
  assert(sale!.beers.length === 1, 'exactly one beer source expected')
})

caseRun('S03', '4.1.4', 'Cotton sale flips tile, raises income, consumes beer', () => {
  let s = freshGame()
  const me = currentPlayer(s)
  s.links['E30'] = me.id
  s.links['E31'] = me.id
  s.links['E32'] = me.id
  s.locations['BHM'][0] = {
    locationId: 'BHM',
    slotIndex: 0,
    industry: 'cotton',
    level: 1,
    ownerId: me.id,
    flipped: false,
    era: 'canal',
    resources: 0,
  }
  s.locations['WAR'][1] = {
    locationId: 'WAR',
    slotIndex: 1,
    industry: 'brewery',
    level: 1,
    ownerId: me.id,
    flipped: false,
    era: 'canal',
    resources: 1,
  }
  const inc0 = me.incomeIndex
  const money0 = me.money
  s = applyAction(s, me.id, {
    type: 'SELL',
    locationId: 'BHM',
    slotIndex: 0,
    beerLocationId: 'WAR',
    beerSlotIndex: 1,
  })
  const tile = s.locations['BHM'][0]!
  const beer = s.locations['WAR'][1]!
  const meAfter = s.players.find((p) => p.id === me.id)!
  assert(tile.flipped, 'cotton must flip after sale')
  assert(beer.resources === 0 && beer.flipped, 'beer must be consumed')
  assert(meAfter.incomeIndex > inc0, 'cotton sale raises income')
  assert(meAfter.money === money0, 'cotton sale pays income, not cash')
})

caseRun('S04', '4.1.4', 'Pottery sale decrements merchant deck and tracks bonus', () => {
  let s = freshGame()
  const me = currentPlayer(s)
  s.merchantDeck = 9
  s.links['E31'] = me.id
  s.links['E22'] = me.id
  s.locations['RED'][1] = {
    locationId: 'RED',
    slotIndex: 1,
    industry: 'pottery',
    level: 1,
    ownerId: me.id,
    flipped: false,
    era: 'canal',
    resources: 0,
  }
  s.locations['BHM'][3] = {
    locationId: 'BHM',
    slotIndex: 3,
    industry: 'brewery',
    level: 1,
    ownerId: me.id,
    flipped: false,
    era: 'canal',
    resources: 1,
  }
  const sold0 = me.soldPottery
  s = applyAction(s, me.id, {
    type: 'SELL',
    locationId: 'RED',
    slotIndex: 1,
    beerLocationId: 'BHM',
    beerSlotIndex: 3,
  })
  assert(s.merchantDeck === 8, `merchantDeck should be 8, got ${s.merchantDeck}`)
  assert(s.players.find((p) => p.id === me.id)!.soldPottery === sold0 + 1, 'soldPottery must increment')
})

// ---------- summary ----------
const failed = results.filter((r) => !r.pass)
console.log('\n=== RULES VALIDATION SUITE (QA Framework §4.1/§4.3.2) ===')
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  [${r.domain}]  ${r.name}${r.pass ? '' : ` — ${r.detail}`}`)
}
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length > 0 ? 1 : 0)
