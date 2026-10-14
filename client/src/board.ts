import { Application, Container, Graphics, Text } from 'pixi.js'
import { LINKS, LOCATION_BY_ID, WORLD, type GameState, type PlacedTile } from '@bronze/shared'

const PLAYER_TINTS = [0xb23a48, 0x2a7f8f, 0x9a9a45, 0x6b4f8f]

function playerColor(state: GameState, pid: string): number {
  const idx = state.players.findIndex((p) => p.id === pid)
  return PLAYER_TINTS[idx >= 0 ? idx : 0] ?? 0x888888
}

function dim(color: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * 0.35)
  const g = Math.floor(((color >> 8) & 0xff) * 0.35)
  const b = Math.floor((color & 0xff) * 0.35)
  return (r << 16) | (g << 8) | b
}

export interface BoardHandle {
  render(state: GameState): void
}

export async function createBoard(host: HTMLElement): Promise<BoardHandle> {
  const app = new Application()
  await app.init({ background: '#141a1c', antialias: true, resizeTo: host })
  host.appendChild(app.canvas)

  const world = new Container()
  app.stage.addChild(world)

  function layout(): void {
    const s = Math.min(app.screen.width / WORLD.w, app.screen.height / WORLD.h)
    world.scale.set(s)
    world.position.set(
      (app.screen.width - WORLD.w * s) / 2,
      (app.screen.height - WORLD.h * s) / 2,
    )
  }
  app.renderer.on('resize', layout)

  function drawLinks(state: GameState): void {
    for (const lk of LINKS) {
      const a = LOCATION_BY_ID.get(lk.a)!
      const b = LOCATION_BY_ID.get(lk.b)!
      const g = new Graphics()
      const owner = state.links[lk.id]
      if (owner) {
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 7, color: playerColor(state, owner), alpha: 0.95 })
      } else {
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 3, color: 0x4a4032, alpha: 0.5 })
      }
      world.addChild(g)
    }
  }

  function drawTile(t: PlacedTile, state: GameState, x: number, y: number): void {
    const color = playerColor(state, t.ownerId)
    const g = new Graphics()
    g.roundRect(x, y, 26, 26, 4)
    g.fill({ color: t.flipped ? dim(color) : color })
    g.stroke({ width: 1.5, color: 0x000000, alpha: 0.6 })
    world.addChild(g)

    const label = new Text({
      text: `${t.industry[0].toUpperCase()}${t.level}`,
      style: { fontSize: 12, fill: t.flipped ? 0xcccccc : 0xffffff, fontFamily: 'Georgia, serif' },
    })
    label.position.set(x + 5, y + 4)
    world.addChild(label)

    if (t.resources > 0) {
      const dotColor =
        t.industry === 'brewery' ? 0xd8a038 : t.industry === 'coal' ? 0x111111 : 0xdddddd
      for (let i = 0; i < t.resources; i++) {
        const d = new Graphics()
        d.circle(x + 7 + i * 7, y + 21, 2.4).fill({ color: dotColor }).stroke({ width: 0.5, color: 0x000000 })
        world.addChild(d)
      }
    }
  }

  function drawLocations(state: GameState): void {
    for (const loc of LOCATION_BY_ID.values()) {
      const slots = state.locations[loc.id] ?? []
      const n = loc.slots.length
      const g = new Graphics()
      g.circle(loc.x, loc.y, loc.merchant ? 30 : 25)
      g.fill({ color: loc.merchant ? 0x33290f : 0x2b2620 })
      g.stroke({ width: loc.merchant ? 3 : 2, color: loc.merchant ? 0xc9a227 : 0x777066 })
      world.addChild(g)

      const name = new Text({
        text: loc.name,
        style: { fontSize: 11, fill: loc.merchant ? 0xc9a227 : 0xd8d2c4, fontFamily: 'Georgia, serif' },
      })
      name.anchor.set(0.5, 1)
      name.position.set(loc.x, loc.y - 30)
      world.addChild(name)

      const startX = loc.x - ((n - 1) * 29) / 2 - 13
      slots.forEach((t, i) => {
        if (t) drawTile(t, state, startX + i * 29, loc.y + 32)
      })
    }
  }

  return {
    render(state: GameState): void {
      world.removeChildren()
      app.renderer.background.color = state.era === 'canal' ? 0x141a1c : 0x1d150e
      drawLinks(state)
      drawLocations(state)
      layout()
    },
  }
}
