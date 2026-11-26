// The 3D war table: a sculpted valley with a living river, forests, towns,
// harbours, player keeps with commanders on thrones, and workers who carry
// out every order. The scene only draws state; it never decides rules.

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import gsap from 'gsap'
import {
  LINKS, LINK_BY_ID, TOWNS, TOWN_BY_ID, network,
  type Building, type Fx, type GameState, type Good,
} from '@bronze/shared/valley'

export const GOOD_COLOR: Record<Good, number> = {
  coal: 0x26262b, copper: 0xc0703c, tin: 0xb9c4cf, bronze: 0xd29a3e, machine: 0x9fb4c4,
}

const BOARD_W = 28
const BOARD_D = 25
const WATER_Y = -0.1

// ------------------------------------------------------------ terrain math

function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z)
  const xf = x - xi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm(x: number, z: number): number {
  let f = 0, amp = 0.5, fr = 1
  for (let i = 0; i < 5; i++) { f += amp * vnoise(x * fr, z * fr); amp *= 0.5; fr *= 2.03 }
  return f
}
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

const RIVERS = LINKS.filter((l) => l.kind === 'river').map((l) => {
  const a = TOWN_BY_ID.get(l.a)!, b = TOWN_BY_ID.get(l.b)!
  return [a.x, a.z, b.x, b.z]
})

/** Ground height at (x, z). Towns sit on flat ground; rivers cut channels. */
export function heightAt(x: number, z: number): number {
  let h = 0.08 + (fbm(x * 0.16 + 3, z * 0.16 - 7) - 0.45) * 1.1
  // Mountains rise in the wild corners, away from the river.
  h += Math.max(0, fbm(x * 0.09 - 11, z * 0.09 + 5) - 0.5) * 5.2
  let river = 99
  for (const r of RIVERS) river = Math.min(river, segDist(x, z, r[0], r[1], r[2], r[3]))
  h = h * smooth(0.4, 2.6, river) + 0.06 * (1 - smooth(0.4, 2.6, river))
  h -= 0.34 * (1 - smooth(0.18, 0.62, river))
  for (const t of TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z)
    if (t.port) h -= 0.55 * (1 - smooth(0.6, 2.3, d))
    else h = h * smooth(0.9, 1.8, d) + 0.1 * (1 - smooth(0.9, 1.8, d))
  }
  // Fade to a rim at the board edge.
  const edge = Math.min(BOARD_W / 2 - Math.abs(x), BOARD_D / 2 - Math.abs(z))
  return h * smooth(0, 1.2, edge)
}

// --------------------------------------------------------------- lanterns
// The valley lies in darkness; it is lit only around towns, works and
// routes, like candles on a war table. Every board material shares these.

const MAX_LAMPS = 64
const LAMPS = {
  uLamps: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4()) },
  uLampCount: { value: 0 },
  uDark: { value: 0.3 },
  uTime: { value: 0 },
}

function lanternize(m: THREE.Material): void {
  const sm = m as THREE.MeshStandardMaterial
  if (!sm.isMeshStandardMaterial || sm.userData.lantern) return
  if (sm.emissiveIntensity > 1.2) return // flames and windows stay bright
  sm.userData.lantern = true
  sm.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LAMPS)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLampW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 lw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          lw = instanceMatrix * lw;
        #endif
        vLampW = (modelMatrix * lw).xyz;`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLampW;
        uniform vec4 uLamps[${MAX_LAMPS}];
        uniform int uLampCount;
        uniform float uDark;
        uniform float uTime;`)
      .replace('#include <opaque_fragment>', `
        float rev = 0.0;
        vec3 warm = vec3(0.0);
        for (int i = 0; i < ${MAX_LAMPS}; i++) {
          if (i >= uLampCount) break;
          vec4 l = uLamps[i];
          float f = smoothstep(l.w, l.w * 0.12, distance(vLampW.xz, l.xy)) * l.z;
          float fl = 0.93 + 0.07 * sin(uTime * 7.3 + float(i) * 2.1) + 0.03 * sin(uTime * 19.1 + float(i));
          rev += f;
          warm += f * fl * vec3(1.0, 0.66, 0.34);
        }
        rev = clamp(rev, 0.0, 1.0);
        outgoingLight = outgoingLight * mix(uDark, 1.1, rev) + diffuseColor.rgb * min(warm, vec3(1.4)) * 0.5;
        #include <opaque_fragment>`)
  }
  sm.customProgramCacheKey = () => 'lantern'
}

function lanternizeTree(o: THREE.Object3D): void {
  o.traverse((c) => {
    const mm = (c as THREE.Mesh).material
    if (!mm) return
    for (const m of Array.isArray(mm) ? mm : [mm]) lanternize(m)
  })
}

// --------------------------------------------------------------- helpers

function mat(color: number, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts })
}

type Glyph = 'mark' | 'glory'

/** The mark: a minted coin with a diamond seal. Drawn, never typed. */
function drawGlyph(ctx: CanvasRenderingContext2D, g: Glyph, x: number, y: number, r: number): void {
  ctx.save()
  ctx.lineWidth = r * 0.16
  ctx.strokeStyle = 'rgba(10,8,5,.9)'
  if (g === 'mark') {
    const grd = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
    grd.addColorStop(0, '#fff0b8')
    grd.addColorStop(0.55, '#e0ae4a')
    grd.addColorStop(1, '#8a5f1e')
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = 'rgba(90,60,20,.9)'
    ctx.lineWidth = r * 0.1
    ctx.beginPath(); ctx.arc(x, y, r * 0.68, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#7a4f14'
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.42); ctx.lineTo(x + r * 0.32, y); ctx.lineTo(x, y + r * 0.42); ctx.lineTo(x - r * 0.32, y); ctx.closePath(); ctx.fill()
  } else {
    ctx.fillStyle = '#f3d98d'
    ctx.beginPath()
    ctx.moveTo(x - r, y - r * 0.35); ctx.lineTo(x - r * 0.5, y + r * 0.05); ctx.lineTo(x, y - r * 0.8)
    ctx.lineTo(x + r * 0.5, y + r * 0.05); ctx.lineTo(x + r, y - r * 0.35); ctx.lineTo(x + r * 0.75, y + r * 0.75)
    ctx.lineTo(x - r * 0.75, y + r * 0.75); ctx.closePath(); ctx.stroke(); ctx.fill()
    ctx.fillStyle = '#b83a2e'
    ctx.beginPath(); ctx.arc(x, y + r * 0.3, r * 0.17, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

function textSprite(text: string, opts: { size?: number; color?: string; bg?: string; bold?: boolean; glyph?: Glyph } = {}): THREE.Sprite {
  const size = opts.size ?? 44
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const font = `${opts.bold ? 'bold ' : ''}${size}px "Cinzel", Georgia, serif`
  ctx.font = font
  const gw = opts.glyph ? size * 1.1 : 0
  const w = Math.ceil(ctx.measureText(text).width) + size + gw
  c.width = w
  c.height = Math.ceil(size * 1.6)
  ctx.font = font
  if (opts.bg) {
    ctx.fillStyle = opts.bg
    const r = c.height / 2
    ctx.beginPath()
    ctx.roundRect(2, 2, w - 4, c.height - 4, r)
    ctx.fill()
  }
  if (opts.glyph) drawGlyph(ctx, opts.glyph, size * 0.5 + gw * 0.45, c.height / 2, size * 0.42)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = size / 6
  ctx.strokeStyle = 'rgba(10,8,5,.85)'
  const tx = (w + gw) / 2
  ctx.strokeText(text, tx, c.height / 2)
  ctx.fillStyle = opts.color ?? '#f1e2bc'
  ctx.fillText(text, tx, c.height / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }))
  const scale = 0.011 * (size / 44)
  sp.scale.set(c.width * scale, c.height * scale, 1)
  return sp
}

export function plotPos(townId: string, slot: number): THREE.Vector3 {
  const t = TOWN_BY_ID.get(townId)!
  const n = t.plots
  const ang = (slot / Math.max(1, n)) * Math.PI * 2 + 0.6
  const r = n === 1 ? 0 : 0.62
  const x = t.x + Math.cos(ang) * r
  const z = t.z + Math.sin(ang) * r
  return new THREE.Vector3(x, heightAt(x, z), z)
}

function townPos(id: string): THREE.Vector3 {
  const t = TOWN_BY_ID.get(id)!
  return new THREE.Vector3(t.x, Math.max(WATER_Y, heightAt(t.x, t.z)), t.z)
}

function linkCurve(id: string): THREE.CatmullRomCurve3 {
  const l = LINK_BY_ID.get(id)!
  const a = townPos(l.a), b = townPos(l.b)
  const pts: THREE.Vector3[] = []
  const n = 16
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = a.x + (b.x - a.x) * t
    const z = a.z + (b.z - a.z) * t
    // Land roads hug the terrain; river lanes ride on the water.
    const y = l.kind === 'river' ? WATER_Y + 0.05 : heightAt(x, z) + 0.05
    pts.push(new THREE.Vector3(x, y, z))
  }
  return new THREE.CatmullRomCurve3(pts)
}

