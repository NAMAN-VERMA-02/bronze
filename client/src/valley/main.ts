import * as V from '@bronze/shared/valley'
import { chooseAction } from '@bronze/shared/valley-ai'
import type { Action, GameState, Good, SeatSpec, BuildingKind, AIDifficulty, AIPersonality } from '@bronze/shared/valley'
import { WarTable, plotPos, type Pick } from './scene'
import { Music } from './music'
import { SoundScape } from './sfx'
import { GuestNet, HostNet, newCode, type HostMsg } from './net'
import { ICON, coin, glory, iconize } from './icons'

// ------------------------------------------------------------------ names

const GOOD_NAME: Record<Good, string> = { coal: 'Coal', copper: 'Copper', tin: 'Tin', bronze: 'Bronze', machine: 'Arms' }
const KIND_NAME: Record<BuildingKind, string> = { mine: 'Mine', smelter: 'Smelter', works: 'Forge' }
const AGE_NAME = ['The Age of Rivers', 'The Age of Roads', 'The Age of Crowns']
const AGE_HINT = [
  'Only river links can be opened. Claim the water.',
  'Roads open across the land. Forges can be built.',
  'Level III buildings unlock. The final reckoning comes.',
]
type ActType = Action['type']
const ACTS: { type: ActType; label: string; key: string }[] = [
  { type: 'build', label: 'Build', key: '1' },
  { type: 'route', label: 'Route', key: '2' },
  { type: 'run', label: 'Run', key: '3' },
  { type: 'deliver', label: 'Deliver', key: '4' },
  { type: 'trade', label: 'Trade', key: '5' },
  { type: 'bond', label: 'Bond', key: '6' },
  { type: 'wait', label: 'Wait', key: '7' },
]
const SAVE_KEY = 'aurel.save.v1'
const NAME_KEY = 'aurel.name'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const goodChip = (g: Good, n: number) => `<span class="chip"><span class="dot g-${g}"></span>${n} ${GOOD_NAME[g]}</span>`
const wantsHtml = (w: V.Goods) => V.GOODS.filter((g) => w[g]).map((g) => goodChip(g, w[g]!)).join('')
const townName = (id: string) => V.TOWN_BY_ID.get(id)!.name

// ------------------------------------------------------------------ state

type Mode = 'ai' | 'hotseat' | 'host' | 'guest'
let mode: Mode = 'ai'
let state: GameState | null = null
let localIds = new Set<string>()
let pending: ActType | null = null
let legal: Action[] = []
let busy = false
let lastTurn: string | null = null
let hostNet: HostNet | null = null
let guestNet: GuestNet | null = null
let mouse = { x: 0, y: 0 }

const music = new Music()
const sfx = new SoundScape()
const table = new WarTable($('world'))
table.scene.rotation.y = 0

function audioOn(): void {
  music.start()
  sfx.resume()
}

// ------------------------------------------------------------------ menus

function menu(html: string): void {
  const m = $('menu')
  m.classList.remove('hidden')
  m.innerHTML = `<div class="card panel">${html}</div>`
}

function hideMenu(): void { $('menu').classList.add('hidden') }

function savedName(): string { return localStorage.getItem(NAME_KEY) ?? '' }

function mainMenu(): void {
  music.setScene('home')
  const save = localStorage.getItem(SAVE_KEY)
  menu(`
    <h1>BRONZE</h1>
    <div class="sub">THE AUREL VALLEY</div>
    <p class="lede">Raise mines, smelt bronze, forge arms. Claim the rivers and roads, and outplay rival lords in a market that moves with every sale.</p>
    <div class="stack">
      ${save ? '<button class="btn primary" id="m-continue">CONTINUE CAMPAIGN</button>' : ''}
      <button class="btn ${save ? '' : 'primary'}" id="m-solo">PLAY VS AI</button>
      <button class="btn" id="m-host">HOST ONLINE TABLE</button>
      <button class="btn" id="m-join">JOIN ONLINE TABLE</button>
      <button class="btn" id="m-hot">SAME-SCREEN BATTLE</button>
      <button class="btn" id="m-help">HOW TO PLAY</button>
    </div>
    <p class="note">1–4 lords · about 30 minutes · free, no account</p>`)
  $('m-continue')?.addEventListener('click', () => { audioOn(); continueSave() })
  $('m-solo').onclick = () => { audioOn(); soloMenu() }
  $('m-host').onclick = () => { audioOn(); hostMenu() }
  $('m-join').onclick = () => { audioOn(); joinMenu() }
  $('m-hot').onclick = () => { audioOn(); hotseatMenu() }
  $('m-help').onclick = () => showHelp()
}

