// All tunable numbers for BRONZE: The Aurel Valley live here.
// The valley, its towns and its contracts are original to this game.

export type Good = 'coal' | 'copper' | 'tin' | 'bronze' | 'machine'
export type Deposit = 'coal' | 'copper' | 'tin'
export type BuildingKind = 'mine' | 'smelter' | 'works'
export type LinkKind = 'river' | 'land'

export const GOODS: Good[] = ['coal', 'copper', 'tin', 'bronze', 'machine']
export const RAW: Deposit[] = ['coal', 'copper', 'tin']

export interface TownDef {
  id: string
  name: string
  x: number
  z: number
  plots: number
  deposit?: Deposit
  port?: boolean
}

export interface LinkDef {
  id: string
  a: string
  b: string
  kind: LinkKind
}

export const TOWNS: TownDef[] = [
  { id: 'northgate', name: 'Northgate', x: 0, z: -10.4, plots: 0, port: true },
  { id: 'saltmouth', name: 'Saltmouth', x: -10.6, z: 9.4, plots: 0, port: true },
  { id: 'eastmarch', name: 'Eastmarch', x: 11.2, z: 0.8, plots: 0, port: true },
  { id: 'highford', name: 'Highford', x: -0.6, z: -7.6, plots: 2, deposit: 'coal' },
  { id: 'millbrook', name: 'Millbrook', x: -2.8, z: -5.2, plots: 2 },
  { id: 'aurel', name: 'Aurel', x: -1.2, z: -2.2, plots: 3 },
  { id: 'ferrybridge', name: 'Ferrybridge', x: -3.4, z: 1.0, plots: 2 },
  { id: 'kettlewell', name: 'Kettlewell', x: -5.4, z: 3.9, plots: 2, deposit: 'copper' },
  { id: 'lowmarsh', name: 'Lowmarsh', x: -7.8, z: 6.6, plots: 2 },
  { id: 'wendle', name: 'Wendle', x: 2.4, z: -1.0, plots: 2 },
  { id: 'orrin', name: 'Orrin', x: 6.0, z: -1.8, plots: 2, deposit: 'tin' },
  { id: 'tinhollow', name: 'Tinhollow', x: -8.2, z: -6.2, plots: 2, deposit: 'tin' },
  { id: 'coalby', name: 'Coalby', x: 3.6, z: -6.8, plots: 2, deposit: 'coal' },
  { id: 'redcliff', name: 'Redcliff', x: -9.4, z: -1.4, plots: 2, deposit: 'copper' },
  { id: 'ashworth', name: 'Ashworth', x: 7.8, z: -7.0, plots: 2, deposit: 'copper' },
  { id: 'greystone', name: 'Greystone', x: 2.4, z: 3.2, plots: 3 },
  { id: 'harrowgate', name: 'Harrowgate', x: 6.4, z: 5.8, plots: 2, deposit: 'tin' },
  { id: 'bellmoor', name: 'Bellmoor', x: 0.8, z: 7.6, plots: 2, deposit: 'coal' },
  { id: 'dunmere', name: 'Dunmere', x: -4.0, z: 8.6, plots: 2 },
  { id: 'stannick', name: 'Stannick', x: -6.2, z: -2.8, plots: 1, deposit: 'coal' },
  { id: 'fenwick', name: 'Fenwick', x: 9.2, z: 4.0, plots: 2, deposit: 'copper' },
]

function L(a: string, b: string, kind: LinkKind): LinkDef {
  return { id: `${a}~${b}`, a, b, kind }
}

