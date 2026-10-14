import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import gsap from 'gsap'

import { PAL } from './palette'
import {
  CITIES,
  CITY_BY_ID,
  LINKS,
  type CityDef,
  type GameState,
  type PlacedIndustry,
  currentPlayer,
  createState,
  createInitialGameState,
  playerById,
  buildOptionsForCity,
  legalLinks,
  LINK_BY_ID,
  linkCost,
  sellValue,
  applyBuild,
  applyNetwork,
  applyDevelop,
  applySell,
  applyLoan,
  advanceTurn,
  addLog,
  freeSlot,
} from './state'
import { SoundScape } from './audio'
import { MusicBox, pickTrack } from './music'
import { makeMapTexture, makeLabelSprite, makeMuralTexture } from './textures'
import { createIndustryPiece, contactShadow, buildSkyline, type PieceVisual } from './pieces'
import { Hud, type UiMode, type PopoverItem } from './hud'
import { Screens } from './screens'
import {
  addAI,
  createTable,
  joinTable,
  markStarted,
  removeAI,
  type TableRecord,
} from './session'
import { aiAct } from './ai'
import type { AIDifficulty, AIPersonality, SeatSpec, IndustryType } from './state'
import {
  legalActions,
  roundsPerEra,
  getLegalDevelopments,
  sellableIndustries,
  legalNetworkLinks,
  canDoubleRail,
  applyNetworkDouble,
  resolveDevelop,
  resolveSell,
  resolveLoan,
  resolveScout,
  resolvePass,
  allBuildOptions,
  serializeGameState,
  hydrateGameState,
  INDUSTRY_SPEC as INDUSTRY_SPEC_REF,
} from './state'
import type { BuildOption } from './state'

// ---------------------------------------------------------------------------
// BRONZE — a premium digital tabletop sitting on a dark Victorian
// workbench. Board-first hierarchy, restrained bloom, physical materials.
// ---------------------------------------------------------------------------

const BOARD_W = 29
const BOARD_D = 25.5
const BOARD_TOP = 0.225
const NODE_TOP = 0.34

interface RouteVis {
  id: string
  group: THREE.Group
  accent: THREE.Mesh
  hl: THREE.Mesh
  hlMat: THREE.MeshStandardMaterial
}

interface PieceEntry {
  vis: PieceVisual
  data: PlacedIndustry
  hitbox: THREE.Mesh
  shadow: THREE.Mesh
  flame?: THREE.Sprite
}

let flameTexture: THREE.Texture | null = null
function getFlameTexture(): THREE.Texture {
  if (!flameTexture) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(32, 34, 2, 32, 32, 30)
    grad.addColorStop(0, 'rgba(255,220,150,0.95)')
    grad.addColorStop(0.35, 'rgba(255,160,60,0.55)')
    grad.addColorStop(0.7, 'rgba(200,90,20,0.18)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    flameTexture = new THREE.CanvasTexture(c)
  }
  return flameTexture
}

function makeFlame(): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: getFlameTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const s = new THREE.Sprite(mat)
  s.scale.set(0.5, 0.62, 1)
  return s
}

function slotOffset(index: number, total: number): THREE.Vector2 {
  const spread = 0.4
  if (total === 1) return new THREE.Vector2(0, 0)
  const x = (index - (total - 1) / 2) * spread
  return new THREE.Vector2(x, total >= 3 && index === 1 ? -0.26 : 0.07)
}

class PuffSystem {
  readonly points: THREE.Points
  private cap = 240
  private cursor = 0
  private pos: Float32Array
  private life: Float32Array

  constructor(pixelRatio: number) {
    this.pos = new Float32Array(this.cap * 3)
    this.life = new Float32Array(this.cap)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aLife;
        varying float vLife;
        uniform float uPR;
        void main(){
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (2.0 + 9.0 * aLife) * uPR * (30.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vLife;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float m = smoothstep(0.5, 0.08, length(uv));
          vec3 warm = mix(vec3(0.55,0.4,0.22), vec3(0.95,0.78,0.45), vLife);
          gl_FragColor = vec4(warm, m * vLife * 0.85);
        }`,
      uniforms: { uPR: { value: pixelRatio } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
  }

  burst(at: THREE.Vector3, n = 14, spread = 0.3): void {
    for (let i = 0; i < n; i++) {
      const k = this.cursor
      this.cursor = (this.cursor + 1) % this.cap
      this.pos[k * 3] = at.x + (Math.random() - 0.5) * spread
      this.pos[k * 3 + 1] = at.y + Math.random() * 0.12
      this.pos[k * 3 + 2] = at.z + (Math.random() - 0.5) * spread
      this.life[k] = 0.9 + Math.random() * 0.1
    }
  }

  update(dt: number): void {
    let dirty = false
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] > 0) {
        this.life[i] = Math.max(0, this.life[i] - dt * 1.6)
        dirty = true
      }
    }
    if (dirty) {
      ;(this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      ;(this.points.geometry.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true
    }
  }
}

class SteamColumns {
  readonly points: THREE.Points
  private tips: THREE.Vector3[] = []
  private count = 110
  private seeds: Float32Array
  private mat: THREE.ShaderMaterial

  constructor(pixelRatio: number, skyline: THREE.Group) {
    const chimneys = skyline.children.filter(
      (c) => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.CylinderGeometry,
    )
    for (let i = 0; i < 12 && chimneys.length > 0; i++) {
      const m = chimneys[Math.floor(Math.random() * chimneys.length)] as THREE.Mesh
      this.tips.push(new THREE.Vector3(m.position.x, m.position.y + 1.2, m.position.z))
    }
    if (this.tips.length === 0) this.tips.push(new THREE.Vector3(0, 4, -18))

    this.seeds = new Float32Array(this.count)
    const pos = new Float32Array(this.count * 3)
    for (let i = 0; i < this.count; i++) {
      this.seeds[i] = Math.random()
      const tip = this.tips[i % this.tips.length]
      pos[i * 3] = tip.x
      pos[i * 3 + 1] = tip.y
      pos[i * 3 + 2] = tip.z
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(this.seeds, 1))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform float uPR;
        varying float vA;
        void main(){
          vec3 p = position;
          float rise = fract(aSeed + uTime * 0.05);
          p.y += rise * 2.6;
          p.x += sin((rise * 4.0 + aSeed * 20.0)) * 0.5 * rise;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (3.0 + rise * 14.0) * uPR * (30.0 / -mv.z);
          vA = (1.0 - rise) * smoothstep(0.0, 0.12, rise) * 0.16;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float m = smoothstep(0.5, 0.05, length(uv));
          gl_FragColor = vec4(vec3(0.62,0.58,0.52), m * vA);
        }`,
      uniforms: { uTime: { value: 0 }, uPR: { value: pixelRatio } },
      transparent: true,
      depthWrite: false,
    })
    this.points = new THREE.Points(geo, this.mat)
    this.points.frustumCulled = false
  }

  tick(t: number): void {
    this.mat.uniforms.uTime.value = t
  }
}

function boot(): void {
  const host = document.getElementById('app') as HTMLElement
  const loading = document.getElementById('loading') as HTMLElement
  // No misleading values before a table is actually set.
  document.body.classList.add('pre-game')

  try {
    init(host, loading)
  } catch (err) {
    loading.textContent = `Failed to start: ${String(err)}`
    throw err
  }
}

