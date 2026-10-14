import { io, type Socket } from 'socket.io-client'
import {
  INCOME_TRACK,
  INDUSTRY_NAME,
  LINK_BY_ID,
  LOCATION_BY_ID,
  cardLabel,
  legalBuildTargets,
  legalNetworkLinks,
  legalSales,
  networkCost,
  scorePlayer,
  tileSpec,
  type GameAction,
  type GameState,
} from '@bronze/shared'
import { createBoard, type BoardHandle } from './board.js'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

type View = 'menu' | 'lobby' | 'game'
let socket: Socket | null = null
let state: (GameState & { youId: string }) | null = null
let board: BoardHandle | null = null
let selectedCard: string | null = null
let devSel: string[] = []
let toastTimer = 0

function show(view: View): void {
  for (const v of ['menu', 'lobby', 'game'] as const) {
    $(v).classList.toggle('hidden', v !== view)
  }
}

function toast(msg: string): void {
  const el = $('toast')
  el.textContent = msg
  el.classList.remove('hidden')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el.classList.add('hidden'), 2600)
}

function connect(): Socket {
  if (socket) return socket
  socket = io()
  socket.on('lobby', (msg: { code: string; seats: { name: string }[] }) => {
    $('lobbyCode').textContent = msg.code
    const ul = $('seats')
    ul.innerHTML = ''
    for (const s of msg.seats) {
      const li = document.createElement('li')
      li.textContent = s.name
      ul.appendChild(li)
    }
    show('lobby')
  })
  socket.on('started', () => {
    $('actionsDiv').innerHTML = '<div class="targetRow"><span class="loc">Dealing cards…</span></div>'
    show('game')
  })
  socket.on('game', (s: GameState & { youId: string }) => {
    state = s
    void renderGame()
  })
  socket.on('action:error', (m: { message: string }) => toast(m.message))
  return socket
}

function me(): GameState['players'][number] | null {
  if (!state) return null
  return state.players.find((p) => p.id === state!.youId) ?? null
}

async function ensureBoard(): Promise<BoardHandle> {
  if (!board) board = await createBoard($('boardHost'))
  return board
}

async function renderGame(): Promise<void> {
  const s = state
  if (!s) return
  ;(await ensureBoard()).render(s)

  const m = me()
  const status = $('status')
  const myId = s.youId
  const isMyTurn =
    m !== null && s.order[s.currentTurnIdx] === myId && s.phase === 'playing'
  const turnName = s.players.find((p) => p.id === s.order[s.currentTurnIdx])?.name ?? '?'
  status.innerHTML = `
    <span class="era">${s.era === 'canal' ? 'Canal Era' : 'Rail Era'}</span>
    <span>Round ${s.round}/10</span>
    <span class="muted">turn: ${turnName}${isMyTurn ? ' — YOU' : ''}</span>
    ${
      m
        ? `<span>£${m.money}</span><span class="muted">income ${INCOME_TRACK[m.incomeIndex]}</span>
           <span class="muted">loans ${m.loans}</span><span class="muted">VP ${scorePlayer(s, myId)}</span>`
        : '<span class="muted">spectating</span>'
    }
    <button id="leaveBtn">Leave</button>
  `
  $('leaveBtn').onclick = () => {
    clearSession()
    location.reload()
  }

  renderPlayers()
  renderActions(isMyTurn && m !== null)
  renderLog()
  renderHand(m)

  if (s.phase === 'game_end' && s.finalScores) {
    const ov = $('overlay')
    const rows = s.finalScores
      .map(
        (f, i) =>
          `<tr><td>${i + 1}.</td><td>${f.name}</td><td>${f.vp} VP</td><td>£${f.money}</td></tr>`,
      )
      .join('')
    ov.innerHTML = `<div class="sheet"><h2>The Final Ledger</h2><table>${rows}</table>
      <button onclick="location.reload()">Return to the Forge</button></div>`
    ov.classList.remove('hidden')
  } else {
    $('overlay').classList.add('hidden')
  }
}

function renderPlayers(): void {
  if (!state) return
  const div = $('playersDiv')
  const rows = state.order
    .map((pid) => {
      const p = state!.players.find((x) => x.id === pid)!
      const isTurn = pid === state!.order[state!.currentTurnIdx]
      return `<tr class="${isTurn ? 'turn' : ''}">
        <td><span style="color:${p.color}">■</span> ${p.name}</td>
        <td class="num">£${p.money}</td>
        <td class="num">${scorePlayer(state!, pid)} VP</td>
      </tr>`
    })
    .join('')
  div.innerHTML = `<table>${rows}</table>`
}

