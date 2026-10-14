import type { AIDifficulty, AIPersonality } from './state'
import type { TableRecord } from './session'

// HOME / CREATE TABLE / JOIN TABLE / LOBBY / SETTINGS / DEBUG AUDIT panels.
// Pure DOM; the 3D scene stays alive behind as atmosphere.

export interface ScreenHooks {
  onQuickPlay(cfg: {
    name: string
    aiCount: number
    difficulty: AIDifficulty
    personality: AIPersonality
  }): void
  onCreateTable(name: string): void
  onJoin(code: string, name: string): string | null // null = ok else error message
  onStartLobby(): void
  onAddAI(): void
  onRemoveAI(): void
  onLeaveLobby(): void
  onMusic(on: boolean): void
  onSfx(on: boolean): void
  onMusicVol(v: number): void
  onSfxVol(v: number): void
}

const PERSONALITIES: { id: AIPersonality; label: string }[] = [
  { id: 'industrialist', label: 'Industrialist' },
  { id: 'network-builder', label: 'Network Builder' },
  { id: 'opportunist', label: 'Opportunist' },
  { id: 'aggressive', label: 'Aggressive Investor' },
]

export class Screens {
  private el: Record<string, HTMLElement> = {}
  hooks: ScreenHooks

  constructor(hooks: ScreenHooks) {
    this.hooks = hooks
    const ids = [
      'screenHome', 'screenCreate', 'screenJoin', 'screenLobby',
      'inpName', 'inpCode', 'createMsg', 'joinMsg', 'lobbySeats',
      'lobbyCode', 'btnAddAi', 'btnRemoveAi', 'btnStart', 'btnLeaveLobby',
      'aiCountVal', 'aiDiff', 'aiPers', 'debugPanel',
      'chkMusic', 'chkSfx', 'rngMusic', 'rngSfx',
    ]
    for (const id of ids) this.el[id] = document.getElementById(id)!
    this.wire()
  }

  private q<T extends HTMLElement>(sel: string): T {
    return document.querySelector(sel) as T
  }

  private wire(): void {
    // Home navigation
    this.q('#navCreate').addEventListener('click', () => this.showPanel('create'))
    this.q('#navJoin').addEventListener('click', () => this.showPanel('join'))
    this.q('#navAi').addEventListener('click', () => this.showPanel('create', { ai: true }))
    // Deterministic navigation: panel BACK always returns to the HOME page.
    this.q('#backHome1').addEventListener('click', () => {
      location.href = './'
    })
    this.q('#backHome2').addEventListener('click', () => {
      location.href = './'
    })

    // CREATE (doubles as PLAY WITH AI config when .ai-mode)
    this.el.btnStart.dataset.mode = ''
    this.q('#btnDoCreate').addEventListener('click', () => {
      const name = (this.el.inpName as HTMLInputElement).value.trim() || 'Industrialist'
      ;(this.el.inpName as HTMLInputElement).value = name
      if (this.el.screenCreate.classList.contains('ai-mode')) {
        const aiCount = Number(this.el.aiCountVal.textContent)
        const difficulty = (this.el.aiDiff as HTMLSelectElement).value as AIDifficulty
        const personality = (this.el.aiPers as HTMLSelectElement).value as AIPersonality
        this.hooks.onQuickPlay({ name, aiCount, difficulty, personality })
      } else {
        this.hooks.onCreateTable(name)
      }
    })

    // JOIN
    this.q('#btnDoJoin').addEventListener('click', () => {
      const code = (this.el.inpCode as HTMLInputElement).value
      const name = (this.el.inpName as HTMLInputElement).value.trim() || 'Industrialist'
      const msg = this.hooks.onJoin(code, name)
      this.msg(this.el.joinMsg, msg ?? '', !msg)
      if (!msg) this.showPanel(null)
    })

    // Lobby controls
    this.el.btnAddAi.addEventListener('click', () => this.hooks.onAddAI())
    this.el.btnRemoveAi.addEventListener('click', () => this.hooks.onRemoveAI())
    this.el.btnStart.addEventListener('click', () => this.hooks.onStartLobby())
    this.el.btnLeaveLobby.addEventListener('click', () => this.hooks.onLeaveLobby())

    // Audio settings
    ;(this.el.chkMusic as HTMLInputElement).checked = true
    ;(this.el.chkSfx as HTMLInputElement).checked = true
    this.el.chkMusic.addEventListener('change', () =>
      this.hooks.onMusic((this.el.chkMusic as HTMLInputElement).checked),
    )
    this.el.chkSfx.addEventListener('change', () =>
      this.hooks.onSfx((this.el.chkSfx as HTMLInputElement).checked),
    )
    this.el.rngMusic.addEventListener('input', () =>
      this.hooks.onMusicVol(Number((this.el.rngMusic as HTMLInputElement).value)),
    )
    this.el.rngSfx.addEventListener('input', () =>
      this.hooks.onSfxVol(Number((this.el.rngSfx as HTMLInputElement).value)),
    )

    // AI count stepper
    this.q<HTMLElement>('#aiMinus').addEventListener('click', () => this.stepAi(-1))
    this.q<HTMLElement>('#aiPlus').addEventListener('click', () => this.stepAi(1))
  }