function init(host: HTMLElement, loading: HTMLElement): void {
  // ------------------------------ Renderer ---------------------------------

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  const pixelRatio = Math.min(window.devicePixelRatio, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(host.clientWidth, host.clientHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.82 // calm, tabletop-photograph exposure
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(PAL.bg)
  scene.fog = new THREE.Fog(PAL.bg, 28, 72)

  const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 150)
  camera.position.set(0, 17.5, 21)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.07
  controls.minDistance = 7
  controls.maxDistance = 40
  controls.maxPolarAngle = 1.34
  controls.minPolarAngle = 0.42
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.32
  controls.target.set(0, 0.3, -0.4)

  // Lighting hierarchy — the room is lit by ONE practical oil lamp;
  // sun-grade fill is gone so the lamp genuinely owns the table.
  scene.add(new THREE.HemisphereLight(0x2a2118, 0x0a0805, 0.5))
  const key = new THREE.DirectionalLight(0xffd9a0, 0.62)
  key.position.set(6, 15, 5)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x33404f, 0.28)
  rim.position.set(-10, 9, -9)
  scene.add(rim)
  scene.add(new THREE.AmbientLight(0x141019, 0.34))

  // ------------------------------ The oil lamp --------------------------------
  const lampGroup = new THREE.Group()
  const brassMat = new THREE.MeshStandardMaterial({ color: PAL.brass, roughness: 0.32, metalness: 0.95 })
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.11, 1.15, 12), brassMat)
  stem.position.y = 0.58
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.09, 14), brassMat)
  foot.position.y = 0.045
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.27, 0.34, 14, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x3a2b18,
      emissive: 0xffb45c,
      emissiveIntensity: 0.55,
      roughness: 0.5,
      side: THREE.DoubleSide,
    }),
  )
  shade.position.y = 1.28
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.14, 14), brassMat)
  cap.position.y = 1.5
  lampGroup.add(stem, foot, shade, cap)

  const lampFlame = makeFlame()
  lampFlame.scale.set(0.55, 0.8, 1)
  lampFlame.position.y = 1.26
  lampGroup.add(lampFlame)

  const lampLight = new THREE.PointLight(0xffb36b, 26, 30, 2)
  lampLight.position.y = 1.3
  lampGroup.add(lampLight)
  lampGroup.position.set(-BOARD_W / 2 - 2.4, 0.4, BOARD_D / 2 - 1.5)
  scene.add(lampGroup)

  // Two seated players — silhouettes at the table's long edges.
  function buildSitter(x: number, z: number, yaw: number): THREE.Group {
    const g = new THREE.Group()
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0906, roughness: 1 })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.25, 2.1, 10), dark)
    body.position.y = 1.35
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10), dark)
    head.position.y = 2.72
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.92, 10, 8), dark)
    shoulder.position.y = 2.16
    shoulder.scale.set(1.25, 0.6, 0.8)
    g.add(body, head, shoulder)
    g.position.set(x, 0.4, z)
    g.rotation.y = yaw
    return g
  }
  scene.add(buildSitter(-5.5, BOARD_D / 2 + 3.6, Math.PI))
  scene.add(buildSitter(6.5, -BOARD_D / 2 - 3.4, 0))

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(host.clientWidth, host.clientHeight),
    0.22, // whisper of bloom — importance only
    0.35,
    0.62,
  )
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  window.addEventListener('resize', () => {
    camera.aspect = host.clientWidth / host.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(host.clientWidth, host.clientHeight)
    composer.setSize(host.clientWidth, host.clientHeight)
  })

  // ------------------------------ State/HUD --------------------------------

  const sound = new SoundScape()
  let state: GameState = createState()
  let mode: UiMode = 'idle'
  let selectedCardId: string | null = null
  let busy = false

  const hud = new Hud({
    onAction: (a) => handleAction(a),
    onCancel: () => setMode('idle'),
    onCardPick: (cardId) => {
      // FINAL CARD RULE — click 1 selects; clicking the SAME selected card
      // EXECUTES it. There is no click-to-deselect: BACK leaves the context.
      if (!isHumanTurn()) {
        debugInteraction('card-pick: not the local player turn')
        return
      }
      if (busy || state.over) {
        debugInteraction(`card-pick: busy=${busy} over=${state.over}`)
        return
      }
      window.clearTimeout(previewTimer ?? undefined)
      pendingPreviewId = null

      const wasSelected = selectedCardId === cardId
      if (wasSelected) {
        // SECOND CLICK ON SELECTED CARD = EXECUTE.
        useHandCard(cardId)
        return
      }

      selectedCardId = cardId
      sound.cardSlide()
      hud.refresh(state, mode, selectedCardId)
      pendingPreviewId = cardId
      previewTimer = window.setTimeout(() => flushPreview(), 260)
    },
    onCardUse: (cardId) => {
      // Native dblclick (detail ≥ 2) routes here too — same execution path.
      if (!isHumanTurn()) {
        debugInteraction('card-use: not the local player turn')
        return
      }
      if (busy || state.over) {
        debugInteraction(`card-use: busy=${busy} over=${state.over}`)
        return
      }
      window.clearTimeout(previewTimer ?? undefined)
      pendingPreviewId = null
      useHandCard(cardId)
    },
    onReset: () => resetGame(),
  })
  // One authoritative audio state — the header button and the home
  // settings always agree, and muting actually silences everything.
  const audioUI = { music: true, sfx: true, mVol: 0.55, sVol: 0.7 }
  function syncSoundLabel(): void {
    hud.setSoundLabel(audioUI.music || audioUI.sfx)
  }
  function applyAudio(): void {
    music.ensure()
    sound.resume()
    music.setEnabled(audioUI.music)
    sound.setEnabled(audioUI.sfx)
    music.setVolume(audioUI.mVol)
    sound.setVolume(audioUI.sVol)
    const chkM = document.getElementById('chkMusic') as HTMLInputElement | null
    const chkS = document.getElementById('chkSfx') as HTMLInputElement | null
    if (chkM) chkM.checked = audioUI.music
    if (chkS) chkS.checked = audioUI.sfx
    syncSoundLabel()
  }
  hud.onAudio(() => {
    const anyOn = audioUI.music || audioUI.sfx
    audioUI.music = !anyOn
    audioUI.sfx = !anyOn
    applyAudio()
  })

  // --------------------------- Save / Resume ---------------------------------

  function saveGame(): void {
    if (phase !== 'game' && phase !== 'results') return
    try {
      localStorage.setItem(
        'kinetic.save',
        JSON.stringify({
          game: serializeGameState(state),
          seats: lastSeats,
          savedAt: Date.now(),
        }),
      )
      hud.toast('Table saved.')
    } catch {
      hud.toast('Could not save (storage full?).')
    }
    closeMenuSafe()
  }

  function loadSavedGame(): boolean {
    try {
      const raw = localStorage.getItem('kinetic.save')
      if (!raw) return false
      const parsed = JSON.parse(raw) as { game: ReturnType<typeof serializeGameState>; seats?: SeatSpec[] }
      lastSeats = parsed.seats ?? null
      state = hydrateGameState(parsed.game)
    } catch {
      return false
    }
    mode = 'idle'
    selectedCardId = null
    busy = true
    pendingEraShow = false
    aiTimer = null
    finalRevealDone = false
    savedCam = null
    focusedCity = null
    doubleRailStage = 0
    firstRailId = null
    pendingBuildOption = null
    hud.closePopover()
    hud.hideOverlay()
    resetBoardVisuals()
    phase = 'opening'
    document.body.classList.remove('pre-game')
    screens.hideAll()
    controls.autoRotate = false
    controls.enabled = false
    camera.position.set(0, 30, 44)
    renderer.toneMappingExposure = 0.16
    history.pushState({ kb: 'game' }, '')
    syncBoard(false)
    syncRoutes()
    syncPawns()
    buildSupplyMats()
    music.setTrack(state.era === 'rail' ? 'rail-spine' : 'canal-hum')
    runOpeningSequence(() => {
      phase = 'game'
      busy = false
      controls.enabled = true
      renderer.toneMappingExposure = 0.82
      camera.position.set(3, 17, 20)
      hud.refresh(state, mode, selectedCardId)
      renderTray()
    })
    return true
  }

  document.getElementById('saveBtn')?.addEventListener('click', () => {
    saveGame()
    closeMenuSafe()
  })

  function closeMenuSafe(): void {
    document.getElementById('pauseMenu')?.classList.add('hidden')
    gamePaused = false
  }

  function refreshResumeSaved(): void {
    const has = !!localStorage.getItem('kinetic.save')
    document.getElementById('resumeSavedBtn')?.classList.toggle('hidden', !has)
  }
  document.getElementById('resumeSavedBtn')?.addEventListener('click', () => {
    if (!loadSavedGame()) hud.toast('No readable saved table.')
  })

  // --------------------------- Pause / Table menu ----------------------------

  function wirePauseMenu(): void {
    const pm = document.getElementById('pauseMenu')!
    const setPaused = (on: boolean): void => {
      gamePaused = on && phase === 'game'
    }
    const closeMenu = (): void => {
      pm.classList.add('hidden')
      setPaused(false)
    }
    document.getElementById('pauseBtn')!.addEventListener('click', () => {
      pm.classList.toggle('hidden')
      const open = !pm.classList.contains('hidden')
      setPaused(open) // authoritative PAUSE while the menu is up
      sound.resume()
      music.ensure()
    })
    document.getElementById('resumeBtn')!.addEventListener('click', closeMenu)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !pm.classList.contains('hidden')) closeMenu()
    })
    document.getElementById('logToggle2')!.addEventListener('click', () => {
      document.getElementById('logPanel')!.classList.toggle('open')
      closeMenu()
    })
    document.getElementById('ljClose')?.addEventListener('click', () => {
      document.getElementById('logPanel')!.classList.remove('open')
    })
    const how = document.getElementById('howBlock')!
    document.getElementById('howBtn')!.addEventListener('click', () => how.classList.toggle('hidden'))
    const resetBtnEl = document.getElementById('resetBtn')!
    resetBtnEl.addEventListener('click', (e) => {
      e.stopImmediatePropagation()
    }, { capture: true })
    resetBtnEl.addEventListener('click', () => {
      closeMenu()
      hud.confirm(
        'RESET CURRENT GAME?',
        'Current progress will be lost. The deal returns to its original state.',
        'RESET',
        () => resetGame(),
      )
    })
    document.getElementById('leaveWsBtn')!.addEventListener('click', () => {
      closeMenu()
      if (phase === 'game' && !state.over) {
        hud.confirm(
          'RETURN TO WORKSHOP?',
          'The active table will be abandoned.',
          'LEAVE TABLE',
          () => {
            location.href = './'
          },
        )
      } else {
        location.href = './'
      }
    })
  }
  wirePauseMenu()

  // ---- BUG 9: fixed, always-visible BACK control (right of the cards) ----
  function contextBack(): void {
    // Stage-aware: an in-progress double-rail backs out one level first.
    if (doubleRailStage > 0) {
      doubleRailStage = 0
      firstRailId = null
      renderTray()
      return
    }
    if (mode === 'BUILD' && pendingBuildOption) {
      pendingBuildOption = null
      selectedCardId = null
      hud.closePopover()
      renderTray()
      return
    }
    hud.closePopover()
    unfocus() // camera restores to the strategic frame
    selectedCardId = null // BACK is the only way out of a selection
    setMode('idle')
    renderTray()
  }

  function setupContextBack(): void {
    const b = document.getElementById('ctxBackBtn')!
    b.addEventListener('click', () => {
      if (!isHumanTurn()) return
      sound.click(0, 1, 0)
      contextBack()
    })
  }
  setupContextBack()

  // Developer-only interaction diagnostics (localStorage 'kb.debug' = '1').
  // Test hook: localStorage kb.autoplay=1 lets the AI also drive the local seat,
  // so a whole game can be played unattended (used by the e2e test).
  const AUTOPLAY = (() => {
    try {
      return localStorage.getItem('kb.autoplay') === '1'
    } catch {
      return false
    }
  })()
  const KB_DEBUG = (() => {
    try {
      return localStorage.getItem('kb.debug') === '1'
    } catch {
      return false
    }
  })()
  function debugInteraction(reason: string): void {
    if (!KB_DEBUG) return
    const cur = currentPlayer(state)
    console.debug('[KB:card-blocked]', {
      reason,
      currentPlayer: cur?.name,
      isAI: cur?.isAI,
      phase,
      gamePaused,
      mode,
      busy,
      over: state.over,
      selectedCardId,
    })
  }

  // ---- Custom card-hand overflow: no native scrollbars, brass arrows ----
  // One system serves BOTH strips: the real player hand and whichever
  // contextual card row is currently dealt into its place.
  function visibleStrip(): HTMLElement {
    const ctx = trayEl()
    return ctx.classList.contains('hidden') ? (document.getElementById('hand') as HTMLElement) : ctx
  }
  function updateHandNav(): void {
    const L = document.getElementById('ctxL')!
    const R = document.getElementById('ctxR')!
    const strip = visibleStrip()
    if (strip.classList.contains('hidden')) {
      L.classList.remove('show')
      R.classList.remove('show')
      return
    }
    const over = strip.scrollWidth - strip.clientWidth > 8
    L.classList.toggle('show', over && strip.scrollLeft > 6)
    R.classList.toggle('show', over && strip.scrollLeft < strip.scrollWidth - strip.clientWidth - 6)
  }
  function nudgeStrip(dir: number): void {
    visibleStrip().scrollTo({ left: visibleStrip().scrollLeft + dir * 280, behavior: 'smooth' })
  }
  function setupHandNav(): void {
    const L = document.getElementById('ctxL')!
    const R = document.getElementById('ctxR')!
    const hand = document.getElementById('hand')!
    const ctx = trayEl()
    L.addEventListener('click', () => nudgeStrip(-1))
    R.addEventListener('click', () => nudgeStrip(1))
    for (const strip of [hand, ctx]) {
      strip.addEventListener(
        'wheel',
        (e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            strip.scrollLeft += e.deltaY
            e.preventDefault()
            updateHandNav()
          }
        },
        { passive: false },
      )
      let drag: { x: number; sl: number } | null = null
      strip.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, sl: strip.scrollLeft }
      })
      window.addEventListener('pointermove', (e) => {
        if (drag) strip.scrollLeft = drag.sl - (e.clientX - drag.x)
      })
      window.addEventListener('pointerup', () => {
        drag = null
        updateHandNav()
      })
    }
    new ResizeObserver(updateHandNav).observe(hand)
    new ResizeObserver(updateHandNav).observe(ctx)
    // Any re-render that swaps cards also re-evaluates arrow visibility.
    const mo = new MutationObserver(updateHandNav)
    mo.observe(hand, { childList: true })
    mo.observe(ctx, { childList: true })
    hand.addEventListener('scroll', updateHandNav)
    ctx.addEventListener('scroll', updateHandNav)
  }
  setupHandNav()

  // Resource glyphs are REAL interactions — inspect supply via context cards.
  function wireResourceInspect(): void {
    document.getElementById('playersPlate')!.addEventListener('click', (e) => {
      const g = (e.target as HTMLElement).closest('.rglyph') as HTMLElement | null
      if (!g || !isHumanTurn()) return
      if (g.classList.contains('res-coal')) openInspect('coal')
      else if (g.classList.contains('res-iron')) openInspect('iron')
      else if (g.classList.contains('res-beer')) openInspect('beer')
      else if (g.classList.contains('pmoney')) openInspect('money')
    })
  }
  function openInspect(res: 'money' | 'iron' | 'coal' | 'beer'): void {
    inspectRes = res
    sound.click(0, 1, 0)
    renderTray()
  }
  wireResourceInspect()
  refreshResumeSaved()

  // --------------------------- Session · Phases ------------------------------

  const music = new MusicBox()
  type Phase = 'home' | 'lobby' | 'opening' | 'game' | 'results'
  let phase: Phase = 'home'
  let currentTable: TableRecord | null = null
  let lastSeats: SeatSpec[] | null = null
  let aiTimer: number | null = null
  let gamePaused = false
  let devHoverKind: IndustryType | null = null
  let previewTimer: number | null = null
  let pendingPreviewId: string | null = null

  /** EXECUTE a hand card: BUILD intent + confirm popover at its target. */
  function useHandCard(cardId: string): void {
    const cur = currentPlayer(state)
    const card = cur.hand.find((c) => c.id === cardId)
    if (!card) return
    selectedCardId = card.id
    sound.cardSlide()
    setMode('BUILD')
    let def = focusedCity ? CITY_BY_ID.get(focusedCity) : undefined
    if (card.cityId) {
      def = CITY_BY_ID.get(card.cityId)
      if (def) {
        focusCity(def.id)
        spawnLocatorPulse(def)
      }
    } else if (!def) {
      def = CITY_BY_ID.get('birmingham')
    }
    if (!def) return
    const s = projectToScreen(new THREE.Vector3(def.x, NODE_TOP + 1.1, def.z))
    hud.closePopover()
    openCityPopover(def, s.x, s.y) // preview → confirm lives here
    hud.refresh(state, mode, selectedCardId)
  }

  function flushPreview(): void {
    // Fires only if the selection survived the double-click window and the
    // seat is still valid — otherwise it silently dissolves.
    const id = pendingPreviewId
    pendingPreviewId = null
    if (!id || selectedCardId !== id) return
    if (phase !== 'game' || busy || state.over || gamePaused) return
    if (!isHumanTurn()) return
    const card = currentPlayer(state).hand.find((c) => c.id === id)
    if (!card) return
    setMode('BUILD')
    if (card.cityId) {
      const def = CITY_BY_ID.get(card.cityId)
      if (def) {
        focusCity(def.id)
        spawnLocatorPulse(def)
        sound.chime(def.x, 1.2, def.z)
      }
    }
  }
  let lastSeed = 1
  let lastTrackId = 'canal-hum'

  function startMatch(seats: SeatSpec[]): void {
    lastSeats = seats
    lastSeed = (Math.random() * 2 ** 31) | 0
    state = createInitialGameState(seats, lastSeed)
    mode = 'idle'
    selectedCardId = null
    busy = true // locked until the opening sequence completes
    pendingEraShow = false
    aiTimer = null
    finalRevealDone = false
    savedCam = null
    focusedCity = null
    doubleRailStage = 0
    firstRailId = null
    pendingBuildOption = null
    hud.closePopover()
    hud.hideOverlay()
    resetBoardVisuals()
    phase = 'opening'
    document.body.classList.remove('pre-game')
    screens.hideAll()
    controls.autoRotate = false
    controls.enabled = false
    camera.position.set(0, 30, 44)
    controls.target.set(0.8, 0.2, -0.4)
    history.pushState({ kb: 'game' }, '')
    hud.refresh(state, mode, selectedCardId)
    syncBoard(false)
    syncRoutes()
    syncPawns()
    buildSupplyMats()
    lastTrackId = pickTrack(['canal-hum', 'loom-and-lathe'])
    music.setTrack(lastTrackId)
    runOpeningSequence(() => {
      phase = 'game'
      busy = false
      controls.enabled = true
      renderer.toneMappingExposure = 0.82
      camera.position.set(3, 17, 20)
      hud.refresh(state, mode, selectedCardId)
      renderTray()
    })
  }

  // Short premium opening: dark room → lamp warms → table descends →
  // pawns arrive → cards deal → CANAL ERA · ROUND 1. ~3.6s, click skips.
  let openingTl: gsap.core.Timeline | null = null
  function runOpeningSequence(onDone: () => void): void {
    const ov = document.getElementById('overlay') as HTMLElement
    ov.className = 'opening'
    ov.classList.remove('hidden')
    ov.innerHTML = `
      <div class="open-line">THE MIDLANDS · 1770</div>
      <div class="open-big">CANAL ERA</div>
      <div class="open-round" id="openRound"></div>`

    const roundEl = document.getElementById('openRound') as HTMLElement
    window.setTimeout(() => { if (roundEl.isConnected) roundEl.textContent = 'ROUND 1 — ONE ACTION EACH' }, 2100)

    // Deal-in stagger for the hand once it exists.
    const handEl = document.getElementById('hand')
    handEl?.classList.add('deal')

    const cam = { e: 0.16 }
    openingTl = gsap.timeline({ onComplete: finish })
    openingTl.to(camera.position, { x: 3, y: 17, z: 20, duration: 2.4, ease: 'power2.inOut' }, 0)
    openingTl.to(cam, {
      e: 0.82,
      duration: 2.2,
      ease: 'power1.inOut',
      onUpdate: () => {
        renderer.toneMappingExposure = cam.e
        lampLight.intensity = 26 * Math.min(1, cam.e * 1.35)
      },
    }, 0.2)
    pawns.forEach((p, i) => {
      p.group.position.y = p.baseY + 4
      openingTl!.to(p.group.position, { y: p.baseY, duration: 0.7, ease: 'power2.out' }, 1.1 + i * 0.14)
      // Each seat lantern ignites as its player arrives — wick, then warmth.
      const lantern = seatLanterns[i]
      if (lantern) {
        const boost = { v: 0 }
        openingTl!.to(boost, {
          v: 1,
          duration: 0.9,
          ease: 'power2.out',
          onStart: () => sound.click(lantern.getWorldPosition(tmpV).x, 1.8, lantern.getWorldPosition(tmpV).z),
          onUpdate: () => {
            lantern.userData.boost = boost.v
          },
        }, 1.35 + i * 0.22)
      }
    })

    function finish(): void {
      openingTl = null
      handEl?.classList.remove('deal')
      ov.classList.add('hidden')
      ov.innerHTML = ''
      onDone()
    }
    const skip = (): void => {
      const tl = openingTl
      if (tl) {
        tl.progress(1)
        tl.kill()
        finish()
      }
      renderer.domElement.removeEventListener('click', skip)
    }
    renderer.domElement.addEventListener('click', skip)
  }

  function backHome(): void {
    phase = 'home'
    hud.closePopover()
    unfocus()
    screens.showLobby(false)
    screens.showPanel(null)
    refreshResumeSaved()
    controls.autoRotate = true
    gsap.to(camera.position, { x: 0, y: 17.5, z: 21, duration: 1.2, ease: 'power2.inOut' })
    gsap.to(controls.target, { x: 0, y: 0.3, z: -0.4, duration: 1.2, ease: 'power2.inOut' })
    music.setScene('home')
  }

  const personalityNames = ['Boulton', 'Watt', 'Arkwright']
  const screens = new Screens({
    onQuickPlay: ({ name, aiCount, difficulty, personality }) => {
      const seats: SeatSpec[] = [{ name, isAI: false }]
      for (let i = 0; i < aiCount; i++) {
        seats.push({
          name: personalityNames[i % personalityNames.length],
          isAI: true,
          personality,
          difficulty,
        })
      }
      startMatch(seats)
    },    onCreateTable: (name) => {
      currentTable = createTable(name)
      phase = 'lobby'
      screens.showPanel(null)
      screens.showLobby(true)
      screens.renderLobby(currentTable)
      music.setScene('lobby')
    },
    onJoin: (code, name): string | null => {
      const r = joinTable(code, name)
      if (!r.ok) return screens.joinMessage(r.reason)
      currentTable = r.table
      phase = 'lobby'
      screens.showPanel(null)
      screens.showLobby(true)
      screens.renderLobby(currentTable)
      music.setScene('lobby')
      return null
    },
    onStartLobby: () => {
      if (!currentTable || currentTable.seats.length < 2) return
      markStarted(currentTable)
      startMatch(currentTable.seats)
    },
    onAddAI: () => {
      if (!currentTable) return
      addAI(currentTable)
      screens.renderLobby(currentTable)
    },
    onRemoveAI: () => {
      if (!currentTable) return
      removeAI(currentTable)
      screens.renderLobby(currentTable)
    },
    onLeaveLobby: () => {
      currentTable = null
      location.href = './' // deterministic: LOBBY → HOME page
    },    onMusic: (on) => {
      audioUI.music = on
      applyAudio()
    },
    onSfx: (on) => {
      audioUI.sfx = on
      applyAudio()
    },
    onMusicVol: (v) => {
      audioUI.mVol = v
      applyAudio()
    },
    onSfxVol: (v) => {
      audioUI.sVol = v
      applyAudio()
    },
  })

  // Deep-link entry from the workshop home page: /kinetic.html#create|join|ai
  {
    const h = location.hash.replace('#', '')
    if (h === 'create') screens.showPanel('create')
    else if (h === 'join') screens.showPanel('join')
    else if (h === 'ai') screens.showPanel('create', { ai: true })
    else screens.showPanel(null)
  }

  // Browser Back during a match must NEVER spawn a fresh game — it asks.
  window.addEventListener('popstate', () => {
    if (phase === 'game' && !state.over) {
      hud.confirmLeave(
        () => history.pushState({ kb: 'game' }, ''),
        () => {
          location.href = './'
        },
      )
    } else if (phase === 'game' || phase === 'results') {
      history.pushState({ kb: 'game' }, '')
    }
  })

  // Escape leaves any contextual selection and restores the strategic frame.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const lp = document.getElementById('logPanel')
      if (lp?.classList.contains('open')) {
        lp.classList.remove('open')
        return
      }
      if (mode !== 'idle') {
        hud.closePopover()
        unfocus()
        setMode('idle')
        renderTray()
      }
    }
  })

  // Respect autoplay policies: audio wakes once, on the first gesture.
  const audioKick = (): void => {
    applyAudio()
    window.removeEventListener('pointerdown', audioKick)
  }
  window.addEventListener('pointerdown', audioKick)

  // Debug audit panel (` key).
  function updateDebug(): void {
    const playable = CITIES.filter((c) => c.slots > 0)
    const major = CITIES.filter((c) => c.kind === 'city' && c.slots >= 2)
    const special = CITIES.filter((c) => c.kind === 'merchant' || c.kind === 'farm-brewery')
    const canalData = LINKS.filter((l) => l.era === 'canal').length
    const railData = LINKS.filter((l) => l.era === 'rail').length
    const canalBuilt = [...routes.values()].filter((r) =>
      LINKS.find((l) => l.id === r.id && l.era === 'canal'),
    ).length
    const railBuilt = routes.size - canalBuilt
    const slotSum = CITIES.reduce((n, c) => n + c.slots, 0)
    const legal = legalActions(state, currentPlayer(state).id)
    screens.setDebug(`
<b>MAP AUDIT</b>  (official player-aid derived)
Playable locations: ${playable.length} data / ${nodes.length} rendered
Major cities:       ${major.length} data / ${major.filter((c) => c.slots > 0).length} rendered
Edge/special:       ${special.length} data / ${special.filter((c) => c.slots > 0).length} nodes (+${special.filter((c) => c.slots === 0).length} map-art beacons)
Canal connections:  ${canalData} data / ${canalBuilt} built
Railway connections:${railData} data / ${railBuilt} built
Industry slots:     ${slotSum}

<b>SESSION</b>
Phase: ${phase} · Era: ${state.era} · Round: ${state.round}
Current: ${currentPlayer(state).name}${currentPlayer(state).isAI ? ' (AI)' : ''}
Legal: ${Object.entries(legal).filter(([, v]) => v).map(([k]) => k).join(', ') || '—'}

<b>REVEAL</b>
Torches lit: ${[...torchTarget.values()].filter((v) => v > 0).length}
Routes lit: ${segIntensity.size} · Global reveal: ${(revealUniforms.uGlobal.value * 100) | 0}%
<b>AUDIO/HAND</b>
Track: ${music.currentTrack}
Hand cards: ${currentPlayer(state).hand.length} · Context cards: ${document.querySelectorAll('#contextHand .ctcard').length}`)
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') {
      const p = document.getElementById('debugPanel')!
      const willShow = p.classList.contains('hidden')
      screens.toggleDebug(willShow)
      if (willShow) updateDebug()
    }
  })

  // ------------------------------ Table & Board -----------------------------

  const sky = buildSkyline()
  scene.add(sky)

  // --------------------------- Workshop room ---------------------------------
  // Walls give the darkness structure; the north wall carries an original
  // engraved chronicle mural whose visibility grows with the reveal.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0e0a07, roughness: 0.97 })
  const northWall = new THREE.Mesh(new THREE.PlaneGeometry(64, 16), wallMat)
  northWall.position.set(0, 7.4, -26)
  scene.add(northWall)
  const westWall = new THREE.Mesh(new THREE.PlaneGeometry(52, 16), wallMat)
  westWall.rotation.y = Math.PI / 2
  westWall.position.set(-30, 7.4, -6)
  scene.add(westWall)
  const eastWall = westWall.clone()
  eastWall.rotation.y = -Math.PI / 2
  eastWall.position.x = 30
  scene.add(eastWall)

  const muralMat = new THREE.MeshStandardMaterial({
    map: makeMuralTexture(),
    color: 0x9a8a70,
    roughness: 0.9,
    emissive: 0x8a6a3a,
    emissiveIntensity: 0.06,
    emissiveMap: makeMuralTexture(),
  })
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(22, 8.25), muralMat)
  mural.position.set(2, 8.1, -25.85)
  scene.add(mural)

  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(23.5, 24.5, 0.6, 56),
    new THREE.MeshStandardMaterial({ color: PAL.table, roughness: 0.96 }),
  )
  table.position.y = -0.42
  scene.add(table)

  let mapTex = makeMapTexture(state.era)
  const boardSideMat = new THREE.MeshStandardMaterial({ color: PAL.walnut, roughness: 0.9 })

  // ---- TORCH-LIT REVEAL BOARD --------------------------------------------
  // The parchment is a dormant engraving until industry wakes it.
  // Point lights (torches) + capsule lights (owned routes) accumulate in
  // shader-space; brightness/warmth are earned, never free.
  const MAX_LIGHTS = 28
  const MAX_SEGS = 24
  const revealUniforms = {
    tMap: { value: mapTex as THREE.Texture },
    uCount: { value: 0 },
    uLights: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4(0, 0, 0, 3)) },
    uSegN: { value: 0 },
    uSegs: { value: Array.from({ length: MAX_SEGS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uSegI: { value: new Array(MAX_SEGS).fill(0) as number[] },
    uGlobal: { value: 0 },
    uTime: { value: 0 },
  }
  const boardTopMat = new THREE.ShaderMaterial({
    uniforms: revealUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vW;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tMap;
      uniform int uCount;
      uniform vec4 uLights[${MAX_LIGHTS}];   // x, z, intensity, radius
      uniform int uSegN;
      uniform vec4 uSegs[${MAX_SEGS}];       // ax, az, bx, bz
      uniform float uSegI[${MAX_SEGS}];
      uniform float uGlobal;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vW;

      float segDist(vec2 p, vec4 s){
        vec2 pa = s.xy, ba = s.zw - s.xy;
        float h = clamp(dot(p - pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
        return distance(p, pa + ba * h);
      }

      void main(){
        vec3 tex = texture2D(tMap, vUv).rgb;

        float reveal = 0.0;
        vec3 warm = vec3(0.0);
        for (int i = 0; i < ${MAX_LIGHTS}; i++) {
          if (i >= uCount) break;
          vec4 l = uLights[i];
          if (l.z <= 0.001) continue;
          float d = distance(vW.xz, l.xy);
          float f = smoothstep(l.w, l.w * 0.18, d) * l.z;
          float fl = 0.92 + 0.08 * sin(uTime * 8.3 + float(i) * 2.1)
                           + 0.04 * sin(uTime * 23.7 + float(i));
          reveal += f;
          warm += f * fl * vec3(1.0, 0.72, 0.38);
        }
        for (int i = 0; i < ${MAX_SEGS}; i++) {
          if (i >= uSegN) break;
          if (uSegI[i] <= 0.001) continue;
          float d = segDist(vW.xz, uSegs[i]);
          float w = 0.55 + uSegI[i] * 0.5;
          float f = smoothstep(w, w * 0.15, d) * uSegI[i];
          reveal += f * 0.85;
          warm += f * vec3(0.95, 0.66, 0.32);
        }

        reveal = clamp(reveal, 0.0, 1.0) * (0.35 + 0.65 * uGlobal + 0.65);
        reveal = clamp(reveal, 0.0, 1.0);

        vec3 dormant = tex * vec3(0.40, 0.42, 0.50);            // cool, sleeping
        vec3 lit     = tex * 1.14 + tex * tex * 0.16;           // awake engraving
        vec3 col = mix(dormant, lit, reveal);
        col += warm * 0.10;                                     // firelight kiss

        gl_FragColor = vec4(col, 1.0);
      }`,
  })

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_W, 0.22, BOARD_D),
    [boardSideMat, boardSideMat, boardTopMat, boardSideMat, boardSideMat, boardSideMat],
  )
  board.position.y = BOARD_TOP - 0.11
  scene.add(board)

  // Brass framing strips.
  const frameMat = new THREE.MeshStandardMaterial({ color: PAL.brass, roughness: 0.35, metalness: 0.9 })
  const mkFrame = (w: number, d: number, x: number, z: number): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), frameMat)
    m.position.set(x, BOARD_TOP + 0.005, z)
    scene.add(m)
  }
  mkFrame(BOARD_W + 0.3, 0.15, 0, -BOARD_D / 2 - 0.07)
  mkFrame(BOARD_W + 0.3, 0.15, 0, BOARD_D / 2 + 0.07)
  mkFrame(0.15, BOARD_D + 0.3, -BOARD_W / 2 - 0.07, 0)
  mkFrame(0.15, BOARD_D + 0.3, BOARD_W / 2 + 0.07, 0)

  // City nodes.
  interface NodeRec {
    def: CityDef
    group: THREE.Group
    rimMat: THREE.MeshStandardMaterial
    label: THREE.Sprite
  }
  const nodes: NodeRec[] = []
  const nodePickables: THREE.Object3D[] = []
  const walnutMat = new THREE.MeshStandardMaterial({ color: PAL.walnut, roughness: 0.88 })
  const socketMat = new THREE.MeshStandardMaterial({ color: 0x151009, roughness: 1 })

  for (const def of CITIES) {
    const g = new THREE.Group()
    g.position.set(def.x, BOARD_TOP + 0.09, def.z)
    if (def.slots === 0) continue // merchant beacons: map art only, no 3D node
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.88, 0.14, 24), walnutMat)
    base.userData.cityId = def.id
    g.add(base)

    const rimMat = new THREE.MeshStandardMaterial({
      color: PAL.brass,
      roughness: 0.4,
      metalness: 0.85,
      emissive: PAL.brass,
      emissiveIntensity: 0,
    })
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.03, 8, 36), rimMat)
    rimRing.rotation.x = Math.PI / 2
    rimRing.userData.cityId = def.id
    g.add(rimRing)
    if (def.merchant) {
      const inner = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.013, 6, 30), frameMat)
      inner.rotation.x = Math.PI / 2
      g.add(inner)
    }

    for (let i = 0; i < def.slots; i++) {
      const off = slotOffset(i, def.slots)
      const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.03, 16), socketMat)
      socket.position.set(off.x, 0.085, off.y)
      g.add(socket)
    }

    const label = makeLabelSprite(def.name, {
      scale: def.lp ?? 0.85,
      muted: def.kind === 'merchant' || def.kind === 'farm-brewery',
    })
    label.position.set(def.lx ?? 0, def.ly ?? 1.15, 0)
    g.add(label)

    scene.add(g)
    nodes.push({ def, group: g, rimMat, label })
    nodePickables.push(base, rimRing)
  }

  // Route visuals.
  const routes = new Map<string, RouteVis>()
  const linkPickables: THREE.Object3D[] = []
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1b2836, roughness: 0.25, metalness: 0.15 })
  const waterLite = new THREE.MeshStandardMaterial({ color: 0x2b3f52, roughness: 0.3 })
  const railBedMat = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.95 })
  const railSteel = new THREE.MeshStandardMaterial({ color: 0x7d828b, roughness: 0.3, metalness: 0.95 })

  for (const l of LINKS) {
    const A = CITY_BY_ID.get(l.a)!
    const B = CITY_BY_ID.get(l.b)!
    const dx = B.x - A.x
    const dz = B.z - A.z
    const dist = Math.hypot(dx, dz)
    const ang = Math.atan2(dz, dx)
    const group = new THREE.Group()
    group.position.set((A.x + B.x) / 2, BOARD_TOP + 0.115, (A.z + B.z) / 2)
    group.rotation.y = -ang

    const isCanal = l.era === 'canal'
    if (isCanal) {
      const channel = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.05, 0.3), waterMat)
      group.add(channel)
      const sheen = new THREE.Mesh(new THREE.BoxGeometry(dist * 0.96, 0.052, 0.1), waterLite)
      sheen.position.y = 0.002
      group.add(sheen)
    } else {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.06, 0.42), railBedMat)
      group.add(bed)
      for (const off of [-0.13, 0.13]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.025, 0.035), railSteel)
        rail.position.set(0, 0.042, off)
        group.add(rail)
      }
      const sleeperCount = Math.floor(dist / 0.42)
      const sleepers = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.07, 0.02, 0.34),
        new THREE.MeshStandardMaterial({ color: PAL.darkWood, roughness: 1 }),
        sleeperCount,
      )
      const m4 = new THREE.Matrix4()
      for (let i = 0; i < sleeperCount; i++) {
        m4.setPosition(-dist / 2 + 0.21 + i * 0.42, -0.01, 0)
        sleepers.setMatrixAt(i, m4)
      }
      sleepers.instanceMatrix.needsUpdate = true
      group.add(sleepers)
      group.visible = false // arrives with the Railway Era
    }

    // Ownership accent + legality halo.
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.2,
      transparent: true,
      opacity: 0.9,
    })
    const accent = new THREE.Mesh(new THREE.BoxGeometry(dist * 0.985, 0.018, 0.1), accentMat)
    accent.position.y = isCanal ? 0.032 : 0.058
    accent.visible = false
    group.add(accent)

    const hlMat = new THREE.MeshStandardMaterial({
      color: PAL.brassBright,
      transparent: true,
      opacity: 0.0,
      emissive: PAL.brassBright,
      emissiveIntensity: 0.5,
    })
    const hl = new THREE.Mesh(new THREE.BoxGeometry(dist * 1.0, 0.02, 0.46), hlMat)
    hl.position.y = 0.045
    group.add(hl)

    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(dist + 0.25, 0.5, 0.85),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    hitbox.userData.linkId = l.id
    group.add(hitbox)
    linkPickables.push(hitbox)

    scene.add(group)
    routes.set(l.id, { id: l.id, group, accent, hl, hlMat })
  }

  // Industry pieces live here.
  const piecesGroup = new THREE.Group()
  scene.add(piecesGroup)
  const pieces = new Map<string, PieceEntry>()
  const puff = new PuffSystem(pixelRatio)
  scene.add(puff.points)
  const steam = new SteamColumns(pixelRatio, sky)
  scene.add(steam.points)

  // Dust motes.
  const dustCount = 130
  const dustPos = new Float32Array(dustCount * 3)
  const dustSeed = new Float32Array(dustCount)
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 26
    dustPos[i * 3 + 1] = Math.random() * 7
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 26
    dustSeed[i] = Math.random()
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1))
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPR;
      varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(p.y + aSeed * 7.0 + uTime * 0.16, 7.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.0 + aSeed * 1.8) * uPR * (26.0 / -mv.z);
        vA = 0.04 + aSeed * 0.08;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float m = smoothstep(0.5, 0.0, length(uv));
        gl_FragColor = vec4(vec3(0.9,0.75,0.5), m * vA);
      }`,
    uniforms: { uTime: { value: 0 }, uPR: { value: pixelRatio } },
    transparent: true,
    depthWrite: false,
  })
  const dust = new THREE.Points(dustGeo, dustMat)
  dust.frustumCulled = false
  scene.add(dust)

  // --------------------------- Reveal state ---------------------------------
  // Derived purely from game state: industries light torches, owned links
  // carry warmth between them. Reset clears everything back to embers-out.
  const torchTarget = new Map<string, number>()
  const torchCur = new Map<string, number>()
  const segIntensity = new Map<string, number>()

  function computeReveal(): void {
    torchTarget.clear()
    for (const p of state.placed) {
      torchTarget.set(p.cityId, Math.min(2.2, (torchTarget.get(p.cityId) ?? 0) + 1))
    }
    segIntensity.clear()
    for (const l of LINKS) {
      const owner = state.linksOwned[l.id]
      if (!owner) continue
      const ta = torchCur.get(l.a) ?? torchTarget.get(l.a) ?? 0
      const tb = torchCur.get(l.b) ?? torchTarget.get(l.b) ?? 0
      const feed = Math.min(1, (ta + tb) / 1.6)
      segIntensity.set(l.id, (l.era === 'rail' ? 0.62 : 0.46) * (0.35 + 0.65 * feed))
    }
  }

  function uploadReveal(t: number): void {
    let n = 0
    for (const def of CITIES) {
      if (n >= MAX_LIGHTS) break
      const target = torchTarget.get(def.id) ?? 0
      const cur = torchCur.get(def.id) ?? 0
      const next = cur + (target - cur) * 0.02
      torchCur.set(def.id, next)
      if (target > 0 || next > 0.01) {
        const v = revealUniforms.uLights.value[n]
        v.set(def.x, def.z, next * 0.9, 2.6 + next * 0.7)
        n++
      }
    }
    revealUniforms.uCount.value = n

    let si = 0
    for (const l of LINKS) {
      if (si >= MAX_SEGS) break
      const inten = segIntensity.get(l.id)
      if (!inten) continue
      const A = CITY_BY_ID.get(l.a)!
      const B = CITY_BY_ID.get(l.b)!
      revealUniforms.uSegs.value[si].set(A.x, A.z, B.x, B.z)
      revealUniforms.uSegI.value[si] = inten * (0.8 + 0.2 * Math.sin(t * 1.7 + si))
      si++
    }
    revealUniforms.uSegN.value = si
    revealUniforms.uTime.value = t
  }

  // --------------------------- Player pawns ----------------------------------
  // Physical character pieces with engraved brass nameplates — identity
  // lives on the table, not in a HUD card.
  interface Pawn {
    group: THREE.Group
    ringMat: THREE.MeshStandardMaterial
    plateMat: THREE.MeshStandardMaterial
    baseY: number
  }
  const pawnGroup = new THREE.Group()
  scene.add(pawnGroup)
  let pawns: Pawn[] = []
  let seatLanterns: THREE.PointLight[] = []
  const plateTexCache = new Map<string, THREE.Texture>()

  function nameplateTexture(name: string, css: string): THREE.Texture {
    const key = `${name}|${css}`
    const hit = plateTexCache.get(key)
    if (hit) return hit
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const g = c.getContext('2d')!
    g.fillStyle = '#241b13'
    g.fillRect(0, 0, 256, 64)
    g.strokeStyle = '#b88a38'
    g.lineWidth = 3
    g.strokeRect(4, 4, 248, 56)
    g.font = 'bold 30px Georgia'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.shadowColor = 'rgba(0,0,0,.9)'
    g.shadowBlur = 4
    g.fillStyle = css
    g.fillText(name.toUpperCase().split('').join('\u200a'), 128, 33)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    plateTexCache.set(key, tex)
    return tex
  }

  const PAWN_ANCHORS: [number, number][] = [
    [7.8, BOARD_D / 2 + 3.1],
    [-8.2, -BOARD_D / 2 - 3.1],
    [-7.8, BOARD_D / 2 + 3.1],
    [8.2, -BOARD_D / 2 - 3.1],
  ]

  function createPawn(name: string, css: string, hex: number, idx: number): Pawn {
    const group = new THREE.Group()
    const [ax, az] = PAWN_ANCHORS[idx % PAWN_ANCHORS.length]
    group.position.set(ax, 0.45, az)
    group.rotation.y = Math.atan2(-ax, -az)

    const woodBase = new THREE.MeshStandardMaterial({ color: PAL.walnut, roughness: 0.85 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.16, 18), woodBase)
    base.position.y = 0.08

    const bodyMat = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.45,
      metalness: 0.55,
      emissive: hex,
      emissiveIntensity: 0.05,
    })
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.02, 0),
      new THREE.Vector2(0.34, 0.03),
      new THREE.Vector2(0.26, 0.12),
      new THREE.Vector2(0.19, 0.32),
      new THREE.Vector2(0.145, 0.52),
      new THREE.Vector2(0.22, 0.66),
      new THREE.Vector2(0.13, 0.72),
    ]
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), bodyMat)
    body.position.y = 0.16
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.04, 8, 18), brassMat)
    collar.rotation.x = Math.PI / 2
    collar.position.y = 0.86
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 10), bodyMat)
    head.position.y = 1.02

    const ringMat = new THREE.MeshStandardMaterial({
      color: PAL.brass,
      emissive: PAL.brassBright,
      emissiveIntensity: 0,
      roughness: 0.4,
      metalness: 0.85,
    })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.032, 8, 40), ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.05

    const plateMat = new THREE.MeshStandardMaterial({
      map: nameplateTexture(name, css),
      roughness: 0.7,
      emissive: 0xffffff,
      emissiveMap: nameplateTexture(name, css),
      emissiveIntensity: 0,
    })
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.44), [
      woodBase,
      woodBase,
      plateMat,
      woodBase,
      woodBase,
      woodBase,
    ])
    plate.position.set(0, 0.02, 0)

    group.add(base, body, collar, head, ring, plate)
    pawnGroup.add(group)
    return { group, ringMat, plateMat, baseY: 0.45 }
  }

  function syncPawns(): void {
    for (const p of pawns) {
      pawnGroup.remove(p.group)
      p.group.traverse((o) => {
        if (o instanceof THREE.Mesh && o.geometry && !(o.geometry instanceof THREE.LatheGeometry))
          o.geometry.dispose()
      })
    }
    pawns = []
    seatLanterns = []
    state.players.forEach((pl, i) => {
      const pawn = createPawn(pl.name, pl.css, pl.colorHex, i)
      // Player-scaled practical light: one lantern per seated player.
      const lantern = new THREE.PointLight(0xffa860, 0, 12, 2)
      lantern.position.set(0, 1.5, 0)
      lantern.userData.boost = 0
      lantern.userData.seed = i * 2.3
      pawn.group.add(lantern)
      seatLanterns.push(lantern)
      pawns.push(pawn)
    })
  }

  function pieceAnchor(def: CityDef, slot: number): THREE.Vector3 {
    const off = slotOffset(slot, def.slots)
    return new THREE.Vector3(def.x + off.x, NODE_TOP, def.z + off.y)
  }

  function syncBoard(animateNew: boolean): void {
    for (const placed of state.placed) {
      const existing = pieces.get(placed.key)
      const def = CITY_BY_ID.get(placed.cityId)!
      if (!existing) {
        const owner = playerById(state, placed.ownerId)
        const vis = createIndustryPiece(placed.kind, placed.level, owner.css, owner.colorHex)
        const anchor = pieceAnchor(def, placed.slot)
        vis.group.position.copy(anchor)
        vis.hitbox.userData.pieceKey = placed.key
        const shadow = contactShadow(0.42)
        shadow.position.set(anchor.x, NODE_TOP + 0.005, anchor.z)
        piecesGroup.add(shadow)
        piecesGroup.add(vis.group)

        // Every industry carries its own small fire — part of the reveal.
        const flame = makeFlame()
        flame.position.set(
          (Math.random() - 0.5) * 0.14,
          placed.kind === 'iron' ? 0.78 : 0.72,
          (Math.random() - 0.5) * 0.14,
        )
        flame.userData.seed = Math.random() * 10
        vis.group.add(flame)
        const entry: PieceEntry = { vis, data: placed, hitbox: vis.hitbox, shadow, flame }
        pieces.set(placed.key, entry)
        if (animateNew) {
          const gy = vis.group.position.y
          vis.group.position.y = gy + 1.5
          gsap.to(vis.group.position, {
            y: gy,
            duration: 0.5,
            ease: 'power2.in',
            onComplete: () => {
              gsap.fromTo(
                vis.group.scale,
                { x: vis.group.scale.x * 1.12, y: vis.group.scale.y * 0.82, z: vis.group.scale.z * 1.12 },
                { x: vis.group.scale.x, y: vis.group.scale.y, z: vis.group.scale.z, duration: 0.55, ease: 'elastic.out(1,0.45)' },
              )
              puff.burst(anchor, 16, 0.4)
              sound.woodPlace(anchor.x, anchor.y, anchor.z)
            },
          })
        }
      } else if (placed.flipped && !existing.data.flipped) {
        const g = existing.vis.group
        gsap.to(g.rotation, { y: g.rotation.y + Math.PI, duration: 0.6, ease: 'power2.inOut' })
        const grey = new THREE.Color(0x4a4440)
        existing.vis.flagMat.color.lerp(grey, 0.72)
        for (const tm of existing.vis.trimMats) tm.color.lerp(grey, 0.72)
      }
      if (existing) existing.data = placed
    }
    // Era cleanup removes obsolete L1 industries — prune their visuals.
    const live = new Set(state.placed.map((t) => t.key))
    for (const [key, entry] of [...pieces]) {
      if (!live.has(key)) {
        piecesGroup.remove(entry.vis.group)
        piecesGroup.remove(entry.shadow)
        pieces.delete(key)
      }
    }
    computeReveal()
    updateTableEcosystem()
  }

  // ------------------- Player mats · decks · discard ------------------------
  // Physical evidence of the real rule-engine supplies and card piles.
  interface SupplyMat {
    group: THREE.Group
    supply: THREE.Group
  }
  const ecosystem = new THREE.Group()
  scene.add(ecosystem)
  let supplyMats: SupplyMat[] = []
  let deckStack: THREE.Group | null = null
  let discardStack: THREE.Group | null = null

  function miniIndustry(kind: IndustryType): THREE.Mesh {
    const mk = (
      color: number,
      opts?: Partial<THREE.MeshStandardMaterialParameters>,
      geo?: THREE.BufferGeometry,
    ): THREE.Mesh => {
      const m = new THREE.Mesh(
        geo ?? new THREE.BoxGeometry(0.15, 0.11, 0.11),
        new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts }),
      )
      m.userData.kind = kind
      return m
    }
    switch (kind) {
      case 'coal': return mk(0x1a1b20)
      case 'iron': return mk(0x9aa0aa, { metalness: 0.6, roughness: 0.35 }, new THREE.BoxGeometry(0.2, 0.09, 0.12))
      case 'cotton': return mk(0xd9d2bd)
      case 'manufacturer': return mk(0x6b4a28)
      case 'pottery': return mk(0x8a4a30, {}, new THREE.ConeGeometry(0.09, 0.16, 7))
      case 'brewery': return mk(0x4a3018, {}, new THREE.CylinderGeometry(0.08, 0.08, 0.15, 9))
    }
  }

  function buildSupplyMats(): void {
    for (const m of supplyMats) ecosystem.remove(m.group)
    if (deckStack) ecosystem.remove(deckStack)
    if (discardStack) ecosystem.remove(discardStack)
    supplyMats = []
    state.players.forEach((pl, i) => {
      const [ax, az] = PAWN_ANCHORS[i % PAWN_ANCHORS.length]
      const group = new THREE.Group()
      group.position.set(ax * 0.66, BOARD_TOP + 0.03, az * 0.78)
      group.rotation.y = Math.atan2(-group.position.x, -group.position.z)
      const rim = new THREE.Mesh(
        new THREE.BoxGeometry(2.42, 0.06, 1.62),
        new THREE.MeshStandardMaterial({ color: PAL.walnut, roughness: 0.88 }),
      )
      const face = new THREE.Mesh(
        new THREE.BoxGeometry(2.28, 0.02, 1.48),
        new THREE.MeshStandardMaterial({ color: 0xcdbf9f, roughness: 0.95 }),
      )
      face.position.y = 0.04
      const supply = new THREE.Group()
      group.add(rim, face, supply)
      ecosystem.add(group)
      supplyMats.push({ group, supply })
    })
    const edgeZ = BOARD_D / 2 + 2.1
    deckStack = new THREE.Group()
    deckStack.position.set(BOARD_W / 2 - 2.6, BOARD_TOP + 0.02, edgeZ)
    discardStack = new THREE.Group()
    discardStack.position.set(-BOARD_W / 2 + 2.6, BOARD_TOP + 0.02, edgeZ)
    ecosystem.add(deckStack, discardStack)
    updateTableEcosystem()
  }

  function updateTableEcosystem(): void {
    supplyMats.forEach((m, i) => {
      const pl = state.players[i]
      if (!pl) return
      m.supply.clear()
      const kinds: IndustryType[] = ['coal', 'iron', 'cotton', 'manufacturer', 'pottery', 'brewery']
      kinds.forEach((kind, col) => {
        const total = pl.supply[kind].l1 + pl.supply[kind].l2
        const show = Math.min(total, 4)
        for (let k = 0; k < show; k++) {
          const piece = miniIndustry(kind)
          piece.position.set(-0.95 + col * 0.38, 0.09 + Math.floor(k / 2) * 0.13, k % 2 === 0 ? -0.12 : 0.1)
          m.supply.add(piece)
        }
      })
    })
    const fill = (grp: THREE.Group | null, count: number): void => {
      if (!grp) return
      grp.clear()
      const n = Math.min(count, 10)
      for (let i = 0; i < n; i++) {
        const c = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 0.02, 0.9),
          new THREE.MeshStandardMaterial({ color: 0xcdbf9f, roughness: 0.92 }),
        )
        c.position.y = i * 0.022
        c.rotation.y = Math.sin(i * 12.9898) * 0.06
        grp.add(c)
      }
    }
    fill(deckStack, state.deck.length)
    fill(discardStack, state.discard.length)
  }

  function syncRoutes(): void {
    for (const l of LINKS) {
      const rv = routes.get(l.id)!
      const ownerId = state.linksOwned[l.id]
      if (ownerId) {
        const owner = playerById(state, ownerId)
        ;(rv.accent.material as THREE.MeshStandardMaterial).color.set(owner.colorHex)
        rv.accent.visible = true
      } else {
        rv.accent.visible = false
      }
    }
    computeReveal()
  }

  // ------------------------------- Camera focus ------------------------------

  let savedCam: { pos: THREE.Vector3; tgt: THREE.Vector3 } | null = null
  let focusedCity: string | null = null

  function focusCity(id: string): void {
    const def = CITY_BY_ID.get(id)!
    if (!savedCam && focusedCity !== id) {
      savedCam = { pos: camera.position.clone(), tgt: controls.target.clone() }
    }
    focusedCity = id
    const tgt = new THREE.Vector3(def.x, 0.4, def.z)
    const dir = camera.position.clone().sub(tgt)
    dir.y = Math.max(dir.y, dir.length() * 0.55)
    dir.normalize().multiplyScalar(8.2)
    gsap.to(controls.target, { x: tgt.x, y: tgt.y, z: tgt.z, duration: 0.9, ease: 'power3.inOut' })
    gsap.to(camera.position, { x: tgt.x + dir.x, y: tgt.y + dir.y, z: tgt.z + dir.z, duration: 0.9, ease: 'power3.inOut' })
  }

  function unfocus(): void {
    if (!savedCam) return
    focusedCity = null
    gsap.to(controls.target, { x: savedCam.tgt.x, y: savedCam.tgt.y, z: savedCam.tgt.z, duration: 0.9, ease: 'power3.inOut' })
    gsap.to(camera.position, {
      x: savedCam.pos.x,
      y: savedCam.pos.y,
      z: savedCam.pos.z,
      duration: 0.9,
      ease: 'power3.inOut',
      onComplete: () => {
        savedCam = null
      },
    })
  }

  // One elegant brass locator ring — never a constant blink.
  let pulseRing: THREE.Mesh | null = null
  function spawnLocatorPulse(def: CityDef): void {
    if (pulseRing) {
      scene.remove(pulseRing)
      pulseRing.geometry.dispose()
      ;(pulseRing.material as THREE.Material).dispose()
    }
    const mat = new THREE.MeshBasicMaterial({
      color: PAL.brassBright,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    pulseRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.035, 8, 44), mat)
    pulseRing.rotation.x = Math.PI / 2
    pulseRing.position.set(def.x, NODE_TOP + 0.06, def.z)
    scene.add(pulseRing)
    gsap.fromTo(
      pulseRing.scale,
      { x: 0.5, y: 0.5, z: 0.5 },
      {
        x: 2.6, y: 2.6, z: 2.6,
        duration: 1.1,
        ease: 'power2.out',
        onUpdate: () => {
          if (pulseRing) (pulseRing.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - pulseRing.scale.x / 2.6)
        },
        onComplete: () => {
          if (pulseRing) {
            scene.remove(pulseRing)
            pulseRing.geometry.dispose()
            ;(pulseRing.material as THREE.Material).dispose()
            pulseRing = null
          }
        },
      },
    )
  }

  // ------------------------------ Interaction --------------------------------

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let downAt: { x: number; y: number; t: number } | null = null
  let hoveredKind: '' | 'city' | 'link' | 'piece' = ''
  let hoveredCityId: string | null = null
  let hoverRouteId: string | null = null
  let sellHoverKey: string | null = null
  const tmpV = new THREE.Vector3()

  // ---- Resource-shortage nudges: warm, focused, never a web error ----
  const RES_LABEL: Record<string, string> = {
    money: 'MONEY',
    iron: 'IRON',
    coal: 'COAL',
    beer: 'BEER',
  }

  function nudgeResource(res: 'money' | 'iron' | 'coal' | 'beer', need?: number, have?: number): void {
    const plate = document.querySelector('#playersPlate .pplate.turn')
    if (plate) {
      const sel =
        res === 'money'
          ? plate.querySelector('.pmoney')
          : plate.querySelector(`.res-${res}`)
      if (sel) {
        sel.classList.remove('res-shake')
        void (sel as HTMLElement).offsetWidth
        sel.classList.add('res-shake')
        window.setTimeout(() => sel.classList.remove('res-shake'), 700)
      }
    }
    document.querySelectorAll('.res-chip').forEach((n) => n.remove())
    const chip = document.createElement('div')
    chip.className = 'res-chip'
    const needTxt =
      need !== undefined && have !== undefined
        ? `<span class="need">Required ×${need} · Available ×${have} — need ${Math.max(0, need - have)} more</span>`
        : ''
    chip.innerHTML = `<b>${RES_LABEL[res] ?? res.toUpperCase()}</b>${needTxt}`
    document.body.appendChild(chip)
    window.setTimeout(() => chip.remove(), 2000)
  }

  function nudgeFromMessage(msg: string): void {
    const m = /(\d+)\s*(iron|coal|beer)/i.exec(msg)
    if (m) return nudgeResource(m[2].toLowerCase() as 'iron' | 'coal' | 'beer', Number(m[1]))
    const x2 = /×\s*(\d+)/.exec(msg)
    if (/coal/i.test(msg)) return nudgeResource('coal', x2 ? Number(x2[1]) : undefined)
    if (/beer/i.test(msg)) return nudgeResource('beer', x2 ? Number(x2[1]) : undefined)
    if (/iron/i.test(msg)) return nudgeResource('iron', x2 ? Number(x2[1]) : undefined)
    if (/money|£/i.test(msg)) return nudgeResource('money')
    hud.toast(msg)
  }

  // ---- Live tooltip state — recomputed from game state, never cached ----
  let lastHover: { x: number; y: number } | null = null

  function fmtCityTip(cityId: string): string {
    const def = CITY_BY_ID.get(cityId)!
    const freeN = freeSlot(state, cityId)
    return `<b>${def.name}</b>${def.merchant ? ' · merchant' : ''}<br/>${
      freeN === null ? 'No free slots' : `${freeN} free slot${freeN === 1 ? '' : 's'}`
    }`
  }

  function setMode(m: UiMode): void {
    // Any explicit mode change cancels a pending card preview.
      window.clearTimeout(previewTimer ?? undefined)
      pendingPreviewId = null
    mode = m
    if (m !== 'BUILD') {
      if (m === 'idle') selectedCardId = null
    }
    hud.closePopover()
    hud.refresh(state, mode, selectedCardId)
    renderTray()
  }

  // ------------------------- Contextual action tray --------------------------
  // The bottom tray mirrors the selected action: legal routes, mat tiles,
  // saleable goods, confirmations — always derived from the rule engine.

  let doubleRailStage = 0 // 0 = single mode, 1 = awaiting first rail, 2 = awaiting second rail
  let firstRailId: string | null = null
  let pendingBuildOption: BuildOption | null = null

  /** Confirm layer for the EXACT clicked BUILD option — no regeneration. */
  function openBuildConfirmPopover(def: CityDef, o: BuildOption): void {
    const pid = currentPlayer(state).id
    const s = projectToScreen(new THREE.Vector3(def.x, NODE_TOP + 1.1, def.z))
    hud.closePopover()
    const items: PopoverItem[] = [
      {
        label: `CONFIRM — ${INDUSTRY_LABEL_OF(o.kind)} L${o.level}`,
        sub: `${def.name}${o.overbuildKey ? ' · OVERBUILDS your tile' : ''} · income +${o.spec.income} · ${o.spec.vp} VP at era end`,
        cost: `£${o.cost.money}${o.cost.iron ? ` Fe×${o.cost.iron}` : ''}${o.cost.beer ? ` Beer×${o.cost.beer}` : ''}`,
        disabled: false,
        onSelect: () => {
          if (KB_DEBUG) console.debug('[KB:dispatch] BUILD', { cardId: o.cardId, cityId: o.cityId, kind: o.kind, overbuildKey: o.overbuildKey })
          const err = applyBuild(state, pid, o.cardId, o.cityId, o.kind)
          pendingBuildOption = null
          if (err) {
            if (KB_DEBUG) console.debug('[KB:rejected]', err)
            return nudgeFromMessage(err)
          }
          hud.closePopover()
          endAction()
        },
      },
      {
        label: 'CANCEL',
        sub: 'Back to build options',
        disabled: false,
        onSelect: () => {
          pendingBuildOption = null
          hud.closePopover()
          renderTray()
        },
      },
    ]
    hud.openPopover(s.x, s.y, `CONFIRM BUILD · ${def.name.toUpperCase()}`, items)
    void pid
  }

  function trayEl(): HTMLElement {
    return document.getElementById('contextHand')!
  }

  function hintEl(): HTMLElement {
    return document.getElementById('infoPanel')!
  }

  const TRAY_TITLES: Record<string, string> = {
    NETWORK: 'NETWORK — AVAILABLE ROUTES',
    DEVELOP: 'DEVELOP — YOUR INDUSTRY MAT',
    SELL: 'SELL — CONNECTED GOODS',
    LOAN: 'LOAN',
    SCOUT: 'SCOUT',
    PASS: 'PASS',
  }

  let traySeq = 0
  let devSelected: IndustryType[] = []
  const trayHandlers = new Map<string, () => void>()
  const confirmArmed = new Set<string>()
  const trayDisabled = new Set<string>()
  let inspectRes: 'money' | 'iron' | 'coal' | 'beer' | null = null
  // BUG-5 guard: the browser delivers click+click+dblclick for one physical
  // double-tap. Without this, a confirm-card executes twice (double iron
  // spend, double sell). One resolver per card per 350ms — no exceptions.
  const lastExecAt = new Map<string, number>()
  function canExecute(id: string): boolean {
    const now = performance.now()
    if (now - (lastExecAt.get(id) ?? -1e9) < 350) return false
    lastExecAt.set(id, now)
    return true
  }

  interface CtCard {
    top: string
    mid?: string
    arrow?: string
    cost?: string
    costShort?: boolean
    era?: string
    dis?: boolean
    disNote?: string
    onClick?: () => void
    onEnter?: () => void
    onLeave?: () => void
    confirm?: () => void // two-tap arm pattern
  }

  interface CtItem {
    id: string
    html: string
    onClick?: () => void
    onEnter?: () => void
    onLeave?: () => void
    onDbl?: () => void
    confirm?: boolean
  }

  /** In-place visual sync for the DEVELOP row (never rebuilds mid-gesture). */
  function syncDevRow(): void {
    const el = trayEl()
    for (const node of Array.from(el.querySelectorAll('.ctcard'))) {
      const label = (node.querySelector('.ct-top')?.textContent ?? '').toUpperCase()
      const kind = (Object.keys(INDUSTRY_SPEC_REF) as IndustryType[]).find(
        (k) => INDUSTRY_LABEL_OF(k).toUpperCase() === label,
      )
      if (!kind) continue // the CONFIRM card
      const on = devSelected.includes(kind)
      node.classList.toggle('armed', on)
    }
    const countEl = el.querySelector('[data-role="count"]')
    const costEl = el.querySelector('[data-role="cost"]')
    if (countEl) countEl.textContent = `${devSelected.length} TILE${devSelected.length === 1 ? '' : 'S'}`
    if (costEl) costEl.textContent = `IRON ×${devSelected.length}`
  }

  function ctCardHtml(id: string, c: CtCard): string {
    return `<div class="ctcard${c.dis ? ' dis' : ''}" id="${id}">
      <div class="ct-top">${c.top}</div>
      ${c.arrow ? `<div class="ct-arrow">${c.arrow}</div>` : ''}
      ${c.mid ? `<div class="ct-mid">${c.mid}</div>` : ''}
      ${c.cost ? `<div class="ct-cost${c.costShort ? ' short' : ''}">${c.cost}</div>` : ''}
      ${c.era ? `<div class="ct-era">${c.era}</div>` : ''}
    </div>`
  }

  function mountCards(el: HTMLElement, cards: CtItem[]): void {
    el.insertAdjacentHTML(
      'beforeend',
      `<div class="ct-row">` + cards.map((c) => c.html).join('') + `</div>`,
    )
    for (const c of cards) {
      const node = document.getElementById(c.id)
      if (!node) continue
      node.addEventListener('mouseenter', () => c.onEnter?.())
      node.addEventListener('mouseleave', () => c.onLeave?.())
      // Single click previews/arms; double click confirms where the rules
      // allow immediate resolution. Validation always runs first.
      node.addEventListener('click', () => {
        if (trayDisabled.has(c.id)) return
        if (c.confirm) {
          // Two-tap pipeline: first tap selects/arms (hover bindings keep
          // the board preview alive), second tap resolves via onClick.
          if (confirmArmed.has(c.id)) {
            confirmArmed.delete(c.id)
            node.classList.remove('armed')
            delete node.dataset.armed
            c.onLeave?.()
            if (!canExecute(c.id)) return
            if (KB_DEBUG) console.debug('[KB:dispatch]', { id: c.id })
            c.onClick?.()
          } else {
            confirmArmed.add(c.id)
            node.classList.add('armed')
            node.dataset.armed = '1'
            c.onEnter?.()
            window.setTimeout(() => {
              if (confirmArmed.has(c.id)) {
                confirmArmed.delete(c.id)
                node.classList.remove('armed')
                delete node.dataset.armed
                c.onLeave?.()
              }
            }, 2600)
          }
          return
        }
        c.onClick?.()
      })
      node.addEventListener('dblclick', () => {
        // Double-click = direct confirmation for executable cards.
        if (trayDisabled.has(c.id)) return
        if (!canExecute(c.id)) return
        if (c.onDbl) {
          c.onDbl()
          return
        }
        if (c.confirm) {
          confirmArmed.delete(c.id)
          node.classList.remove('armed')
        }
        c.onClick?.()
      })
    }
  }

  function renderTray(): void {
    const el = trayEl()
    const hint = hintEl()
    trayHandlers.clear()
    trayDisabled.clear()
    confirmArmed.clear()
    const pid = currentPlayer(state).id
    hoverRouteId = null
    sellHoverKey = null
    if (mode !== 'DEVELOP') devSelected = []
    if (mode !== 'BUILD') pendingBuildOption = null
    hud.closePopover() // BUG 1: never stack a second interaction layer

    const showBack = mode !== 'idle' && !state.over
    document.getElementById('ctxBackBtn')?.classList.toggle('hidden', !showBack)

    // ---- Resource inspection (real interaction, same card language) ----
    if (inspectRes && isHumanTurn()) {
      const p = playerById(state, pid)
      const have =
        inspectRes === 'money' ? p.money : inspectRes === 'iron' ? p.iron : inspectRes === 'coal' ? p.coal : p.beer
      let required: number | null = null
      if (mode === 'NETWORK' && state.era === 'rail') required = 1
      if (mode === 'DEVELOP') required = 1
      if (mode === 'SELL') required = inspectRes === 'beer' ? 1 : null
      const id = `ct${traySeq++}`
      el.classList.remove('hidden')
      el.innerHTML = `<div class="ct-row">${ctCardHtml(id, {
        top: RES_LABEL[inspectRes],
        mid: `AVAILABLE ×${have}${required !== null ? `<br/>REQUIRED BY ACTION ×${required}` : ''}`,
        cost:
          required !== null && have < required
            ? `NEED ${required - have} MORE`
            : 'RESERVES READY',
        costShort: required !== null ? have < required : false,
        era: 'SUPPLY LEDGER',
      })}</div>`
      document.getElementById('hand')?.classList.add('hide-hand')
      hint.innerHTML = `<b>${RES_LABEL[inspectRes]} — SUPPLY INSPECTION</b>`
      return
    }
    inspectRes = null

    hint.innerHTML = mode === 'idle' ? defaultHintText(mode) : `<b>${TRAY_TITLES[mode] ?? mode}</b>`
    if (mode === 'idle' || state.over) {
      el.classList.add('hidden')
      el.innerHTML = ''
      document.getElementById('hand')?.classList.remove('hide-hand')
      return
    }
    // The REAL hand slides away; contextual cards deal into its place —
    // BUILD included, so every action shares one interaction pattern.
    document.getElementById('hand')?.classList.add('hide-hand')
    el.classList.remove('ct-swap')
    void el.offsetWidth
    el.classList.add('ct-swap')
    el.classList.remove('hidden')

    // ---- BUILD — clicked option is AUTHORITATIVE; popover = confirm ----
    if (mode === 'BUILD') {
      const opts = allBuildOptions(state, pid)
      const dedup = new Map<string, BuildOption>()
      for (const o of opts) {
        const k = `${o.cityId}:${o.kind}${o.overbuildKey ? ':ob' : ''}`
        if (!dedup.has(k)) dedup.set(k, o)
      }
      const cards: CtItem[] = [...dedup.values()].slice(0, 12).map((o) => {
        const id = `ct${traySeq++}`
        trayHandlers.set(id, () => {
          // The EXACT clicked option becomes the pending payload. Nothing
          // is regenerated or replaced downstream.
          pendingBuildOption = o
          selectedCardId = o.cardId
          const def = CITY_BY_ID.get(o.cityId)!
          focusCity(def.id)
          spawnLocatorPulse(def)
          sound.chime(def.x, 1.2, def.z)
          openBuildConfirmPopover(def, o)
        })
        return {
          id,
          html: ctCardHtml(id, {
            top: INDUSTRY_LABEL_OF(o.kind).toUpperCase(),
            mid: `${CITY_BY_ID.get(o.cityId)!.name}<br/>LEVEL ${o.level}`,
            cost: `£${o.cost.money}${o.cost.iron ? ` · FE×${o.cost.iron}` : ''}${o.cost.beer ? ` · BEER×${o.cost.beer}` : ''}`,
            era: o.overbuildKey ? 'OVERBUILD' : o.inNetwork ? 'IN NETWORK' : 'LOCATION CARD',
          }),
        }
      })
      mountCards(el, cards)
      updateHandNav()
      if (cards.length === 0)
        el.insertAdjacentHTML('beforeend', '<span class="ct-note">No legal builds with the current hand.</span>')
      return
    }

    // ---- NETWORK — physical route tiles ----
    if (mode === 'NETWORK') {
      const p = playerById(state, pid)
      const links = legalNetworkLinks(state, pid)
      const cards: CtItem[] = links.map((l) => {
        const id = `ct${traySeq++}`
        const coalNeed = l.era === 'rail' ? 1 : 0
        const isSecondPick = doubleRailStage === 2
        trayHandlers.set(id, () => {
          if (doubleRailStage === 1) {
            firstRailId = l.id
            doubleRailStage = 2
            hud.toast('First rail marked — now the second.')
            renderTray()
            return
          }
          if (doubleRailStage === 2) {
            const err = applyNetworkDouble(state, pid, firstRailId!, l.id)
            firstRailId = null
            doubleRailStage = 0
            if (err) return nudgeFromMessage(err)
            sound.railClack(0, 1, 0)
            endAction()
            return
          }
          execNetwork(l.id, l.era)
        })
        return {
          id,
          html: ctCardHtml(id, {
            top: CITY_BY_ID.get(l.a)!.name,
            arrow: '↓',
            mid: CITY_BY_ID.get(l.b)!.name,
            cost: l.era === 'canal' ? '£3' : `£5 · COAL ×1`,
            costShort: coalNeed > p.coal,
            era: l.era === 'canal' ? 'CANAL' : 'RAILWAY',
          }),
          confirm: true,
          onEnter: () => (hoverRouteId = l.id),
          onLeave: () => (hoverRouteId = null),
        }
      })
      if (state.era === 'rail' && canDoubleRail(state, pid)) {
        const id = `ct${traySeq++}`
        trayHandlers.set(id, () => {
          if (doubleRailStage === 0) {
            doubleRailStage = 1
            hud.toast('DOUBLE RAIL: pick rail 1 of 2 (£15 · coal×2 · beer×1).')
          } else {
            doubleRailStage = 0
            firstRailId = null
            hud.toast('Double-rail cancelled.')
          }
          renderTray()
        })
        cards.push({
          id,
          html: ctCardHtml(id, {
            top: doubleRailStage ? 'RAIL ' + (doubleRailStage + 1) + ' OF 2…' : 'DOUBLE RAIL',
            mid: 'TWO RAILS',
            cost: '£15 · COAL ×2 · BEER ×1',
            era: doubleRailStage ? 'SELECT NEXT RAIL' : 'SPECIAL ACTION',
          }),
        })
      }
      if (doubleRailStage > 0 && firstRailId) {
        const l = LINK_BY_ID.get(firstRailId)!
        el.insertAdjacentHTML(
          'beforeend',
          `<span class="tray-note">Rail 1: ${CITY_BY_ID.get(l.a)!.name} → ${CITY_BY_ID.get(l.b)!.name}</span>`,
        )
      }
      mountCards(el, cards)
      updateHandNav()
      return
    }

    // ---- DEVELOP — mat tiles; tap = arm, dbl-tap = develop now ----
    // NOTE: selection toggles mutate classes IN PLACE. Rebuilding the row
    // inside the click handler resets the browser's click-detail counter
    // and the dblclick never forms (root cause of BUG-A here).
    if (mode === 'DEVELOP') {
      const p = playerById(state, pid)
      const devs = getLegalDevelopments(state, pid).slice(0, 6)
      const cards: CtItem[] = devs.map((d) => {
        const id = `ct${traySeq++}`
        const short = p.iron < d.iron
        if (short) trayDisabled.add(id)
        trayHandlers.set(id, () => {
          // Single tap: arm/disarm this kind (max two, iron-aware).
          if (short && !devSelected.includes(d.kind)) {
            return nudgeResource('iron', d.iron, p.iron)
          }
          if (devSelected.includes(d.kind)) {
            devSelected = devSelected.filter((k) => k !== d.kind)
          } else if (devSelected.length < 2) {
            devSelected = [...devSelected, d.kind]
            sound.click(0, 1, 0)
          }
          syncDevRow()
        })
        return {
          id,
          html: ctCardHtml(id, {
            top: INDUSTRY_LABEL_OF(d.kind).toUpperCase(),
            mid: `LEVEL ${d.level}`,
            cost: `IRON ×${d.iron}`,
            costShort: short,
            era: 'REMOVE FROM MAT',
            dis: short,
          }),
          onEnter: () => (devHoverKind = d.kind),
          onLeave: () => (devHoverKind = null),
          // Double-tap: use this tile immediately (legal single develop).
          onDbl: () => {
            if (p.iron < d.iron) return nudgeResource('iron', d.iron, p.iron)
            const err = resolveDevelop(state, pid, [d.kind])
            if (err) return nudgeFromMessage(err)
            endAction()
          },
        }
      })
      mountCards(el, cards)
      // Persistent CONFIRM card, updated in place (never rebuilt mid-tap).
      const cid = `ct${traySeq++}`
      trayHandlers.set(cid, () => {
        if (devSelected.length === 0) return
        const err = resolveDevelop(state, pid, [...devSelected])
        if (err) return nudgeFromMessage(err)
        devSelected = []
        endAction()
      })
      el.insertAdjacentHTML(
        'beforeend',
        `<div class="ctcard ${devSelected.length ? '' : 'dis'}" id="${cid}">
          <div class="ct-top">CONFIRM<br/>DEVELOPMENT</div>
          <div class="ct-mid" data-role="count">${devSelected.length} TILE${devSelected.length === 1 ? '' : 'S'}</div>
          <div class="ct-cost" data-role="cost">IRON ×${devSelected.length}</div>
          <div class="ct-era">TAP TO CONFIRM</div>
        </div>`,
      )
      el.insertAdjacentHTML('beforeend', '<span class="ct-note">Tap to arm (max 2) · double-tap a tile to develop it instantly.</span>')
      return
    }

    // ---- SELL — connected goods ----
    if (mode === 'SELL') {
      const items = sellableIndustries(state, pid).slice(0, 8)
      const cards: CtItem[] = items.map((t) => {
        const id = `ct${traySeq++}`
        trayHandlers.set(id, () => {
          const err = resolveSell(state, pid, t.key)
          if (err) return nudgeFromMessage(err)
          sound.coins(0, 1, 0)
          endAction()
        })
        return {
          id,
          html: ctCardHtml(id, {
            top: INDUSTRY_LABEL_OF(t.kind).toUpperCase(),
            mid: `${CITY_BY_ID.get(t.cityId)!.name}<br/>MERCHANT LINKED`,
            cost: `SELL £${sellValue(t)}`,
            era: 'FLIPS TILE',
          }),
          confirm: true,
          onEnter: () => (sellHoverKey = t.key),
          onLeave: () => (sellHoverKey = null),
        }
      })
      mountCards(el, cards)
      if (cards.length === 0) el.insertAdjacentHTML('beforeend', '<span class="ct-note">No connected goods ready for market.</span>')
      return
    }

    // ---- LOAN / SCOUT / PASS — compact confirmation cards ----
    if (mode === 'LOAN' || mode === 'SCOUT' || mode === 'PASS') {
      const id = `ct${traySeq++}`
      let top = '', mid = '', cost = '', era = ''
      let exec: (() => string | null) | null = null
      let after: (() => void) | null = null
      if (mode === 'LOAN') {
        top = 'TAKE LOAN'; mid = '+£30'; cost = 'INCOME −3 LEVELS'; era = 'CONFIRM'
        exec = () => resolveLoan(state, pid)
        after = () => sound.coins(0, 1, 0)
      } else if (mode === 'SCOUT') {
        top = 'SCOUT EXPEDITION'; mid = 'WILD LOCATION<br>+ WILD INDUSTRY'; cost = 'DISCARD 3 CARDS'; era = 'CONFIRM'
        exec = () => resolveScout(state, pid)
        after = () => sound.cardSlide()
      } else {
        top = 'PASS TURN'; mid = 'DISCARD ONE CARD'; cost = 'YIELD THE ACTION'; era = 'CONFIRM'
        exec = () => resolvePass(state, pid)
      }
      trayHandlers.set(id, () => {
        const err = exec!()
        if (err) return nudgeFromMessage(err)
        after?.()
        endAction()
      })
      mountCards(el, [
        {
          id,
          html: ctCardHtml(id, { top, mid, cost, era }),
          confirm: true,
          onClick: () => trayHandlers.get(id)?.(),
        },
      ])
      el.insertAdjacentHTML('beforeend', '<span class="ct-note">Tap once to arm — tap again to confirm.</span>')
      return
    }
  }

  function defaultHintText(m: UiMode): string {
    if (m === 'BUILD')
      return '<b>BUILD</b> · pick a card below, then a city on the board.<br/><span class="dim">Costs preview before you confirm.</span>'
    return '<span class="dim">Choose an action — drag to orbit, scroll to zoom.</span>'
  }

  function execNetwork(linkId: string, era?: string): void {
    const pid = currentPlayer(state).id
    if (KB_DEBUG) console.debug('[KB:dispatch] NETWORK', { linkId, era, player: pid })
    const err = applyNetwork(state, pid, linkId)
    if (err) {
      if (KB_DEBUG) console.debug('[KB:rejected]', err)
      return nudgeFromMessage(err) // visible contextual reason, no silent fail
    }
    const rv = routes.get(linkId)!
    const g = rv.group
    gsap.fromTo(g.scale, { x: 0.01 }, {
      x: 1,
      duration: 0.55,
      ease: 'back.out(1.4)',
      onStart: () => sound.bass(g.position.x, 1, g.position.z),
      onUpdate: () => puff.burst(tmpV.set(g.position.x, BOARD_TOP + 0.15, g.position.z), 2, 0.5),
      onComplete: () => sound.railClack(g.position.x, 1, g.position.z),
    })
    endAction()
  }

  function handleAction(a: string): void {
    if (!isHumanTurn()) {
      debugInteraction(`action ${a}: not the local player turn`)
      return
    }
    if (busy || state.over) return
    if (!['BUILD', 'NETWORK', 'DEVELOP', 'SELL', 'LOAN', 'SCOUT', 'PASS'].includes(a)) return
    setMode(mode === (a as UiMode) ? 'idle' : (a as UiMode))
  }

  function endAction(): void {
    const eraBefore = state.era
    advanceTurn(state)
    pendingEraShow = !state.over && state.era !== eraBefore
    selectedCardId = null
    setMode('idle')
    // Soft physical nudge — the table acknowledges the action.
    if (!gsap.isTweening(controls.target)) {
      const y0 = controls.target.y
      gsap.to(controls.target, {
        y: y0 + 0.05,
        duration: 0.15,
        ease: 'power1.out',
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          controls.target.y = y0
        },
      })
    }
    afterStateChange()
  }

  function afterStateChange(): void {
    ;(window as unknown as { __bronze: unknown }).__bronze = {
      era: state.era,
      round: state.round,
      over: state.over,
      turns: state.log.length,
      track: music.currentTrack,
      scores: state.players.map((p) => ({ name: p.name, vp: p.vp, money: p.money })),
    }
    syncBoard(true)
    syncRoutes()
    hud.refresh(state, mode, selectedCardId)
    renderTray()
    // Adaptive soundtrack: arrangement deepens as industrialization grows.
    if (!state.over) {
      const rp = roundsPerEra(state.players.length)
      const prog = state.round / rp
      let wanted = lastTrackId
      if (state.era === 'canal') {
        wanted =
          prog >= 0.66
            ? 'ironworks-nocturne'
            : prog >= 0.33
              ? pickTrack(['loom-and-lathe', 'canal-hum'], lastTrackId)
              : 'canal-hum'
      } else {
        wanted =
          prog >= 0.55
            ? 'full-steam'
            : pickTrack(['rail-spine', 'loom-and-lathe'], lastTrackId)
      }
      if (wanted !== lastTrackId) {
        lastTrackId = wanted
        music.setTrack(wanted)
        hud.toast('\u266A ' + music.currentTrack)
      }
    }
    if (state.over) {
      // Signature payoff: the whole hidden map comes alive before the ledger.
      runFinalReveal(() => {
        phase = 'results'
        music.setScene('results')
        const rows = [...state.players]
          .sort((a, b) => b.vp - a.vp || b.money - a.money)
          .map((p) => ({
            name: p.name,
            vp: p.vp,
            money: p.money,
            income: p.income,
            vpBuilds: p.vpBuilds,
            vpSells: p.vpSells,
            linksBuilt: p.linksBuilt,
            railVp: p.vp - p.vpCanalEnd,
          }))
        hud.gameOver(
          rows,
          () => {
            if (lastSeats) startMatch(lastSeats)
          },
          () => {
            if (currentTable) {
              phase = 'lobby'
              screens.showLobby(true)
              screens.renderLobby(currentTable)
              music.setScene('lobby')
            } else {
              backHome()
            }
          },
        )
      })
    } else if (pendingEraShow) {
      pendingEraShow = false
      runEraTransition()
    }
  }

  let finalRevealDone = false
  function runFinalReveal(onDone: () => void): void {
    if (finalRevealDone) {
      onDone()
      return
    }
    finalRevealDone = true
    busy = true
    hud.setBusy(true)
    sound.eraFanfare()
    window.setTimeout(() => sound.steam(0, 3, 0, 0.1), 900)
    gsap.to(revealUniforms.uGlobal, { value: 1, duration: 3.2, ease: 'power1.inOut' })
    gsap.to(controls.target, { x: 0, y: -0.2, z: 0, duration: 3.6, ease: 'power2.inOut' })
    gsap.to(camera.position, { x: 0, y: 30, z: 33, duration: 3.6, ease: 'power2.inOut' })
    window.setTimeout(() => {
      busy = false
      hud.setBusy(false)
      onDone()
    }, 3700)
  }

  let pendingEraShow = false

  function runEraTransition(): void {
    busy = true
    hud.setBusy(true)
    sound.eraShift()
    music.setScene('rail')
    hud.eraTransition('CANAL ERA', 'RAILWAY ERA', () => {
      mapTex.dispose()
      mapTex = makeMapTexture('rail')
      revealUniforms.tMap.value = mapTex
      let delay = 0
      for (const [, rv] of routes) {
        const l = LINKS.find((x) => x.id === rv.id)!
        if (l.era === 'rail') {
          const g = rv.group
          g.visible = true
          g.scale.set(0.01, 1, 1)
          window.setTimeout(() => {
            gsap.to(g.scale, { x: 1, duration: 0.5, ease: 'back.out(1.6)' })
            const p = g.position
            sound.railClack(p.x, p.y, p.z)
          }, delay)
          delay += 160
        }
      }
      window.setTimeout(() => {
        busy = false
        hud.setBusy(false)
      }, delay + 500)
    })
  }

  function resetBoardVisuals(): void {
    unfocus()
    hud.closePopover()
    for (const [, entry] of pieces) {
      piecesGroup.remove(entry.vis.group)
      piecesGroup.remove(entry.shadow)
      entry.vis.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose()
      })
    }
    pieces.clear()
    torchTarget.clear()
    torchCur.clear()
    segIntensity.clear()
    doubleRailStage = 0
    firstRailId = null
    pendingBuildOption = null
    gsap.killTweensOf(revealUniforms.uGlobal)
    revealUniforms.uGlobal.value = 0
    finalRevealDone = false
    for (const [, rv] of routes) {
      rv.accent.visible = false
      const l = LINKS.find((x) => x.id === rv.id)!
      if (l.era === 'rail') rv.group.visible = false
    }
    mapTex.dispose()
    mapTex = makeMapTexture('canal')
      revealUniforms.tMap.value = mapTex
  }

  function resetGame(): void {
    // True fresh start: brand-new initial state + full opening sequence.
    gamePaused = false
    document.getElementById('pauseMenu')?.classList.add('hidden')
    inspectRes = null
    resetBoardVisuals()
    state = createInitialGameState(lastSeats ?? undefined, lastSeed)
    mode = 'idle'
    selectedCardId = null
    busy = true
    pendingEraShow = false
    aiTimer = null
    finalRevealDone = false
    savedCam = null
    focusedCity = null
    hud.hideOverlay()
    hud.closePopover()
    phase = 'opening'
    controls.autoRotate = false
    controls.enabled = false
    camera.position.set(0, 30, 44)
    controls.target.set(0.8, 0.2, -0.4)
    renderer.toneMappingExposure = 0.16
    hud.refresh(state, mode, selectedCardId)
    syncBoard(false)
    syncRoutes()
    syncPawns()
    buildSupplyMats()
    runOpeningSequence(() => {
      phase = 'game'
      busy = false
      controls.enabled = true
      renderer.toneMappingExposure = 0.82
      camera.position.set(3, 17, 20)
      hud.refresh(state, mode, selectedCardId)
      renderTray()
    })
  }

  // Popover builders.
  function openCityPopover(def: CityDef, screenX: number, screenY: number): void {
    const cur = currentPlayer(state)
    const free = freeSlot(state, def.id)
    const items: PopoverItem[] = []
    const INDUSTRY_SPEC_LOCAL = INDUSTRY_SPEC_REF
    type IndustryTypeName = keyof typeof INDUSTRY_SPEC_LOCAL

    // Engine-derived: any hand card that legally builds here (lowest level).
    const opts = buildOptionsForCity(state, cur.id, def.id)

    if (free === null) {
      hud.openPopover(screenX, screenY, def.name, [])
      return
    }
    if (opts.length === 0) {
      // Explain the shortage with a resource-focused nudge, not red text.
      const net = new Set<string>()
      const p = cur
      let explained = false
      for (const kind of Object.keys(INDUSTRY_SPEC_LOCAL) as IndustryTypeName[]) {
        const lvl = p.supply[kind].l1 > 0 ? 1 : p.supply[kind].l2 > 0 ? 2 : null
        if (!lvl) continue
        const spec = INDUSTRY_SPEC_LOCAL[kind][lvl - 1]
        if (spec.railOnly && state.era !== 'rail') continue
        if (p.money < spec.cost.money) {
          nudgeResource('money', spec.cost.money, p.money)
          explained = true
        } else if (p.iron < spec.cost.iron) {
          nudgeResource('iron', spec.cost.iron, p.iron)
          explained = true
        } else if (p.beer < spec.cost.beer) {
          nudgeResource('beer', spec.cost.beer, p.beer)
          explained = true
        }
        if (explained) break
      }
      items.push({
        label: explained ? 'Missing resources' : 'Nothing legal here right now',
        sub: explained
          ? 'The shortfall is marked on your ledger'
          : 'Needs network access or an open era rule',
        disabled: true,
      })
    }
    for (const o of opts.slice(0, 6)) {
      items.push({
        label: `${INDUSTRY_LABEL_OF(o.kind)} L${o.level}`,
        sub: `Income +${o.spec.income} · ${o.spec.vp} VP at era end${o.spec.grant?.coal ? ' · yields coal' : ''}${o.spec.grant?.iron ? ' · yields iron' : ''}${o.spec.grant?.beer ? ' · yields beer' : ''}`,
        cost: `£${o.cost.money}${o.cost.iron ? ` Fe×${o.cost.iron}` : ''}${o.cost.beer ? ` Beer×${o.cost.beer}` : ''}`,
        disabled: false,
        onSelect: () => {
          const err = resolveBuildPath(state, cur.id, o.cardId, def.id, o.kind)
          if (err) return hud.toast(err)
          hud.closePopover()
          endAction()
        },
      })
    }
    hud.openPopover(screenX, screenY, `${def.name.toUpperCase()}${def.merchant ? '  ·  MERCHANT BEACON' : ''}`, items)
  }

  function resolveBuildPath(
    s: GameState,
    pid: string,
    cardId: string,
    cityId: string,
    kind: import('./state').IndustryType,
  ): string | null {
    return applyBuild(s, pid, cardId, cityId, kind)
  }

  function INDUSTRY_LABEL_OF(kind: string): string {
    switch (kind) {
      case 'coal': return 'Coal Mine'
      case 'iron': return 'Iron Works'
      case 'cotton': return 'Cotton Mill'
      case 'manufacturer': return 'Manufacturer'
      case 'pottery': return 'Pottery'
      case 'brewery': return 'Brewery'
      default: return kind
    }
  }

  function isHumanTurn(): boolean {
    if (phase !== 'game' || busy || state.over) return false
    if (gamePaused) return false
    return !currentPlayer(state).isAI
  }

  function pick(clientX: number, clientY: number): void {
    // Board interactions are equally turn-gated — the world simply does
    // not respond when it is not your seat (or before the table is set).
    if (!isHumanTurn()) {
      debugInteraction('board-pick: not the local player turn')
      return
    }
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const cur = currentPlayer(state)

    if (hud.popoverOpen) {
      hud.closePopover()
      unfocus()
      return
    }

    // 1) Pieces (develop / sell modes).
    if (mode === 'DEVELOP' || mode === 'SELL') {
      const hits = raycaster.intersectObjects([...pieces.values()].map((p) => p.hitbox), false)
      if (hits.length > 0) {
        const key = hits[0].object.userData.pieceKey as string
        const entry = pieces.get(key)!
        if (mode === 'DEVELOP') {
          const err = applyDevelop(state, cur.id, key)
          if (err) return hud.toast(err)
          sound.woodPlace(entry.vis.group.position.x, entry.vis.group.position.y, entry.vis.group.position.z)
          endAction()
          return
        } else {
          const err = applySell(state, cur.id, key)
          if (err) return hud.toast(err)
          sound.coins(entry.vis.group.position.x, 1, entry.vis.group.position.z)
          hud.toast(`Sold for £${sellValue(entry.data)}`)
          endAction()
          return
        }
      }
    }

    // 2) Links (network mode).
    if (mode === 'NETWORK') {
      const hits = raycaster.intersectObjects(linkPickables, false)
      if (hits.length > 0) {
        const linkId = hits[0].object.userData.linkId as string
        execNetwork(linkId)
        return
      }
    }

    // 3) Cities (inspect / build).
    const cityHits = raycaster.intersectObjects(nodePickables, false)
    if (cityHits.length > 0) {
      const cityId = cityHits[0].object.userData.cityId as string
      const def = CITY_BY_ID.get(cityId)!
      sound.click(def.x, 1, def.z)
      focusCity(cityId)
      const screen = projectToScreen(new THREE.Vector3(def.x, NODE_TOP + 1.2, def.z))
      openCityPopover(def, screen.x, screen.y)
      return
    }

    // Empty ground click: deselect.
    if (focusedCity) {
      hud.closePopover()
      unfocus()
    }
  }

  function projectToScreen(v: THREE.Vector3): { x: number; y: number } {
    const p = v.clone().project(camera)
    return {
      x: (p.x * 0.5 + 0.5) * window.innerWidth,
      y: (-p.y * 0.5 + 0.5) * window.innerHeight,
    }
  }

  renderer.domElement.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() }
  })

  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt) return
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y)
    const quick = performance.now() - downAt.t < 600
    downAt = null
    if (moved < 6 && quick) {
      sound.resume()
      pick(e.clientX, e.clientY)
    }
  })

  // Hover feedback.
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (busy || state.over) return
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const cur = currentPlayer(state)

    let kind: typeof hoveredKind = ''
    let tipText = ''

    const pieceHits =
      mode === 'DEVELOP' || mode === 'SELL'
        ? raycaster.intersectObjects([...pieces.values()].map((p) => p.hitbox), false)
        : []
    if (pieceHits.length > 0) {
      const key = pieceHits[0].object.userData.pieceKey as string
      const entry = pieces.get(key)!
      const owner = playerById(state, entry.data.ownerId)
      kind = 'piece'
      tipText =
        mode === 'SELL'
          ? `${INDUSTRY_LABEL_OF(entry.data.kind)} L${entry.data.level} · ${owner.name}<br/>Sell for £${sellValue(entry.data)} (−1 beer)`
          : `${INDUSTRY_LABEL_OF(entry.data.kind)} L${entry.data.level} · ${owner.name}<br/>Develop discards this tile`
    } else if (mode === 'NETWORK') {
      const lh = raycaster.intersectObjects(linkPickables, false)
      if (lh.length > 0) {
        const linkId = lh[0].object.userData.linkId as string
        const l = LINKS.find((x) => x.id === linkId)!
        kind = 'link'
        tipText = `${CITY_BY_ID.get(l.a)!.name} ↔ ${CITY_BY_ID.get(l.b)!.name}<br/>£${linkCost(state, l)}`
      }
    } else {
      const ch = raycaster.intersectObjects(nodePickables, false)
      if (ch.length > 0) {
        const cityId = ch[0].object.userData.cityId as string
        const def = CITY_BY_ID.get(cityId)!
        kind = 'city'
        lastHover = { x: e.clientX, y: e.clientY }
        tipText = fmtCityTip(cityId)
      } else {
        lastHover = null
      }
    }

    hoveredKind = kind
    renderer.domElement.style.cursor = kind ? 'pointer' : 'grab'
    if (kind) hud.showTip(tipText, e.clientX, e.clientY)
    else hud.hideTip()

    // Rim glow + label lift are handled per-frame in the render loop.
    hoveredCityId =
      kind === 'city'
        ? ((raycaster.intersectObjects(nodePickables, false)[0]?.object.userData.cityId as string) ?? null)
        : null
    void cur
  })

  // ------------------------------ Refresh loop -------------------------------

  function legalHighlightTargets(): { links: Set<string>; pieces: Set<string> } {
    const cur = currentPlayer(state)
    const links = new Set<string>()
    const pcs = new Set<string>()
    if (mode === 'NETWORK') for (const l of legalLinks(state, cur.id)) links.add(l.id)
    if (mode === 'SELL')
      for (const t of state.placed)
        if (
          t.ownerId === cur.id &&
          !t.flipped &&
          ['cotton', 'manufacturer'].includes(t.kind) &&
          cur.beer >= 1
        )
          pcs.add(t.key)
    if (mode === 'DEVELOP' && cur.developLeft > 0)
      for (const t of state.placed) if (t.ownerId === cur.id && !t.flipped) pcs.add(t.key)
    // Contextual-card hover → board highlight (CARD → BOARD link).
    if (sellHoverKey) pcs.add(sellHoverKey)
    return { links, pieces: pcs }
  }

  const clock = new THREE.Clock()

  hud.refresh(state, mode, selectedCardId)
  syncBoard(false)
  syncRoutes()

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime

    dustMat.uniforms.uTime.value = t
    steam.tick(t)
    puff.update(dt)

    const { links: hotLinks, pieces: hotPieces } = legalHighlightTargets()
    const pulse = 0.2 + 0.14 * Math.sin(t * 3.2)
    for (const [, rv] of routes) {
      const legal = hotLinks.has(rv.id)
      rv.hl.visible = legal || hoverRouteId === rv.id
      rv.hlMat.opacity = hoverRouteId === rv.id ? 0.6 : legal ? pulse : 0
    }

    // Node rims: hover > selected > idle; labels breathe with zoom level.
    const camDist = camera.position.distanceTo(controls.target)
    const lf = THREE.MathUtils.clamp(1.35 - camDist * 0.026, 0.74, 1.16)
    for (const n of nodes) {
      const isHover = n.def.id === hoveredCityId
      const isSel = n.def.id === focusedCity
      const targetRim = isSel ? 0.24 : isHover ? 0.42 : 0
      n.rimMat.emissiveIntensity += (targetRim - n.rimMat.emissiveIntensity) * 0.14
      const baseY = n.def.ly ?? 1.15
      const targetY = baseY + (isHover || isSel ? 0.12 : 0)
      n.label.position.y += (targetY - n.label.position.y) * 0.15
      const s = (n.def.lp ?? 0.85) * lf
      n.label.scale.set(2.35 * s, 0.59 * s, 1)
    }

    // Tooltip stays truthful every frame — slot counts can never go stale.
    if (hoveredKind === 'city' && hoveredCityId && lastHover && !hud.popoverOpen) {
      hud.showTip(fmtCityTip(hoveredCityId), lastHover.x, lastHover.y)
    }

    // Pawns breathe; the active player's piece rises into its brass ring.
    for (let i = 0; i < pawns.length; i++) {
      const p = pawns[i]
      const pid = state.order[i]
      const active = phase !== 'home' && !state.over && state.order[state.turnIdx] === pid
      const tY = p.baseY + (active ? 0.13 : 0) + Math.sin(t * 0.9 + i) * 0.02
      p.group.position.y += (tY - p.group.position.y) * 0.08
      const rT = active ? 0.6 : 0.05
      p.ringMat.emissiveIntensity += (rT - p.ringMat.emissiveIntensity) * 0.09
      p.plateMat.emissiveIntensity += ((active ? 0.32 : 0.04) - p.plateMat.emissiveIntensity) * 0.08
    }

    // The oil lamp flickers like an honest flame.
    const lampFl = 0.9 + 0.1 * Math.sin(t * 7.3) * Math.sin(t * 3.1) + 0.04 * Math.sin(t * 19)
    lampLight.intensity = 26 * lampFl
    ;(lampFlame.material as THREE.SpriteMaterial).opacity = 0.5 + 0.2 * lampFl
    lampFlame.scale.set(0.5 + 0.06 * lampFl, 0.78 + 0.1 * lampFl, 1)
    // Seat lanterns: gentle independent flicker on their ignition boost.
    for (const l of seatLanterns) {
      const b = (l.userData.boost as number) ?? 1
      const fl = 0.9 + 0.1 * Math.sin(t * 6.1 + (l.userData.seed as number)) + 0.05 * Math.sin(t * 17 + (l.userData.seed as number))
      l.intensity = 7 * b * fl
    }
    // DEVELOP card hover → the matching supply cluster breathes on the mat.
    if (devHoverKind && supplyMats.length) {
      const curIdx = state.turnIdx
      const mat = supplyMats[curIdx]
      if (mat) {
        for (const mini of mat.supply.children) {
          const match = (mini as THREE.Mesh).userData.kind === devHoverKind
          const s = match ? 1.18 : 1
          mini.scale.lerp(new THREE.Vector3(s, s, s), 0.2)
        }
      }
    }
    // The mural emerges with the world — subtle, environmental.
    muralMat.emissiveIntensity = 0.05 + revealUniforms.uGlobal.value * 0.4

    let wi = 0
    for (const [key, entry] of pieces) {
      const hot = hotPieces.has(key)
      const flicker = 0.12 + 0.045 * Math.sin(t * 1.7 + wi * 1.3)
      const targetE = hot ? 0.55 : flicker
      for (const wm of entry.vis.windowMats) {
        wm.emissiveIntensity += (targetE - wm.emissiveIntensity) * 0.14
        void wm
      }
      if (!gsap.isTweening(entry.vis.group.position)) {
        const targetY = hot ? NODE_TOP + Math.sin(t * 2.4 + key.length) * 0.02 : NODE_TOP
        entry.vis.group.position.y += (targetY - entry.vis.group.position.y) * (hot ? 0.25 : 0.1)
      }
      // Torch flame lives and dies with its location's reveal intensity.
      if (entry.flame) {
        const cityI = torchCur.get(entry.data.cityId) ?? 0
        const seed = entry.flame.userData.seed as number
        const fl =
          0.7 +
          0.3 * Math.sin(t * 11 + seed) * Math.sin(t * 5.3 + seed * 2.17) +
          0.08 * Math.sin(t * 29 + seed)
        const lit = Math.min(1, cityI)
        ;(entry.flame.material as THREE.SpriteMaterial).opacity =
          lit * (0.34 + 0.22 * fl) * (0.6 + 0.4 * revealUniforms.uGlobal.value + 0.4)
        const sc = 0.34 + 0.14 * lit * (0.8 + 0.25 * fl)
        entry.flame.scale.set(sc, sc * 1.3, 1)
      }
      wi++
    }

    uploadReveal(t)

    // Node hover lift handled via pointermove tweens; keep popover glued.
    if (hud.popoverOpen && focusedCity) {
      const def = CITY_BY_ID.get(focusedCity)!
      const s = projectToScreen(new THREE.Vector3(def.x, NODE_TOP + 1.1, def.z))
      hud.movePopover(s.x, s.y)
    }

    controls.update()
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -12.5, 12.5)
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -11.5, 11.5)
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 4)
    const cp = camera.position
    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd)
    sound.updateListener(cp, fwd)

    // AI turns flow through the same rule engine and endAction pipeline.
    // A real PAUSE freezes all progression — resume continues exactly here.
    if (gamePaused) {
      aiTimer = null
    } else if (phase === 'game' && !state.over && !busy && !hud.popoverOpen) {
      const curAI = currentPlayer(state)
      if ((curAI.isAI || AUTOPLAY) && mode === 'idle') {
        if (aiTimer === null) {
          aiTimer = AUTOPLAY ? 0.05 : 1.0 + Math.random() * 0.9
          const flavour = [
            'EVALUATING A BUILD',
            'PLANNING A NETWORK',
            'WEIGHING THE LEDGER',
            'SURVEYING THE MIDLANDS',
          ]
          hud.setThinking(curAI.name, flavour[Math.floor(Math.random() * flavour.length)])
        } else {
          aiTimer -= dt
          if (aiTimer <= 0) {
            aiTimer = null
            hud.setThinking(null)
            const res = aiAct(state, curAI.id)
            if (!res.ok) addLog(state, `${curAI.name} passed.`)
            endAction()
          }
        }
      } else if (!curAI.isAI && !AUTOPLAY) {
        aiTimer = null
      }
    }

    composer.render()
  })

  addLog(state, `${currentPlayer(state).name} opens the ledger.`)
  hud.refresh(state, mode, selectedCardId)

  window.setTimeout(() => {
    loading.style.opacity = '0'
    window.setTimeout(() => loading.remove(), 800)
  }, 300)
}

boot()