// ----------------------------------------------------------- the scene

export type Pick =
  | { kind: 'town'; id: string }
  | { kind: 'link'; id: string }
  | { kind: 'plot'; town: string; slot: number }
  | { kind: 'building'; town: string; slot: number }

interface LinkVis { group: THREE.Group; hit: THREE.Mesh; guide: THREE.Mesh; owned: THREE.Object3D | null; owner: string | null }
interface Keep { group: THREE.Group; commander: THREE.Group; arm: THREE.Object3D; halo: THREE.PointLight; banner: THREE.Mesh; pos: THREE.Vector3 }

export class WarTable {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private composer: EffectComposer
  private clock = new THREE.Clock()
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private hits: THREE.Object3D[] = []
  private townRings = new Map<string, THREE.Mesh>()
  private plotPads = new Map<string, THREE.Mesh>()
  private buildingVis = new Map<string, { sig: string; group: THREE.Group }>()
  private goodsVis = new Map<string, THREE.Group>()
  private linkVis = new Map<string, LinkVis>()
  private keeps = new Map<string, Keep>()
  private territory = new THREE.Group()
  private fxLayer = new THREE.Group()
  private smoke: { sp: THREE.Sprite; life: number; v: THREE.Vector3 }[] = []
  private smokeTex: THREE.Texture
  private water!: THREE.Mesh
  private torches: THREE.PointLight[] = []
  private hammers: THREE.Object3D[] = []
  private selectable: { towns: Set<string>; links: Set<string>; plots: Set<string>; buildings: Set<string> } = {
    towns: new Set(), links: new Set(), plots: new Set(), buildings: new Set(),
  }
  private hoverObj: THREE.Object3D | null = null
  private downAt = { x: 0, y: 0 }
  private seatAngle = new Map<string, number>()
  private shake = 0
  view: 'pov' | 'overview' = 'pov'
  private lastState: GameState | null = null
  private barges: THREE.Object3D[] = []
  private spinners: THREE.Object3D[] = []
  private bobbers: THREE.Object3D[] = []
  onPick: (p: Pick) => void = () => {}
  onHover: (p: Pick | null) => void = () => {}

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.setSize(host.clientWidth, host.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 400)
    this.camera.position.set(0, 60, 60)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI * 0.46
    this.controls.minDistance = 7
    this.controls.maxDistance = 48
    this.controls.target.set(0, 0, 1)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), 0.5, 0.55, 0.72))
    this.composer.addPass(new OutputPass())

    this.smokeTex = this.makeSmokeTexture()
    this.buildWorld()
    this.scene.add(this.territory, this.fxLayer)

    window.addEventListener('resize', () => this.resize(host))
    const el = this.renderer.domElement
    el.addEventListener('pointerdown', (e) => { this.downAt = { x: e.clientX, y: e.clientY } })
    el.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 6) return
      const p = this.pickAt(e)
      if (p) this.onPick(p)
    })
    el.addEventListener('pointermove', (e) => {
      const p = this.pickAt(e)
      this.onHover(p)
      el.style.cursor = p ? 'pointer' : 'grab'
    })
    this.renderer.setAnimationLoop(() => this.frame())
  }

  private resize(host: HTMLElement): void {
    const w = host.clientWidth, h = host.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
  }

  // ------------------------------------------------------------ world

  private buildWorld(): void {
    const s = this.scene
    s.background = new THREE.Color(0x060508)
    s.fog = new THREE.Fog(0x060508, 30, 78)

    // Moonlight gives shape; candles and torches give warmth.
    s.add(new THREE.HemisphereLight(0x2c3650, 0x0a0705, 0.38))
    const moon = new THREE.DirectionalLight(0x9db4e6, 0.62)
    moon.position.set(12, 24, -14)
    moon.castShadow = true
    moon.shadow.mapSize.set(2048, 2048)
    const sc = moon.shadow.camera
    sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 70
    moon.shadow.bias = -0.0005
    moon.shadow.normalBias = 0.03
    s.add(moon)
    const warmKey = new THREE.DirectionalLight(0xffc88a, 0.35)
    warmKey.position.set(-10, 14, 16)
    s.add(warmKey)
    for (const [x, z] of [[-BOARD_W / 2 - 3, BOARD_D / 2 + 1], [BOARD_W / 2 + 3, -BOARD_D / 2 - 1]]) {
      const brazier = this.makeBrazier()
      brazier.position.set(x, -0.45, z)
      s.add(brazier)
    }

    // Great hall floor and the table the valley sits on.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(90, 64), mat(0x0f0b08, { roughness: 0.95 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -2.2
    floor.receiveShadow = true
    s.add(floor)
    const table = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 3.2, 1.6, BOARD_D + 3.2), mat(0x2a190e, { roughness: 0.55 }))
    table.position.y = -1.25
    table.receiveShadow = true
    table.castShadow = true
    s.add(table)
    const trim = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 1.2, 0.5, BOARD_D + 1.2), mat(0x8a6a34, { metalness: 0.7, roughness: 0.35 }))
    trim.position.y = -0.55
    s.add(trim)

    this.buildTerrain()
    this.buildWater()
    this.buildForest()
    this.buildTowns()
    this.buildLinks()
    this.buildAtmosphere()
    // Everything on the board answers to the lanterns.
    for (const o of this.scene.children) if (o !== this.fxLayer && o.userData.offBoard !== true) lanternizeTree(o)
  }

  private makeBrazier(): THREE.Group {
    const g = new THREE.Group()
    g.userData.offBoard = true
    const iron = mat(0x1d1b1a, { metalness: 0.8, roughness: 0.4 })
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.25, 2.2, 8), iron)
    leg.position.y = 1.1
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.35, 0.45, 12, 1, true), iron)
    bowl.position.y = 2.35
    const coals = new THREE.Mesh(new THREE.CircleGeometry(0.62, 16), new THREE.MeshStandardMaterial({ color: 0xff8a30, emissive: 0xff5a10, emissiveIntensity: 3 }))
    coals.rotation.x = -Math.PI / 2
    coals.position.y = 2.5
    const light = new THREE.PointLight(0xff9a4a, 60, 34, 1.7)
    light.position.y = 3.2
    this.torches.push(light)
    g.add(leg, bowl, coals, light)
    return g
  }

  private embers!: THREE.Points
  private mist: THREE.Mesh[] = []

  private buildAtmosphere(): void {
    // Drifting embers and fireflies over the valley.
    const n = 320
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * BOARD_W
      pos[i * 3 + 1] = 0.3 + Math.random() * 3
      pos[i * 3 + 2] = (Math.random() - 0.5) * BOARD_D
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.embers = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffb060, size: 0.07, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    this.embers.userData.offBoard = true
    this.scene.add(this.embers)
    // Low mist banks that crawl across the valley.
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = 30 + Math.random() * 70
      const grd = g.createRadialGradient(x, y, 0, x, y, r)
      grd.addColorStop(0, 'rgba(170,180,200,.22)')
      grd.addColorStop(1, 'rgba(170,180,200,0)')
      g.fillStyle = grd
      g.fillRect(0, 0, 256, 256)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    for (let i = 0; i < 2; i++) {
      const map = tex.clone()
      map.repeat.set(1.5 + i, 1.5 + i)
      const m = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W * 1.3, BOARD_D * 1.3), new THREE.MeshBasicMaterial({
        map, transparent: true, opacity: 0.13, depthWrite: false, color: 0x56607a,
      }))
      m.rotation.x = -Math.PI / 2
      m.position.y = 0.45 + i * 0.5
      m.userData.offBoard = true
      this.mist.push(m)
      this.scene.add(m)
    }
  }

  /** Recompute which parts of the valley are lit. */
  private relight(s: GameState | null): void {
    const lamps = LAMPS.uLamps.value
    let n = 0
    const add = (x: number, z: number, i: number, r: number) => { if (n < MAX_LAMPS) lamps[n++].set(x, z, i, r) }
    for (const t of TOWNS) {
      const built = s ? s.plots[t.id].filter(Boolean).length : 0
      const sel = this.selectable.towns.has(t.id) || [...this.selectable.plots].some((k) => k.startsWith(t.id + ':'))
      add(t.x, t.z, Math.min(1, (t.port ? 0.6 : 0.42) + built * 0.25 + (sel ? 0.45 : 0)), 2.3 + built * 0.45 + (sel ? 0.7 : 0))
    }
    if (s) for (const l of LINKS) {
      if (!s.links[l.id] && !this.selectable.links.has(l.id)) continue
      const a = TOWN_BY_ID.get(l.a)!, b = TOWN_BY_ID.get(l.b)!
      add((a.x + b.x) / 2, (a.z + b.z) / 2, this.selectable.links.has(l.id) ? 0.55 : 0.35, Math.hypot(a.x - b.x, a.z - b.z) * 0.55)
    }
    LAMPS.uLampCount.value = n
  }

  private buildTerrain(): void {
    const seg = 220
    const geo = new THREE.PlaneGeometry(BOARD_W, BOARD_D, seg, Math.round((seg * BOARD_D) / BOARD_W))
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    const sand = new THREE.Color(0x8e7b57), grass = new THREE.Color(0x40592c), grass2 = new THREE.Color(0x5a6c34)
    const forest = new THREE.Color(0x283b20), rock = new THREE.Color(0x5e5852), snow = new THREE.Color(0xc4cad1)
    const mud = new THREE.Color(0x2e2419)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const h = heightAt(x, z)
      pos.setY(i, h)
      const n = fbm(x * 0.5, z * 0.5)
      if (h < -0.05) c.copy(mud)
      else if (h < 0.12) c.copy(sand).lerp(grass, smooth(0.0, 0.12, h))
      else if (h < 0.9) c.copy(grass).lerp(grass2, n).lerp(forest, smooth(0.45, 0.75, fbm(x * 0.3 + 9, z * 0.3)) * 0.6)
      else if (h < 1.9) c.copy(rock).lerp(grass, Math.max(0, 0.35 - (h - 0.9)))
      else c.copy(rock).lerp(snow, smooth(1.9, 2.4, h + n * 0.3))
      colors.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: false }))
    terrain.receiveShadow = true
    terrain.castShadow = true
    this.scene.add(terrain)
  }

  private buildWater(): void {
    const geo = new THREE.PlaneGeometry(BOARD_W, BOARD_D, 1, 1)
    geo.rotateX(-Math.PI / 2)
    const m = new THREE.MeshStandardMaterial({
      color: 0x15394a, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.9,
      emissive: 0x06151d, emissiveIntensity: 0.6,
    })
    this.water = new THREE.Mesh(geo, m)
    this.water.position.y = WATER_Y
    this.water.receiveShadow = true
    this.scene.add(this.water)
  }

  private buildForest(): void {
    const cone = new THREE.ConeGeometry(0.16, 0.55, 6)
    cone.translate(0, 0.3, 0)
    const pine = new THREE.InstancedMesh(cone, mat(0xffffff, { roughness: 0.9 }), 1400)
    const ball = new THREE.IcosahedronGeometry(0.2, 0)
    ball.translate(0, 0.28, 0)
    const oak = new THREE.InstancedMesh(ball, mat(0xffffff, { roughness: 0.9, flatShading: true }), 700)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3()
    const col = new THREE.Color()
    let np = 0, no = 0
    for (let i = 0; i < 9000 && (np < 1400 || no < 700); i++) {
      const x = (hash(i, 1.3) - 0.5) * (BOARD_W - 1.2)
      const z = (hash(i, 7.9) - 0.5) * (BOARD_D - 1.2)
      const h = heightAt(x, z)
      if (h < 0.14 || h > 1.6) continue
      if (fbm(x * 0.3 + 9, z * 0.3) < 0.5) continue
      if (TOWNS.some((t) => Math.hypot(t.x - x, t.z - z) < 1.6)) continue
      if (LINKS.some((l) => {
        const a = TOWN_BY_ID.get(l.a)!, b = TOWN_BY_ID.get(l.b)!
        return segDist(x, z, a.x, a.z, b.x, b.z) < 0.35
      })) continue
      const s = 0.7 + hash(i, 3.1) * 0.8
      p.set(x, h - 0.02, z)
      q.setFromEuler(new THREE.Euler(0, hash(i, 5.5) * 6, 0))
      sc.set(s, s * (0.9 + hash(i, 2.2) * 0.5), s)
      m4.compose(p, q, sc)
      if (h > 0.7 || hash(i, 4.4) > 0.45) {
        if (np >= 1400) continue
        pine.setMatrixAt(np, m4)
        pine.setColorAt(np++, col.setHSL(0.3 + hash(i, 6) * 0.06, 0.35, 0.13 + hash(i, 8) * 0.06))
      } else {
        if (no >= 700) continue
        oak.setMatrixAt(no, m4)
        oak.setColorAt(no++, col.setHSL(0.2 + hash(i, 6) * 0.08, 0.35, 0.18 + hash(i, 8) * 0.07))
      }
    }
    pine.count = np
    oak.count = no
    for (const im of [pine, oak]) { im.castShadow = true; im.receiveShadow = true; this.scene.add(im) }
  }

  private buildTowns(): void {
    const wall = new THREE.BoxGeometry(0.22, 0.18, 0.18)
    wall.translate(0, 0.09, 0)
    const roof = new THREE.ConeGeometry(0.17, 0.16, 4)
    roof.rotateY(Math.PI / 4)
    roof.translate(0, 0.26, 0)
    const walls = new THREE.InstancedMesh(wall, mat(0xd8c9a6, { roughness: 0.85 }), 260)
    const roofs = new THREE.InstancedMesh(roof, mat(0xffffff, { roughness: 0.7 }), 260)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1)
    const col = new THREE.Color()
    let n = 0
    for (const t of TOWNS) {
      const houses = t.port ? 9 : 5 + t.plots * 2
      for (let i = 0; i < houses; i++) {
        const ang = (i / houses) * Math.PI * 2 + hash(i, t.x) * 0.5
        const r = 1.0 + hash(i, t.z) * 0.35
        const x = t.x + Math.cos(ang) * r, z = t.z + Math.sin(ang) * r
        p.set(x, Math.max(WATER_Y, heightAt(x, z)), z)
        q.setFromEuler(new THREE.Euler(0, -ang, 0))
        m4.compose(p, q, one)
        walls.setMatrixAt(n, m4)
        roofs.setMatrixAt(n, m4)
        roofs.setColorAt(n++, col.setHSL(0.02 + hash(i, 2) * 0.05, 0.45, 0.28 + hash(i, 9) * 0.12))
      }
      // Town square and plot pads.
      const center = townPos(t.id)
      const square = new THREE.Mesh(new THREE.CylinderGeometry(t.port ? 0.55 : 0.82, 0.9, 0.05, 28), mat(0x5c574e, { roughness: 0.95 }))
      square.position.copy(center).setY(center.y + 0.02)
      square.receiveShadow = true
      this.scene.add(square)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.035, 8, 48), mat(0xd7b65f, { emissive: 0xd7b65f, emissiveIntensity: 0, transparent: true, opacity: 0 }))
      ring.rotation.x = Math.PI / 2
      ring.userData.offBoard = true
      ring.position.copy(center).setY(center.y + 0.1)
      this.scene.add(ring)
      this.townRings.set(t.id, ring)
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.6, 16), new THREE.MeshBasicMaterial({ visible: false }))
      hit.position.copy(center)
      hit.userData.pick = { kind: 'town', id: t.id } satisfies Pick
      this.scene.add(hit)
      this.hits.push(hit)
      for (let sl = 0; sl < t.plots; sl++) {
        const pp = plotPos(t.id, sl)
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.06, 20), mat(0x5a5246, { emissive: 0xd7b65f, emissiveIntensity: 0 }))
        pad.position.copy(pp).setY(pp.y + 0.07)
        pad.receiveShadow = true
        pad.userData.pick = { kind: 'plot', town: t.id, slot: sl } satisfies Pick
        pad.userData.offBoard = true
        this.scene.add(pad)
        this.hits.push(pad)
        this.plotPads.set(`${t.id}:${sl}`, pad)
      }
      if (t.deposit) {
        const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), mat(GOOD_COLOR[t.deposit], { metalness: t.deposit === 'coal' ? 0.1 : 0.6, roughness: 0.4, flatShading: true }))
        ore.position.set(center.x - 0.95, center.y + 0.16, center.z + 0.35)
        ore.castShadow = true
        this.scene.add(ore)
      }
      if (t.port) this.addHarbour(center)
      const label = textSprite(t.name.toUpperCase(), { size: t.port ? 40 : 34, color: t.port ? '#9fd2e8' : '#f1e2bc' })
      label.position.set(center.x, center.y + 1.05, center.z - 0.9)
      this.scene.add(label)
    }
    walls.count = n
    roofs.count = n
    // Lit windows: most homes keep a candle burning.
    const win = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 0.01), new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xffa040, emissiveIntensity: 2.6 }), n)
    let nw = 0
    const shift = new THREE.Matrix4().makeTranslation(0, 0.09, 0.091)
    for (let i = 0; i < n; i++) {
      if (hash(i, 31) < 0.25) continue
      walls.getMatrixAt(i, m4)
      win.setMatrixAt(nw++, m4.clone().multiply(shift))
    }
    win.count = nw
    win.userData.offBoard = true
    this.scene.add(win)
    for (const im of [walls, roofs]) { im.castShadow = true; im.receiveShadow = true; this.scene.add(im) }
  }

  private addHarbour(c: THREE.Vector3): void {
    const g = new THREE.Group()
    const dock = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.3), mat(0x5b3e22))
    dock.position.set(0, 0.04, 0.7)
    g.add(dock)
    const lightHouse = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.9, 10), mat(0xe8e1d0))
    lightHouse.position.set(0.7, 0.45, -0.2)
    g.add(lightHouse)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 3 }))
    lamp.position.set(0.7, 0.95, -0.2)
    g.add(lamp)
    for (let i = 0; i < 2; i++) {
      const ship = this.makeShip(0x6b4a2b, 0xe9dfc8)
      ship.position.set(-0.5 + i * 0.9, -WATER_Y * 0 - 0.02, 1.3 + i * 0.25)
      ship.rotation.y = 0.4 + i
      ship.userData.bob = i
      this.bobbers.push(ship)
      g.add(ship)
    }
    g.position.set(c.x, WATER_Y, c.z)
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    this.scene.add(g)
  }

  private makeShip(hull: number, sail: number): THREE.Group {
    const g = new THREE.Group()
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.55, 4, 1), mat(hull))
    h.rotation.z = Math.PI / 2
    h.scale.set(1, 1, 0.6)
    h.position.y = 0.06
    g.add(h)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45), mat(0x3a2814))
    mast.position.y = 0.3
    g.add(mast)
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.26), mat(sail, { side: THREE.DoubleSide }))
    s.position.set(0, 0.32, 0)
    s.rotation.y = Math.PI / 2
    g.add(s)
    return g
  }

  private buildLinks(): void {
    for (const l of LINKS) {
      const curve = linkCurve(l.id)
      const group = new THREE.Group()
      const guideMat = new THREE.MeshStandardMaterial({
        color: l.kind === 'river' ? 0x8fd0ff : 0xc9b48a, transparent: true, opacity: 0.28,
        emissive: l.kind === 'river' ? 0x3a8ab0 : 0x8a7a50, emissiveIntensity: 0.25,
      })
      const guide = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.045, 6, false), guideMat)
      group.add(guide)
      const hit = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.28, 6, false), new THREE.MeshBasicMaterial({ visible: false }))
      hit.userData.pick = { kind: 'link', id: l.id } satisfies Pick
      group.add(hit)
      this.hits.push(hit)
      this.scene.add(group)
      group.userData.offBoard = true // guides keep full brightness when highlighted
      this.linkVis.set(l.id, { group, hit, guide, owned: null, owner: null })
    }
  }

  // ------------------------------------------------------------ keeps

  /** Place one keep per player around the table; `localId` sits at the south edge. */
  setupKeeps(s: GameState, localId: string | null): void {
    for (const k of this.keeps.values()) this.scene.remove(k.group)
    this.keeps.clear()
    const n = s.players.length
    const startIdx = Math.max(0, s.players.findIndex((p) => p.id === localId))
    s.players.forEach((p, i) => {
      const rel = (i - startIdx + n) % n
      const ang = n === 2 ? [0, Math.PI][rel] : (rel / n) * Math.PI * 2
      this.seatAngle.set(p.id, ang)
      const k = this.makeKeep(new THREE.Color(p.color).getHex(), p.id === localId ? null : p.name)
      const r = 15.6
      k.group.position.set(Math.sin(ang) * r * 1.08, -0.45, Math.cos(ang) * r * 0.95)
      k.group.rotation.y = ang + Math.PI
      k.pos = k.group.position.clone()
      this.scene.add(k.group)
      this.keeps.set(p.id, k)
    })
  }

  private makeKeep(color: number, name: string | null): Keep {
    const g = new THREE.Group()
    g.userData.offBoard = true
    const stone = mat(0x6f6a62, { roughness: 0.9 })
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 0.7, 10), stone)
    plinth.position.y = 0.35
    g.add(plinth)
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.6 - i * 0.3, 0.16, 0.5), stone)
      step.position.set(0, 0.78 + i * 0.16, 0.7 - i * 0.3)
      g.add(step)
    }
    // Rival keeps get a tower beside the throne; yours is left out so it
    // never stands between you and the valley.
    if (name !== null) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 3.6, 12), stone)
      tower.position.set(-2.3, 2.5, 0.6)
      g.add(tower)
      for (let i = 0; i < 8; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.28), stone)
        const a = (i / 8) * Math.PI * 2
        m.position.set(-2.3 + Math.cos(a) * 0.85, 4.45, 0.6 + Math.sin(a) * 0.85)
        g.add(m)
      }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.4, 12), mat(color, { roughness: 0.5 }))
      roof.position.set(-2.3, 5.2, 0.6)
      g.add(roof)
    }
    // Throne.
    const gold = mat(0xd4a94a, { metalness: 0.85, roughness: 0.3 })
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.75), mat(0x4a2618))
    seat.position.set(0, 1.5, 0)
    g.add(seat)
    // Your own throne has a low back so the camera sees over your shoulder.
    const backH = name === null ? 0.55 : 1.7
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.0, backH, 0.18), gold)
    back.position.set(0, 1.4 + backH / 2, -0.38)
    g.add(back)
    const cush = new THREE.Mesh(new THREE.BoxGeometry(0.8, backH * 0.76, 0.06), mat(color))
    cush.position.set(0, 1.4 + backH / 2, -0.27)
    g.add(cush)
    for (const sx of [-0.5, 0.5]) {
      const armrest = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.8), gold)
      armrest.position.set(sx, 1.85, 0)
      g.add(armrest)
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), gold)
      finial.position.set(sx, 1.45 + backH, -0.38)
      g.add(finial)
    }
    // Commander.
    const cmd = new THREE.Group()
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 10), mat(color, { roughness: 0.6 }))
    robe.position.y = 0.55
    cmd.add(robe)
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.55, 10), mat(0x8c8f96, { metalness: 0.8, roughness: 0.35 }))
    chest.position.y = 1.05
    cmd.add(chest)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), mat(0xe0b896))
    head.position.y = 1.47
    cmd.add(head)
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.12, 8, 1, true), gold)
    crown.position.y = 1.62
    cmd.add(crown)
    const arm = new THREE.Group()
    const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55), mat(0x8c8f96, { metalness: 0.8, roughness: 0.35 }))
    armMesh.position.y = -0.27
    arm.add(armMesh)
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.08), mat(0xdfe6ee, { metalness: 1, roughness: 0.15 }))
    sword.position.y = -0.85
    arm.add(sword)
    arm.position.set(0.3, 1.25, 0)
    arm.rotation.x = -0.4
    cmd.add(arm)
    cmd.position.set(0, 1.6, -0.05)
    g.add(cmd)
    // Banners and torches.
    for (const sx of [-1.9, 1.9]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2), mat(0x3a2814))
      pole.position.set(sx, 2.3, -0.4)
      g.add(pole)
      const torch = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff8a2a, emissiveIntensity: 4 }))
      torch.position.set(sx * 0.7, 1.3, 1.2)
      g.add(torch)
      if (sx > 0) {
        const light = new THREE.PointLight(0xff9a40, 9, 9, 1.6)
        light.position.set(0, 2.2, 1.4)
        g.add(light)
        this.torches.push(light)
      }
    }
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3, 8, 8), mat(color, { side: THREE.DoubleSide, roughness: 0.7 }))
    flag.position.set(1.9 + 0.46, 3.2, -0.4)
    g.add(flag)
    const flag2 = flag.clone()
    flag2.position.x = -1.9 + 0.46
    g.add(flag2)
    const halo = new THREE.PointLight(0xffd27a, 0, 7, 1.4)
    halo.position.set(0, 3.6, 1.2)
    g.add(halo)
    // Your own keep carries no label: it would block the throne view.
    const label = name ? textSprite(name, { size: 46, color: '#f6e7c2', bg: 'rgba(20,14,8,.65)', bold: true }) : new THREE.Object3D()
    label.position.set(0, 4.6, -0.4)
    g.add(label)
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
    return { group: g, commander: cmd, arm, halo, banner: flag, pos: g.position.clone() }
  }

  // ------------------------------------------------------------ camera

  setView(v: 'pov' | 'overview', localId: string | null, dur = 1.4): void {
    this.view = v
    const ang = (localId ? this.seatAngle.get(localId) : undefined) ?? 0
    const pos = v === 'pov'
      ? new THREE.Vector3(Math.sin(ang) * 21, 6.4, Math.cos(ang) * 21)
      : new THREE.Vector3(Math.sin(ang) * 3, 31, Math.cos(ang) * 9)
    const target = v === 'pov' ? new THREE.Vector3(Math.sin(ang) * 5, 0.8, Math.cos(ang) * 5) : new THREE.Vector3(0, 0, 0.5)
    gsap.to(this.camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: dur, ease: 'power2.inOut' })
    gsap.to(this.controls.target, { x: target.x, y: target.y, z: target.z, duration: dur, ease: 'power2.inOut' })
  }

  /** Sweeping opening shot that lands in the player's throne view. */
  intro(localId: string | null): Promise<void> {
    if (document.hidden) { this.setView('pov', localId, 0.01); return Promise.resolve() }
    this.camera.position.set(-30, 34, -26)
    this.controls.target.set(0, 0, 0)
    return new Promise((res) => {
      gsap.to(this.camera.position, { x: 26, y: 20, z: -14, duration: 2.2, ease: 'sine.inOut', onComplete: () => {
        this.setView('pov', localId, 1.8)
        setTimeout(res, 1800)
      } })
    })
  }

  focusTown(id: string): void {
    const t = townPos(id)
    gsap.to(this.controls.target, { x: t.x, y: 0, z: t.z, duration: 0.8, ease: 'power2.out' })
  }

  // ------------------------------------------------------------ picking

  private pickAt(e: PointerEvent): Pick | null {
    const r = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const found = this.raycaster.intersectObjects(this.hits, false)
    for (const f of found) {
      const p = f.object.userData.pick as Pick | undefined
      if (!p) continue
      if (this.isSelectable(p)) {
        this.setHover(f.object)
        return p
      }
    }
    this.setHover(null)
    return null
  }

  private isSelectable(p: Pick): boolean {
    const s = this.selectable
    if (p.kind === 'town') return s.towns.has(p.id)
    if (p.kind === 'link') return s.links.has(p.id)
    if (p.kind === 'plot') return s.plots.has(`${p.town}:${p.slot}`) || s.buildings.has(`${p.town}:${p.slot}`)
    return s.buildings.has(`${p.town}:${p.slot}`)
  }

  private setHover(o: THREE.Object3D | null): void {
    if (this.hoverObj === o) return
    this.hoverObj = o
  }

  setSelectable(sel: Partial<WarTable['selectable']>): void {
    this.selectable = {
      towns: sel.towns ?? new Set(), links: sel.links ?? new Set(),
      plots: sel.plots ?? new Set(), buildings: sel.buildings ?? new Set(),
    }
    this.relight(this.lastState)
  }

  // ------------------------------------------------------------ state sync

  sync(s: GameState): void {
    // Buildings.
    const seen = new Set<string>()
    for (const t of TOWNS) s.plots[t.id].forEach((b, slot) => {
      const key = `${t.id}:${slot}`
      if (!b) return
      seen.add(key)
      const owner = s.players.find((p) => p.id === b.owner)!
      const sig = `${b.owner}|${b.kind}|${b.level}`
      const cur = this.buildingVis.get(key)
      if (!cur || cur.sig !== sig) {
        if (cur) this.scene.remove(cur.group)
        const g = this.makeBuilding(b, new THREE.Color(owner.color).getHex())
        const pp = plotPos(t.id, slot)
        g.position.copy(pp).setY(pp.y + 0.09)
        g.rotation.y = hash(slot, t.x) * 6
        g.userData.pick = { kind: 'building', town: t.id, slot } satisfies Pick
        g.traverse((o) => { o.userData.pick = g.userData.pick })
        lanternizeTree(g)
        this.scene.add(g)
        this.hits.push(...g.children)
        this.buildingVis.set(key, { sig, group: g })
        if (!cur) {
          g.scale.setScalar(0.01)
          gsap.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(2.2)' })
        } else gsap.fromTo(g.scale, { x: 1.4, y: 1.4, z: 1.4 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' })
      }
      this.syncGoods(key, b)
    })
    for (const [key, v] of this.buildingVis) if (!seen.has(key)) { this.scene.remove(v.group); this.buildingVis.delete(key) }
    // Links.
    for (const l of LINKS) {
      const v = this.linkVis.get(l.id)!
      const owner = s.links[l.id]
      if (owner === v.owner) continue
      v.owner = owner
      if (v.owned) v.group.remove(v.owned)
      v.owned = null
      v.guide.visible = !owner
      if (owner) {
        const col = new THREE.Color(s.players.find((p) => p.id === owner)!.color).getHex()
        v.owned = this.makeOwnedLink(l.id, l.kind, col)
        lanternizeTree(v.owned)
        v.group.add(v.owned)
      }
    }
    this.lastState = s
    this.relight(s)
    // Territory: a coloured ring per player around every town in their network.
    this.territory.clear()
    s.players.forEach((p, i) => {
      const col = new THREE.Color(p.color)
      for (const tid of network(s, p.id)) {
        const c = townPos(tid)
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.2 + i * 0.09, 1.27 + i * 0.09, 48),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
        )
        ring.rotation.x = -Math.PI / 2
        ring.position.set(c.x, c.y + 0.07, c.z)
        this.territory.add(ring)
      }
    })
  }

  private syncGoods(key: string, b: Building): void {
    const prev = this.goodsVis.get(key)
    if (prev) this.scene.remove(prev)
    const g = new THREE.Group()
    let i = 0
    for (const good of ['coal', 'copper', 'tin', 'bronze', 'machine'] as Good[]) {
      for (let k = 0; k < (b.goods[good] ?? 0); k++, i++) {
        const geo = good === 'bronze' || good === 'machine' ? new THREE.BoxGeometry(0.13, 0.06, 0.07) : new THREE.BoxGeometry(0.08, 0.08, 0.08)
        const m = new THREE.Mesh(geo, mat(GOOD_COLOR[good], { metalness: good === 'coal' ? 0.05 : 0.75, roughness: 0.35 }))
        m.position.set(0.3 + (i % 3) * 0.1, 0.05 + Math.floor(i / 3) * 0.085, -0.12 + (Math.floor(i / 3) % 2) * 0.05)
        m.castShadow = true
        g.add(m)
      }
    }
    const [town, slot] = key.split(':')
    const pp = plotPos(town, Number(slot))
    g.position.copy(pp).setY(pp.y + 0.09)
    this.scene.add(g)
    this.goodsVis.set(key, g)
  }

  private makeOwnedLink(id: string, kind: 'river' | 'land', color: number): THREE.Object3D {
    const curve = linkCurve(id)
    const g = new THREE.Group()
    if (kind === 'river') {
      const lane = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.05, 8, false), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 }))
      g.add(lane)
      const barge = this.makeShip(0x5b3e22, color)
      barge.scale.setScalar(0.8)
      barge.userData.curve = curve
      barge.userData.speed = 0.05 + hash(id.length, 3) * 0.04
      barge.userData.t = hash(id.length, 7)
      this.barges.push(barge)
      g.add(barge)
    } else {
      const road = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.07, 4, false), mat(0x8b8170, { roughness: 1 }))
      road.scale.y = 0.4
      g.add(road)
      const edge = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.025, 6, false), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 }))
      edge.position.y = 0.04
      g.add(edge)
      // Milestones in the owner's colour.
      for (let t = 0.2; t < 0.9; t += 0.3) {
        const p = curve.getPoint(t)
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), mat(color))
        post.position.copy(p).add(new THREE.Vector3(0, 0.08, 0))
        g.add(post)
      }
    }
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    g.scale.setScalar(1)
    return g
  }

  private makeBuilding(b: Building, color: number): THREE.Group {
    const g = new THREE.Group()
    const s = 0.8 + b.level * 0.15
    const own = mat(color, { roughness: 0.55 })
    const stone = mat(0x8a8276, { roughness: 0.9 })
    const wood = mat(0x5a3b20, { roughness: 0.8 })
    if (b.kind === 'mine') {
      const ore = mat(GOOD_COLOR[b.deposit ?? 'coal'], { flatShading: true, roughness: 0.5, metalness: b.deposit === 'coal' ? 0.1 : 0.6 })
      const mound = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.2, 7), ore)
      mound.position.y = 0.1
      g.add(mound)
      for (const sx of [-0.14, 0.14]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), wood)
        leg.position.set(sx, 0.32, 0)
        leg.rotation.z = sx > 0 ? -0.15 : 0.15
        g.add(leg)
      }
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16), mat(0x2b2b2b, { metalness: 0.8 }))
      wheel.position.set(0, 0.56, 0)
      this.spinners.push(wheel)
      g.add(wheel)
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.01), own)
      flag.position.set(0.08, 0.72, 0)
      g.add(flag)
    } else if (b.kind === 'smelter') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.36, 10), stone)
      base.position.y = 0.18
      g.add(base)
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 10), own)
      band.position.y = 0.3
      g.add(band)
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.45, 8), mat(0x5a3a26))
      chimney.position.set(0.12, 0.55, -0.05)
      g.add(chimney)
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff6a10, emissiveIntensity: 3.5 }))
      mouth.position.set(0, 0.14, 0.24)
      g.add(mouth)
      g.userData.smoke = new THREE.Vector3(0.12, 0.8, -0.05)
    } else {
      const hall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.36), stone)
      hall.position.y = 0.15
      g.add(hall)
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.22, 4), own)
      roof.rotation.y = Math.PI / 4
      roof.position.y = 0.41
      roof.scale.set(1, 1, 0.75)
      g.add(roof)
      const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), mat(0x2a2d33, { metalness: 0.9, roughness: 0.3 }))
      anvil.position.set(0, 0.04, 0.3)
      g.add(anvil)
      const hammer = new THREE.Group()
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), wood)
      handle.position.y = 0.1
      const headM = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.05), mat(0x2a2d33, { metalness: 0.9 }))
      headM.position.y = 0.2
      hammer.add(handle, headM)
      hammer.position.set(0.06, 0.08, 0.3)
      g.add(hammer)
      this.hammers.push(hammer)
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff7a20, emissiveIntensity: 2.6 }))
      glow.position.set(0, 0.12, 0.181)
      g.add(glow)
      g.userData.smoke = new THREE.Vector3(-0.1, 0.6, 0)
    }
    // Pennants show the level.
    for (let i = 0; i < b.level; i++) {
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), own)
      p.position.set(-0.3 + i * 0.08, 0.06, 0.28)
      p.rotation.z = Math.PI / 2
      g.add(p)
    }
    g.scale.setScalar(s)
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
    return g
  }

  private portraits = new Map<string, string>()
  private portraitKit: { r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera } | null = null

  /** A lantern-lit picture of the real building model, as a data URL (cached). */
  portrait(kind: Building['kind'], level: Building['level'], deposit: Building['deposit'], color: string): string {
    const key = `${kind}:${level}:${deposit ?? ''}:${color}`
    const hit = this.portraits.get(key)
    if (hit) return hit
    if (!this.portraitKit) {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
      r.setSize(176, 144, false)
      r.toneMapping = THREE.ACESFilmicToneMapping
      r.outputColorSpace = THREE.SRGBColorSpace
      const scene = new THREE.Scene()
      const key1 = new THREE.PointLight(0xffb060, 6, 6, 1.4)
      key1.position.set(0.6, 0.9, 1.1)
      const rim = new THREE.DirectionalLight(0x8fb0ff, 1.2)
      rim.position.set(-1.5, 1.2, -1)
      scene.add(key1, rim, new THREE.AmbientLight(0x6a5a50, 0.9))
      const cam = new THREE.PerspectiveCamera(30, 176 / 144, 0.1, 20)
      cam.position.set(1.15, 0.95, 1.5)
      cam.lookAt(0, 0.33, 0)
      this.portraitKit = { r, scene, cam }
    }
    const { r, scene, cam } = this.portraitKit
    // makeBuilding registers animated parts; a portrait must not leave them behind.
    const nh = this.hammers.length
    const ns = this.spinners.length
    const g = this.makeBuilding({ owner: '', kind, level, deposit, goods: {} } as Building, new THREE.Color(color).getHex())
    this.hammers.length = nh
    this.spinners.length = ns
    scene.add(g)
    r.render(scene, cam)
    const url = r.domElement.toDataURL('image/png')
    scene.remove(g)
    this.portraits.set(key, url)
    return url
  }

  // ------------------------------------------------------------ highlights

  highlight(s: GameState): void {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220)
    for (const [id, ring] of this.townRings) {
      const on = this.selectable.towns.has(id)
      const m = ring.material as THREE.MeshStandardMaterial
      m.opacity = on ? 0.5 + pulse * 0.5 : 0
      m.emissiveIntensity = on ? 1.5 + pulse : 0
    }
    for (const [key, pad] of this.plotPads) {
      const on = this.selectable.plots.has(key)
      const m = pad.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = on ? 1.2 + pulse * 2.2 : 0
    }
    for (const [id, v] of this.linkVis) {
      const on = this.selectable.links.has(id)
      const m = v.guide.material as THREE.MeshStandardMaterial
      m.opacity = on ? 0.6 + pulse * 0.4 : 0.22
      m.emissiveIntensity = on ? 1.4 + pulse * 1.6 : 0.25
      v.guide.scale.setScalar(1)
    }
    for (const [key, v] of this.buildingVis) {
      const on = this.selectable.buildings.has(key)
      v.group.position.y = plotPos(key.split(':')[0], Number(key.split(':')[1])).y + 0.09 + (on ? 0.05 + pulse * 0.08 : 0)
    }
    void s
  }

  setTurn(s: GameState, currentId: string | null): void {
    for (const [pid, k] of this.keeps) {
      const on = pid === currentId
      gsap.to(k.halo, { intensity: on ? 5 : 0, duration: 0.5 })
      gsap.to(k.arm.rotation, { x: on ? -2.6 : -0.4, duration: 0.6, ease: 'back.out(2)' })
    }
    void s
  }

  // ------------------------------------------------------------ effects

  private keepOf(pid: string): THREE.Vector3 {
    const k = this.keeps.get(pid)
    return k ? k.pos.clone().setY(0.2) : new THREE.Vector3(0, 0, 14)
  }

  private makeWorker(color: number): THREE.Group {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.14, 4, 8), mat(color))
    body.position.y = 0.16
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(0xe0b896))
    head.position.y = 0.33
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.08, 8), mat(0x3a2814))
    hat.position.y = 0.4
    const tool = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.02), mat(0x5a3b20))
    tool.position.set(0.09, 0.2, 0)
    tool.rotation.z = -0.5
    g.add(body, head, hat, tool)
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    return g
  }

  /** A squad of workers marches from the player's keep to a place on the board. */
  sendWorkers(pid: string, color: string, to: THREE.Vector3, count = 3, dur = 1.1): Promise<void> {
    const from = this.keepOf(pid)
    const col = new THREE.Color(color).getHex()
    const done: Promise<void>[] = []
    for (let i = 0; i < count; i++) {
      const w = this.makeWorker(col)
      w.scale.setScalar(1.7)
      const off = new THREE.Vector3((i - (count - 1) / 2) * 0.35, 0, (i % 2) * 0.25)
      w.position.copy(from).add(off)
      this.fxLayer.add(w)
      const target = to.clone().add(off.clone().multiplyScalar(0.6))
      w.lookAt(target.x, w.position.y, target.z)
      const st = { t: 0 }
      done.push(new Promise((res) => {
        gsap.to(st, {
          t: 1, duration: dur, delay: i * 0.08, ease: 'power1.inOut',
          onUpdate: () => {
            const x = from.x + off.x + (target.x - from.x - off.x) * st.t
            const z = from.z + off.z + (target.z - from.z - off.z) * st.t
            const ground = Math.max(WATER_Y, Math.abs(x) < BOARD_W / 2 && Math.abs(z) < BOARD_D / 2 ? heightAt(x, z) : -0.3)
            w.position.set(x, ground + Math.abs(Math.sin(st.t * 28)) * 0.08, z)
            w.scale.setScalar(1.7 - st.t * 0.7)
          },
          onComplete: () => {
            gsap.to(w.position, { y: w.position.y + 0.25, duration: 0.15, yoyo: true, repeat: 3 })
            gsap.to(w.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.35, delay: 0.5, onComplete: () => { this.fxLayer.remove(w); res() } })
          },
        })
      }))
    }
    return Promise.all(done).then(() => undefined)
  }

  /** A cart or barge carries one good along a path of towns. */
  carry(good: Good, path: string[], dur = 0.9): Promise<void> {
    if (path.length < 2) return Promise.resolve()
    const pts = path.map((id) => townPos(id).add(new THREE.Vector3(0, 0.25, 0)))
    const curve = new THREE.CatmullRomCurve3(pts)
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.2), mat(GOOD_COLOR[good], { metalness: 0.6, roughness: 0.3, emissive: GOOD_COLOR[good], emissiveIntensity: 0.5 }))
    crate.castShadow = true
    this.fxLayer.add(crate)
    const st = { t: 0 }
    return new Promise((res) => {
      gsap.to(st, {
        t: 1, duration: dur * Math.min(2.2, path.length / 2), ease: 'power1.inOut',
        onUpdate: () => {
          const p = curve.getPoint(st.t)
          crate.position.set(p.x, p.y + Math.sin(st.t * Math.PI) * 0.6, p.z)
          crate.rotation.y += 0.1
        },
        onComplete: () => { this.fxLayer.remove(crate); res() },
      })
    })
  }

  floatText(text: string, at: THREE.Vector3, color = '#ffe08a', glyph?: Glyph): void {
    const sp = textSprite(text, { size: 60, color, bold: true, glyph })
    sp.position.copy(at).add(new THREE.Vector3(0, 0.8, 0))
    this.fxLayer.add(sp)
    gsap.to(sp.position, { y: sp.position.y + 1.6, duration: 1.6, ease: 'power2.out' })
    gsap.to(sp.material, { opacity: 0, duration: 0.6, delay: 1.0, onComplete: () => { this.fxLayer.remove(sp) } })
  }

  burst(at: THREE.Vector3, color: number, n = 26): void {
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color }))
      sp.position.copy(at)
      this.fxLayer.add(sp)
      const a = Math.random() * Math.PI * 2, up = 0.6 + Math.random() * 1.4, r = 0.5 + Math.random()
      gsap.to(sp.position, { x: at.x + Math.cos(a) * r, y: at.y + up, z: at.z + Math.sin(a) * r, duration: 0.7, ease: 'power2.out' })
      gsap.to(sp.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.7, delay: 0.2, onComplete: () => { this.fxLayer.remove(sp) } })
    }
  }

  quake(power = 0.35): void { this.shake = power }

  /** Screen position (CSS px) of a plot, for tests and tutorials. */
  screenOfPlot(town: string, slot: number): { x: number; y: number } {
    const v = plotPos(town, slot).project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
  }

  townPoint(id: string): THREE.Vector3 { return townPos(id) }
  linkPoint(id: string): THREE.Vector3 { return linkCurve(id).getPoint(0.5) }

  /** Play one action's effects; resolves when the animation is done. */
  async play(fx: Fx[], s: GameState, fast: boolean): Promise<void> {
    if (document.hidden) return
    const color = (pid: string) => s.players.find((p) => p.id === pid)?.color ?? '#ffffff'
    const speed = fast ? 0.55 : 1
    const jobs: Promise<void>[] = []
    let moves = 0
    for (const f of fx) {
      if (f.kind === 'build') {
        const at = plotPos(f.town, f.slot)
        jobs.push(this.sendWorkers(f.who, color(f.who), at, 4, 1.0 * speed).then(() => this.burst(at.clone().add(new THREE.Vector3(0, 0.3, 0)), 0xffd27a)))
      } else if (f.kind === 'route') {
        jobs.push(this.sendWorkers(f.who, color(f.who), this.linkPoint(f.link), 5, 1.0 * speed))
      } else if (f.kind === 'produce') {
        const at = plotPos(f.town, f.slot)
        jobs.push(this.sendWorkers(s.plots[f.town][f.slot]!.owner, color(s.plots[f.town][f.slot]!.owner), at, 2, 0.8 * speed).then(() => {
          this.floatText(`+${f.n} ${f.good === 'machine' ? 'arms' : f.good}`, at, '#cfe8ff')
        }))
      } else if (f.kind === 'move' && moves < 8) {
        moves++
        jobs.push(new Promise<void>((r) => setTimeout(r, moves * 90 * speed)).then(() => this.carry(f.good, f.path, 0.8 * speed)))
      } else if (f.kind === 'deliver') {
        const at = townPos(f.contract.town)
        jobs.push(new Promise<void>((r) => setTimeout(r, 700 * speed)).then(() => {
          this.burst(at.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xffe08a, 50)
          this.floatText(`+${f.contract.money}`, at, '#ffe08a', 'mark')
          this.floatText(`+${f.contract.vp}`, at.clone().add(new THREE.Vector3(0, 0.7, 0)), '#f3d98d', 'glory')
          this.quake(0.15)
        }))
      } else if (f.kind === 'pay' && f.why === 'toll') {
        const k = this.keepOf(f.to)
        this.floatText(`+${f.amount} toll`, k.clone().setY(3), '#ffd27a', 'mark')
      } else if (f.kind === 'trade') {
        this.floatText(`+${f.earned}`, this.keepOf(f.who).setY(3.2), '#ffe08a', 'mark')
      } else if (f.kind === 'tick') {
        this.quake(0.4)
      }
    }
    // Never let an animation hold up the game (hidden tabs pause frames).
    await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 3500))])
  }

  // ------------------------------------------------------------ frame

  private makeSmokeTexture(): THREE.Texture {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30)
    grd.addColorStop(0, 'rgba(200,190,180,.55)')
    grd.addColorStop(1, 'rgba(200,190,180,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  }

  private frame(): void {
    const dt = Math.min(0.05, this.clock.getDelta())
    const t = this.clock.elapsedTime
    this.controls.update()
    // Water shimmer.
    const wm = this.water.material as THREE.MeshStandardMaterial
    wm.emissiveIntensity = 0.5 + Math.sin(t * 1.3) * 0.12
    // Torch flicker.
    this.torches.forEach((l, i) => { l.intensity = 3.4 + Math.sin(t * 13 + i * 1.7) * 0.6 + Math.sin(t * 7.3 + i) * 0.4 })
    // Commanders breathe; banners sway.
    for (const k of this.keeps.values()) {
      k.commander.position.y = 1.6 + Math.sin(t * 1.6) * 0.02
      k.banner.rotation.y = Math.sin(t * 1.8) * 0.18
    }
    for (const h of this.hammers) h.rotation.z = Math.max(0, Math.sin(t * 6)) * 1.4 - 0.4
    // Barges drift along their lanes; mine wheels turn; ships bob.
    for (const o of this.barges) {
      if (!o.parent) continue
      o.userData.t = (o.userData.t + dt * o.userData.speed) % 1
      const c = o.userData.curve as THREE.CatmullRomCurve3
      o.position.copy(c.getPoint(o.userData.t))
      const q = c.getTangent(o.userData.t)
      o.rotation.y = Math.atan2(q.x, q.z) - Math.PI / 2
    }
    for (const o of this.spinners) o.rotation.z += dt * 2
    for (const o of this.bobbers) o.position.y = Math.sin(t * 1.4 + o.userData.bob) * 0.02
    LAMPS.uTime.value = t
    const ep = this.embers.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < ep.count; i++) {
      let y = ep.getY(i) + dt * (0.12 + (i % 7) * 0.02)
      if (y > 3.4) y = 0.3
      ep.setXYZ(i, ep.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.08, y, ep.getZ(i) + Math.cos(t * 0.5 + i) * dt * 0.08)
    }
    ep.needsUpdate = true
    this.mist.forEach((m, i) => {
      const mp = (m.material as THREE.MeshBasicMaterial).map!
      mp.offset.x = t * 0.004 * (i ? -1 : 1)
      mp.offset.y = t * 0.002
    })
    if (Math.random() < dt * 6) {
      for (const { group } of this.buildingVis.values()) {
        const at = group.userData.smoke as THREE.Vector3 | undefined
        if (!at || Math.random() > 0.35) continue
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, depthWrite: false, opacity: 0.7 }))
        sp.position.copy(group.localToWorld(at.clone()))
        sp.scale.setScalar(0.25)
        this.fxLayer.add(sp)
        this.smoke.push({ sp, life: 0, v: new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.35, 0.08) })
      }
    }
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const sm = this.smoke[i]
      sm.life += dt
      sm.sp.position.addScaledVector(sm.v, dt)
      sm.sp.scale.setScalar(0.25 + sm.life * 0.5)
      ;(sm.sp.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.6 - sm.life * 0.3)
      if (sm.life > 2) { this.fxLayer.remove(sm.sp); this.smoke.splice(i, 1) }
    }
    if (this.shake > 0.001) {
      const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake
      this.camera.position.x += sx
      this.camera.position.y += sy
      this.shake *= 0.88
    }
    this.composer.render()
  }
}