  private stepAi(d: number): void {
    const cur = Number(this.el.aiCountVal.textContent)
    const next = Math.min(3, Math.max(1, cur + d))
    this.el.aiCountVal.textContent = String(next)
  }

  showPanel(which: 'create' | 'join' | null, opts?: { ai?: boolean }): void {
    this.el.screenHome.classList.toggle('hidden', which === null)
    this.el.screenCreate.classList.add('hidden')
    this.el.screenJoin.classList.add('hidden')
    this.el.screenCreate.classList.toggle('ai-mode', !!opts?.ai)
    if (which === 'create') this.el.screenCreate.classList.remove('hidden')
    if (which === 'join') this.el.screenJoin.classList.remove('hidden')
    this.q('#btnDoCreate').textContent = opts?.ai ? 'BEGIN THE AGE' : 'OPEN TABLE'
  }

  showLobby(visible: boolean): void {
    this.el.screenLobby.classList.toggle('hidden', !visible)
  }

  hideAll(): void {
    this.el.screenHome.classList.add('hidden')
    this.el.screenLobby.classList.add('hidden')
  }

  renderLobby(table: TableRecord): void {
    this.el.lobbyCode.textContent = table.code
    this.el.lobbySeats.innerHTML = table.seats
      .map((s, i) => {
        const aiTag = s.isAI ? `<em>AI · ${escape(s.personality ?? 'industrialist')}</em>` : ''
        return `<div class="seat"><span class="seat-n">${i + 1}</span>
          <span class="seat-name">${escape(s.name)} ${aiTag}</span>
          <span class="seat-ready">READY</span></div>`
      })
      .join('')
    this.el.btnAddAi.toggleAttribute('disabled', table.seats.length >= 4)
    this.el.btnRemoveAi.toggleAttribute('disabled', !table.seats.some((s) => s.isAI))
    this.el.btnStart.toggleAttribute('disabled', table.seats.length < 2)
    const open = [...Array(Math.max(0, 4 - table.seats.length)).keys()]
      .map(() => '<div class="seat waiting"><span class="seat-name dim">Waiting…</span></div>')
      .join('')
    this.el.lobbySeats.insertAdjacentHTML('beforeend', open)
  }

  private msg(target: HTMLElement, text: string, ok: boolean): void {
    target.textContent = text
    target.classList.toggle('bad', !!text && !ok)
    target.classList.toggle('good', !!text && ok)
  }

  joinMessage(reason: string): string {
    switch (reason) {
      case 'format': return 'That code does not look right — five letters or digits.'
      case 'notfound': return 'No such table is registered on this desk.'
      case 'full': return 'That table is full or already dealing.'
      case 'duplicate': return 'Someone at that table already bears your name.'
      default: return ''
    }
  }

  toggleDebug(force?: boolean): void {
    const p = this.el.debugPanel
    const show = force ?? p.classList.contains('hidden')
    p.classList.toggle('hidden', !show)
    return void show
  }

  setDebug(content: string): void {
    this.el.debugPanel.innerHTML = content
  }
}

function escape(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
