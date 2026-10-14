import type { MapLink, MapLocation } from '../types.js'

export const WORLD = { w: 1200, h: 1080 }

export const LOCATIONS: MapLocation[] = [
  { id: 'MAC', name: 'Macclesfield', x: 700, y: 70, slots: ['cotton', 'cotton'] },
  { id: 'LEK', name: 'Leek', x: 600, y: 150, merchant: true, slots: ['pottery', 'brewery'] },
  { id: 'BUR', name: 'Burslem', x: 505, y: 110, slots: ['pottery', 'coal', 'pottery'] },
  { id: 'STO', name: 'Stoke-on-Trent', x: 465, y: 215, slots: ['pottery', 'iron', 'coal'] },
  { id: 'TRE', name: 'Trentham', x: 575, y: 265, slots: ['pottery', 'brewery'] },
  { id: 'STN', name: 'Stone', x: 445, y: 320, slots: ['coal', 'brewery', 'goods'] },
  { id: 'UTX', name: 'Uttoxeter', x: 625, y: 340, slots: ['brewery', 'goods'] },
  { id: 'DER', name: 'Derby', x: 810, y: 270, slots: ['cotton', 'goods'] },
  { id: 'ASH', name: 'Ashby', x: 905, y: 395, slots: ['coal', 'iron'] },
  { id: 'STF', name: 'Stafford', x: 345, y: 370, slots: ['coal', 'goods'] },
  { id: 'CAN', name: 'Cannock', x: 405, y: 470, slots: ['coal', 'coal'] },
  { id: 'WOL', name: 'Wolverhampton', x: 330, y: 555, slots: ['coal', 'iron', 'goods'] },
  { id: 'WAL', name: 'Walsall', x: 460, y: 520, merchant: true, slots: ['coal', 'iron', 'goods'] },
  { id: 'SHW', name: 'Shrewsbury', x: 165, y: 430, slots: ['cotton', 'goods'] },
  { id: 'COB', name: 'Coalbrookdale', x: 115, y: 545, slots: ['iron', 'iron'] },
  { id: 'BRG', name: 'Bridgnorth', x: 225, y: 585, slots: ['coal', 'brewery'] },
  { id: 'DUD', name: 'Dudley', x: 365, y: 635, slots: ['coal', 'iron', 'brewery'] },
  { id: 'KID', name: 'Kidderminster', x: 245, y: 705, slots: ['goods', 'brewery'] },
  { id: 'BHM', name: 'Birmingham', x: 505, y: 655, slots: ['cotton', 'goods', 'pottery', 'brewery'] },
  { id: 'WOR', name: 'Worcester', x: 385, y: 800, merchant: true, slots: ['pottery', 'goods'] },
  { id: 'RED', name: 'Redditch', x: 570, y: 770, merchant: true, slots: ['goods', 'pottery'] },
  { id: 'GLO', name: 'Gloucester', x: 285, y: 900, merchant: true, slots: ['cotton', 'goods'] },
  { id: 'HER', name: 'Hereford', x: 135, y: 850, slots: ['brewery', 'goods'] },
  { id: 'COV', name: 'Coventry', x: 710, y: 610, slots: ['cotton', 'goods'] },
  { id: 'NUN', name: 'Nuneaton', x: 730, y: 490, merchant: true, slots: ['coal', 'pottery'] },
  { id: 'WAR', name: 'Warwick', x: 650, y: 730, slots: ['goods', 'brewery'] },
  { id: 'RUG', name: 'Rugby', x: 830, y: 690, slots: ['coal', 'goods'] },
  { id: 'BAN', name: 'Banbury', x: 775, y: 860, slots: ['brewery', 'goods'] },
  { id: 'OXF', name: 'Oxford', x: 890, y: 945, slots: ['cotton', 'goods'] },
  { id: 'REA', name: 'Reading', x: 1030, y: 995, slots: ['goods', 'goods'] },
]

const E = (id: string, a: string, b: string): MapLink => ({ id, a, b })

export const LINKS: MapLink[] = [
  E('E01', 'MAC', 'LEK'),
  E('E02', 'MAC', 'BUR'),
  E('E03', 'LEK', 'BUR'),
  E('E04', 'BUR', 'STO'),
  E('E05', 'STO', 'TRE'),
  E('E06', 'STO', 'STN'),
  E('E07', 'TRE', 'UTX'),
  E('E08', 'STN', 'UTX'),
  E('E09', 'STN', 'STF'),
  E('E10', 'STF', 'CAN'),
  E('E11', 'STF', 'WOL'),
  E('E12', 'UTX', 'DER'),
  E('E13', 'DER', 'ASH'),
  E('E14', 'ASH', 'NUN'),
  E('E15', 'CAN', 'WAL'),
  E('E16', 'CAN', 'WOL'),
  E('E17', 'WOL', 'DUD'),
  E('E18', 'WOL', 'BRG'),
  E('E19', 'WOL', 'WAL'),
  E('E20', 'WAL', 'BHM'),
  E('E21', 'DUD', 'KID'),
  E('E22', 'DUD', 'BHM'),
  E('E23', 'COB', 'BRG'),
  E('E24', 'COB', 'SHW'),
  E('E25', 'SHW', 'STF'),
  E('E26', 'SHW', 'BRG'),
  E('E27', 'BRG', 'KID'),
  E('E28', 'KID', 'BHM'),
  E('E29', 'KID', 'WOR'),
  E('E30', 'BHM', 'WAR'),
  E('E31', 'BHM', 'RED'),
  E('E32', 'BHM', 'COV'),
  E('E33', 'WOR', 'BHM'),
  E('E34', 'WOR', 'RED'),
  E('E35', 'WOR', 'GLO'),
  E('E36', 'GLO', 'HER'),
  E('E37', 'WOR', 'HER'),
  E('E38', 'WAR', 'BAN'),
  E('E39', 'WAR', 'RUG'),
  E('E40', 'RUG', 'COV'),
  E('E41', 'COV', 'NUN'),
  E('E42', 'BAN', 'OXF'),
  E('E43', 'OXF', 'REA'),
]

export const LOCATION_BY_ID = new Map(LOCATIONS.map((l) => [l.id, l]))
export const LINK_BY_ID = new Map(LINKS.map((l) => [l.id, l]))

export const NEIGHBORS: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {}
  for (const loc of LOCATIONS) m[loc.id] = []
  for (const lk of LINKS) {
    if (!m[lk.a].includes(lk.b)) m[lk.a].push(lk.b)
    if (!m[lk.b].includes(lk.a)) m[lk.b].push(lk.a)
  }
  return m
})()

export function locationName(id: string): string {
  return LOCATION_BY_ID.get(id)?.name ?? id
}