// The Aurel river runs north to south-west; a tributary runs east to Eastmarch.
export const LINKS: LinkDef[] = [
  L('northgate', 'highford', 'river'),
  L('highford', 'millbrook', 'river'),
  L('millbrook', 'aurel', 'river'),
  L('aurel', 'ferrybridge', 'river'),
  L('ferrybridge', 'kettlewell', 'river'),
  L('kettlewell', 'lowmarsh', 'river'),
  L('lowmarsh', 'saltmouth', 'river'),
  L('lowmarsh', 'dunmere', 'river'),
  L('aurel', 'wendle', 'river'),
  L('wendle', 'orrin', 'river'),
  L('orrin', 'eastmarch', 'river'),
  L('northgate', 'coalby', 'land'),
  L('highford', 'coalby', 'land'),
  L('coalby', 'ashworth', 'land'),
  L('coalby', 'wendle', 'land'),
  L('ashworth', 'orrin', 'land'),
  L('orrin', 'fenwick', 'land'),
  L('fenwick', 'eastmarch', 'land'),
  L('fenwick', 'harrowgate', 'land'),
  L('harrowgate', 'eastmarch', 'land'),
  L('harrowgate', 'greystone', 'land'),
  L('greystone', 'wendle', 'land'),
  L('greystone', 'ferrybridge', 'land'),
  L('greystone', 'bellmoor', 'land'),
  L('bellmoor', 'dunmere', 'land'),
  L('dunmere', 'saltmouth', 'land'),
  L('northgate', 'tinhollow', 'land'),
  L('tinhollow', 'millbrook', 'land'),
  L('tinhollow', 'stannick', 'land'),
  L('stannick', 'redcliff', 'land'),
  L('stannick', 'aurel', 'land'),
  L('redcliff', 'kettlewell', 'land'),
  L('redcliff', 'saltmouth', 'land'),
]

export const TOWN_BY_ID = new Map(TOWNS.map((t) => [t.id, t]))
export const LINK_BY_ID = new Map(LINKS.map((l) => [l.id, l]))

export interface BuildingSpec {
  cost: [number, number, number]
  vp: [number, number, number]
  income: [number, number, number]
  /** Mines: units produced per Run. Converters: max batches per Run. */
  output: [number, number, number]
  stock: number
}

export const BUILDINGS: Record<BuildingKind, BuildingSpec> = {
  mine: { cost: [6, 10, 15], vp: [1, 1, 2], income: [1, 1, 2], output: [2, 3, 4], stock: 6 },
  smelter: { cost: [12, 18, 26], vp: [1, 2, 3], income: [1, 2, 3], output: [1, 2, 3], stock: 3 },
  works: { cost: [16, 24, 34], vp: [2, 3, 4], income: [2, 3, 4], output: [1, 2, 3], stock: 2 },
}

export const RECIPES: Record<'smelter' | 'works', { in: Partial<Record<Good, number>>; out: Good }> = {
  smelter: { in: { copper: 2, tin: 1, coal: 1 }, out: 'bronze' },
  works: { in: { bronze: 2, coal: 1 }, out: 'machine' },
}

/** Goods a single building can hold. */
export const STORAGE_CAP = 8

export const PRICES: Record<Good, number[]> = {
  coal: [1, 2, 2, 3, 3, 4, 5, 6],
  copper: [2, 2, 3, 3, 4, 5, 6, 7],
  tin: [2, 3, 3, 4, 5, 6, 7, 8],
  bronze: [8, 10, 11, 12, 14, 16, 18, 21],
  machine: [18, 21, 24, 27, 30, 34, 38, 42],
}
export const PRICE_START = 3

export const ACTION_TIME = { build: 3, route: 2, run: 1, deliver: 2, trade: 1, bond: 1 } as const
export const AGE_LENGTH = 18
export const TICKS = [6, 12, 18]
export const AGES = 3
export const START_MONEY = 30
export const BASE_INCOME = 4
/** Works (arms forges) open in this Age. */
export const WORKS_AGE = 2
export const RIVER_COST = 5
export const LAND_COST = 8
export const LAND_COAL = 1
export const TOLL = 1
export const BOND_AMOUNT = 20
export const BOND_INCOME = 3
export const MAX_BONDS = 3
export const BOND_END_VP = 5
export const MONEY_PER_VP = 4
export const CONTRACT_ROW = 4
export const CONTRACT_AGING = 2
export const GOAL_VP: [number, number] = [8, 4]

/** Most marks a single Wait can collect. */
export const WAIT_CAP = 2

// Contract templates per Age. Rewards are computed from good values so the
// numbers stay consistent when prices are tuned.
export const GOOD_VALUE: Record<Good, number> = { coal: 4, copper: 5, tin: 6, bronze: 20, machine: 44 }
export const GOOD_VP: Record<Good, number> = { coal: 1, copper: 1, tin: 1.2, bronze: 3.5, machine: 8 }

