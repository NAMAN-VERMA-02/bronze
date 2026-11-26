// The Aurel Valley score: a composed flute air in 6/8, D Dorian, in a stone
// hall with an echo: a slow tavern whistle over a soft frame drum. War drums
// sound for market ticks. Pure Web Audio, no files. Notes are scheduled ahead on the
// audio clock, so timing stays steady even when the main thread is busy.

type Scene = 'home' | 'game' | 'tense' | 'end'

const D4 = 62
const BAR = 6
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

// Chords as semitones above D: root, third, fifth (all inside D Dorian).
const Dm = [0, 3, 7], C = [-2, 2, 5], G = [5, 9, 12], F = [3, 7, 10], Am = [-5, -2, 2]

// Each theme: 8 bars of [chord, melody], melody as [semitones above D4, eighths].
type Bar = [number[], [number, number][]]
const THEME_A: Bar[] = [
  [Dm, [[7, 3], [5, 1], [3, 2]]],
  [C, [[2, 2], [3, 1], [2, 1], [0, 2]]],
  [G, [[2, 2], [0, 1], [-3, 3]]],
  [Dm, [[0, 6]]],
  [Dm, [[7, 2], [9, 1], [10, 2], [9, 1]]],
  [F, [[7, 3], [5, 1], [3, 2]]],
  [C, [[2, 2], [3, 1], [5, 2], [2, 1]]],
  [Dm, [[0, 6]]],
]
const THEME_B: Bar[] = [
  [Am, [[12, 3], [10, 1], [7, 2]]],
  [G, [[9, 2], [7, 1], [5, 3]]],
  [F, [[3, 1], [5, 1], [7, 1], [10, 3]]],
  [C, [[10, 2], [9, 1], [7, 3]]],
  [Dm, [[5, 2], [3, 1], [2, 2], [0, 1]]],
  [G, [[2, 3], [5, 1], [9, 2]]],
  [Am, [[7, 3], [10, 1], [9, 1], [7, 1]]],
  [Dm, [[2, 2], [0, 4]]],
]
// The order the themes play in; `up` lifts a section an octave.
const FORM: { theme: Bar[]; up?: boolean }[] = [
  { theme: THEME_A },
  { theme: THEME_B },
  { theme: THEME_A, up: true },
  { theme: THEME_B, up: true },
]

// The tavern whistle, played slow and soft over a gentle frame-drum pulse.
type Tone = { harm: number; breath: number; vibRate: number; vibDepth: number; attack: number; peak: number; legato: number }
const WHISTLE: Tone = { harm: 0.13, breath: 0.045, vibRate: 4.6, vibDepth: 0.005, attack: 0.06, peak: 0.18, legato: 0.92 }
const EIGHTH = 0.34 // seconds; about 59 dotted-quarter beats a minute
const ECHO = 0.25

export class Music {
  private ctx: AudioContext | null = null
  private out: GainNode | null = null
  private bus: GainNode | null = null
  private verb: GainNode | null = null
  private echo: GainNode | null = null
  private noise: AudioBuffer | null = null
  private timer = 0
  private next = 0
  private step = 0
  private scene: Scene = 'home'
  enabled = true
  volume = 0.55

  start(): void {
    if (this.ctx) { void this.ctx.resume(); return }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = this.enabled ? this.volume : 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.ratio.value = 3
    this.out.connect(comp).connect(ctx.destination)
    this.bus = ctx.createGain()
    this.bus.connect(this.out)
    // Hall reverb with a short pre-delay.
    const pre = ctx.createDelay(0.1)
    pre.delayTime.value = 0.03
    const conv = ctx.createConvolver()
    conv.buffer = this.impulse(3.6)
    const wet = ctx.createGain()
    wet.gain.value = 0.5
    this.verb = ctx.createGain()
    this.verb.connect(pre).connect(conv).connect(wet).connect(this.out)
    // Dotted-quarter echo for the flute.
    const dl = ctx.createDelay(2)
    dl.delayTime.value = EIGHTH * 3
    const fb = ctx.createGain()
    fb.gain.value = 0.28
    const ef = ctx.createBiquadFilter()
    ef.type = 'lowpass'
    ef.frequency.value = 2200
    this.echo = ctx.createGain()
    this.echo.connect(dl).connect(ef).connect(fb).connect(dl)
    ef.connect(this.verb)
    ef.connect(this.bus)
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const nd = this.noise.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
    this.next = ctx.currentTime + 0.1
    this.timer = window.setInterval(() => this.schedule(), 25)
  }

