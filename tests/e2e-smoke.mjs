// Fast browser check: start a game vs AI, confirm it autosaves, reload and continue it.
// Usage: node tests/e2e-smoke.mjs [baseUrl]   (PW_EXECUTABLE points at a local Chromium if needed)
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch({
  executablePath: process.env.PW_EXECUTABLE || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 900, height: 560 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
const fail = async (msg) => {
  console.error('FAIL: ' + msg, errors.slice(0, 5))
  await browser.close()
  process.exit(1)
}

await page.addInitScript(() => localStorage.setItem('kb.autoplay', '1'))
await page.goto(`${base}/kinetic.html#ai`)
await page.getByText('BEGIN THE AGE').click()

let saved = null
for (let i = 0; i < 60 && !saved; i++) {
  await page.waitForTimeout(3000)
  saved = await page.evaluate(() => localStorage.getItem('kinetic.save'))
}
if (!saved) await fail('no autosave appeared while playing')
const game = JSON.parse(saved).game
if (typeof game.coalMarket !== 'number') await fail('saved game is missing the coal market')

// Back to the home page without autoplay: the saved game must be offered.
await page.addInitScript(() => localStorage.removeItem('kb.autoplay'))
await page.goto(`${base}/`)
const cont = page.getByText('CONTINUE GAME')
try {
  await cont.waitFor({ state: 'visible', timeout: 30000 })
} catch {
  await fail('Continue game button not shown after reload')
}
await cont.click()
try {
  await page.waitForFunction(() => !document.body.classList.contains('pre-game'), null, { timeout: 30000 })
} catch {
  await fail('game did not resume after clicking Continue game')
}
if (errors.length) await fail('page errors during run')
console.log(JSON.stringify({ ok: true, round: game.round, turns: game.log.length }))
await browser.close()
