import type { ActionType, GameState, BuildOption } from './state'
import { CITY_BY_ID, currentPlayer, legalActions, playerById } from './state'
import type { Card } from './state'

// Victorian DOM HUD: engraved plates, parchment cards, ledger log.
// All styling lives in kinetic.html; this module only manages structure/state.

export type UiMode = 'idle' | 'BUILD' | 'NETWORK' | 'DEVELOP' | 'SELL' | 'LOAN' | 'SCOUT' | 'PASS'

export interface PopoverItem {
  label: string
  sub: string
  cost?: string
  disabled: boolean
  accent?: string
  onSelect?: () => void
}

export interface HudHooks {
  onAction(action: ActionType): void
  onCancel(): void
  /** Single click — select/preview only. */
  onCardPick(cardId: string): void
  /** Double click (event.detail ≥ 2) — rule-validated use/confirm. */
  onCardUse(cardId: string): void
  onReset(): void
}

const INDUSTRY_LABEL: Record<string, string> = {
  coal: 'Coal Mine',
  iron: 'Iron Works',
  cotton: 'Cotton Mill',
  manufacturer: 'Manufacturer',
  pottery: 'Pottery',
  brewery: 'Brewery',
}

function cardTip(c: Card): string {
  if (c.kind === 'wild-location') return 'Wild Location: build any industry in any town you can reach.'
  if (c.kind === 'wild-industry') return `Wild ${INDUSTRY_LABEL[c.industry ?? 'coal']}: build this industry in any town.`
  const city = c.cityId ? CITY_BY_ID.get(c.cityId) : undefined
  return city ? `${city.name}: build there, or build any industry connected to your network.` : ''
}

function emblemSvg(c: Card, kind?: string): string {
  const st = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'
  if (c.kind === 'wild-location') {
    return `<svg viewBox="0 0 48 40" ${st}><path d="M24 4l4.2 9 9.8 1.2-7.2 6.8 1.9 9.7L24 25.8 15.3 30.7l1.9-9.7L10 14.2 19.8 13z"/></svg>`
  }
  if (c.kind === 'wild-industry') {
    return `<svg viewBox="0 0 48 40" ${st}><circle cx="24" cy="20" r="6"/><path d="M24 6v5M24 29v5M10 20h5M33 20h5M14 10l3.5 3.5M30.5 26.5L34 30M34 10l-3.5 3.5M17.5 26.5L14 30"/></svg>`
  }
  if (kind === 'merchant') {
    return `<svg viewBox="0 0 48 40" ${st}><path d="M6 34h36M10 34V16l14-8 14 8v18M18 34v-9h12v9"/><circle cx="24" cy="16" r="2.5"/></svg>`
  }
  if (kind === 'farm-brewery') {
    return `<svg viewBox="0 0 48 40" ${st}><path d="M12 14h20v18a3 3 0 01-3 3H15a3 3 0 01-3-3zM32 18h4a3 3 0 010 8h-4M16 9c0 3 3 3 3 6M22 8c0 3 3 3 3 6"/></svg>`
  }
  return `<svg viewBox="0 0 48 40" ${st}><path d="M4 34h40M8 34V20h8v14M16 34V12h9v22M25 34V22h7v12M32 34V16h8v18"/><path d="M19 8c0-3 3-3 3-6M13 12c0-2 2-2 2-4"/></svg>`
}

export class Hud {
  private el: Record<string, HTMLElement> = {}
  hooks: HudHooks

  constructor(hooks: HudHooks) {
    this.hooks = hooks
    const ids = [
      'playersPlate', 'eraName', 'roundLabel', 'turnBanner', 'actionBar',
      'infoPanel', 'hand', 'logOl', 'tooltip', 'popover', 'popoverTitle',
      'popoverBody', 'overlay', 'audioBtn', 'resetBtn', 'logToggle', 'logPanel',
    ]
    for (const id of ids) this.el[id] = document.getElementById(id)!
    this.wire()
  }