  setScene(s: Scene): void { this.scene = s }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.2)
  }

  setVolume(v: number): void {
    this.volume = v
    if (this.enabled) this.setEnabled(true)
  }

  /** War drum roll for market ticks and Age changes. */
  drums(hits = 3): void {
    if (!this.ctx) return
    const t0 = this.ctx.currentTime + 0.02
    for (let i = 0; i < hits; i++) this.taiko(t0 + i * 0.24, i === hits - 1 ? 1 : 0.65)
  }

  dispose(): void {
    clearInterval(this.timer)
    void this.ctx?.close()
    this.ctx = null
  }

  // ---------------------------------------------------------------- scheduler

  private schedule(): void {
    const ctx = this.ctx
    if (!ctx) return
    // After a stall (background tab), skip ahead instead of firing a burst.
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05
    while (this.next < ctx.currentTime + 0.2) {
      if (this.enabled) this.play(this.step, this.next)
      this.step++
      this.next += EIGHTH
    }
  }

  private play(step: number, t: number): void {
    const e = step % BAR
    const barNo = Math.floor(step / BAR)
    const part = FORM[Math.floor(barNo / 8) % FORM.length]
    const [, tune] = part.theme[barNo % 8]
    let at = 0
    for (const [n, len] of tune) {
      if (at === e) this.flute(D4 + n + (part.up ? 12 : 0), t, len * EIGHTH * WHISTLE.legato, WHISTLE, ECHO)
      at += len
    }
    // A soft heartbeat on the two main beats of each 6/8 bar.
    if (e === 0 || e === 3) this.bodhran(t, e === 0 ? 0.32 : 0.2)
  }

  // ---------------------------------------------------------------- instruments

  private impulse(sec: number): AudioBuffer {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * sec)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      let lp = 0
      for (let i = 0; i < len; i++) {
        // Darken the tail over time, like stone walls absorbing the highs.
        const k = 0.15 + 0.8 * (i / len)
        lp += (Math.random() * 2 - 1 - lp) * (1 - k)
        d[i] = lp * Math.pow(1 - i / len, 2.2)
      }
    }
    return buf
  }

  private route(node: AudioNode, dry: number, wet: number, echo = 0): void {
    const ctx = this.ctx!
    const d = ctx.createGain()
    d.gain.value = dry
    node.connect(d).connect(this.bus!)
    const w = ctx.createGain()
    w.gain.value = wet
    node.connect(w).connect(this.verb!)
    if (echo) {
      const x = ctx.createGain()
      x.gain.value = echo
      node.connect(x).connect(this.echo!)
    }
  }

  private flute(midi: number, t: number, dur: number, tone: Tone, echo: number): void {
    const ctx = this.ctx!
    const f0 = hz(midi)
    const o = ctx.createOscillator()
    o.frequency.value = f0
    const o2 = ctx.createOscillator()
    o2.type = 'triangle'
    o2.frequency.value = f0 * 2
    const o2g = ctx.createGain()
    o2g.gain.value = tone.harm
    // Vibrato blooms after the note settles.
    const vib = ctx.createOscillator()
    vib.frequency.value = tone.vibRate
    const vg = ctx.createGain()
    vg.gain.setValueAtTime(0, t)
    vg.gain.linearRampToValueAtTime(0, t + Math.min(0.35, dur * 0.4))
    vg.gain.linearRampToValueAtTime(f0 * tone.vibDepth, t + Math.min(0.9, dur))
    vib.connect(vg)
    vg.connect(o.frequency)
    vg.connect(o2.frequency)
    const breath = ctx.createBufferSource()
    breath.buffer = this.noise
    const bf = ctx.createBiquadFilter()
    bf.type = 'bandpass'
    bf.frequency.value = f0 * 2.2
    bf.Q.value = 2.5
    const bg = ctx.createGain()
    bg.gain.setValueAtTime(tone.breath, t)
    bg.gain.exponentialRampToValueAtTime(0.008, t + 0.12)
    const g = ctx.createGain()
    const peak = tone.peak
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + tone.attack)
    g.gain.setValueAtTime(peak, t + Math.max(0.08, dur - 0.12))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08)
    o.connect(g)
    o2.connect(o2g).connect(g)
    breath.connect(bf).connect(bg).connect(g)
    this.route(g, 0.6, 0.45, echo)
    const end = t + dur + 0.1
    for (const n of [o, o2, vib]) { n.start(t); n.stop(end) }
    breath.start(t, Math.random())
    breath.stop(end)
  }

  private bodhran(t: number, vel: number): void {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(70, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.4 * vel, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    const n = ctx.createBufferSource()
    n.buffer = this.noise
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = 900
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.12 * vel, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    o.connect(g)
    n.connect(nf).connect(ng).connect(g)
    this.route(g, 0.8, 0.2)
    o.start(t)
    o.stop(t + 0.27)
    n.start(t, Math.random())
    n.stop(t + 0.06)
  }

  private taiko(t: number, vel: number): void {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(95, t)
    o.frequency.exponentialRampToValueAtTime(38, t + 0.45)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.6 * vel, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8)
    const n = ctx.createBufferSource()
    n.buffer = this.noise
    const nf = ctx.createBiquadFilter()
    nf.type = 'lowpass'
    nf.frequency.value = 400
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.25 * vel, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    o.connect(g)
    n.connect(nf).connect(ng).connect(g)
    this.route(g, 0.85, 0.45)
    o.start(t)
    o.stop(t + 0.85)
    n.start(t, Math.random())
    n.stop(t + 0.16)
  }
}
