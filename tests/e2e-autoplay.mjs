// Plays a full game in a real browser: two AI opponents plus the autoplaying local seat.
// Usage: node tests/e2e-autoplay.mjs <baseUrl> [screenshotDir]
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:4173'
const shots = process.argv[3]
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 850 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))
await page.addInitScript(() => localStorage.setItem('kb.autoplay', '1'))
await page.goto(`${base}/kinetic.html#ai`)
await page.getByText('BEGIN THE AGE').click()
const eras = new Set()
const tracks = new Set()
let done = false
const start = Date.now()
while (Date.now() - start < 540000) {
  await page.waitForTimeout(2000)
  const st = await page.evaluate(() => window.__bronze ?? null)
  if (!st) continue
  eras.add(st.era)
  tracks.add(st.track)
  if (shots && st.round === 2 && !globalThis.s1) { globalThis.s1 = 1; await page.screenshot({ path: `${shots}/mid.png` }) }
  if (st.over) { done = true; break }
}
if (shots) await page.screenshot({ path: `${shots}/end.png` })
const last = await page.evaluate(() => window.__bronze)
console.log(JSON.stringify({ done, eras: [...eras], tracks: [...tracks], last, errors: errors.slice(0, 10) }, null, 1))
await browser.close()
process.exit(done && errors.length === 0 ? 0 : 1)