function soloMenu(): void {
  menu(`
    <h1 style="font-size:34px">VS AI</h1>
    <div class="stack" style="margin-top:18px">
      <input id="s-name" maxlength="16" placeholder="Your name" value="${esc(savedName())}" />
      <div class="row"><span>Rivals</span>
        <select id="s-n"><option>1</option><option>2</option><option selected>3</option></select>
        <select id="s-d"><option value="easy">Squire (easy)</option><option value="normal" selected>Knight (normal)</option><option value="hard">Warlord (hard)</option></select>
      </div>
      <button class="btn primary" id="s-go">MARCH TO WAR</button>
    </div>
    <button class="back" id="back">← back</button>`)
  $('back').onclick = mainMenu
  $('s-go').onclick = () => {
    const name = ($<HTMLInputElement>('s-name').value.trim() || 'You').slice(0, 16)
    localStorage.setItem(NAME_KEY, name)
    const n = Number($<HTMLSelectElement>('s-n').value)
    const d = $<HTMLSelectElement>('s-d').value as AIDifficulty
    const pers: AIPersonality[] = ['baron', 'industrialist', 'trader', 'balanced']
    const seats: SeatSpec[] = [{ name, isAI: false }]
    for (let i = 0; i < n; i++) seats.push({ name: V.AI_NAMES[i], isAI: true, difficulty: d, personality: pers[i] })
    startLocal(seats, 'ai')
  }
}

function hotseatMenu(): void {
  menu(`
    <h1 style="font-size:30px">SAME SCREEN</h1>
    <p class="note">Pass the mouse between turns. The camera swings to whoever commands next.</p>
    <div class="stack" style="margin-top:14px">
      ${[0, 1, 2, 3].map((i) => `<input id="h-${i}" maxlength="16" placeholder="${i < 2 ? `Lord ${i + 1}` : `Lord ${i + 1} (leave empty to skip)`}" />`).join('')}
      <label class="row"><input type="checkbox" id="h-ai" style="width:auto" /> Fill empty seats with AI</label>
      <button class="btn primary" id="h-go">BEGIN</button>
    </div>
    <button class="back" id="back">← back</button>`)
  $('back').onclick = mainMenu
  $('h-go').onclick = () => {
    const seats: SeatSpec[] = []
    const fill = $<HTMLInputElement>('h-ai').checked
    for (let i = 0; i < 4; i++) {
      const v = $<HTMLInputElement>(`h-${i}`).value.trim().slice(0, 16)
      if (v || i < 2) seats.push({ name: v || `Lord ${i + 1}`, isAI: false })
      else if (fill) seats.push({ name: V.AI_NAMES[i], isAI: true })
    }
    startLocal(seats, 'hotseat')
  }
}

function hostMenu(): void {
  menu(`
    <h1 style="font-size:30px">HOST A TABLE</h1>
    <div class="stack" style="margin-top:16px">
      <input id="o-name" maxlength="16" placeholder="Your name" value="${esc(savedName())}" />
      <button class="btn primary" id="o-go">OPEN THE GATES</button>
      <div class="err" id="o-err"></div>
    </div>
    <button class="back" id="back">← back</button>`)
  $('back').onclick = mainMenu
  $('o-go').onclick = async () => {
    const name = ($<HTMLInputElement>('o-name').value.trim() || 'Host').slice(0, 16)
    localStorage.setItem(NAME_KEY, name)
    const code = newCode()
    hostNet?.close()
    hostNet = new HostNet(code, [{ name, isAI: false }])
    $('o-err').textContent = 'Opening the gates…'
    try {
      await hostNet.ready()
    } catch {
      $('o-err').textContent = 'Could not reach the matchmaking service. Check your connection and try again.'
      return
    }
    hostNet.onLobby = () => hostLobby()
    // A guest who drops out hands their seat to an AI, so the table never stalls.
    hostNet.onLeave = (seat) => {
      const spec = hostNet!.seats[seat]
      if (!spec) return
      Object.assign(spec, { isAI: true, personality: 'balanced' })
      const p = state?.players[seat]
      if (p) {
        p.isAI = true
        toast(`${p.name} left`, 'An AI lord takes their seat.')
        hostNet!.broadcastState(state!)
        lastTurn = ''
        step()
      } else {
        hostNet!.broadcastLobby()
        hostLobby()
      }
    }
    hostNet.onError = (m) => { const e = document.getElementById('o-err'); if (e) e.textContent = m }
    hostNet.onAction = (seat, a) => {
      const pid = `p${seat}`
      if (!state || V.currentPlayer(state)?.id !== pid || busy) return
      void doApply(pid, a)
    }
    hostLobby()
  }
}

function hostLobby(): void {
  if (!hostNet || state) return
  const seats = hostNet.seats
  menu(`
    <h1 style="font-size:26px">YOUR TABLE</h1>
    <p class="note">Send this code to your friends. They choose “Join online table”.</p>
    <div class="code">${hostNet.code}</div>
    <div class="seats">${seats.map((s, i) => `<div class="seat"><span class="dot" style="background:${V.PLAYER_COLORS[i]}"></span>${esc(s.name)} ${s.isAI ? '<span class="note">AI</span>' : i === 0 ? '<span class="note">host</span>' : ''}</div>`).join('')}</div>
    <div class="row">
      <button class="btn" id="l-ai" ${seats.length >= 4 ? 'disabled' : ''}>+ AI LORD</button>
      <button class="btn primary" id="l-go" ${seats.length < 2 ? 'disabled' : ''}>START</button>
    </div>
    <div class="err" id="o-err"></div>
    <button class="back" id="back">← leave</button>`)
  $('back').onclick = () => { hostNet?.close(); hostNet = null; mainMenu() }
  $('l-ai').onclick = () => {
    seats.push({ name: V.AI_NAMES[seats.length], isAI: true, personality: 'balanced' })
    hostNet!.broadcastLobby()
    hostLobby()
  }
  $('l-go').onclick = () => {
    mode = 'host'
    localIds = new Set(['p0'])
    begin(V.createGame(seats))
  }
}