function renderLog(): void {
  if (!state) return
  const ol = $('logOl')
  ol.innerHTML = ''
  for (const line of [...state.log].reverse().slice(0, 40)) {
    const li = document.createElement('li')
    li.textContent = line.text
    ol.appendChild(li)
  }
}

function send(action: GameAction): void {
  socket?.emit('game:action', { action })
}

interface SavedSession {
  code: string
  name: string
}

const SESSION_KEY = 'bronze.session'

function saveSession(s: SavedSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SavedSession
    return s.code && s.name ? s : null
  } catch {
    return null
  }
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

function showRejoin(): void {
  const s = loadSession()
  const btn = $('rejoinBtn')
  if (!s) {
    btn.classList.add('hidden')
    return
  }
  btn.textContent = `Return to table ${s.code} as ${s.name}`
  btn.classList.remove('hidden')
  btn.onclick = () => {
    ;($('nameInput') as HTMLInputElement).value = s.name
    ;($('codeInput') as HTMLInputElement).value = s.code
    connect().emit('lobby:join', { code: s.code, name: s.name })
  }
}

function actButton(label: string, disabled: boolean, fn: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.disabled = disabled
  b.onclick = fn
  return b
}

function renderActions(myTurn: boolean): void {
  if (!state) return
  const div = $('actionsDiv')
  div.innerHTML = ''
  const meNow = me()

  const buildGroup = document.createElement('div')
  buildGroup.className = 'group'
  if (selectedCard) {
    const targets = legalBuildTargets(state, state.youId).filter((t) => t.cardId === selectedCard)
    buildGroup.appendChild(
      Object.assign(document.createElement('h3'), { textContent: `Building with ${cardLabel(cardOf(selectedCard))}` }),
    )
    for (const t of targets) {
      const row = document.createElement('div')
      row.className = 'targetRow'
      const loc = document.createElement('span')
      loc.className = 'loc'
      loc.textContent = `${LOCATION_BY_ID.get(t.locationId)?.name ?? t.locationId} · ${INDUSTRY_NAME[t.industry]}`
      row.appendChild(loc)
      for (const lv of t.levels) {
        const spec = tileSpec(t.industry, lv)
        row.appendChild(actButton(`L${lv} £${spec.cost}`, false, () => {
          send({
            type: 'BUILD',
            cardId: t.cardId,
            locationId: t.locationId,
            slotIndex: t.slotIndex,
            industry: t.industry,
            level: lv,
          })
          selectedCard = null
        }))
      }
      buildGroup.appendChild(row)
    }
    if (targets.length === 0) {
      buildGroup.appendChild(Object.assign(document.createElement('div'), {
        textContent: 'No affordable placements for this card.',
        className: 'loc',
      }))
    }
  }

  const netGroup = document.createElement('div')
  netGroup.className = 'group'
  const links = myTurn ? legalNetworkLinks(state, state.youId) : []
  netGroup.appendChild(Object.assign(document.createElement('h3'), { textContent: `Links (${links.length})` }))
  const linkChips = document.createElement('div')
  linkChips.className = 'chips'
  for (const id of links) {
    const lk = LINK_BY_ID.get(id)!
    const chip = document.createElement('span')
    chip.className = 'chip'
    chip.textContent = `${LOCATION_BY_ID.get(lk.a)?.name} ↔ ${LOCATION_BY_ID.get(lk.b)?.name} (£${networkCost(state, state.youId)})`
    chip.onclick = () => send({ type: 'NETWORK', linkId: id })
    linkChips.appendChild(chip)
  }
  netGroup.appendChild(linkChips)

  const sellGroup = document.createElement('div')
  sellGroup.className = 'group'
  const sales = myTurn ? legalSales(state, state.youId) : []
  sellGroup.appendChild(Object.assign(document.createElement('h3'), { textContent: `Sell (${sales.length})` }))
  for (const s of sales) {
    const row = document.createElement('div')
    row.className = 'targetRow'
    const tile = state.locations[s.locationId][s.slotIndex]
    const sel = document.createElement('select')
    for (const b of s.beers) {
      const opt = document.createElement('option')
      opt.value = `${b.locationId}:${b.slotIndex}`
      opt.textContent = `beer @ ${LOCATION_BY_ID.get(b.locationId)?.name}`
      sel.appendChild(opt)
    }
    row.appendChild(document.createTextNode(`Sell ${INDUSTRY_NAME[tile!.industry]} L${tile!.level} @ ${LOCATION_BY_ID.get(s.locationId)?.name} using`))
    row.appendChild(sel)
    row.appendChild(actButton('Sell', false, () => {
      const [bl, bs] = sel.value.split(':')
      send({
        type: 'SELL',
        locationId: s.locationId,
        slotIndex: s.slotIndex,
        beerLocationId: bl,
        beerSlotIndex: Number(bs),
      })
    }))
    sellGroup.appendChild(row)
  }

  const devGroup = document.createElement('div')
  devGroup.className = 'group'
  devGroup.appendChild(Object.assign(document.createElement('h3'), { textContent: 'Develop' }))
  if (meNow) {
    const eligible = meNow.tilesLeft.filter((t) => t.count > 0)
      .filter((t) => {
        const spec = tileSpec(t.industry, t.level)
        return spec.era === state!.era && (!spec.developOnly || state!.justDeveloped)
      })
    for (const t of eligible.slice(0, 12)) {
      const lab = document.createElement('label')
      lab.className = 'dev'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      const key = `${t.industry}:${t.level}`
      cb.checked = devSel.includes(key)
      cb.onchange = () => {
        devSel = cb.checked ? [...devSel, key].slice(-2) : devSel.filter((k) => k !== key)
        renderActions(myTurn)
      }
      lab.appendChild(cb)
      lab.appendChild(document.createTextNode(` ${INDUSTRY_NAME[t.industry]} L${t.level} (${t.count} left)`))
      devGroup.appendChild(lab)
    }
    devGroup.appendChild(actButton(`Discard ${devSel.length}/2 tiles`, !myTurn || devSel.length === 0, () => {
      send({
        type: 'DEVELOP',
        tiles: devSel.map((k) => {
          const [ind, lvl] = k.split(':')
          return { industry: ind as GameState['players'][number]['tilesLeft'][number]['industry'], level: Number(lvl) }
        }),
      })
      devSel = []
    }))
  }

  const misc = document.createElement('div')
  misc.className = 'group chips'
  const canLoan = myTurn && meNow !== null && meNow.incomeIndex > 0
  misc.appendChild(actButton('Take Loan (+£30)', !canLoan, () => send({ type: 'LOAN' })))
  misc.appendChild(actButton('Pass', !myTurn, () => send({ type: 'PASS' })))

  div.append(buildGroup, netGroup, sellGroup, devGroup, misc)
}

