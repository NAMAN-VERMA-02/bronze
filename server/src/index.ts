import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import {
  GameError,
  applyAction,
  createGame,
  redactFor,
  type GameAction,
  type GameState,
} from '@bronze/shared'
import { loadRooms, removeRoom, saveRoom } from './store.js'

const PORT = Number(process.env.PORT ?? 3001)

const app = express()
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }))
const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })

interface Seat {
  name: string
}

interface SocketInfo {
  seat: Seat | null
  room: Room
}

interface Room {
  code: string
  seats: Seat[]
  sockets: Map<string, SocketInfo>
  started: boolean
  state: GameState | null
  playerIds: Map<Seat, string>
}

const rooms = new Map<string, Room>()
const infoOfSocket = new Map<string, SocketInfo>()

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function persistRoom(room: Room): void {
  if (!room.started) return
  saveRoom({
    code: room.code,
    started: room.started,
    seatNames: room.seats.map((s) => s.name),
    state: room.state,
  })
}

for (const sr of loadRooms()) {
  const room: Room = {
    code: sr.code,
    seats: sr.seatNames.map((name) => ({ name })),
    sockets: new Map(),
    started: true,
    state: sr.state,
    playerIds: new Map(),
  }
  assignPlayerIds(room)
  rooms.set(room.code, room)
}

function makeCode(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = ''
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    if (!rooms.has(code)) return code
  }
  throw new Error('could not allocate room code')
}

function assignPlayerIds(room: Room): void {
  room.playerIds = new Map(room.seats.map((seat, i) => [seat, `p${i}`]))
}

function playerIdOf(room: Room, info: SocketInfo): string | null {
  return info.seat ? (room.playerIds.get(info.seat) ?? null) : null
}

function lobbyView(room: Room) {
  return {
    code: room.code,
    started: room.started,
    seats: room.seats.map((s, i) => ({ playerId: `p${i}`, name: s.name })),
  }
}

function viewFor(room: Room, playerId: string | null): (GameState & { youId: string }) | null {
  if (!room.state) return null
  if (!playerId) {
    return {
      ...room.state,
      players: room.state.players.map((p) => ({ ...p, hand: [] })),
      youId: '',
    }
  }
  return redactFor(room.state, playerId)
}

function sendLobby(room: Room): void {
  io.to(room.code).emit('lobby', lobbyView(room))
}

function sendGameTo(socketId: string, room: Room): void {
  const info = room.sockets.get(socketId)
  if (info && room.state) io.to(socketId).emit('game', viewFor(room, playerIdOf(room, info)))
}

function sendGameAll(room: Room): void {
  for (const sid of room.sockets.keys()) sendGameTo(sid, room)
}

function cleanName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return s.slice(0, 24) || 'Industrialist'
}

io.on('connection', (socket) => {
  socket.on('lobby:create', (msg: { name?: string }, ack?: (v: unknown) => void) => {
    leaveRoom(socket.id)
    const room: Room = {
      code: makeCode(),
      seats: [],
      sockets: new Map(),
      started: false,
      state: null,
      playerIds: new Map(),
    }
    rooms.set(room.code, room)
    joinRoom(socket, room, cleanName(msg?.name))
    ack?.({ ok: true, code: room.code })
  })

  socket.on('lobby:join', (msg: { code?: string; name?: string }, ack?: (v: unknown) => void) => {
    const code = String(msg?.code ?? '').trim().toUpperCase()
    const room = rooms.get(code)
    if (!room) {
      ack?.({ ok: false, error: 'Room not found' })
      return
    }
    leaveRoom(socket.id)
    const seated = joinRoom(socket, room, cleanName(msg?.name))
    ack?.({ ok: true, code: room.code, seated })
  })

  socket.on('lobby:start', (_msg: unknown, ack?: (v: unknown) => void) => {
    const info = infoOfSocket.get(socket.id)
    if (!info || !info.room.sockets.has(socket.id)) {
      ack?.({ ok: false, error: 'You are not in a room' })
      return
    }
    const room = info.room
    if (room.started || room.state) {
      ack?.({ ok: false, error: 'Already started' })
      return
    }
    if (room.seats.length < 2 || info.seat === null) {
      ack?.({ ok: false, error: 'Need at least 2 seated players' })
      return
    }
    room.started = true
    assignPlayerIds(room)
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) | 0
    room.state = createGame(
      room.seats.map((s) => s.name),
      seed,
    )
    io.to(room.code).emit('started', {})
    sendGameAll(room)
    persistRoom(room)
    ack?.({ ok: true })
  })

  socket.on('game:action', (raw: { action?: GameAction }) => {
    const info = infoOfSocket.get(socket.id)
    if (!info) return
    const room = info.room
    if (!room.started || !room.state) return
    const pid = playerIdOf(room, info)
    if (!pid) return
    try {
      room.state = applyAction(room.state, pid, raw.action as GameAction)
      sendGameAll(room)
      persistRoom(room)
    } catch (e) {
      const message = e instanceof GameError ? e.message : 'Invalid action'
      socket.emit('action:error', { message })
    }
  })

  socket.on('disconnect', () => {
    leaveRoom(socket.id)
  })
})

function joinRoom(
  socket: { join: (code: string) => void; id: string },
  room: Room,
  name: string,
): boolean {
  socket.join(room.code)
  let seat: Seat | null = null
  if (!room.started && room.seats.length < 4) {
    seat = { name }
    room.seats.push(seat)
    assignPlayerIds(room)
  } else if (room.started) {
    const existing = room.seats.find((s) => s.name === name)
    if (existing) {
      for (const [sid, inf] of room.sockets) {
        if (inf.seat === existing && sid !== socket.id) inf.seat = null
      }
      seat = existing
    }
  }
  const info: SocketInfo = { seat, room }
  room.sockets.set(socket.id, info)
  infoOfSocket.set(socket.id, info)
  sendLobby(room)
  if (room.state) sendGameTo(socket.id, room)
  return seat !== null
}

function leaveRoom(socketId: string): void {
  const info = infoOfSocket.get(socketId)
  if (!info) return
  infoOfSocket.delete(socketId)
  const room = info.room
  room.sockets.delete(socketId)
  if (info.seat && !room.started) {
    const idx = room.seats.indexOf(info.seat)
    if (idx !== -1) room.seats.splice(idx, 1)
    assignPlayerIds(room)
  }
  if (room.sockets.size === 0 && !room.started) {
    rooms.delete(room.code)
    removeRoom(room.code)
  } else sendLobby(room)
}

httpServer.listen(PORT, () => {
  console.log(`bronze server listening on http://localhost:${PORT}`)
})
