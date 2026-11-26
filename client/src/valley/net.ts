// Online play over WebRTC (PeerJS). The host's browser runs the rules
// engine; guests send actions and receive state. No server of our own.

import Peer, { type DataConnection } from 'peerjs'
import type { Action, GameState, SeatSpec } from '@bronze/shared/valley'

const PREFIX = 'aurel-valley-table-'

export type HostMsg =
  | { t: 'lobby'; seats: SeatSpec[]; you: number }
  | { t: 'state'; state: GameState; you: string }
  | { t: 'error'; text: string }
export type GuestMsg = { t: 'join'; name: string } | { t: 'act'; action: Action }

export function newCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join('')
}

export class HostNet {
  private peer: Peer
  private guests: { conn: DataConnection; seat: number }[] = []
  onLobby: () => void = () => {}
  onAction: (seat: number, a: Action) => void = () => {}
  onError: (msg: string) => void = () => {}
  onLeave: (seat: number) => void = () => {}

  constructor(readonly code: string, readonly seats: SeatSpec[]) {
    this.peer = new Peer(PREFIX + code)
    this.peer.on('error', (e) => this.onError(String(e.type ?? e)))
    this.peer.on('connection', (conn) => {
      conn.on('data', (raw) => {
        const m = raw as GuestMsg
        if (m.t === 'join') {
          if (this.seats.length >= 4) { conn.send({ t: 'error', text: 'The table is full' } satisfies HostMsg); return }
          // Names arrive from other browsers: trim and cap them.
          const name = String(m.name ?? '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Guest'
          this.seats.push({ name, isAI: false })
          this.guests.push({ conn, seat: this.seats.length - 1 })
          this.broadcastLobby()
          this.onLobby()
        } else if (m.t === 'act') {
          const g = this.guests.find((x) => x.conn === conn)
          if (g) this.onAction(g.seat, m.action)
        }
      })
      conn.on('close', () => {
        const g = this.guests.find((x) => x.conn === conn)
        this.guests = this.guests.filter((x) => x.conn !== conn)
        if (g) this.onLeave(g.seat)
      })
    })
  }

  ready(): Promise<void> {
    return new Promise((res, rej) => {
      if (this.peer.open) return res()
      this.peer.once('open', () => res())
      this.peer.once('error', (e) => rej(e))
    })
  }

  broadcastLobby(): void {
    for (const g of this.guests) g.conn.send({ t: 'lobby', seats: this.seats, you: g.seat } satisfies HostMsg)
  }

  broadcastState(s: GameState): void {
    for (const g of this.guests) g.conn.send({ t: 'state', state: s, you: `p${g.seat}` } satisfies HostMsg)
  }

  close(): void { this.peer.destroy() }
}

export class GuestNet {
  private peer = new Peer()
  private conn: DataConnection | null = null
  onMsg: (m: HostMsg) => void = () => {}
  onError: (msg: string) => void = () => {}

  join(code: string, name: string): Promise<void> {
    return new Promise((res, rej) => {
      this.peer.on('error', (e) => { this.onError(String(e.type ?? e)); rej(e) })
      const go = () => {
        const conn = this.peer.connect(PREFIX + code.toUpperCase(), { reliable: true })
        this.conn = conn
        conn.on('open', () => { conn.send({ t: 'join', name } satisfies GuestMsg); res() })
        conn.on('data', (d) => this.onMsg(d as HostMsg))
        conn.on('close', () => this.onError('The host left the table'))
      }
      if (this.peer.open) go()
      else this.peer.once('open', go)
    })
  }

  act(a: Action): void { this.conn?.send({ t: 'act', action: a } satisfies GuestMsg) }
  close(): void { this.peer.destroy() }
}