  private wire(): void {
    this.el.actionBar.querySelectorAll('button[data-act]').forEach((b) => {
      b.addEventListener('click', () => this.hooks.onAction((b as HTMLElement).dataset.act as ActionType))
    })
    this.el.resetBtn.addEventListener('click', () => this.hooks.onReset())
    this.el.logToggle.addEventListener('click', () => {
      this.el.logPanel.classList.toggle('open')
    })
    // Close popover on background click.
    this.el.popover.addEventListener('click', (e) => {
      if (e.target === this.el.popover) this.closePopover()
    })
  }

  onAudio(cb: (on: boolean) => void): void {
    let on = true
    this.el.audioBtn.onclick = () => {
      on = !on
      this.el.audioBtn.textContent = on ? 'Sound: On' : 'Sound: Off'
      cb(on)
    }
  }

  renderTurn(name: string, css: string): void {
    this.el.turnBanner.innerHTML = `<span class="tdot" style="background:${css}"></span>${escapeHtml(
      name.toUpperCase(),
    )}'S TURN`
  }

  setThinking(name: string | null, status?: string): void {
    if (name) {
      this.el.turnBanner.classList.add('thinking')
      const sfx = status ? ` — ${escapeHtml(status)}` : '…'
      this.el.turnBanner.innerHTML = `<span class="tdot think"></span>${escapeHtml(
        name.toUpperCase(),
      )} ${sfx}`
    } else {
      this.el.turnBanner.classList.remove('thinking')
    }
  }

  private renderPlayers(s: GameState): void {
    const cur = currentPlayer(s)
    const plate = this.el.playersPlate
    plate.innerHTML = s.order
      .map((pid) => {
        const p = playerById(s, pid)
        const isTurn = pid === cur.id
        const tag = p.isAI ? '<em>AI</em>' : ''
        const prev = this.prevRes.get(pid)
        const mDir = !prev ? '' : p.money > prev.m ? ' up' : p.money < prev.m ? ' down' : ''
        const vDir = !prev ? '' : p.vp > prev.v ? ' up' : p.vp < prev.v ? ' down' : ''
        const iDir = !prev ? '' : p.income > prev.i ? ' up' : p.income < prev.i ? ' down' : ''
        this.prevRes.set(pid, { m: p.money, v: p.vp, i: p.income })
        const needle = Math.max(-70, Math.min(140, p.income * 16 - 24))
        const stat = (cls: string, title: string, glyph: string, val: string, label: string) =>
          `<span class="rglyph stat ${cls}" title="${title}"><span class="${glyph}"></span><b>${val}</b><small>${label}</small></span>`
        return `<div class="pplate ${isTurn ? 'turn' : 'wait'}" style="--pc:${p.css}">
          <div class="phead">
            <span class="pdot"></span>
            <span class="pname">${escapeHtml(p.name)} ${tag}</span>
            <span class="medal${vDir}" title="Victory Points">${p.vp}<small>VP</small></span>
          </div>
          <div class="statgrid">
            ${stat('pmoney' + mDir, 'money', 'g-coin', `£${p.money}`, 'Money')}
            ${stat('inc' + iDir, 'income per round', 'g-gauge" style="--needle:' + needle + 'deg', `+${p.income}`, 'Income')}
            ${stat('res-coal', 'coal', 'g-lump', `${p.coal}`, 'Coal')}
            ${stat('res-iron', 'iron', 'g-ingot', `${p.iron}`, 'Iron')}
            ${stat('res-beer', 'beer', 'g-barrel', `${p.beer}`, 'Beer')}
          </div>
        </div>`
      })
      .join('')
  }

  private prevRes = new Map<string, { m: number; v: number; i: number }>()

  // ------------------------------ Rendering ---------------------------------

