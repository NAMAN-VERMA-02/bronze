// One test per Bronze rule, each from a fresh two-player game so they stay independent.
import {
  createInitialGameState,
  currentPlayer,
  playerById,
  advanceTurn,
  resolveBuild,
  resolveNetwork,
  resolveDevelop,
  resolveSell,
  resolveLoan,
  resolvePass,
  allBuildOptions,
  legalNetworkLinks,
  roundsPerEra,
  HAND_LIMIT,
  SUPPLY_TEMPLATE,
  INDUSTRY_SPEC,
  type GameState,
  type Card,
  type PlacedIndustry,
  type IndustryType,
} from '../src/bronze/state.js'

let failed = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

const SEATS = [
  { name: 'A', isAI: false },
  { name: 'B', isAI: false },
]

function fresh(): GameState {
  return createInitialGameState(SEATS, 42)
}

/** Gives the current player a wild location card so they can build anywhere. */
function withWild(s: GameState): { me: ReturnType<typeof currentPlayer>; card: Card } {
  const me = currentPlayer(s)
  const card: Card = { id: 'test-wild', cityId: null, kind: 'wild-location' }
  me.hand.unshift(card)
  return { me, card }
}

function place(s: GameState, cityId: string, kind: IndustryType, ownerId: string, level: 1 | 2 = 1): PlacedIndustry {
  const slot = s.placed.filter((t) => t.cityId === cityId).length
  const t: PlacedIndustry = {
    key: `${cityId}:${slot}`,
    cityId,
    slot,
    kind,
    level,
    ownerId,
    flipped: false,
    scored: false,
    resources: kind === 'brewery' ? level : 0,
  }
  s.placed.push(t)
  return t
}

// ---------- Setup ----------
{
  const s = fresh()
  const me = currentPlayer(s)
  check('every player starts with a full hand of eight cards', s.players.every((p) => p.hand.length === HAND_LIMIT))
  check('players start with the printed supply of tiles', JSON.stringify(me.supply) === JSON.stringify(SUPPLY_TEMPLATE))
  check('the first canal round gives each player one action', s.players.every((p) => p.actionsLeft === 1))
  check('rounds per era follow player count: 2p=10, 3p=9, 4p=8', roundsPerEra(2) === 10 && roundsPerEra(3) === 9 && roundsPerEra(4) === 8)
  check('the game starts in the canal era', s.era === 'canal' && s.round === 1)
}

// ---------- Loan ----------
{
  const s = fresh()
  const me = currentPlayer(s)
  const money = me.money
  const err = resolveLoan(s, me.id)
  check('a loan gives £30 and lowers income by three levels', !err && me.money === money + 30 && me.income === -3)
  const s2 = fresh()
  const p2 = currentPlayer(s2)
  p2.income = -7
  check('a loan is refused when income cannot fall further', resolveLoan(s2, p2.id) !== null)
}

// ---------- Pass / card use ----------
{
  const s = fresh()
  const me = currentPlayer(s)
  const before = me.hand.length
  const discards = s.discard.length
  check('passing is allowed', resolvePass(s, me.id) === null)
  check('every action discards one card', me.hand.length === before - 1 && s.discard.length === discards + 1)
}