function joinMenu(): void {
  menu(`
    <h1 style="font-size:30px">JOIN A TABLE</h1>
    <div class="stack" style="margin-top:16px">
      <input id="j-code" maxlength="5" placeholder="Table code" style="text-transform:uppercase;letter-spacing:.3em;text-align:center" />
      <input id="j-name" maxlength="16" placeholder="Your name" value="${esc(savedName())}" />
      <button class="btn primary" id="j-go">RIDE OUT</button>
      <div class="err" id="j-err"></div>
    </div>
    <button class="back" id="back">← back</button>`)
  $('back').onclick = mainMenu
  $('j-go').onclick = async () => {
    const code = $<HTMLInputElement>('j-code').value.trim().toUpperCase()
    if (!/^[A-Z2-9]{5}$/.test(code)) { $('j-err').textContent = 'Codes are 5 letters and numbers.'; return }
    const name = ($<HTMLInputElement>('j-name').value.trim() || 'Guest').slice(0, 16)
    localStorage.setItem(NAME_KEY, name)
    guestNet?.close()
    guestNet = new GuestNet()
    $('j-err').textContent = 'Riding to the table…'
    guestNet.onError = (m) => {
      const e = document.getElementById('j-err')
      if (e) e.textContent = m === 'peer-unavailable' ? 'No table with that code.' : m
      else toast('Connection lost', m)
    }
    guestNet.onMsg = (m) => onHostMsg(m)
    try { await guestNet.join(code, name) } catch { /* onError reports it */ }
  }
}

function onHostMsg(m: HostMsg): void {
  if (m.t === 'lobby' && !state) {
    menu(`
      <h1 style="font-size:26px">AT THE TABLE</h1>
      <div class="seats">${m.seats.map((s, i) => `<div class="seat"><span class="dot" style="background:${V.PLAYER_COLORS[i]}"></span>${esc(s.name)} ${i === m.you ? '<span class="note">you</span>' : s.isAI ? '<span class="note">AI</span>' : ''}</div>`).join('')}</div>
      <p class="note">Waiting for the host to start…</p>`)
  } else if (m.t === 'error') {
    const e = document.getElementById('j-err')
    if (e) e.textContent = m.text
  } else if (m.t === 'state') {
    if (!state) {
      mode = 'guest'
      localIds = new Set([m.you])
      begin(m.state)
    } else void present(m.state)
  }
}

function showHelp(): void {
  const el = document.createElement('div')
  el.id = 'help'
  el.innerHTML = `<div class="card panel">
    <h2>HOW TO PLAY</h2>
    <p>Three Ages. Win the most <b>glory</b> by the end of the Age of Crowns.</p>
    <h4>THE TIME TRACK</h4>
    <p>Every action costs time. Whoever is <b>furthest behind</b> on the track acts next, so cheap actions can let you move twice before a rival moves once. When everyone reaches 18, the Age ends.</p>
    <h4>ACTIONS</h4>
    <ul>
      <li><b>Build</b> (3): a Mine on a deposit, a Smelter, or (from Age II) a Forge, in or next to your lands. Or upgrade your own building.</li>
      <li><b>Route</b> (2): open a river link (5 marks), or from Age II a road (8 marks + 1 coal). Rivals pay you 1 mark to move goods over it.</li>
      <li><b>Run</b> (1): mines dig ore; smelters turn 2 copper + tin + coal into bronze; forges turn 2 bronze + coal into arms. Missing inputs are bought from rivals (they get paid) or the exchange.</li>
      <li><b>Deliver</b> (2): fill a contract with goods that can travel there. Big rewards in marks and glory.</li>
      <li><b>Trade</b> (1): sell goods at a port. Each sale lowers the price.</li>
      <li><b>Bond</b> (1): take 20 marks, lose 3 income forever and 5 glory at the end.</li>
      <li><b>Wait</b>: skip ahead of the next lord and collect up to 2 marks.</li>
    </ul>
    <h4>MARKET TICKS (6 · 12 · 18)</h4>
    <p>The first lord past each mark triggers an event, prices drift back to normal, contracts grow richer by 2 marks and the oldest one is lost. Each lord collects income as they pass a mark.</p>
    <h4>SCORING</h4>
    <p>At each Age end, buildings earn glory, and links earn 1 glory if both ends hold buildings. At the end, every 4 marks become 1 glory, and three Patron goals pay 8 and 4 glory.</p>
    <h4>CONTROLS</h4>
    <p>Keys 1–7 pick actions, Esc cancels, V switches between your throne view and the war map. Drag to look around, scroll to zoom.</p>
    <div style="text-align:center;margin-top:14px"><button class="btn primary" id="help-x">TO BATTLE</button></div>
  </div>`
  document.body.appendChild(el)
  $('help-x').onclick = () => el.remove()
  el.onclick = (e) => { if (e.target === el) el.remove() }
}

