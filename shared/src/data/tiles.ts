import type { IndustryType, TileSpec } from '../types.js'

export const INDUSTRY_LABEL: Record<IndustryType, string> = {
  cotton: 'C',
  coal: 'L',
  iron: 'I',
  brewery: 'B',
  goods: 'G',
  pottery: 'P',
}

export const INDUSTRY_NAME: Record<IndustryType, string> = {
  cotton: 'Cotton Mill',
  coal: 'Coal Mine',
  iron: 'Iron Works',
  brewery: 'Brewery',
  goods: 'Manufactured Goods',
  pottery: 'Pottery',
}

function spec(
  industry: IndustryType,
  era: 'canal' | 'rail',
  levels: [number, number, number, number][],
  quantities: number[],
): TileSpec[] {
  return levels.map(([level, cost, vp, linkValue], i) => {
    const s: TileSpec = {
      industry,
      level,
      era,
      cost,
      vp,
      linkValue,
      coalRequired: 0,
      quantity: quantities[i],
    }
    if (industry === 'cotton') {
      s.coalRequired = level >= 7 ? 2 : 1
      s.sellIncome = 4 + level
    }
    if (industry === 'coal') s.production = Math.min(5, 2 + Math.floor((level - 1) / 2))
    if (industry === 'iron') s.production = Math.min(6, 2 + Math.floor(level / 2))
    if (industry === 'brewery') s.beerCapacity = era === 'canal' ? 1 : 2
    if (industry === 'goods') {
      s.coalRequired = 1
      s.sellMoney = 12 + level * 2
    }
    if (industry === 'pottery') {
      s.coalRequired = 1
      s.sellMoney = 12 + level * 2
      if (level === 3 || level === 4 || level === 7 || level === 8) s.developOnly = true
    }
    return s
  })
}

export const TILE_SPECS: TileSpec[] = [
  ...spec('cotton', 'canal', [[1, 12, 5, 3], [2, 14, 7, 4], [3, 16, 9, 5], [4, 18, 11, 6]], [2, 2, 1, 1]),
  ...spec('cotton', 'rail', [[5, 20, 13, 7], [6, 22, 15, 8], [7, 26, 17, 9], [8, 30, 19, 10]], [1, 2, 2, 1]),
  ...spec('coal', 'canal', [[1, 5, 1, 1], [2, 7, 2, 1], [3, 9, 3, 1], [4, 12, 4, 1]], [1, 2, 2, 1]),
  ...spec('coal', 'rail', [[5, 15, 5, 2], [6, 18, 6, 2], [7, 22, 7, 2], [8, 26, 8, 2]], [1, 2, 2, 1]),
  ...spec('iron', 'canal', [[1, 5, 3, 1], [2, 7, 4, 1], [3, 9, 5, 1], [4, 12, 6, 2]], [1, 2, 2, 1]),
  ...spec('iron', 'rail', [[5, 15, 7, 2], [6, 18, 8, 3], [7, 21, 9, 3], [8, 25, 10, 3]], [1, 2, 2, 1]),
  ...spec('brewery', 'canal', [[1, 5, 4, 1], [2, 7, 5, 1], [3, 9, 6, 1], [4, 12, 7, 2]], [2, 2, 1, 1]),
  ...spec('brewery', 'rail', [[5, 15, 8, 2], [6, 18, 9, 2], [7, 21, 10, 2], [8, 25, 11, 2]], [2, 2, 1, 1]),
  ...spec('goods', 'canal', [[1, 8, 5, 3], [2, 10, 6, 4], [3, 14, 7, 5], [4, 17, 8, 6]], [2, 2, 1, 1]),
  ...spec('goods', 'rail', [[5, 8, 5, 3], [6, 10, 6, 4], [7, 14, 7, 5], [8, 17, 8, 6]], [2, 2, 1, 1]),
  ...spec('pottery', 'canal', [[1, 17, 10, 4], [2, 20, 11, 4], [3, 0, 12, 5], [4, 0, 13, 6]], [2, 2, 1, 1]),
  ...spec('pottery', 'rail', [[5, 23, 10, 5], [6, 26, 11, 5], [7, 0, 12, 6], [8, 0, 13, 7]], [2, 2, 1, 1]),
].flat()

const SPEC_KEY = new Map<string, TileSpec>()
for (const t of TILE_SPECS) SPEC_KEY.set(`${t.industry}:${t.level}`, t)

export function tileSpec(industry: IndustryType, level: number): TileSpec {
  const s = SPEC_KEY.get(`${industry}:${level}`)
  if (!s) throw new Error(`no tile spec for ${industry}:${level}`)
  return s
}

export function specsForEra(era: 'canal' | 'rail'): TileSpec[] {
  return TILE_SPECS.filter((t) => t.era === era)
}

export const INCOME_TRACK = [-10, -5, 0, 5, 10, 15, 20, 25, 30]

export function coalPrice(n: number): number {
  if (n <= 0) return 5
  if (n === 1) return 4
  if (n === 2) return 3
  if (n <= 5) return 2
  return 1
}

export function ironPrice(n: number): number {
  if (n <= 0) return 4
  if (n === 1) return 4
  if (n === 2) return 3
  if (n <= 4) return 2
  return 1
}

export const HAND_SIZE = 8
export const ROUNDS_PER_ERA = 10
export const LOAN_AMOUNT = 30
export const START_MONEY = 17
export const CANAL_LINK_COST = 5
export const RAIL_LINK_BASE_COST = 5
export const RAIL_LINK_ESCALATION = 2
export const IRON_PER_LINK = 1
export const COAL_MARKET_START = 14
export const IRON_MARKET_START = 8
export const MERCHANT_DECK_SIZE = 9
export const POTTERY_BONUS_VP = 2