// ---------- Build ----------
{
  const s = fresh()
  const { me, card } = withWild(s)
  const money = me.money
  const err = resolveBuild(s, me.id, card.id, 'birmingham', 'cotton')
  const tile = s.placed.find((t) => t.cityId === 'birmingham')
  check('building places the tile and pays its printed cost', !err && !!tile && me.money === money - INDUSTRY_SPEC.cotton[0].cost.money, err ?? '')
  check('building uses up one tile from the supply', me.supply.cotton.l1 === SUPPLY_TEMPLATE.cotton.l1 - 1)
  check('building spends the chosen card', !me.hand.some((c) => c.id === card.id))
  check('a placed industry belongs to the builder at level one', tile?.ownerId === me.id && tile?.level === 1)
}
{
  const s = fresh()
  const { me, card } = withWild(s)
  const err = resolveBuild(s, me.id, card.id, 'birmingham', 'coal')
  check('building a coal mine raises income by its printed amount', !err && me.income === INDUSTRY_SPEC.coal[0].income, err ?? '')
}
{
  const s = fresh()
  const { me, card } = withWild(s)
  check('pottery cannot be built in the canal era', resolveBuild(s, me.id, card.id, 'birmingham', 'pottery') !== null)
}
{
  const s = fresh()
  const { me } = withWild(s)
  const err = resolveBuild(s, me.id, 'no-such-card', 'birmingham', 'cotton')
  check('building with a card you do not hold is refused', err !== null && s.placed.length === 0)
  void me
}
{
  const s = fresh()
  const { me, card } = withWild(s)
  me.money = 1
  check('building without enough money is refused', resolveBuild(s, me.id, card.id, 'birmingham', 'cotton') !== null)
}
{
  const s = fresh()
  const { me, card } = withWild(s)
  check('a brewery cannot be built away from your network', resolveBuild(s, me.id, card.id, 'birmingham', 'brewery') !== null)
}
{
  const s = fresh()
  const { me } = withWild(s)
  const rival = s.players.find((p) => p.id !== me.id)!
  place(s, 'birmingham', 'cotton', me.id, 1)
  place(s, 'birmingham', 'manufacturer', rival.id, 1)
  place(s, 'birmingham', 'manufacturer', rival.id, 1)
  me.supply.cotton.l1 = 0 // only level two cotton tiles remain
  const up = allBuildOptions(s, me.id).filter((o) => o.overbuildKey && o.kind === 'cotton' && o.level === 2)
  check('you can overbuild your own tile with a higher level when the town is full', up.length > 0)
  const manu = allBuildOptions(s, me.id).filter((o) => o.overbuildKey && o.kind === 'manufacturer')
  check('you cannot overbuild a rival manufacturer', manu.length === 0)
}

// ---------- Network ----------
{
  const s = fresh()
  const me = currentPlayer(s)
  const money = me.money
  const err = resolveNetwork(s, me.id, 'stafford~stone')
  check('a canal link costs £3 and becomes yours', !err && me.money === money - 3 && s.linksOwned['stafford~stone'] === me.id, err ?? '')
  check('a built link counts toward your link total', me.linksBuilt === 1)
  check('a link cannot be built twice', resolveNetwork(s, s.order.find((id) => id !== me.id)!, 'stafford~stone') !== null)
}
{
  const s = fresh()
  const me = currentPlayer(s)
  check('rail links cannot be built in the canal era', resolveNetwork(s, me.id, 'stoke~uttoxeter') !== null)
  check('an unknown route is refused', resolveNetwork(s, me.id, 'nowhere~nothing') !== null)
}
{
  const s = fresh()
  const me = currentPlayer(s)
  resolveNetwork(s, me.id, 'stafford~stone')
  const legal = legalNetworkLinks(s, me.id).map((l) => l.id)
  check('later links must connect to your network', legal.includes('stafford~cannock') && !legal.includes('coventry~birmingham'))
  check('a link away from your network is refused', resolveNetwork(s, me.id, 'coventry~birmingham') !== null)
}

// ---------- Develop ----------
{
  const s = fresh()
  const me = currentPlayer(s)
  const left = me.developLeft
  const err = resolveDevelop(s, me.id, ['cotton'])
  check('developing removes the lowest tile of that industry', !err && me.supply.cotton.l1 === SUPPLY_TEMPLATE.cotton.l1 - 1, err ?? '')
  check('developing uses up a development', me.developLeft === left - 1)
}
{
  const s = fresh()
  const me = currentPlayer(s)
  check('pottery cannot be developed in the canal era', resolveDevelop(s, me.id, ['pottery']) !== null)
  check('develop removes one or two industries, no more', resolveDevelop(s, me.id, ['cotton', 'coal', 'iron']) !== null)
}
{
  const s = fresh()
  const me = currentPlayer(s)
  me.developLeft = 0
  check('develop is refused once developments run out', resolveDevelop(s, me.id, ['cotton']) !== null)
}