// ------------------------------------------------------------------ game flow

function startLocal(seats: SeatSpec[], m: Mode): void {
  mode = m
  const s = V.createGame(seats)
  localIds = new Set(s.players.filter((p) => !p.isAI).map((p) => p.id))
  begin(s)
}

function continueSave(): void {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!) as { state: GameState; mode: Mode }
    mode = raw.mode
    localIds = new Set(raw.state.players.filter((p) => !p.isAI).map((p) => p.id))
    begin(raw.state, false)
  } catch {
    localStorage.removeItem(SAVE_KEY)
    mainMenu()
  }
}

function firstLocal(): string | null {
  return [...localIds][0] ?? null
}

async function begin(s: GameState, intro = true): Promise<void> {
  state = s
  hideMenu()
  $('hud').classList.remove('hidden')
  table.setupKeeps(s, firstLocal())
  table.sync(s)
  render()
  music.setScene('game')
  if (hostNet) hostNet.broadcastState(s)
  if (intro) {
    busy = true
    await table.intro(firstLocal())
    busy = false
    banner(AGE_NAME[s.age - 1].toUpperCase(), AGE_HINT[s.age - 1])
    music.drums(3)
  } else table.setView('pov', firstLocal(), 0.1)
  step()
}

function isAuthority(): boolean { return mode !== 'guest' }

function step(): void {
  if (!state || busy) return
  if (state.phase === 'ended') return results()
  const cur = V.currentPlayer(state)
  if (!cur) return
  table.setTurn(state, cur.id)
  if (cur.id !== lastTurn) {
    lastTurn = cur.id
    if (localIds.has(cur.id)) {
      if (mode === 'hotseat' && localIds.size > 1) table.setView('pov', cur.id, 1.1)
      flash(`${localIds.size > 1 ? cur.name.toUpperCase() + ', ' : ''}YOUR COMMAND`)
      sfx.chime(0, 0, 0)
    }
  }
  if (cur.isAI && isAuthority()) {
    setTimeout(() => {
      if (!state || busy || V.currentPlayer(state)?.id !== cur.id) return
      void doApply(cur.id, chooseAction(state, cur.id))
    }, 260)
  }
  legal = localIds.has(cur.id) ? V.legalActions(state, cur.id) : []
  render()
}

async function commit(a: Action): Promise<void> {
  if (!state || busy) return
  const cur = V.currentPlayer(state)
  if (!cur || !localIds.has(cur.id)) return
  setPending(null)
  if (mode === 'guest') {
    busy = true
    guestNet?.act(a)
    // The host's state message releases the lock.
    setTimeout(() => { busy = false }, 4000)
    return
  }
  await doApply(cur.id, a)
}

async function doApply(pid: string, a: Action): Promise<void> {
  if (!state) return
  let next: GameState
  try {
    next = V.apply(state, pid, a)
  } catch (e) {
    if (e instanceof V.RuleError) { toast('Not allowed', e.message); return }
    throw e
  }
  await present(next)
}

async function present(next: GameState): Promise<void> {
  if (!state) return
  busy = true
  const prev = state
  const actor = V.currentPlayer(prev)
  state = next
  const local = actor ? localIds.has(actor.id) : false
  sfxFor(next)
  if (actor && !localIds.has(actor.id)) {
    for (const l of next.log) if (l.seq > prev.logSeq && l.who === actor.id) feedCard(actor.name, actor.color, l.text)
  }
  if (hostNet) hostNet.broadcastState(next)
  await table.play(next.fx, next, !local)
  table.sync(next)
  for (const f of next.fx) {
    if (f.kind === 'tick') {
      banner(`MARKET TICK · ${f.event.title.toUpperCase()}`, f.event.text)
      music.drums(3)
    }
    if (f.kind === 'age' && next.phase === 'play') {
      setTimeout(() => {
        banner(AGE_NAME[next.age - 1].toUpperCase(), AGE_HINT[next.age - 1])
        sfx.eraFanfare()
        music.drums(5)
      }, 900)
    }
  }
  music.setScene(next.age === 3 ? 'tense' : 'game')
  if (mode !== 'host' && mode !== 'guest') {
    if (next.phase === 'play') localStorage.setItem(SAVE_KEY, JSON.stringify({ state: next, mode }))
    else localStorage.removeItem(SAVE_KEY)
  }
  busy = false
  step()
}

function sfxFor(s: GameState): void {
  for (const f of s.fx) {
    if (f.kind === 'build') sfx.woodPlace(0, 0, 0)
    else if (f.kind === 'route') sfx.railClack(0, 0, 0)
    else if (f.kind === 'produce') sfx.steam(0, 0, 0)
    else if (f.kind === 'deliver' || f.kind === 'trade') sfx.coins(0, 0, 0)
  }
}

// ------------------------------------------------------------------ selection

function myTurn(): boolean {
  const cur = state && V.currentPlayer(state)
  return !!cur && localIds.has(cur.id) && !busy
}

