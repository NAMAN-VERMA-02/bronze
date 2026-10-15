// Card UI check: select a hand card, see only its build options, BACK, pick an option, confirm.
// Usage: node tests/e2e-cards.mjs [baseUrl]   (PW_EXECUTABLE points at a local Chromium if needed)
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch({
  executablePath: process.env.PW_EXECUTABLE || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1400, height: 850 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
const fail = async (msg) => {
  console.error('FAIL: ' + msg, errors.slice(0, 5))
  await browser.close()
  process.exit(1)
}
const T = { timeout: 20000 }

await page.addInitScript(() => {
  try { localStorage.setItem('kb.autoplay', '0') } catch {}
})
await page.goto(`${base}/kinetic.html#ai`)
await page.getByText('BEGIN THE AGE').click()
try {
  await page.waitForFunction(() => /INDUSTRIALIST/i.test(document.getElementById('turnBanner')?.textContent ?? ''), null, { timeout: 120000 })
} catch {
  await fail('human turn never started')
}
await page.waitForTimeout(1500)

const hand = page.locator('#hand .vcard')
const ctx = page.locator('#contextHand .ctcard')
const nHand = await hand.count()
if (nHand < 5) await fail(`hand has only ${nHand} cards`)

// 1. Selecting a card shows ONLY that card's options.
const cityOf = async (i) => (await hand.nth(i).textContent()).replace(/\s+/g, ' ')
await hand.nth(2).click()
try { await ctx.first().waitFor({ state: 'visible', ...T }) } catch { await fail('no option cards after selecting a hand card') }
await page.waitForTimeout(600)
const city = (await cityOf(2)).match(/LOCATION\s+(.+?)\s+(CITY|TOWN|FARM)/i)?.[1]
const opts = await ctx.evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ')))
if (city && !city.includes('Brewery') && opts.some((t) => !t.includes(city))) await fail(`options for other cards leaked in: ${opts}`)

// 2. BACK returns the hand.
await page.locator('#ctxBackBtn').click(T)
await page.waitForFunction(() => !document.getElementById('hand').classList.contains('hide-hand'), null, T)
if ((await ctx.count()) !== 0) await fail('option cards remained after BACK')

// 2b. Switching tray modes directly never leaves the previous mode's cards behind.
await page.getByRole('button', { name: 'NETWORK' }).first().click(T)
await ctx.first().waitFor({ state: 'visible', ...T })
await page.getByRole('button', { name: 'DEVELOP' }).first().click(T)
await page.waitForTimeout(800)
if ((await page.locator('#contextHand .ct-arrow').count()) !== 0) await fail('network cards stayed in the DEVELOP tray')
await page.locator('#ctxBackBtn').click(T)
await page.waitForFunction(() => !document.getElementById('hand').classList.contains('hide-hand'), null, T)

// 3. Another card can then be picked, and its option opens the confirm popover.
await hand.nth(0).click()
await ctx.first().waitFor({ state: 'visible', ...T })
await page.waitForTimeout(600)
await ctx.first().click(T)
try {
  await page.waitForFunction(() => !document.getElementById('popover').classList.contains('hidden'), null, T)
} catch {
  await fail('clicking an option card did not open the confirm popover')
}

// 4. Confirming builds: the action resolves and a tile appears in the log.
const before = await page.evaluate(() => document.getElementById('logOl')?.textContent ?? '')
await page.locator('#popoverBody > *').first().click(T)
try {
  await page.waitForFunction((b) => (document.getElementById('logOl')?.textContent ?? '') !== b, before, T)
} catch {
  await fail('confirm did not change the game log')
}
// 5. Next turn: DEVELOP — pick a tile, then the CONFIRM card resolves it.
try {
  await page.waitForFunction(() => /INDUSTRIALIST'S TURN/i.test(document.getElementById('turnBanner')?.textContent ?? ''), null, { timeout: 120000 })
} catch {
  await fail('human turn did not return after the build')
}
await page.waitForTimeout(1500)
const logBefore = await page.evaluate(() => document.getElementById('logOl')?.textContent ?? '')
await page.locator('button[data-act="DEVELOP"]').click(T)
await ctx.first().waitFor({ state: 'visible', ...T })
await page.waitForTimeout(600)
await ctx.first().click(T)
await page.waitForTimeout(400)
await ctx.last().click(T)
try {
  await page.waitForFunction((b) => (document.getElementById('logOl')?.textContent ?? '') !== b, logBefore, T)
} catch {
  await fail('develop CONFIRM card did nothing')
}
if (errors.length) await fail('page errors')
console.log('cards ok')
await browser.close()
