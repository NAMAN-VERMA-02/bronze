// Generative old-world score. Dorian-mode plucked strings + soft bells +
// low bowed drone, rendered live via Web Audio — no assets, no copyright.
// A licensed audio file can replace startAmbience() later without touching
// callers: everything funnels through setScene/setVolumes/setEnabled.

export type MusicScene = 'home' | 'lobby' | 'game' | 'rail' | 'results'

const DORIAN = [0, 2, 3, 5, 7, 9, 10] // D dorian
const BASE = 146.83 // D3

// Adaptive multi-track system. Each "track" is a distinct generative
// arrangement (mode, tempo, layer balance) rendered live — no assets,
// no licensing risk, endless variation without repetition fatigue.
export interface TrackPreset {
  id: string
  title: string
  mode: number[]
  tempo: number
  pluck: number // melody bus level & density
  bell: number // bell frequency/level
  drone: number // low bowed bed
  pulse: number // metallic rail pulse
  hum: number // soft human-like humming pad
}

export const TRACKS: TrackPreset[] = [
  { id: 'workshop-dawn', title: 'Workshop Dawn', mode: [0, 2, 3, 7, 9], tempo: 58, pluck: 0.5, bell: 0.14, drone: 0.3, pulse: 0, hum: 0.14 },
  { id: 'anticipation', title: 'Anticipation', mode: DORIAN, tempo: 64, pluck: 0.68, bell: 0.16, drone: 0.32, pulse: 0, hum: 0.18 },
  { id: 'canal-hum', title: 'Canal Hum', mode: [0, 2, 3, 5, 7, 10], tempo: 62, pluck: 0.5, bell: 0.22, drone: 0.34, pulse: 0, hum: 0.24 },
  { id: 'loom-and-lathe', title: 'Loom & Lathe', mode: [0, 3, 5, 7, 10], tempo: 66, pluck: 0.6, bell: 0.16, drone: 0.38, pulse: 0, hum: 0.2 },
  { id: 'ironworks-nocturne', title: 'Ironworks Nocturne', mode: [0, 1, 5, 7, 8], tempo: 56, pluck: 0.42, bell: 0.26, drone: 0.46, pulse: 0.12, hum: 0.22 },
  { id: 'rail-spine', title: 'Rail Spine', mode: [0, 2, 4, 7, 9], tempo: 70, pluck: 0.62, bell: 0.12, drone: 0.42, pulse: 0.55, hum: 0.18 },
  { id: 'full-steam', title: 'Full Steam', mode: [0, 2, 4, 7, 11], tempo: 74, pluck: 0.66, bell: 0.1, drone: 0.46, pulse: 0.75, hum: 0.16 },
  { id: 'final-reckoning', title: 'Final Reckoning', mode: [0, 3, 5, 8, 10], tempo: 50, pluck: 0.34, bell: 0.34, drone: 0.36, pulse: 0, hum: 0.3 },
]

export function trackById(id: string): TrackPreset {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[2]
}

/** Pick a compatible track without immediately repeating the last one. */
export function pickTrack(candidates: string[], avoid?: string): string {
  const pool = candidates.filter((c) => c !== avoid)
  const list = pool.length > 0 ? pool : candidates
  return list[Math.floor(Math.random() * list.length)]
}

export class MusicBox {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private pluckBus: GainNode | null = null
  private droneBus: GainNode | null = null
  private bellBus: GainNode | null = null
  private pulseBus: GainNode | null = null
  private humBus: GainNode | null = null
  private timer = 0
  private step = 0
  private nextTime = 0
  private scene: MusicScene = 'home'
  private cur: TrackPreset = TRACKS[2]
  enabled = false
  volume = 0.55

  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    try {
      this.ctx = new AudioContext()
    } catch {
      this.ctx = null
      return
    }
    const ctx = this.ctx
    this.bus = ctx.createGain()
    this.bus.gain.value = 0
    // Warm limiting so plucks + bells never clip against the drone.
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -20
    comp.knee.value = 26
    comp.ratio.value = 5
    comp.attack.value = 0.006
    comp.release.value = 0.3
    this.bus.connect(comp)
    comp.connect(ctx.destination)