  refresh(s: GameState, mode: UiMode, selectedCardId: string | null): void {
    const cur = currentPlayer(s)
    this.renderTurn(cur.name, cur.css)
    this.renderPlayers(s)

    this.el.eraName.textContent = s.era === 'canal' ? 'CANAL ERA' : 'RAILWAY ERA'
    const rp = s.players.length >= 4 ? 8 : s.players.length === 3 ? 9 : 10
    const total = s.era === 'canal' && s.round === 1 ? 1 : 2
    const done = Math.min(total, total - cur.actionsLeft + (cur.actionsLeft > 0 ? 0 : 0))
    this.el.roundLabel.textContent =
      `Round ${Math.min(s.round, rp)} of ${rp} · ACTION ${Math.min(total, total - cur.actionsLeft + 1)}/${total}`
    if (!this.el.turnBanner.classList.contains('thinking')) {
      this.renderTurn(cur.name, cur.css)
    }

    const legal = legalActions(s, cur.id)
    this.el.actionBar.querySelectorAll('button[data-act]').forEach((b) => {
      const act = (b as HTMLElement).dataset.act as ActionType
      const btn = b as HTMLButtonElement
      btn.disabled = !legal[act] || s.over
      btn.classList.toggle('active', mode === act)
    })

    const info = this.el.infoPanel
    if (s.over) {
      info.innerHTML = '<span class="dim">The reckoning is complete.</span>'
    } else {
      switch (mode) {
        case 'BUILD':
          info.innerHTML =
            '<b>BUILD</b> · pick a city card below, then choose a city on the board.<br/><span class="dim">Costs are shown before you confirm.</span>'
          break
        case 'NETWORK':
          info.innerHTML = '<b>NETWORK</b> · click a glowing route to build it.'
          break
        case 'DEVELOP':
          info.innerHTML = '<b>DEVELOP</b> · click one of your industries to discard it.'
          break
        case 'SELL':
          info.innerHTML = '<b>SELL</b> · click a glowing mill or works to sell its goods.'
          break
        default:
          info.innerHTML =
            '<span class="dim">Choose an action — drag to orbit, scroll to zoom.</span>'
      }
    }

    // Authoritative hand-visibility sync — the real hand can never get
    // stuck hidden (or interactive) after turns, refills or AI actions.
    this.el.hand.classList.toggle('hide-hand', mode !== 'idle' && !s.over)
    this.el.hand.classList.toggle('waiting', cur.isAI || s.over)
    const handEl = this.el.hand
    handEl.innerHTML = ''
    // One authoritative interaction path: a single delegated listener on the
    // hand container survives every re-render/turn/refill for the life of
    // the page. Individual cards only carry data — never their own listeners.
    if (!handEl.dataset.delegated) {
      handEl.dataset.delegated = '1'
      handEl.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).closest('.vcard') as HTMLElement | null
        if (!target) return
        const cardId = target.dataset.cardId
        if (!cardId) return
        // BUG 1 fix: event.detail ≥ 2 means the second press of a physical
        // double-click. We must NOT run the toggle again (that destroyed the
        // selection); instead route straight to rule-validated use.
        if (e.detail >= 2 && this.hooks.onCardUse) {
          this.hooks.onCardUse(cardId)
          return
        }
        this.hooks.onCardPick(cardId)
      })
    }
    cur.hand.forEach((c) => {
      const card = document.createElement('div')
      card.className = 'vcard' + (c.id === selectedCardId ? ' sel' : '')
      card.dataset.cardId = c.id
      card.title = cardTip(c)
      card.appendChild(this.cardFace(c, cur.css))
      handEl.appendChild(card)
    })
    if (cur.hand.length === 0) {
      handEl.innerHTML = '<div class="nohand dim">no cards</div>'
    }

    // Log.
    const ol = this.el.logOl
    ol.innerHTML = [...s.log]
      .reverse()
      .slice(0, 26)
      .map(
        (l) =>
          `<li class="${l.tone ?? ''}"><span class="lmark">§</span>${escapeHtml(l.text)}</li>`,
      )
      .join('')
  }

  private cardFace(c: Card, tintCss: string): HTMLElement {
    const face = document.createElement('div')
    face.className = 'vcard-face kind-' + c.kind
    face.style.setProperty('--tint', tintCss)
    const city = c.cityId ? CITY_BY_ID.get(c.cityId) : undefined
    const title =
      c.kind === 'wild-location' ? 'Wild Location' : c.kind === 'wild-industry' ? INDUSTRY_LABEL[c.industry ?? 'coal'] : (city?.name ?? '')
    const sub =
      c.kind === 'wild-location'
        ? 'ANY TOWN'
        : c.kind === 'wild-industry'
          ? 'ANY INDUSTRY'
          : city?.kind === 'merchant'
            ? 'MERCHANT'
            : city?.kind === 'farm-brewery'
              ? 'FARM BREWERY'
              : city?.town
                ? 'TOWN'
                : 'CITY'
    const pips = city ? '<i></i>'.repeat(Math.min(city.slots, 4)) : ''
    face.innerHTML = `<div class="vc-kind">${c.kind === 'location' ? 'LOCATION' : 'WILD'}</div>
      <div class="vc-emblem">${emblemSvg(c, city?.kind)}</div>
      <div class="vc-title">${escapeHtml(title)}</div>
      <div class="vc-sub">${sub}</div>
      <div class="vc-pips">${pips}</div>
      <div class="vc-brand">BRONZE</div>`
    return face
  }

  // ------------------------------ Floating UI --------------------------------

  showTip(text: string, x: number, y: number): void {
    const t = this.el.tooltip
    t.innerHTML = text
    t.style.left = `${x + 16}px`
    t.style.top = `${y + 14}px`
    t.classList.remove('hidden')
  }

  hideTip(): void {
    this.el.tooltip.classList.add('hidden')
  }

  openPopover(x: number, y: number, title: string, items: PopoverItem[]): void {
    this.el.popoverTitle.textContent = title
    const body = this.el.popoverBody
    body.innerHTML = ''
    if (items.length === 0) {
      body.innerHTML = '<div class="dim pop-note">Nothing can be built here right now.<br/>Select a matching city card first.</div>'
    }
    for (const it of items) {
      const row = document.createElement('button')
      row.className = 'pop-item'
      row.disabled = it.disabled
      row.innerHTML = `<span class="pi-accent" style="background:${it.accent ?? '#b58a3a'}"></span>
        <span class="pi-main"><span class="pi-label">${it.label}</span>
        <span class="pi-sub">${it.sub}</span></span>
        ${it.cost ? `<span class="pi-cost">${it.cost}</span>` : ''}`
      row.addEventListener('click', () => {
        if (!row.disabled) it.onSelect?.()
      })
      body.appendChild(row)
    }
    this.el.popover.classList.remove('hidden')
    this.movePopover(x, y)
  }

  movePopover(x: number, y: number): void {
    const p = this.el.popover
    const pw = p.offsetWidth || 320
    const ph = p.offsetHeight || 240
    p.style.left = `${Math.min(Math.max(12, x - pw / 2), window.innerWidth - pw - 12)}px`
    p.style.top = `${Math.min(Math.max(70, y + 18), window.innerHeight - ph - 90)}px`
  }

  closePopover(): void {
    this.el.popover.classList.add('hidden')
  }

  get popoverOpen(): boolean {
    return !this.el.popover.classList.contains('hidden')
  }

  toast(msg: string): void {
    let t = document.getElementById('ktoast')
    if (!t) {
      t = document.createElement('div')
      t.id = 'ktoast'
      document.body.appendChild(t)
    }
    t.textContent = msg
    t.classList.add('show')
    window.setTimeout(() => t!.classList.remove('show'), 2200)
  }

  // ------------------------------ Overlays -----------------------------------

  eraTransition(from: string, to: string, onDone: () => void): void {
    const ov = this.el.overlay
    ov.innerHTML = `
      <div class="era-wrap">
        <div class="era-line">${from} COMPLETE</div>
        <div class="era-mid">— the iron age arrives —</div>
        <div class="era-big">${to}</div>
      </div>`
    ov.classList.remove('hidden')
    ov.classList.add('era')
    window.setTimeout(() => {
      ov.classList.add('hidden')
      ov.classList.remove('era')
      ov.innerHTML = ''
      onDone()
    }, 2600)
  }

  gameOver(
    rows: {
      name: string
      vp: number
      money: number
      income: number
      vpBuilds: number
      vpSells: number
      linksBuilt: number
      railVp: number
    }[],
    onRestart: () => void,
    onLobby: () => void,
  ): void {
    const ov = this.el.overlay
    const table = rows
      .map(
        (r, i) =>
          `<tr class="${i === 0 ? 'win' : ''}">
            <td>${i + 1}.</td><td>${escapeHtml(r.name)}</td>
            <td>${r.vp} VP</td><td>£${r.money}</td><td>+${r.income}</td>
            <td>${r.vpBuilds}</td><td>${r.vpSells}</td><td>${r.linksBuilt}</td>
            <td>${r.railVp}</td>
          </tr>`,
      )
      .join('')
    ov.className = ''
    ov.innerHTML = `
      <div class="ledger">
        <h2>The Industrial Age Concludes</h2>
        <table class="results">
          <thead><tr><th></th><th>Industrialist</th><th>VP</th><th>Wealth</th><th>Income</th><th>Industry</th><th>Trade</th><th>Network</th><th>Rail Era</th></tr></thead>
          <tbody>${table}</tbody>
        </table>
        <div class="btnrow">
          <button id="againBtn">Play Again</button>
          <button id="lobbyBtn">Return to Lobby</button>
        </div>
      </div>`
    ov.classList.remove('hidden')
    document.getElementById('againBtn')!.addEventListener('click', () => {
      ov.classList.add('hidden')
      onRestart()
    })
    document.getElementById('lobbyBtn')!.addEventListener('click', () => {
      ov.classList.add('hidden')
      onLobby()
    })
  }

  confirm(title: string, body: string, okLabel: string, onOk: () => void): void {
    const ov = this.el.overlay
    ov.className = ''
    ov.innerHTML = `
      <div class="ledger" style="min-width:340px">
        <h2>${escapeHtml(title)}</h2>
        <p class="dim" style="margin-bottom:6px">${escapeHtml(body)}</p>
        <div class="btnrow">
          <button id="cfCancel">Cancel</button>
          <button id="cfOk">${escapeHtml(okLabel)}</button>
        </div>
      </div>`
    ov.classList.remove('hidden')
    document.getElementById('cfCancel')!.addEventListener('click', () => {
      ov.classList.add('hidden')
    })
    document.getElementById('cfOk')!.addEventListener('click', () => {
      ov.classList.add('hidden')
      onOk()
    })
  }

  hideOverlay(): void {
    this.el.overlay.classList.add('hidden')
    this.el.overlay.innerHTML = ''
  }

  confirmLeave(onContinue: () => void, onHome: () => void): void {
    const ov = this.el.overlay
    ov.className = ''
    ov.innerHTML = `
      <div class="ledger" style="min-width:340px">
        <h2>Leave Current Game?</h2>
        <p class="dim" style="margin-bottom:6px">The table will be cleared.</p>
        <div class="btnrow">
          <button id="lvStay">Continue Playing</button>
          <button id="lvGo">Return Home</button>
        </div>
      </div>`
    ov.classList.remove('hidden')
    document.getElementById('lvStay')!.addEventListener('click', () => {
      ov.classList.add('hidden')
      onContinue()
    })
    document.getElementById('lvGo')!.addEventListener('click', () => {
      ov.classList.add('hidden')
      onHome()
    })
  }

  setBusy(busy: boolean): void {
    this.el.actionBar.classList.toggle('locked', busy)
  }

  setSoundLabel(on: boolean): void {
    this.el.audioBtn.textContent = on ? 'Sound: On' : 'Sound: Off'
  }
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
