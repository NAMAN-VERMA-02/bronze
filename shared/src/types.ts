export type IndustryType = 'cotton' | 'coal' | 'iron' | 'brewery' | 'goods' | 'pottery'
export type Era = 'canal' | 'rail'

export interface TileSpec {
  industry: IndustryType
  level: number
  era: Era
  cost: number
  vp: number
  linkValue: number
  coalRequired: number
  quantity: number
  developOnly?: boolean
  beerCapacity?: number
  production?: number
  sellIncome?: number
  sellMoney?: number
}

export interface MapLocation {
  id: string
  name: string
  x: number
  y: number
  merchant?: boolean
  slots: IndustryType[]
}

export interface MapLink {
  id: string
  a: string
  b: string
}

export interface Card {
  id: string
  kind: 'location' | 'industry' | 'wild'
  ref?: string
}

export interface PlacedTile {
  locationId: string
  slotIndex: number
  industry: IndustryType
  level: number
  ownerId: string
  flipped: boolean
  era: Era
  resources: number
}

export interface TileCount {
  industry: IndustryType
  level: number
  count: number
}

export interface PlayerState {
  id: string
  name: string
  color: string
  money: number
  incomeIndex: number
  loans: number
  hand: Card[]
  spentThisRound: number
  linksBuiltThisEra: number
  tilesLeft: TileCount[]
  soldPottery: number
}

export interface LogLine {
  seq: number
  text: string
}

export type GamePhase = 'playing' | 'game_end'

export interface FinalScore {
  playerId: string
  name: string
  vp: number
  money: number
}

export interface GameState {
  players: PlayerState[]
  order: string[]
  currentTurnIdx: number
  actionsLeft: number
  round: number
  era: Era
  locations: Record<string, (PlacedTile | null)[]>
  links: Record<string, string | null>
  coalMarket: number
  ironMarket: number
  drawPile: Card[]
  discardPile: Card[]
  merchantDeck: number
  log: LogLine[]
  logSeq: number
  phase: GamePhase
  finalScores: FinalScore[] | null
  justDeveloped: boolean
  rngState: number
}

export type GameAction =
  | { type: 'BUILD'; cardId: string; locationId: string; slotIndex: number; industry: IndustryType; level: number }
  | { type: 'NETWORK'; linkId: string }
  | { type: 'DEVELOP'; tiles: { industry: IndustryType; level: number }[] }
  | { type: 'LOAN' }
  | { type: 'SELL'; locationId: string; slotIndex: number; beerLocationId: string; beerSlotIndex: number }
  | { type: 'PASS' }

export interface BuildTarget {
  cardId: string
  locationId: string
  slotIndex: number
  industry: IndustryType
  levels: number[]
}

export interface SaleOption {
  locationId: string
  slotIndex: number
  beers: { locationId: string; slotIndex: number }[]
}

export class GameError extends Error {}