export const CONTRACT_TEMPLATES: Partial<Record<Good, number>>[][] = [
  [
    { coal: 2 }, { coal: 3 }, { copper: 2 }, { copper: 3 }, { tin: 2 }, { copper: 1, tin: 1 },
    { coal: 1, copper: 2 }, { bronze: 1 }, { bronze: 1 }, { bronze: 2 }, { tin: 3 }, { coal: 2, tin: 1 },
  ],
  [
    { bronze: 1 }, { bronze: 2 }, { bronze: 2 }, { bronze: 3 }, { bronze: 1, coal: 2 }, { machine: 1 },
    { machine: 1 }, { tin: 3 }, { copper: 4 }, { bronze: 2, tin: 1 }, { machine: 1, coal: 1 }, { coal: 4 },
  ],
  [
    { machine: 1 }, { machine: 2 }, { machine: 2 }, { machine: 3 }, { machine: 1, bronze: 2 }, { bronze: 3 },
    { bronze: 4 }, { machine: 2, coal: 2 }, { bronze: 2, tin: 2 }, { machine: 1, bronze: 1 }, { copper: 5 }, { machine: 2, bronze: 1 },
  ],
]

export type EventEffect =
  | { kind: 'price'; good: Good; steps: number }
  | { kind: 'landDiscount'; amount: number }
  | { kind: 'riverSurcharge'; amount: number }
  | { kind: 'contractBonus'; amount: number }
  | { kind: 'reliefLowest'; amount: number }
  | { kind: 'none' }

export interface EventDef {
  id: string
  title: string
  text: string
  effect: EventEffect
}

export const EVENTS: EventDef[] = [
  { id: 'tinrush', title: 'Tin Rush', text: 'Prospectors flood the hills. Tin falls 2 steps.', effect: { kind: 'price', good: 'tin', steps: -2 } },
  { id: 'copperglut', title: 'Copper Glut', text: 'Too much ore at the wharves. Copper falls 2 steps.', effect: { kind: 'price', good: 'copper', steps: -2 } },
  { id: 'coalshort', title: 'Coal Shortage', text: 'A hard winter. Coal rises 2 steps.', effect: { kind: 'price', good: 'coal', steps: 2 } },
  { id: 'foundry', title: 'Foundry Fever', text: 'Bell-makers want bronze. Bronze rises 2 steps.', effect: { kind: 'price', good: 'bronze', steps: 2 } },
  { id: 'slump', title: 'Bronze Slump', text: 'Cheap imports land. Bronze falls 2 steps.', effect: { kind: 'price', good: 'bronze', steps: -2 } },
  { id: 'machineage', title: 'Machine Age', text: 'Mills retool. Machines rise 2 steps.', effect: { kind: 'price', good: 'machine', steps: 2 } },
  { id: 'railboom', title: 'Road Boom', text: 'Roads cost 2 marks less until the next tick.', effect: { kind: 'landDiscount', amount: 2 } },
  { id: 'flood', title: 'Flood Season', text: 'River links cost 2 marks more until the next tick.', effect: { kind: 'riverSurcharge', amount: 2 } },
  { id: 'fair', title: 'Merchant Fair', text: 'Every open contract pays 3 marks more.', effect: { kind: 'contractBonus', amount: 3 } },
  { id: 'relief', title: "Patron's Gift", text: 'The lord with the least glory receives 6 marks.', effect: { kind: 'reliefLowest', amount: 6 } },
  { id: 'calm', title: 'Calm Markets', text: 'Nothing stirs this season.', effect: { kind: 'none' } },
]

export type GoalId =
  | 'contracts' | 'routes' | 'tolls' | 'level3' | 'machines' | 'deposits' | 'ports' | 'bronze'

export const GOALS: { id: GoalId; title: string; text: string }[] = [
  { id: 'contracts', title: 'The Contractor', text: 'Most contracts filled' },
  { id: 'routes', title: 'The Navigator', text: 'Most links owned' },
  { id: 'tolls', title: 'The Toll Keeper', text: 'Most tolls earned' },
  { id: 'level3', title: 'The Magnate', text: 'Most level III buildings' },
  { id: 'machines', title: 'The Engineer', text: 'Most machines delivered' },
  { id: 'deposits', title: 'The Prospector', text: 'Most deposit types mined (coal, copper, tin)' },
  { id: 'ports', title: 'The Harbourmaster', text: 'Most ports reachable over your own links' },
  { id: 'bronze', title: 'The Founder', text: 'Most bronze smelted' },
]

export const AI_NAMES = ['Hesketh', 'Marrow', 'Quill', 'Ottoline']
export const PLAYER_COLORS = ['#c79a3f', '#a2443a', '#4f7f92', '#6a8a4c']