function setPending(t: ActType | null): void {
  pending = t
  $('picker')?.remove()
  const sel: Parameters<WarTable['setSelectable']>[0] = {}
  if (t === 'build') sel.plots = new Set(legal.filter((a) => a.type === 'build').map((a) => `${(a as { town: string }).town}:${(a as { slot: number }).slot}`))
  if (t === 'route') sel.links = new Set(legal.filter((a): a is Extract<Action, { type: 'route' }> => a.type === 'route').map((a) => a.link))
  if (t === 'run') sel.buildings = new Set(legal.filter((a): a is Extract<Action, { type: 'run' }> => a.type === 'run').map((a) => `${a.town}:${a.slot}`))
  if (t === 'deliver') {
    const ids = new Set(legal.filter((a): a is Extract<Action, { type: 'deliver' }> => a.type === 'deliver').map((a) => a.contract))
    sel.towns = new Set(state!.contracts.filter((c) => ids.has(c.id)).map((c) => c.town))
  }
  table.setSelectable(sel)
  if (t === 'trade') tradePicker()
  if (t === 'bond') picker([{ label: `Take ${coin(V.BOND_AMOUNT)}`, sub: `Income −${V.BOND_INCOME} for good, −${V.BOND_END_VP} glory at the end`, act: { type: 'bond' } }])
  if (t === 'wait') void commit({ type: 'wait' })
  render()
}

function picker(opts: { label: string; sub: string; act: Action }[]): void {
  $('picker')?.remove()
  const el = document.createElement('div')
  el.id = 'picker'
  el.className = 'panel'
  opts.forEach((o) => {
    const b = document.createElement('button')
    b.className = 'btn opt'
    b.innerHTML = `${o.label}<small>${o.sub}</small>`
    b.onclick = () => void commit(o.act)
    el.appendChild(b)
  })
  $('hud').appendChild(el)
}

function tradePicker(): void {
  const s = state!
  const opts = legal.filter((a): a is Extract<Action, { type: 'trade' }> => a.type === 'trade').map((a) => {
    let earn = 0
    let idx = s.priceIdx[a.good]
    for (let i = 0; i < a.qty; i++) { earn += V.PRICES[a.good][idx]; idx = Math.max(0, idx - 1) }
    return { label: `Sell ${a.qty} ${GOOD_NAME[a.good]}`, sub: `about ${coin(earn)} before tolls`, act: a as Action }
  })
  if (opts.length) picker(opts)
  else toast('Nothing to sell', 'You need goods in a building that can reach a port.')
}

table.onPick = (p: Pick) => {
  if (!state || !myTurn() || !pending) return
  sfx.click(0, 0, 0)
  if (pending === 'route' && p.kind === 'link') return void commit({ type: 'route', link: p.id })
  if (pending === 'run' && (p.kind === 'building' || p.kind === 'plot')) return void commit({ type: 'run', town: p.town, slot: p.slot })
  if (pending === 'build' && (p.kind === 'plot' || p.kind === 'building')) {
    const opts = legal.filter((a): a is Extract<Action, { type: 'build' }> => a.type === 'build' && a.town === p.town && a.slot === p.slot)
    const existing = state.plots[p.town][p.slot]
    picker(opts.map((a) => {
      const spec = V.BUILDINGS[a.kind]
      const cost = spec.cost[a.level - 1] - (existing ? spec.cost[existing.level - 1] : 0)
      const what = a.kind === 'mine' ? `${GOOD_NAME[V.TOWN_BY_ID.get(a.town)!.deposit!]} Mine` : KIND_NAME[a.kind]
      return {
        label: `${existing ? 'Upgrade to ' : ''}${what} ${V.roman(a.level)}`,
        sub: `${coin(cost)} · ${glory(spec.vp[a.level - 1])} per Age · +${spec.income[a.level - 1]} income`,
        act: a,
      }
    }))
    table.focusTown(p.town)
    return
  }
  if (pending === 'deliver' && p.kind === 'town') {
    const ids = new Set(legal.filter((a): a is Extract<Action, { type: 'deliver' }> => a.type === 'deliver').map((a) => a.contract))
    const here = state.contracts.filter((c) => c.town === p.id && ids.has(c.id))
    if (here.length === 1) return void commit({ type: 'deliver', contract: here[0].id })
    picker(here.map((c) => ({ label: `Deliver ${V.goodsLabel(c.wants)}`, sub: `${coin(c.money)} ${glory(c.vp)}`, act: { type: 'deliver', contract: c.id } as Action })))
  }
}

table.onHover = (p) => {
  const tip = $('tip')
  if (!tip || !state || !p) { tip?.classList.add('hidden'); return }
  tip.classList.remove('hidden')
  tip.style.left = `${mouse.x + 16}px`
  tip.style.top = `${mouse.y + 12}px`
  tip.innerHTML = hoverText(p)
}

