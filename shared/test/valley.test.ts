// Rule tests for the Aurel Valley engine. Run: npm test
import assert from 'node:assert/strict'
import {
  apply, check, createGame, currentPlayer, findPath, legalActions, price, network, PRICE_START,
  type GameState,
} from '../src/valley/engine'
import { chooseAction } from '../src/valley/ai'

let passed = 0
function test(name: string, fn: () => void): void {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

const two = () => createGame([{ name: 'Ada', isAI: false }, { name: 'Ben', isAI: false }], 42)
const turn = (s: GameState) => currentPlayer(s)!.id

test('first player acts first and time moves them back in line', () => {
  let s = two()
  assert.equal(turn(s), 'p0')
  s = apply(s, 'p0', { type: 'build', town: 'highford', slot: 0, kind: 'mine', level: 1 })
  assert.equal(s.players[0].time, 3)
  assert.equal(s.players[0].money, 24)
  assert.equal(turn(s), 'p1')
})

test('mines only on deposits; level II locked in Age I; network enforced', () => {
  const s = two()
  assert.match(check(s, 'p0', { type: 'build', town: 'aurel', slot: 0, kind: 'mine', level: 1 })!, /no deposit/)
  assert.match(check(s, 'p0', { type: 'build', town: 'highford', slot: 0, kind: 'mine', level: 2 })!, /unlocks/)
  const s2 = apply(s, 'p0', { type: 'build', town: 'highford', slot: 0, kind: 'mine', level: 1 })
  const s3 = apply(s2, 'p1', { type: 'wait' })
  assert.equal(turn(s3), 'p0')
  assert.match(check(s3, 'p0', { type: 'build', town: 'orrin', slot: 0, kind: 'mine', level: 1 })!, /not in or next to your network/)
})

test('land links are closed in Age I, river links cost £5', () => {
  let s = two()
  assert.match(check(s, 'p0', { type: 'route', link: 'northgate~coalby' })!, /Age II/)
  s = apply(s, 'p0', { type: 'route', link: 'northgate~highford' })
  assert.equal(s.players[0].money, 25)
  assert.ok(network(s, 'p0').has('highford'))
})

test('tolls: crossing a rival link pays them £1', () => {
  let s = two()
  s = apply(s, 'p0', { type: 'route', link: 'northgate~highford' }) // p0 t2
  s = apply(s, 'p1', { type: 'build', town: 'highford', slot: 0, kind: 'mine', level: 1 }) // p1 t3
  s = apply(s, 'p0', { type: 'wait' }) // p0 -> 4
  s = apply(s, 'p1', { type: 'run', town: 'highford', slot: 0 }) // p1 t4, 2 coal
  const path = findPath(s, 'p1', 'highford', 'northgate')!
  assert.equal(path.toll, 1)
  const before = s.players[0].money
  s = apply(s, 'p1', { type: 'trade', good: 'coal', qty: 1 })
  assert.equal(s.players[0].money, before + 1)
  assert.equal(s.priceIdx.coal, PRICE_START - 1)
})

test('smelter buys missing inputs from the exchange and the price rises', () => {
  let s = two()
  s = apply(s, 'p0', { type: 'build', town: 'highford', slot: 0, kind: 'smelter', level: 1 })
  s = apply(s, 'p1', { type: 'wait' })
  s = apply(s, 'p0', { type: 'route', link: 'northgate~highford' })
  s = apply(s, 'p1', { type: 'wait' })
  const cu = price(s, 'copper')
  s.players[0].money = 100
  s = apply(s, 'p0', { type: 'run', town: 'highford', slot: 0 })
  assert.equal(s.plots.highford[0]!.goods.bronze, 1)
  assert.ok(price(s, 'copper') > cu)
  assert.equal(s.players[0].stats.bronze, 1)
})

test('random AI games always finish, money never negative, VP sane', () => {
  for (let seed = 1; seed <= 6; seed++) {
    let s = createGame([
      { name: 'A', isAI: true, personality: 'balanced' },
      { name: 'B', isAI: true, personality: 'baron' },
      { name: 'C', isAI: true, personality: 'industrialist', difficulty: 'easy' },
    ], seed)
    let guard = 0
    while (s.phase === 'play') {
      const p = currentPlayer(s)!
      assert.ok(legalActions(s, p.id).length > 0)
      s = apply(s, p.id, chooseAction(s, p.id))
      for (const x of s.players) assert.ok(x.money >= 0, 'money went negative')
      assert.ok(++guard < 2000, 'game did not end')
    }
    assert.equal(s.final!.length, 3)
    assert.ok(s.final![0].vp > 10, `winner scored ${s.final![0].vp}`)
  }
})

console.log(`\n${passed} valley tests passed`)
