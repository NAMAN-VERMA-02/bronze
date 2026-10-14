import {
  applyAction,
  createGame,
  legalBuildTargets,
  legalNetworkLinks,
  legalSales,
  currentPlayer,
  scorePlayer,
  type GameAction,
  type GameState,
} from '../src/index.js'

function pick<T>(arr: T[]): T | undefined {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomMove(state: GameState): GameAction {
  const pid = currentPlayer(state).id
  const roll = Math.random()
  const builds = legalBuildTargets(state, pid)
  if (roll < 0.55 && builds.length > 0) {
    const t = pick(builds)!
    return {
      type: 'BUILD',
      cardId: t.cardId,
      locationId: t.locationId,
      slotIndex: t.slotIndex,
      industry: t.industry,
      level: pick(t.levels)!,
    }
  }
  if (roll < 0.72) {
    const links = legalNetworkLinks(state, pid)
    if (links.length > 0) return { type: 'NETWORK', linkId: pick(links)! }
  }
  if (roll < 0.84) {
    const sales = legalSales(state, pid)
    if (sales.length > 0) {
      const s = pick(sales)!
      return {
        type: 'SELL',
        locationId: s.locationId,
        slotIndex: s.slotIndex,
        beerLocationId: s.beers[0].locationId,
        beerSlotIndex: s.beers[0].slotIndex,
      }
    }
  }
  if (roll < 0.9) {
    const withTiles = currentPlayer(state).tilesLeft.filter((t) => t.count > 0)
    if (withTiles.length >= 1) {
      const a = pick(withTiles)!
      const b = pick(withTiles)!
      const tiles =
        a === b || Math.random() < 0.5
          ? [{ industry: a.industry, level: a.level }]
          : [
              { industry: a.industry, level: a.level },
              { industry: b.industry, level: b.level },
            ]
      return { type: 'DEVELOP', tiles }
    }
  }
  if (roll < 0.94) return { type: 'LOAN' }
  return { type: 'PASS' }
}

let seed = 12345
for (let g = 0; g < 20; g++) {
  seed += 7919
  let state = createGame(['Alice', 'Bob'], seed)
  let steps = 0
  while (state.phase === 'playing') {
    if (++steps > 20000) throw new Error('game did not terminate')
    try {
      state = applyAction(state, currentPlayer(state).id, randomMove(state))
    } catch (e) {
      state = applyAction(state, currentPlayer(state).id, { type: 'PASS' })
    }
  }
  const scores = state.finalScores!
  for (const p of state.players) {
    const recomputed = scorePlayer(state, p.id)
    const reported = scores.find((s) => s.playerId === p.id)!.vp
    if (recomputed !== reported) throw new Error(`score mismatch ${recomputed} vs ${reported}`)
  }
  console.log(
    `game ${g}: ${steps} actions — winner ${scores[0].name} VP=${scores[0].vp} ` +
      `| canal builds=${state.discardPile.length ? '' : ''}era=${state.era} rounds=${state.round}`,
  )
}
console.log('SMOKE OK — 20 randomized full games completed with consistent scoring')