/** The exact action a click on `p` would commit, if it is a single one. */
function actionFor(p: Pick): Action | null {
  if (!pending) return null
  const find = (f: (a: Action) => boolean) => legal.find(f) ?? null
  if (pending === 'route' && p.kind === 'link') return find((a) => a.type === 'route' && a.link === p.id)
  if (pending === 'run' && p.kind !== 'town' && p.kind !== 'link') return find((a) => a.type === 'run' && a.town === p.town && a.slot === p.slot)
  if (pending === 'deliver' && p.kind === 'town') {
    const here = legal.filter((a) => a.type === 'deliver' && state!.contracts.find((c) => c.id === a.contract)?.town === p.id)
    return here.length === 1 ? here[0] : null
  }
  return null
}

/** Simulate an action and show what it will cost and earn. */
function previewHtml(a: Action): string {
  const s = state!
  const cur = V.currentPlayer(s)!
  let after: GameState
  try { after = V.apply(s, cur.id, a) } catch { return '' }
  const me = after.players.find((x) => x.id === cur.id)!
  const dm = me.money - cur.money
  const dv = me.vp - cur.vp
  const made = after.fx.filter((f): f is Extract<V.Fx, { kind: 'produce' }> => f.kind === 'produce').map((f) => `+${f.n} ${GOOD_NAME[f.good]}`)
  const tolls = after.fx.filter((f) => f.kind === 'pay' && f.from === cur.id).length
  return `<div class="pv">
    <span class="${dm < 0 ? 'neg' : 'pos'}">${dm >= 0 ? '+' : ''}${coin(dm)}</span>
    ${dv ? `<span class="pos">+${glory(dv)}</span>` : ''}
    ${made.length ? `<span>${made.join(', ')}</span>` : ''}
    <span class="amt">${ICON.time}${me.time - cur.time}</span>
    ${tolls ? '<span class="neg">pays rivals</span>' : ''}
  </div>`
}

function hoverText(p: Pick): string {
  const a = actionFor(p)
  return baseHover(p) + (a ? previewHtml(a) : '')
}

function baseHover(p: Pick): string {
  const s = state!
  if (p.kind === 'link') {
    const l = V.LINK_BY_ID.get(p.id)!
    const c = V.linkCost(s, p.id)
    return `<b>${l.kind === 'river' ? 'River link' : 'Road'}</b> ${townName(l.a)} – ${townName(l.b)}<br/>${coin(c.money)}${c.coal ? ' + 1 coal' : ''} · 2 time`
  }
  const town = p.kind === 'town' ? p.id : p.town
  const t = V.TOWN_BY_ID.get(town)!
  if (p.kind !== 'town') {
    const b = s.plots[town][p.slot]
    if (b) {
      const o = s.players.find((x) => x.id === b.owner)!
      const goods = V.GOODS.filter((g) => b.goods[g]).map((g) => `${b.goods[g]} ${GOOD_NAME[g]}`).join(', ') || 'empty'
      return `<b>${esc(o.name)}'s ${b.kind === 'mine' ? GOOD_NAME[b.deposit!] + ' ' : ''}${KIND_NAME[b.kind]} ${V.roman(b.level)}</b><br/>${t.name} · holds ${goods}`
    }
    return `<b>Empty plot</b> in ${t.name}${t.deposit ? ` · ${GOOD_NAME[t.deposit]} deposit` : ''}`
  }
  const cs = s.contracts.filter((c) => c.town === town)
  return `<b>${t.name}</b>${t.port ? ' · port' : ''}${t.deposit ? ` · ${GOOD_NAME[t.deposit]} deposit` : ''}${cs.map((c) => `<br/>Contract: ${V.goodsLabel(c.wants)} → ${coin(c.money)} ${glory(c.vp)}`).join('')}`
}

window.addEventListener('pointermove', (e) => { mouse = { x: e.clientX, y: e.clientY } })
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return
  if (e.key === 'Escape') { setPending(null); return }
  if (e.key.toLowerCase() === 'v' && state) { table.setView(table.view === 'pov' ? 'overview' : 'pov', V.currentPlayer(state) && localIds.has(V.currentPlayer(state)!.id) ? V.currentPlayer(state)!.id : firstLocal()); return }
  const a = ACTS.find((x) => x.key === e.key)
  if (a && myTurn() && legal.some((l) => l.type === a.type)) setPending(pending === a.type ? null : a.type)
})

// ------------------------------------------------------------------ HUD

