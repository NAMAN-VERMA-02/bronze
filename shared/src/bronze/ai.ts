import {
  type GameState,
  type PlayerState,
  allBuildOptions,
  legalNetworkLinks,
  sellableIndustries,
  legalActions,
  getLegalDevelopments,
  applyBuild,
  applyNetwork,
  resolveDevelop,
  applySell,
  applyLoan,
  CITY_BY_ID,
} from './state.js'

// AI plays through the SAME rule engine as humans — it queries legal
// actions and calls the same apply* mutations. It never touches visuals.

export interface AIResult {
  ok: boolean
  detail: string
}

interface Candidate {
  score: number
  label: string
  run: () => string | null // null = success; string = failure reason
}

export function aiAct(s: GameState, playerId: string): AIResult {
  const p = playerOf(s, playerId)
  const difficulty = p.difficulty ?? 'normal'
  const personality = p.personality ?? 'industrialist'
  const legal = legalActions(s, playerId)

  const candidates: Candidate[] = []

  // ---- SELL ----
  if (legal.SELL) {
    for (const t of sellableIndustries(s, playerId)) {
      candidates.push({
        score: personality === 'opportunist' ? 9 : 6,
        label: `sold goods in ${CITY_BY_ID.get(t.cityId)!.name}`,
        run: () => {
          const e = applySell(s, playerId, t.key)
          return e === null ? `sold goods in ${CITY_BY_ID.get(t.cityId)!.name}` : null
        },
      })
    }
  }

  // ---- BUILD (engine-driven: every legal card × city × lowest level) ----
  if (legal.BUILD) {
    for (const o of allBuildOptions(s, playerId)) {
      let score = 4 + o.spec.vp * 0.8 - o.cost.money * 0.08 + o.spec.income * 1.1
      if (personality === 'industrialist') score += 2 + o.spec.income * 0.9
      if (personality === 'aggressive') score += o.level === 2 ? 3 : -0.5
      if (difficulty === 'hard') score += o.spec.income * 1.1 + o.spec.vp * 0.3
      if (difficulty === 'easy') score = 5 + Math.random()
      candidates.push({
        score,
        label: `${o.kind} L${o.level} in ${CITY_BY_ID.get(o.cityId)!.name}`,
        run: () => {
          const e = applyBuild(s, playerId, o.cardId, o.cityId, o.kind)
          return e === null
            ? `built ${o.kind} L${o.level} in ${CITY_BY_ID.get(o.cityId)!.name}`
            : null
        },
      })
    }
  }

  // ---- NETWORK ----
  if (legal.NETWORK) {
    for (const l of legalNetworkLinks(s, playerId)) {
      let score = 3.2 + (personality === 'network-builder' ? 3.4 : 0)
      if (l.era === 'rail') score += difficulty === 'easy' ? 0 : 1.2
      if (difficulty === 'hard') score += 1.0
      candidates.push({
        score,
        label: `linked ${CITY_BY_ID.get(l.a)!.name} → ${CITY_BY_ID.get(l.b)!.name}`,
        run: () => {
          const e = applyNetwork(s, playerId, l.id)
          return e === null
            ? `linked ${CITY_BY_ID.get(l.a)!.name} → ${CITY_BY_ID.get(l.b)!.name}`
            : null
        },
      })
    }
  }

  // ---- DEVELOP ----
  if (legal.DEVELOP && (difficulty !== 'easy' || Math.random() < 0.3)) {
    const dev = getLegalDevelopments(s, playerId)[0]
    if (dev) {
      candidates.push({
        score: 1.4,
        label: 'developed an industry',
        run: () => {
          const e = resolveDevelop(s, playerId, [dev.kind])
          return e === null ? 'developed an industry' : null
        },
      })
    }
  }

  // ---- LOAN ----
  if (legal.LOAN) {
    let score = 0.8
    if (personality === 'aggressive') score = 4.5
    if (p.money < 10) score += 2.5
    if (difficulty === 'hard' && p.income <= 1) score -= 2
    candidates.push({
      score,
      label: 'took a loan',
      run: () => {
        const e = applyLoan(s, playerId)
        return e === null ? 'took a loan (+£30)' : null
      },
    })
  }

  // Difficulty shapes exploration of the ranked list.
  candidates.sort((a, b) => b.score - a.score)
  let shortlist: Candidate[]
  if (difficulty === 'easy') {
    shortlist = shuffle(candidates).slice(0, 2)
  } else if (difficulty === 'normal') {
    shortlist = candidates.slice(0, 3)
  } else {
    shortlist = candidates.slice(0, 4)
  }
  for (const c of shortlist) {
    const result = c.run()
    if (result !== null) return { ok: true, detail: result }
  }
  return { ok: false, detail: 'no legal action found — passing' }
}

function playerOf(s: GameState, id: string): PlayerState {
  return s.players.find((x) => x.id === id)!
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
