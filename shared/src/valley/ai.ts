// AI rivals: score every legal action by how much it improves a valuation
// of the position, minus the time it costs. Personalities change weights;
// difficulty changes noise and look-ahead.

import {
  AGES, AGE_LENGTH, BUILDINGS, GOODS, LINKS, MONEY_PER_VP, TICKS, apply, buildingsOf, cheapestSource,
  currentPlayer, income, legalActions, player, price,
  type Action, type AIPersonality, type GameState,
} from './engine'

const WEIGHTS: Record<AIPersonality, { build: number; link: number; goods: number; money: number }> = {
  balanced: { build: 1, link: 1, goods: 1, money: 1 },
  baron: { build: 0.85, link: 1.6, goods: 0.9, money: 1 },
  industrialist: { build: 1.3, link: 0.8, goods: 1, money: 0.95 },
  trader: { build: 0.9, link: 0.9, goods: 1.25, money: 1.1 },
}

/** Value per time unit the AI expects to make; actions must beat it. */
const TIME_COST = 0.55

export function evaluate(s: GameState, pid: string): number {
  const p = player(s, pid)
  const w = WEIGHTS[p.personality]
  if (s.phase === 'ended') return p.vp * 10
  const agesLeft = AGES - s.age + 1
  const lateness = s.age === AGES ? Math.max(0.15, 1 - p.time / AGE_LENGTH) : 1
  let v = p.vp + (w.money * p.money) / MONEY_PER_VP
  for (const { town, b } of buildingsOf(s, pid)) {
    v += w.build * BUILDINGS[b.kind].vp[b.level - 1] * agesLeft
    for (const g of GOODS) {
      const n = b.goods[g] ?? 0
      if (!n) continue
      // Goods only count if they can still be turned into money.
      const reachable = s.contracts.some((c) => c.wants[g]) || cheapestSource(s, p, g, town, false) !== null
      v += (w.goods * n * price(s, g) * (reachable ? 0.85 : 0.5) * lateness) / MONEY_PER_VP
    }
    // Converters are worth more when their inputs are on the board.
    if (b.kind !== 'mine') v += 0.4 * b.level * lateness
  }
  for (const l of LINKS) {
    if (s.links[l.id] !== pid) continue
    const busy = s.plots[l.a].some(Boolean) && s.plots[l.b].some(Boolean) ? 1 : 0.3
    v += w.link * (busy * agesLeft * 0.8 + 0.6 * lateness)
  }
  const paydaysLeft = TICKS.filter((t) => t > p.time).length + 3 * (AGES - s.age)
  v += (income(s, pid) * paydaysLeft) / MONEY_PER_VP
  v -= p.bonds * 5
  // Ready-to-fill contracts are close to banked VP.
  for (const c of s.contracts) {
    let ok = true
    for (const g of GOODS) {
      const need = c.wants[g] ?? 0
      if (!need) continue
      let have = 0
      for (const o of buildingsOf(s, pid)) have += o.b.goods[g] ?? 0
      if (have < need) { ok = false; break }
    }
    if (ok) v += c.vp * 0.5 + c.money / MONEY_PER_VP / 3
  }
  return v
}

function timeOf(s: GameState, pid: string, a: Action, after: GameState): number {
  if (a.type === 'wait') return Math.max(1, player(after, pid).time - player(s, pid).time)
  return { build: 3, route: 2, run: 1, deliver: 2, trade: 1, bond: 1 }[a.type]
}

interface Scored { a: Action; score: number; after: GameState }

function scoreAll(s: GameState, pid: string): Scored[] {
  const base = evaluate(s, pid)
  const out: Scored[] = []
  for (const a of legalActions(s, pid)) {
    const after = apply(s, pid, a)
    const dt = timeOf(s, pid, a, after)
    let score = evaluate(after, pid) - base - dt * TIME_COST
    if (a.type === 'bond') score -= 1.5
    out.push({ a, score, after })
  }
  return out.sort((x, y) => y.score - x.score)
}

/** Seeded so replays and network play stay deterministic. */
function noise(s: GameState, i: number): number {
  const x = Math.sin((s.actions + 1) * 9301 + i * 49297) * 233280
  return x - Math.floor(x)
}

export function chooseAction(s: GameState, pid: string): Action {
  const p = player(s, pid)
  const scored = scoreAll(s, pid)
  if (!scored.length) return { type: 'wait' }
  if (p.difficulty === 'easy') {
    const top = scored.slice(0, 6)
    return top[Math.floor(noise(s, 1) * top.length)].a
  }
  if (p.difficulty === 'hard') {
    // Look one move ahead when the AI keeps the turn (cheap combos).
    let best = scored[0]
    let bestV = -Infinity
    for (const c of scored.slice(0, 6)) {
      let v = c.score
      if (currentPlayer(c.after)?.id === pid) {
        const ahead = scoreAll(c.after, pid)
        if (ahead.length) v += 0.6 * Math.max(0, ahead[0].score)
      }
      if (v > bestV) { bestV = v; best = c }
    }
    return best.a
  }
  // Normal: best move, with a small tie-break wobble between near-equals.
  const near = scored.filter((x) => x.score >= scored[0].score - 0.25)
  return near[Math.floor(noise(s, 2) * near.length)].a
}