// ---------- Sell ----------
{
  const s = fresh()
  const me = currentPlayer(s)
  const t = place(s, 'birmingham', 'cotton', me.id)
  const money = me.money
  const err = resolveSell(s, me.id, t.key)
  check('selling pays the sale value and flips the tile', !err && t.flipped && me.money === money + 10, err ?? '')
  check('selling scores the tile\'s victory points', me.vp === INDUSTRY_SPEC.cotton[0].vp)
}
{
  const s = fresh()
  const me = currentPlayer(s)
  const rival = s.players.find((p) => p.id !== me.id)!
  const t = place(s, 'birmingham', 'cotton', rival.id)
  check('you cannot sell an industry that is not yours', resolveSell(s, me.id, t.key) !== null)
}
{
  const s = fresh()
  const me = currentPlayer(s)
  place(s, 'birmingham', 'coal', me.id)
  check('coal mines are not sellable goods', resolveSell(s, me.id, 'birmingham:0') !== null)
}
{
  const s = fresh()
  const me = currentPlayer(s)
  for (const id of ['worcester~gloucester', 'kidderminster~worcester', 'kidderminster~birmingham']) s.linksOwned[id] = me.id
  const a = place(s, 'birmingham', 'cotton', me.id)
  const b = place(s, 'birmingham', 'cotton', me.id)
  const income = me.income
  resolveSell(s, me.id, a.key)
  check('a merchant bonus applies on the first sale through it', me.income === income + 1 && s.merchantBonusUsed['gloucester'] === me.id)
  resolveSell(s, me.id, b.key)
  check('a merchant bonus is only granted once', me.income === income + 1)
}

// ---------- Turn and round flow ----------
{
  const s = fresh()
  const [first, second] = s.order
  advanceTurn(s)
  check('after one action the next player takes their turn', currentPlayer(s).id === second && first !== second)
  advanceTurn(s)
  check('after both players act the round advances', s.round === 2)
  check('later rounds give each player two actions', s.players.every((p) => p.actionsLeft === 2))
}
{
  const s = fresh()
  const [first] = s.order
  const me = playerById(s, first)
  me.income = 4
  const money = me.money
  advanceTurn(s)
  advanceTurn(s)
  check('income is paid at the end of the round', me.money === money + 4)
}
{
  const s = fresh()
  const [first, second] = s.order
  playerById(s, first).spent = 9
  playerById(s, second).spent = 2
  advanceTurn(s)
  advanceTurn(s)
  check('turn order for the next round follows least money spent first', s.order[0] === second && s.order[1] === first)
  check('spending resets for the new round', s.players.every((p) => p.spent === 0))
}
{
  const s = fresh()
  const me = playerById(s, s.order[0])
  me.income = -3
  const vp = me.vp
  const money = me.money
  advanceTurn(s)
  advanceTurn(s)
  check('a negative income costs money and victory points at round end', me.money === money - 3 && me.vp === vp - 3)
}
{
  const s = fresh()
  s.players.forEach((p) => (p.hand = p.hand.slice(0, 3)))
  advanceTurn(s)
  advanceTurn(s)
  check('hands are refilled toward eight after each turn', s.players.every((p) => p.hand.length === HAND_LIMIT))
}

// ---------- Era scoring ----------
function finishEra(s: GameState): void {
  let guard = 0
  const era = s.era
  while (s.era === era && !s.over && guard++ < 200) {
    const p = currentPlayer(s)
    resolvePass(s, p.id)
    advanceTurn(s)
  }
}
{
  const s = fresh()
  const me = playerById(s, s.order[0])
  s.linksOwned['stafford~stone'] = me.id // stone is a town (1), stafford a city (2)
  place(s, 'birmingham', 'cotton', me.id, 1).flipped = true
  const before = me.vp
  finishEra(s)
  check('the canal era ends and the rail era begins', s.era === 'rail' && s.round === 1)
  check('links score one VP per adjacent town and two per city', me.vp >= before + 3, `vp ${before} -> ${me.vp}`)
  check('flipped industries score their victory points at era end', me.vp >= before + 3 + INDUSTRY_SPEC.cotton[0].vp)
  check('level one industries leave the board after the canal era', s.placed.every((t) => t.level > 1))
  check('players get two developments for the rail era', s.players.every((p) => p.developLeft === 2))
  check('pottery becomes buildable in the rail era when you have beer', (() => {
    const { me: m, card } = withWild(s)
    m.money = 100
    m.beer = 1
    return resolveBuild(s, m.id, card.id, 'birmingham', 'pottery') === null
  })())
}
{
  const s = fresh()
  const rounds: Record<string, number> = { canal: 0, rail: 0 }
  while (!s.over) {
    rounds[s.era] = Math.max(rounds[s.era], s.round)
    resolvePass(s, currentPlayer(s).id)
    advanceTurn(s)
  }
  check('the game ends after the rail era', s.over)
  check('each era lasts the same number of rounds', rounds.canal === roundsPerEra(2) && rounds.rail === roundsPerEra(2), JSON.stringify(rounds))
}

console.log(failed === 0 ? '\nBronze rule tests passed' : `\n${failed} rule test(s) FAILED`)
process.exit(failed === 0 ? 0 : 1)
