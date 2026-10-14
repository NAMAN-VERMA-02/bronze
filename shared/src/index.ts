export * from './types.js'
export * from './data/map.js'
export * from './data/tiles.js'
export * from './data/cards.js'
export * from './engine/rng.js'
export * from './engine/setup.js'
export * from './engine/logic.js'

import type { GameState } from './types.js'
import { playerById } from './engine/setup.js'

export function redactFor(state: GameState, youId: string): GameState & { youId: string } {
  return {
    ...state,
    youId,
    players: state.players.map((p) =>
      p.id === youId ? p : { ...p, hand: [], linksBuiltThisEra: 0, tilesLeft: [] },
    ),
  }
}
