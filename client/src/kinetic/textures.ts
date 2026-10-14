import * as THREE from 'three'
import { CITIES, LINKS, CITY_BY_ID, type Era } from './state'

// Procedural Victorian cartography, drawn to canvas — no image assets.

const W = 2048
const H = 1920
const PAD = 72

// World-space extents of the playable map (matches CITIES spread).
export const MAP_WORLD = { minX: -12, maxX: 12, minZ: -11.5, maxZ: 11.5 }

function w2c(x: number): number {
  return ((x - MAP_WORLD.minX) / (MAP_WORLD.maxX - MAP_WORLD.minX)) * (W - PAD * 2) + PAD
}
function h2c(z: number): number {
  return ((z - MAP_WORLD.minZ) / (MAP_WORLD.maxZ - MAP_WORLD.minZ)) * (H - PAD * 2) + PAD
}

function grain(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const a = Math.random() * 0.055
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,240,210,${a * 0.7})`
    ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random())
  }
  ctx.strokeStyle = 'rgba(60,42,24,0.05)'
  for (let i = 0; i < 46; i++) {
    ctx.beginPath()
    const x = Math.random() * W
    const y = Math.random() * H
    ctx.moveTo(x, y)
    ctx.lineTo(x + (Math.random() - 0.5) * 220, y + (Math.random() - 0.5) * 40)
    ctx.lineWidth = 0.7
    ctx.stroke()
  }
}

function contours(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.strokeStyle = 'rgba(90,66,38,0.22)'
  ctx.lineWidth = 2
  const centers = [
    { x: W * 0.32, y: H * 0.3 },
    { x: W * 0.68, y: H * 0.62 },
  ]
  for (const c of centers) {
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath()
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.12) {
        const wob = 1 + 0.16 * Math.sin(a * 3 + i) + 0.09 * Math.cos(a * 5 - i * 2)
        const rx = i * 130 * wob
        const ry = i * 88 * wob
        const px = c.x + Math.cos(a) * rx
        const py = c.y + Math.sin(a) * ry
        if (a === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
  }
  ctx.restore()
}

function compass(ctx: CanvasRenderingContext2D): void {
  const cx = W - 250
  const cy = 260
  ctx.save()
  ctx.strokeStyle = 'rgba(138,100,44,0.85)'
  ctx.fillStyle = 'rgba(138,100,44,0.85)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, 92, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, 70, 0, Math.PI * 2)
  ctx.lineWidth = 1.4
  ctx.stroke()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const r1 = i % 2 === 0 ? 34 : 58
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
    ctx.lineTo(cx + Math.cos(a) * 86, cy + Math.sin(a) * 86)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(cx, cy - 84)
  ctx.lineTo(cx + 13, cy)
  ctx.lineTo(cx, cy + 30)
  ctx.lineTo(cx - 13, cy)
  ctx.closePath()
  ctx.fill()
  ctx.font = '54px Georgia'
  ctx.textAlign = 'center'
  ctx.fillText('N', cx, cy - 112)
  ctx.restore()
}

function cartouche(ctx: CanvasRenderingContext2D, era: Era): void {
  // Decorative, deliberately secondary — never competes with gameplay text.
  const x = 96
  const y = H - 300
  const w = 620
  const h = 196
  ctx.save()
  ctx.globalAlpha = 0.8
  ctx.strokeStyle = '#7a5c2e'
  ctx.lineWidth = 3.4
  ctx.strokeRect(x, y, w, h)
  ctx.lineWidth = 1.4
  ctx.strokeRect(x + 11, y + 11, w - 22, h - 22)
  ctx.fillStyle = 'rgba(18,12,7,0.3)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = 'rgba(216,192,138,0.82)'
  ctx.textAlign = 'center'
  ctx.font = '52px Georgia'
  ctx.fillText('THE  MIDLANDS', x + w / 2, y + 88)
  ctx.fillStyle = 'rgba(168,137,90,0.85)'
  ctx.font = '23px Georgia'
  ctx.fillText(
    era === 'canal' ? 'INDUSTRIAL SURVEY · CANAL ERA' : 'INDUSTRIAL SURVEY · RAILWAY ERA',
    x + w / 2,
    y + 134,
  )
  ctx.strokeStyle = '#7a5c2e'
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.moveTo(x + 110, y + 158)
  ctx.lineTo(x + w - 110, y + 158)
  ctx.stroke()
  ctx.restore()
}

function hiddenCartography(ctx: CanvasRenderingContext2D): void {
  // Old-world details sleeping under the darkness — the reveal system
  // earns them their visibility.
  const road = (a: string, b: string): void => {
    const A = CITY_BY_ID.get(a)!
    const B = CITY_BY_ID.get(b)!
    const mx = w2c((A.x + B.x) / 2) + 30
    const my = h2c((A.z + B.z) / 2) - 40
    ctx.strokeStyle = 'rgba(96,74,46,0.55)'
    ctx.lineWidth = 4.6
    ctx.setLineDash([20, 15])
    ctx.beginPath()
    ctx.moveTo(w2c(A.x), h2c(A.z))
    ctx.quadraticCurveTo(mx, my, w2c(B.x), h2c(B.z))
    ctx.stroke()
    ctx.setLineDash([])
  }
  road('shrewsbury', 'oxford')
  road('stafford', 'derby')
  road('worcester', 'coventry')

  // Region boundary loops.
  ctx.save()
  ctx.strokeStyle = 'rgba(126,100,62,0.34)'
  ctx.lineWidth = 2
  ctx.setLineDash([5, 11])
  for (const c of [
    { x: W * 0.3, y: H * 0.28 },
    { x: W * 0.66, y: H * 0.68 },
  ]) {
    ctx.beginPath()
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.16) {
      const wob = 1 + 0.2 * Math.sin(a * 2 + c.x) + 0.12 * Math.cos(a * 4)
      const px = c.x + Math.cos(a) * 300 * wob
      const py = c.y + Math.sin(a) * 210 * wob
      if (a === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
  ctx.restore()

  // Hill marks — little resting giants.
  ctx.strokeStyle = 'rgba(104,82,50,0.55)'
  ctx.lineWidth = 3
  for (const [hx, hy] of [
    [-1.4, -8.3],
    [-1.0, -7.7],
    [-9.2, 3.1],
    [-8.7, 3.7],
    [8.1, 9.4],
  ] as const) {
    const px = w2c(hx)
    const py = h2c(hy)
    ctx.beginPath()
    ctx.arc(px - 9, py + 4, 9, Math.PI, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(px + 9, py + 4, 9, Math.PI, 0)
    ctx.stroke()
  }

  // Surveyor crosses.
  ctx.strokeStyle = 'rgba(156,124,76,0.42)'
  ctx.lineWidth = 2.4
  for (const [sx, sy] of [
    [-7, -6],
    [3, -6.8],
    [-6, 6.8],
    [5.5, 4.2],
    [7.5, -1.5],
    [-2, -3.6],
    [4.5, 6.5],
    [-9.5, 5.2],
  ] as const) {
    const px = w2c(sx)
    const py = h2c(sy)
    ctx.beginPath()
    ctx.moveTo(px - 9, py)
    ctx.lineTo(px + 9, py)
    ctx.moveTo(px, py - 9)
    ctx.lineTo(px, py + 9)
    ctx.stroke()
  }
}

function waterways(ctx: CanvasRenderingContext2D): void {
  // River Trent-ish sweep across the map.
  const pts: [number, number][] = [
    [-10, -3.4],
    [-6.5, -2.2],
    [-3, -0.6],
    [0.6, 0.1],
    [4, 1.6],
    [7.5, 1.1],
    [10.4, 2.4],
  ]
  const draw = (width: number, color: string): void => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    pts.forEach(([wx, wz], i) => {
      const px = w2c(wx)
      const py = h2c(wz)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }
  draw(30, 'rgba(22,32,42,0.9)')
  draw(9, 'rgba(44,61,74,0.55)')
}

function linkPath(l: { a: string; b: string }): [number, number][] {
  const A = CITY_BY_ID.get(l.a)!
  const B = CITY_BY_ID.get(l.b)!
  return [
    [w2c(A.x), h2c(A.z)],
    [w2c((A.x + B.x) / 2), h2c((A.z + B.z) / 2) - 26],
    [w2c(B.x), h2c(B.z)],
  ]
}

function strokePath(ctx: CanvasRenderingContext2D, pts: [number, number][], width: number, color: string, dash?: number[]): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.setLineDash(dash ?? [])
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1])
  ctx.stroke()
  ctx.setLineDash([])
}

function routes(ctx: CanvasRenderingContext2D, era: Era): void {
  for (const l of LINKS) {
    const p = linkPath(l)
    if (l.era === 'canal') {
      strokePath(ctx, p, 11.5, 'rgba(24,36,48,0.97)')
      strokePath(ctx, p, 4.2, 'rgba(52,76,96,0.95)')
      strokePath(ctx, p, 1.4, 'rgba(150,114,54,0.55)')
    } else if (era === 'rail') {
      strokePath(ctx, p, 13, 'rgba(46,34,20,0.98)')
      strokePath(ctx, p, 3, 'rgba(132,137,146,0.98)')
      ctx.save()
      ctx.lineWidth = 1.8
      strokePath(ctx, p, 11, 'rgba(66,48,28,0.65)', [3, 12])
      ctx.restore()
    } else {
      // Surveyed future railway: dotted intention line.
      strokePath(ctx, p, 3.6, 'rgba(88,66,42,0.62)', [14, 12])
    }
  }
}

function cityMarks(ctx: CanvasRenderingContext2D): void {
  for (const c of CITIES) {
    const x = w2c(c.x)
    const y = h2c(c.z)
    ctx.save()
    if (c.slots > 0) {
      ctx.strokeStyle = 'rgba(138,100,44,0.9)'
      ctx.lineWidth = c.merchant ? 3 : 2.2
      ctx.beginPath()
      ctx.arc(x, y, c.merchant ? 24 : 19, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(20,14,8,0.45)'
      ctx.fill()
    } else {
      // Merchant beacon towns: diamond mark.
      ctx.strokeStyle = 'rgba(138,100,44,0.95)'
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(x, y - 16)
      ctx.lineTo(x + 14, y)
      ctx.lineTo(x, y + 16)
      ctx.lineTo(x - 14, y)
      ctx.closePath()
      ctx.stroke()
      ctx.fillStyle = 'rgba(20,14,8,0.5)'
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(x, y, 3.6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(181,138,58,0.95)'
    ctx.fill()
    ctx.fillStyle = 'rgba(228,204,138,0.92)'
    ctx.font = '25px Georgia'
    ctx.textAlign = 'center'
    ctx.fillText(c.name.toUpperCase().split('').join('\u200a'), x, y - (c.merchant ? 30 : 26))
    ctx.restore()
  }
}

export function makeMapTexture(era: Era): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#54422b')
  grad.addColorStop(0.45, '#614d33')
  grad.addColorStop(0.75, '#51402a')
  grad.addColorStop(1, '#443523')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  contours(ctx)
  hiddenCartography(ctx)
  waterways(ctx)
  routes(ctx, era)
  cityMarks(ctx)
  compass(ctx)
  cartouche(ctx, era)
  grain(ctx)

  // Edge wear vignette.
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.28)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 26
  ctx.strokeRect(0, 0, W, H)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export interface LabelOpts {
  scale?: number
  muted?: boolean
}

export function makeLabelSprite(text: string, opts: LabelOpts = {}): THREE.Sprite {
  const scale = opts.scale ?? 0.9
  const cw = 512
  const ch = 128
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.font = '54px Georgia'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.9)'
  ctx.shadowBlur = 12
  ctx.fillStyle = opts.muted ? '#c9b78d' : '#efe3c0'
  ctx.fillText(text, cw / 2, ch / 2 - 8)
  ctx.shadowBlur = 0
  ctx.strokeStyle = opts.muted ? 'rgba(150,124,80,0.7)' : 'rgba(197,157,84,0.9)'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  const tw = ctx.measureText(text).width
  ctx.moveTo(cw / 2 - tw / 2 - 14, ch / 2 + 30)
  ctx.lineTo(cw / 2 + tw / 2 + 14, ch / 2 + 30)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(2.35 * scale, 0.59 * scale, 1)
  return sprite
}

export interface CardArt {
  canvas: HTMLCanvasElement
}

// Original engraved chronicle for the workshop wall — rural Midlands →
// mills → canals → industrialization → railways. Drawn, never copied.
// Easter eggs: founder's mark KB·1770, tiny pawn glyphs, an anvil.
export function makeMuralTexture(): THREE.CanvasTexture {
  const w = 1024
  const h = 384
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!

  g.fillStyle = '#0d0a07'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = '#3a2b18'
  g.lineWidth = 2
  g.strokeRect(10, 10, w - 20, h - 20)

  const ink = 'rgba(150,116,64,0.85)'
  const faint = 'rgba(120,92,50,0.5)'
  g.lineWidth = 2.4

  // — Chapter I: rolling hills and a hamlet (left) —
  g.strokeStyle = ink
  for (let i = 0; i < 3; i++) {
    g.beginPath()
    for (let x = 30; x <= 220; x += 6) {
      const y = 300 - i * 26 - Math.sin(x * 0.02 + i) * 22 - Math.cos(x * 0.05) * 8
      if (x === 30) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  // tiny hamlet roofs
  for (const [hx, hy] of [[70, 258], [96, 264], [128, 256]] as const) {
    g.beginPath()
    g.moveTo(hx - 9, hy + 8)
    g.lineTo(hx, hy - 6)
    g.lineTo(hx + 9, hy + 8)
    g.closePath()
    g.stroke()
  }

  // — Chapter II: water mill + weir —
  g.beginPath()
  g.moveTo(240, 310)
  g.bezierCurveTo(280, 290, 320, 292, 360, 306)
  g.stroke()
  g.strokeRect(268, 246, 46, 52)
  g.beginPath()
  g.arc(291, 298, 20, Math.PI * 0.1, Math.PI * 0.95)
  g.stroke()
  for (let s = 0; s < 6; s++) {
    const a = Math.PI * 0.15 + s * 0.42
    g.beginPath()
    g.moveTo(291 + Math.cos(a) * 6, 298 + Math.sin(a) * 6)
    g.lineTo(291 + Math.cos(a) * 19, 298 + Math.sin(a) * 19)
    g.stroke()
  }

  // — Chapter III: canal with boat & bridge —
  g.strokeStyle = ink
  g.beginPath()
  g.moveTo(380, 316)
  g.quadraticCurveTo(430, 300, 470, 314)
  g.quadraticCurveTo(510, 328, 550, 312)
  g.stroke()
  // narrowboat silhouette
  g.beginPath()
  g.moveTo(452, 306)
  g.lineTo(500, 306)
  g.lineTo(494, 316)
  g.lineTo(458, 316)
  g.closePath()
  g.stroke()
  // humpback bridge
  g.beginPath()
  g.moveTo(520, 314)
  g.quadraticCurveTo(535, 288, 552, 313)
  g.stroke()

  // — Chapter IV: mills with chimneys (industrialization) —
  const mill = (mx: number, my: number, sc: number): void => {
    g.strokeRect(mx, my, 60 * sc, 44 * sc)
    for (let wx = 0; wx < 4; wx++) {
      g.strokeRect(mx + 7 * sc + wx * 13 * sc, my + 12 * sc, 7 * sc, 9 * sc)
    }
    g.beginPath()
    g.moveTo(mx + 66 * sc, my)
    g.lineTo(mx + 74 * sc, my - 40 * sc)
    g.lineTo(mx + 82 * sc, my)
    g.closePath()
    g.stroke()
    // smoke curls
    g.beginPath()
    g.arc(mx + 78 * sc, my - 52 * sc, 7 * sc, 0, Math.PI * 2)
    g.stroke()
  }
  mill(580, 236, 1)
  mill(672, 222, 1.25)

  // — Chapter V: railway viaduct + locomotive —
  g.beginPath()
  g.moveTo(560, 330)
  g.lineTo(1000, 330)
  g.stroke()
  for (let px = 585; px < 995; px += 42) {
    g.beginPath()
    g.moveTo(px, 330)
    g.lineTo(px + 14, 366)
    g.moveTo(px + 28, 330)
    g.lineTo(px + 14, 366)
    g.stroke()
  }
  g.strokeRect(700, 296, 84, 30)
  g.beginPath()
  g.arc(718, 330, 11, 0, Math.PI * 2)
  g.arc(756, 330, 11, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.moveTo(792, 300)
  g.lineTo(806, 268)
  g.stroke()
  g.beginPath()
  g.arc(802, 258, 8, 0, Math.PI * 2)
  g.stroke()

  // — Chapter VI: dense industrial city skyline (right) —
  let sx = 850
  while (sx < 1000) {
    const bw = 18 + ((sx * 7) % 22)
    const bh = 30 + ((sx * 13) % 60)
    g.strokeRect(sx, 330 - bh, bw, bh)
    sx += bw + 6
  }

  // Hidden layer: founder's mark, pawn trio, anvil (easter eggs)
  g.font = '13px Georgia'
  g.fillStyle = 'rgba(150,116,64,0.55)'
  g.fillText('KB · MDCCCLXX', w - 148, h - 22)
  g.strokeStyle = 'rgba(150,116,64,0.4)'
  for (const [px, py] of [[344, 250], [356, 252], [368, 249]] as const) {
    g.beginPath()
    g.arc(px, py, 4, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(px - 4, py + 9)
    g.lineTo(px + 4, py + 9)
    g.stroke()
  }
  // tiny anvil near the forge chapter
  g.beginPath()
  g.moveTo(392, 268)
  g.lineTo(404, 268)
  g.lineTo(400, 274)
  g.lineTo(396, 274)
  g.closePath()
  g.stroke()
  g.fillRect(396, 274, 4, 6)

  // Engraved frame flourishes
  g.strokeStyle = faint
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(18, 26)
  g.lineTo(w - 18, 26)
  g.moveTo(18, h - 26)
  g.lineTo(w - 18, h - 26)
  g.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function makeCardFace(title: string, subtitle: string, tint: string): HTMLCanvasElement {
  const cw = 512
  const ch = 720
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!

  const grad = ctx.createLinearGradient(0, 0, 0, ch)
  grad.addColorStop(0, '#dccfa9')
  grad.addColorStop(0.5, '#cdbf98')
  grad.addColorStop(1, '#bfb087')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, cw, ch)

  // stains
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(90,64,34,${Math.random() * 0.05})`
    ctx.beginPath()
    ctx.arc(Math.random() * cw, Math.random() * ch, 20 + Math.random() * 70, 0, Math.PI * 2)
    ctx.fill()
  }

  // ornamental borders
  ctx.strokeStyle = '#6b4f2a'
  ctx.lineWidth = 7
  ctx.strokeRect(20, 20, cw - 40, ch - 40)
  ctx.lineWidth = 2
  ctx.strokeRect(36, 36, cw - 72, ch - 72)
  ctx.fillStyle = '#6b4f2a'
  ;[
    [28, 28],
    [cw - 28, 28],
    [28, ch - 28],
    [cw - 28, ch - 28],
  ].forEach(([x, y]) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(Math.PI / 4)
    ctx.fillRect(-9, -9, 18, 18)
    ctx.restore()
  })

  // engraved emblem: gear ring + chimney silhouette in tint
  const cx = cw / 2
  const cy = 300
  ctx.save()
  ctx.strokeStyle = tint
  ctx.fillStyle = tint
  ctx.globalAlpha = 0.85
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(cx, cy, 108, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.arc(cx, cy, 88, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    ctx.save()
    ctx.translate(cx + Math.cos(a) * 98, cy + Math.sin(a) * 98)
    ctx.rotate(a)
    ctx.fillRect(-7, -7, 14, 14)
    ctx.restore()
  }
  // tiny industrial skyline inside the gear
  ctx.fillRect(cx - 62, cy + 34, 30, 40)
  ctx.fillRect(cx - 24, cy + 14, 34, 60)
  ctx.fillRect(cx + 20, cy + 44, 26, 30)
  ctx.fillRect(cx - 14, cy - 26, 8, 44) // chimney
  ctx.beginPath()
  ctx.arc(cx + 2, cy - 34, 10, Math.PI, 0)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = '#2e2418'
  ctx.textAlign = 'center'
  ctx.font = 'bold 46px Georgia'
  ctx.fillText(title, cx, 520)
  ctx.font = '24px Georgia'
  ctx.fillStyle = '#5a4630'
  ctx.fillText(subtitle, cx, 560)

  ctx.fillStyle = '#6b4f2a'
  ctx.font = '22px Georgia'
  ctx.fillText('B  R  A  S  S', cx, 660)

  return canvas
}