    const mk = (): GainNode => {
      const g = ctx.createGain()
      g.connect(this.bus!)
      return g
    }
    this.pluckBus = mk()
    this.droneBus = mk()
    this.bellBus = mk()
    this.pulseBus = mk()
    this.humBus = mk()
    this.pluckBus.gain.value = this.cur.pluck
    this.droneBus.gain.value = this.cur.drone
    this.bellBus.gain.value = this.cur.bell
    this.pulseBus.gain.value = this.cur.pulse
    this.humBus.gain.value = this.cur.hum

    this.startDrone()
    this.startHum()
    this.nextTime = ctx.currentTime + 0.1
    this.timer = window.setInterval(() => this.schedule(), 240)
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (!on && this.bus && this.ctx) {
      this.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6)
    } else if (on) {
      this.ensure()
      this.applyScene()
    }
  }

  setVolume(v: number): void {
    this.volume = v
    this.applyScene()
  }

  setScene(s: MusicScene): void {
    this.scene = s
    const defaults: Record<MusicScene, string> = {
      home: 'workshop-dawn',
      lobby: 'anticipation',
      game: 'canal-hum',
      rail: 'rail-spine',
      results: 'final-reckoning',
    }
    this.setTrack(defaults[s])
  }

  /** Smooth 2.5s crossfade into a new arrangement; melody never hard-cuts. */
  setTrack(id: string): void {
    const t = trackById(id)
    if (t.id === this.cur.id && this.ctx) return
    this.cur = t
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const ramp = (bus: GainNode | null, v: number): void => {
      bus?.gain.setTargetAtTime(v, now, 1.0)
    }
    ramp(this.pluckBus, t.pluck)
    ramp(this.droneBus, t.drone)
    ramp(this.bellBus, t.bell)
    ramp(this.pulseBus, t.pulse)
    ramp(this.humBus, t.hum)
    this.applyScene()
  }

  get currentTrack(): string {
    return this.cur.title
  }

  private applyScene(): void {
    if (!this.ctx || !this.bus || !this.enabled) return
    const t = this.ctx.currentTime
    const v = this.volume * 0.24
    const sceneGain =
      this.scene === 'home' ? 1 : this.scene === 'lobby' ? 0.85 : this.scene === 'results' ? 0.9 : 0.75
    this.bus.gain.setTargetAtTime(v * sceneGain, t, 1.2)
    // Scene shapes the active track; it never overrides the track's own mix.
    const tr = this.cur
    this.pulseBus?.gain.setTargetAtTime(this.scene === 'rail' ? Math.max(tr.pulse, 0.5) : tr.pulse, t, 2)
    this.pluckBus?.gain.setTargetAtTime(Math.min(1, tr.pluck * (this.scene === 'game' || this.scene === 'rail' ? 0.9 : 1.15)), t, 1.5)
    this.droneBus?.gain.setTargetAtTime(tr.drone, t, 1.5)
    this.bellBus?.gain.setTargetAtTime(tr.bell, t, 1.5)
    this.humBus?.gain.setTargetAtTime(tr.hum, t, 1.5)
  }

  dispose(): void {
    window.clearInterval(this.timer)
    void this.ctx?.close()
    this.ctx = null
  }

  // --------------------------- voices ---------------------------------------

  private startHum(): void {
    if (!this.ctx || !this.humBus) return
    const ctx = this.ctx
    // Two softly detuned triangles through a vowel-ish bandpass: a warm,
    // non-lyrical "hum" that breathes with the drone.
    for (const det of [-6, 5]) {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = BASE / 2
      osc.detune.value = det * 4
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 340
      bp.Q.value = 1.1
      const g = ctx.createGain()
      g.gain.value = 0.14
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.09 + Math.random() * 0.05
      const lg = ctx.createGain()
      lg.gain.value = 0.05
      lfo.connect(lg)
      lg.connect(g.gain)
      osc.connect(bp)
      bp.connect(g)
      g.connect(this.humBus)
      osc.start()
      lfo.start()
    }
  }

  private startDrone(): void {
    if (!this.ctx || !this.droneBus) return
    const ctx = this.ctx
    for (const [freq, detune] of [
      [73.42, -4], // D2
      [110.0, 3], // A2
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = detune
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 220
      lp.Q.value = 2
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.06 + Math.random() * 0.04
      const lfoG = ctx.createGain()
      lfoG.gain.value = 60
      lfo.connect(lfoG)
      lfoG.connect(lp.frequency)
      const g = ctx.createGain()
      g.gain.value = 0.16
      osc.connect(lp)
      lp.connect(g)
      g.connect(this.droneBus)
      osc.start()
      lfo.start()
    }
  }

  private pluck(freq: number, when: number, vel: number): void {
    if (!this.ctx || !this.pluckBus) return
    const ctx = this.ctx
    // Body: decaying triangle through a moving bandpass — lute-ish.
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const bp = ctx.createBiquadFilter()
    bp.type = 'lowpass'
    bp.frequency.setValueAtTime(freq * 6, when)
    bp.frequency.exponentialRampToValueAtTime(freq * 1.6, when + 0.5)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(vel, when + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.4)
    osc.connect(bp)
    bp.connect(g)
    g.connect(this.pluckBus)
    osc.start(when)
    osc.stop(when + 1.5)
    // Attack noise: brief filtered burst gives the string scrape.
    const nb = ctx.createBufferSource()
    nb.buffer = this.noise(0.05)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(vel * 0.25, when)
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.05)
    nb.connect(ng)
    ng.connect(this.pluckBus!)
    nb.start(when)
  }

  private bell(when: number): void {
    if (!this.ctx || !this.bellBus) return
    const partials: [number, number][] = [
      [587.33, 0.14],
      [880, 0.07],
      [1174.7, 0.045],
    ]
    for (const [f, v] of partials) {
      const o = this.ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.002)
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, when)
      g.gain.exponentialRampToValueAtTime(v, when + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, when + 3.4)
      o.connect(g)
      g.connect(this.bellBus)
      o.start(when)
      o.stop(when + 3.5)
    }
  }

  private railTick(when: number): void {
    if (!this.ctx || !this.pulseBus) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise(0.04)
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 320
    bp.Q.value = 4
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.12, when)
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.09)
    src.connect(bp)
    bp.connect(g)
    g.connect(this.pulseBus)
    src.start(when)
  }

  private noise(sec: number): AudioBuffer {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * sec)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  // --------------------------- scheduler ------------------------------------

  private schedule(): void {
    if (!this.ctx || !this.enabled) return
    const spb = 60 / this.cur.tempo / 2
    const density = Math.min(0.78, Math.max(0.3, this.cur.pluck))
    while (this.nextTime < this.ctx.currentTime + 0.6) {
      const t = this.nextTime
      const bar = Math.floor(this.step / 8)
      const beat = this.step % 8

      // Melody: sparse random walk on the track's mode, resting often.
      if (Math.random() < density) {
        const deg = this.cur.mode[Math.floor(Math.random() * this.cur.mode.length)]
        const oct = Math.random() < 0.22 ? 2 : 1
        const freq = BASE * Math.pow(2, (deg + 7 * (oct - 1)) / 12)
        const vel = 0.16 + Math.random() * 0.1
        this.pluck(freq, t, vel)
        if (Math.random() < 0.18) this.pluck(freq * 1.5, t + spb * 0.5, vel * 0.6)
      }
      // Bass pluck at bar starts.
      if (beat === 0) {
        this.pluck((BASE / 2) * Math.pow(2, this.cur.mode[bar % 4 === 3 ? 4 : 0] / 12), t, 0.2)
      }
      // Soft bell — more frequent on bell-heavy tracks.
      if (this.step % 32 === 12 && Math.random() < this.cur.bell + 0.35) this.bell(t)
      // Railway-era slow metallic pulse.
      if (beat % 4 === 0) this.railTick(t + 0.02)

      this.step++
      this.nextTime += spb
    }
  }
}
