import { createState, allBuildOptions, legalNetworkLinks, resolveBuild, applyNetwork, currentPlayer, LINKS } from '../client/src/kinetic/state.ts'

const s = createState([{ name: 'A', isAI: false }, { name: 'B', isAI: true }, { name: 'C', isAI: true }], 4242)
const me = currentPlayer(s)
const o = allBuildOptions(s, me.id)[0]
console.log('era:', s.era, '| build option:', o.kind, '@', o.cityId)
console.log('resolveBuild:', resolveBuild(s, me.id, o.cardId, o.cityId, o.kind))

const links = legalNetworkLinks(s, me.id)
console.log('\nlegal count:', links.length, '| s.era:', s.era)
for (const l of links.slice(0, 6)) console.log('  ', l.id, l.era)

// direct probe of the filter for every canal link
const canal = LINKS.filter(l => l.era === 'canal')
console.log('\ncanal total:', canal.length)
const owned = Object.keys(s.linksOwned)
console.log('owned:', owned.length)
let pass = 0, failEra = 0, failOwned = 0, failMoney = 0
for (const l of canal) {
  if (s.linksOwned[l.id]) { failOwned++; continue }
  if (me.money < 3) { failMoney++; continue }
  if (l.era !== s.era) { failEra++; continue }
  pass++
}
console.log('canal pass:', pass, '| blocked owned:', failOwned, 'money:', failMoney, 'era?:', failEra)