function render(): void {
  const s = state
  if (!s) return
  const hud = $('hud')
  const cur = V.currentPlayer(s)
  const me = (cur && localIds.has(cur.id) ? cur : s.players.find((p) => localIds.has(p.id))) ?? s.players[0]
  const can = (t: ActType) => legal.some((a) => a.type === t)
  const ready = new Set(legal.filter((a): a is Extract<Action, { type: 'deliver' }> => a.type === 'deliver').map((a) => a.contract))
  const waitGain = cur && localIds.has(cur.id) ? Math.min(V.WAIT_CAP, Math.max(1, V.actionTime(s, cur.id, { type: 'wait' }))) : 0
  const promptText: Record<ActType, string> = {
    build: 'Choose a glowing plot to build on',
    route: 'Choose a glowing river or road to claim',
    run: 'Choose one of your buildings to put to work',
    deliver: 'Choose a glowing town to deliver to',
    trade: 'Choose what to sell',
    bond: 'Confirm the bond',
    wait: '',
  }
  hud.innerHTML = `
    <div id="players">${s.players.map((p) => `
      <div class="plate panel ${cur?.id === p.id ? 'turn' : ''}" style="--pc:${p.color}">
        <div class="nm"><span>${esc(p.name)}</span><span class="tag">${p.isAI ? 'AI' : localIds.has(p.id) ? 'YOU' : 'LORD'}</span></div>
        <div class="st"><b>${coin(p.money)}</b><b>${glory(p.vp)}</b><span class="amt">${ICON.time}${p.time}</span>${p.bonds ? `<span>bonds ${p.bonds}</span>` : ''}</div>
      </div>`).join('')}</div>

    <div id="track" class="panel">
      <div class="hd"><span>AGE ${V.roman(s.age)} · ${AGE_NAME[s.age - 1].toUpperCase().replace('THE ', '')}</span><span>${cur ? (localIds.has(cur.id) ? 'Your command' : `${esc(cur.name)} commands`) : ''}</span></div>
      <div class="bar">
        ${V.TICKS.map((t) => `<div class="tick" style="left:calc(${(t / V.AGE_LENGTH) * 100}% - 2px)"><span>${s.ticksDone.includes(t) ? ICON.check : ICON.flag}${t}</span></div>`).join('')}
        ${s.players.map((p, i) => `<div class="tok ${cur?.id === p.id ? 'turn' : ''}" title="${esc(p.name)}" style="--pc:${p.color};left:${(p.time / V.AGE_LENGTH) * 100}%;top:${3 + (s.players.filter((q, j) => j < i && q.time === p.time).length) * -7}px"></div>`).join('')}
      </div>
    </div>

    <div id="topright">
      <button class="btn" id="b-view" title="Switch view (V)">${table.view === 'pov' ? ICON.map + ' WAR MAP' : ICON.throne + ' THRONE'}</button>
      <button class="btn icon" id="b-music" title="Music">${music.enabled ? ICON.music : ICON.mute}</button>
      <button class="btn icon" id="b-help" title="How to play">${ICON.help}</button>
      <button class="btn icon" id="b-quit" title="Leave">${ICON.leave}</button>
    </div>

    <div id="market" class="panel">
      <h3>EXCHANGE</h3>
      ${V.GOODS.map((g) => `<div class="price"><span class="dot g-${g}"></span><span>${GOOD_NAME[g]}</span><b>${coin(V.price(s, g))}</b><span class="ladder">${V.PRICES[g].map((_, i) => `<i class="${i <= s.priceIdx[g] ? 'on' : ''}"></i>`).join('')}</span></div>`).join('')}
      <div id="event">${s.event ? `<b>${esc(s.event.title.toUpperCase())}</b>${iconize(esc(s.event.text))}` : '<b>NO EVENT YET</b>The first market tick comes at 6.'}</div>
    </div>

    <div id="contracts" class="panel">
      <h3>CONTRACTS</h3>
      ${s.contracts.map((c) => `
        <div class="ct ${ready.has(c.id) ? 'ready' : ''}" data-town="${c.town}">
          <div class="to">${V.TOWN_BY_ID.get(c.town)!.port ? ICON.anchor : ''}${townName(c.town)}</div>
          <div class="wants">${wantsHtml(c.wants)}</div>
          <div class="seal" title="${c.vp} glory">${c.vp}</div><div class="rw"><span><b>${coin(c.money)}</b></span>${ready.has(c.id) ? `<button class="btn primary go" data-c="${c.id}">DELIVER</button>` : ''}</div>
        </div>`).join('') || '<p class="note">No contracts left this Age.</p>'}
    </div>

    <div id="me" class="panel" style="border-left:5px solid ${me.color}">
      <h3>${esc(me.name.toUpperCase())}'S HOLDINGS</h3>
      <div class="row"><span>Income each tick</span><b>${coin(V.income(s, me.id))}</b></div>
      <div class="row"><span>Stock</span><span class="stock"><span class="amt" title="Mines">${ICON.mine}${me.stock.mine}</span><span class="amt" title="Smelters">${ICON.smelter}${me.stock.smelter}</span><span class="amt" title="Forges">${ICON.forge}${me.stock.works}</span></span></div>
      <div class="row"><span>Goods</span><span>${heldHtml(s, me.id) || '<span class="goal">none</span>'}</span></div>
      <h3 style="margin-top:6px">PATRONS · 8 / 4 GLORY</h3>
      ${s.goals.map((g) => { const d = V.GOALS.find((x) => x.id === g)!; return `<div class="goal"><b>${d.title}</b> · ${d.text} <span style="color:var(--ink)">(${V.goalMetric(s, g, me.id)})</span></div>` }).join('')}
    </div>

    <div id="actions" class="panel">
      ${ACTS.map((a) => `<button class="btn act ${pending === a.type ? 'on' : ''}" data-a="${a.type}" ${myTurn() && can(a.type) ? '' : 'disabled'} title="Key ${a.key}">
        <span class="ic">${ICON[a.type]}</span><span class="lb">${a.label.toUpperCase()}</span>
        <span class="tm">${a.type === 'wait' ? `+${coin(waitGain)}` : `<span class="amt">${ICON.time}${V.ACTION_TIME[a.type as Exclude<ActType, 'wait'>]}</span>`}</span></button>`).join('')}
    </div>

    ${pending && promptText[pending] ? `<div id="prompt" class="panel">${promptText[pending]} <button class="btn" id="p-x">CANCEL</button></div>` : ''}
    ${cur && !localIds.has(cur.id) ? `<div id="prompt" class="panel">${esc(cur.name)} ${cur.isAI ? 'is plotting…' : 'is deciding…'}</div>` : ''}

    <div id="log" class="panel">${s.log.slice(-5).map((l) => `<div>${iconize(esc(l.text))}</div>`).join('')}</div>
    <div id="tip" class="panel hidden"></div>`
  hud.querySelectorAll<HTMLButtonElement>('.act').forEach((b) => {
    b.onclick = () => { sfx.click(0, 0, 0); const t = b.dataset.a as ActType; setPending(pending === t ? null : t) }
  })
  hud.querySelectorAll<HTMLButtonElement>('.go').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); void commit({ type: 'deliver', contract: b.dataset.c! }) } })
  hud.querySelectorAll<HTMLElement>('.ct').forEach((c) => { c.onclick = () => table.focusTown(c.dataset.town!) })
  $('p-x')?.addEventListener('click', () => setPending(null))
  $('b-view').onclick = () => {
    table.setView(table.view === 'pov' ? 'overview' : 'pov', cur && localIds.has(cur.id) ? cur.id : firstLocal())
    render()
  }
  $('b-music').onclick = () => { music.setEnabled(!music.enabled); sfx.setEnabled(music.enabled); render() }
  $('b-help').onclick = () => showHelp()
  $('b-quit').onclick = () => {
    if (!confirm('Leave this battle? Solo and same-screen games are saved.')) return
    location.reload()
  }
}

