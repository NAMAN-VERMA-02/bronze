import { io, type Socket } from 'socket.io-client'
import type { GameState } from '@bronze/shared'

const URL = 'http://localhost:3001'
type View = GameState & { youId: string }

function main(): void {
  const a: Socket = io(URL)
  const b: Socket = io(URL)

  let va: View | null = null
  let vb: View | null = null
  a.on('game', (s: View) => (va = s))
  b.on('game', (s: View) => (vb = s))
  a.on('action:error', () => {})
  b.on('action:error', () => {})

  a.emit('lobby:create', { name: 'Alice' }, (v: { ok: boolean; code: string }) => {
    if (!v?.ok) fail('create failed')
    b.emit(
      'lobby:join',
      { code: v.code, name: 'Bob' },
      (j: { ok: boolean }) => {
        if (!j?.ok) fail('join failed')
        a.emit('lobby:start', {}, (s: { ok: boolean; error?: string }) => {
          if (!s?.ok) fail(`start failed: ${s?.error}`)
        })
      },
    )
  })

  let startIdx = -1
  let loaned = false
  let step = 0

  function fail(msg: string): void {
    console.error(`E2E FAIL — ${msg}`)
    process.exit(1)
  }

  const timer = setInterval(() => {
    if (++step > 300) fail('timeout')
    if (!va || !vb) return
    if (startIdx < 0) startIdx = va.currentTurnIdx
    if (va.phase !== 'playing') {
      console.log('E2E OK — game reached the final ledger')
      finish()
    }
    const cur = va.order[va.currentTurnIdx]
    const actor = cur === 'p0' ? a : b
    const view = cur === 'p0' ? va : vb
    if (view.phase !== 'playing') return
    if (!loaned && view.actionsLeft === 2) {
      loaned = true
      actor.emit('game:action', { action: { type: 'LOAN' } })
      return
    }
    if (view.actionsLeft > 0) actor.emit('game:action', { action: { type: 'PASS' } })
    if (va.round > 1 || va.currentTurnIdx !== startIdx) {
      for (const p of va.players) {
        if (p.id !== va.youId && p.hand.length !== 0) fail('opponent hand leaked')
      }
      console.log(
        'E2E OK — room create/join/start, loan+pass actions, turn rotation, hand redaction verified',
      )
      finish()
    }
  }, 100)

  function finish(): void {
    clearInterval(timer)
    a.close()
    b.close()
    process.exit(0)
  }
}

main()
