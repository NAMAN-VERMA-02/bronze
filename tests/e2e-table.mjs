// Browser check: create a table, see its code in the lobby, add an AI seat, then join it from a second tab.
// Usage: node tests/e2e-table.mjs [baseUrl]   (PW_EXECUTABLE points at a local Chromium if needed)
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch({
  executablePath: process.env.PW_EXECUTABLE || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } }) // tabs share localStorage, like the join flow
const errors = []
const fail = async (msg) => {
  console.error('FAIL: ' + msg, errors.slice(0, 5))
  await browser.close()
  process.exit(1)
}
const host = await ctx.newPage()
host.on('pageerror', (e) => errors.push('host: ' + e.message))
await host.goto(`${base}/kinetic.html#create`)
await host.locator('#inpName').fill('Host')
await host.locator('#btnDoCreate').click()
const lobbyCode = host.locator('#lobbyCode')
await host.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.getElementById('lobbyCode')?.textContent?.trim() ?? ''), null, { timeout: 15000 }).catch(() => fail('lobby did not show a 5-character table code'))
const code = (await lobbyCode.textContent()).trim()
await host.locator('#btnAddAi').click()
if (await host.locator('#btnStart').isDisabled()) await fail('START GAME still disabled after adding an AI seat')

const guest = await ctx.newPage()
guest.on('pageerror', (e) => errors.push('guest: ' + e.message))
await guest.goto(`${base}/kinetic.html#join`)
await guest.locator('#screenJoin input').first().fill('Guest')
await guest.locator('#inpCode').fill(code)
await guest.locator('#btnDoJoin').click()
await guest.waitForFunction(() => document.getElementById('screenJoin')?.classList.contains('hidden'), null, { timeout: 15000 }).catch(async () => fail('joining table ' + code + ' failed: ' + (await guest.locator('#joinMsg').textContent())))

if (errors.length) await fail('page errors during run')
console.log(JSON.stringify({ ok: true, code }))
await browser.close()