function heldHtml(s: GameState, pid: string): string {
  const held: V.Goods = {}
  for (const o of V.buildingsOf(s, pid)) for (const g of V.GOODS) held[g] = (held[g] ?? 0) + (o.b.goods[g] ?? 0)
  return V.GOODS.filter((g) => held[g]).map((g) => `<span class="chip"><span class="dot g-${g}"></span>${held[g]}</span>`).join(' ')
}

function feedCard(name: string, color: string, text: string): void {
  let feed = document.getElementById('feed')
  if (!feed) {
    feed = document.createElement('div')
    feed.id = 'feed'
    document.body.appendChild(feed)
  }
  const card = document.createElement('div')
  card.className = 'feedcard'
  card.style.setProperty('--pc', color)
  // Strip the actor's name from the start: the card header already shows it.
  const body = text.startsWith(name) ? text.slice(name.length).trim() : text
  card.innerHTML = `<b>${esc(name)}</b><span>${iconize(esc(body))}</span>`
  feed.prepend(card)
  while (feed.children.length > 3) feed.lastElementChild!.remove()
  setTimeout(() => {
    card.classList.add('out')
    setTimeout(() => card.remove(), 400)
  }, 3600)
}

let bannerTimer = 0
function banner(big: string, small: string): void {
  const b = $('banner')
  b.querySelector('.big')!.textContent = big
  b.querySelector('.small')!.textContent = small
  b.classList.remove('hidden')
  b.animate([{ opacity: 0, transform: 'scale(1.15)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.2,1.4,.4,1)' })
  clearTimeout(bannerTimer)
  bannerTimer = window.setTimeout(() => {
    b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400 }).onfinish = () => b.classList.add('hidden')
  }, 2300)
}

// A short flash never covers a banner that is still telling news (a tick, an Age).
function flash(text: string): void { if ($('banner').classList.contains('hidden')) banner(text, '') }

function toast(title: string, text: string): void { banner(title.toUpperCase(), text) }

function results(): void {
  const s = state!
  music.setScene('end')
  music.drums(6)
  const f = s.final!
  const el = document.createElement('div')
  el.id = 'results'
  const labels = [...new Set(f.flatMap((r) => r.breakdown.map((b) => b.label)))]
  el.innerHTML = `<div class="card panel">
    <h2>${esc(f[0].name.toUpperCase())} RULES THE VALLEY</h2>
    <table>
      <tr><td></td>${f.map((r) => `<td><b>${esc(r.name)}</b></td>`).join('')}</tr>
      ${labels.map((l) => `<tr><td>${esc(l)}</td>${f.map((r) => `<td>${r.breakdown.find((b) => b.label === l)?.vp ?? '·'}</td>`).join('')}</tr>`).join('')}
      <tr class="w"><td><b>Total glory</b></td>${f.map((r) => `<td><b>${r.vp}</b></td>`).join('')}</tr>
    </table>
    <button class="btn primary" id="r-again">PLAY AGAIN</button>
  </div>`
  document.body.appendChild(el)
  $('r-again').onclick = () => location.reload()
}

mainMenu()
table.setView('overview', null, 0.01)

// Dev-only handle for browser tests.
if (import.meta.env.DEV) Object.assign(window, { __valley: { table, get state() { return state } } })
