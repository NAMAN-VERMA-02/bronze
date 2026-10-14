export function stepRng(s: number): [number, number] {
  s = (s + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return [(t ^ (t >>> 14)) >>> 0, s]
}

export function randInt(state: { rngState: number }, nExclusive: number): number {
  const [v, s] = stepRng(state.rngState)
  state.rngState = s
  return v % nExclusive
}

export function shuffle<T>(state: { rngState: number }, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(state, i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
