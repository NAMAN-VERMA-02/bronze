import type { Card, GameState, PlayerState } from '../types.js'
import { HAND_SIZE } from '../data/tiles.js'
import { buildDeck } from '../data/cards.js'
import { LINKS, LOCATIONS } from '../data/map.js'
import { TILE_SPECS } from '../data/tiles.js'
import { shuffle } from './rng.js'

export const PLAYER_COLORS = ['#b23a48', '#2a7f8f', '#7c7c3a', '#6b4f8f']

export function createGame(names: string[], seed: number): GameState {
  const state: GameState = {
    players: names.map((name, i) => ({
      id: `p${i}`,
      name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      money: 17,
      incomeIndex: 4,
      loans: 0,
      hand: [],
      spentThisRound: 0,
      linksBuiltThisEra: 0,
      tilesLeft: TILE_SPECS.map((t) => ({ industry: t.industry, level: t.level, count: t.quantity })),
      soldPottery: 0,
    })),
    order: [],
    currentTurnIdx: 0,
    actionsLeft: 2,
    round: 1,
    era: 'canal',
    locations: Object.fromEntries(LOCATIONS.map((l) => [l.id, l.slots.map(() => null)])),
    links: Object.fromEntries(LINKS.map((l) => [l.id, null])),
    coalMarket: 14,
    ironMarket: 8,
    drawPile: [],
    discardPile: [],
    merchantDeck: 0,
    log: [],
    logSeq: 0,
    phase: 'playing',
    finalScores: null,
    justDeveloped: false,
    rngState: seed | 0,
  }
  shuffle(
    state,
    state.players.map((p) => p.id),
  ).forEach((id, i) => {
    state.order[i] = id
  })
  state.drawPile = shuffle(state, buildDeck())
  for (const p of state.players) {
    p.hand = state.drawPile.splice(0, HAND_SIZE)
  }
  addLog(state, `Game begins — ${state.players.length} players, Canal Era, ${names.join(' vs ')}`)
  return state
}

export function addLog(state: GameState, text: string): void {
  state.log.push({ seq: ++state.logSeq, text })
}

export function playerById(state: GameState, pid: string): PlayerState {
  const p = state.players.find((x) => x.id === pid)
  if (!p) throw new Error(`unknown player ${pid}`)
  return p
}

export function currentPlayer(state: GameState): PlayerState {
  return playerById(state, state.order[state.currentTurnIdx])
}