function cardOf(cardId: string): GameState['players'][number]['hand'][number] {
  const m2 = me()
  return m2!.hand.find((c) => c.id === cardId)!
}

function renderHand(m: GameState['players'][number] | null): void {
  const bar = $('handBar')
  bar.innerHTML = ''
  if (!m) return
  for (const c of m.hand) {
    const chip = document.createElement('span')
    chip.className = 'cardChip' + (c.id === selectedCard ? ' sel' : '')
    chip.textContent = cardLabel(c)
    chip.onclick = () => {
      selectedCard = selectedCard === c.id ? null : c.id
      void renderGame()
    }
    bar.appendChild(chip)
  }
}

$('createBtn').onclick = () => {
  const name = ($('nameInput') as HTMLInputElement).value
  connect().emit('lobby:create', { name }, (v: { ok: boolean; code?: string }) => {
    if (v?.ok && v.code) saveSession({ code: v.code, name: name.trim() || 'Industrialist' })
  })
}
$('joinBtn').onclick = () => {
  const code = ($('codeInput') as HTMLInputElement).value.trim().toUpperCase()
  const name = ($('nameInput') as HTMLInputElement).value
  connect().emit(
    'lobby:join',
    { code, name },
    (v: { ok: boolean; seated?: boolean }) => {
      if (v?.ok) saveSession({ code, name: name.trim() || 'Industrialist' })
    },
  )
}
$('startBtn').onclick = () => {
  connect().emit('lobby:start', {})
}

showRejoin()
show('menu')
