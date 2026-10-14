import type { Card, Era, IndustryType } from '../types.js'
import { LOCATIONS } from './map.js'

const INDUSTRIES: IndustryType[] = ['cotton', 'coal', 'iron', 'brewery', 'goods', 'pottery']

export function buildDeck(): Card[] {
  const cards: Card[] = []
  let n = 0
  for (const loc of LOCATIONS) cards.push({ id: `c${++n}`, kind: 'location', ref: loc.id })
  for (const ind of INDUSTRIES) {
    for (let i = 0; i < 3; i++) cards.push({ id: `c${++n}`, kind: 'industry', ref: ind })
  }
  for (let i = 0; i < 2; i++) cards.push({ id: `c${++n}`, kind: 'wild' })
  return cards
}

export function cardLabel(card: Card): string {
  if (card.kind === 'wild') return 'Wild'
  if (card.kind === 'industry') return `Industry: ${card.ref}`
  return LOCATIONS.find((l) => l.id === card.ref)?.name ?? card.ref ?? '?'
}

export function deckForEra(_era: Era): Card[] {
  return buildDeck()
}
