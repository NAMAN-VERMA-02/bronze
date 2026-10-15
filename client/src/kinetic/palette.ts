// Shared visual palette — Victorian industrial, restrained.
export const PAL = {
  bg: 0x080705,
  table: 0x17100a,
  walnut: 0x2b2016,
  parchment: 0x251b11,
  brass: 0xb58a3a,
  brassBright: 0xd2ae5b,
  brassPale: 0xe4cc8a,
  iron: 0x23262b,
  steel: 0x6b6f76,
  brick: 0x5a3a26,
  darkWood: 0x3a2a18,
  copper: 0x7e5230,
  coal: 0x14151a,
  water: 0x16202a,
  waterLight: 0x243442,
  furnace: 0xff7a20,
  window: 0xffb45c,
  shadow: 0x000000,
} as const

export interface PlayerMeta {
  name: string
  hex: number
  css: string
}

export const PLAYER_META: PlayerMeta[] = [
  { name: 'Alex', hex: 0xc79a3f, css: '#c79a3f' },
  { name: 'Jordan', hex: 0x8e3b34, css: '#8e3b34' },
  { name: 'Sam', hex: 0x476c7a, css: '#476c7a' },
  { name: 'Nadia', hex: 0x5a7444, css: '#5a7444' },
]

export const INDUSTRY_LABEL: Record<string, string> = {
  coal: 'Coal Mine',
  iron: 'Iron Works',
  cotton: 'Cotton Mill',
  manufacturer: 'Manufacturer',
  pottery: 'Pottery',
  brewery: 'Brewery',
}
