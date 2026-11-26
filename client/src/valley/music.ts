// The Aurel Valley score: a composed elven-medieval air in 6/8, D Dorian.
// Plucked harp (Karplus-Strong), recorder melody, string pad, bodhran pulse
// and war drums. Pure Web Audio, no files. Notes are scheduled ahead on the
// audio clock, so timing stays steady even when the main thread is busy.

type Scene = 'home' | 'game' | 'tense' | 'end'

const D3 = 50
const D4 = 62
const EIGHTH = 0.36 // seconds; 6/8 at about 56 dotted-quarter beats a minute
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
// The order the themes play in, and who carries the tune.
const FORM: { theme: Bar[]; lead: 'harp' | 'flute' | 'none'; up?: boolean }[] = [
  { theme: THEME_A, lead: 'none' },
  { theme: THEME_A, lead: 'flute' },
  { theme: THEME_B, lead: 'flute' },
  { theme: THEME_A, lead: 'harp', up: true },
  { theme: THEME_B, lead: 'none' },
  { theme: THEME_A, lead: 'flute', up: true },
]
// Harp accompaniment per eighth: chord-tone index (0 root, 1 third, 2 fifth) and octave.
const ARP: [number, number][] = [[0, -12], [2, -12], [0, 0], [1, 0], [2, 0], [1, 0]]

export class Music {
  private ctx: AudioContext | null = null
  private out: GainNode | null = null
  private bus: GainNode | null = null
  private verb: GainNode | null = null
  private echo: GainNode | null = null
  private noise: AudioBuffer | null = null
  private plucks = new Map<number, AudioBuffer>()
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
    const [chord, tune] = part.theme[barNo % 8]
    const sc = this.scene
    const calm = sc === 'home' || sc === 'end'

    // Harp: rolling chord, thinner when calm.
    const [ci, oct] = ARP[e]
    if (!calm || e % 2 === 0) this.harp(D3 + 12 + chord[ci] + oct, t, e === 0 ? 0.9 : 0.55)
    if (e === 0) this.harp(D3 - 12 + chord[0], t, 0.8)
    if (e === 3 && !calm) this.harp(D3 - 12 + chord[2], t, 0.5)

    // String pad, one voicing per bar.
    if (e === 0) this.pad(chord, t, EIGHTH * BAR)

    // The tune.
    const lead = sc === 'end' ? 'flute' : sc === 'home' ? (part.lead === 'none' ? 'none' : 'harp') : part.lead
    if (lead !== 'none') {
      let at = 0
      for (const [n, len] of tune) {
        if (at === e) {
          const m = D4 + n + (part.up && sc !== 'home' ? 12 : 0)
          if (lead === 'flute') this.flute(m, t, len * EIGHTH * 0.96)
          else this.harp(m + 12, t, 0.75)
        }
        at += len
      }
    }

    // Percussion: soft bodhran in play, a driving ostinato in the last Age.
    if (sc === 'game' && (e === 0 || e === 3)) this.bodhran(t, e === 0 ? 0.55 : 0.35)
    if (sc === 'tense') {
      if (e === 0 || e === 3) this.taiko(t, e === 0 ? 0.55 : 0.4)
      this.bodhran(t, e === 0 || e === 3 ? 0.5 : 0.22)
    }
    // A bell marks the start of each new section.
    if (e === 0 && barNo % 8 === 0) this.bell(D4 + 12 + chord[0], t)
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

  /** Karplus-Strong string: a noise burst circulating in a damped delay line. */
  private pluckBuffer(midi: number): AudioBuffer {
    const hit = this.plucks.get(midi)
    if (hit) return hit
    const ctx = this.ctx!
    const sr = ctx.sampleRate
    const f = hz(midi)
    const len = Math.floor(sr * 2.6)
    const buf = ctx.createBuffer(1, len, sr)
    const y = buf.getChannelData(0)
    // The two-tap averaging filter adds half a sample of delay; take it out of the line.
    const period = sr / f - 0.5
    const D = Math.floor(period)
    const frac = period - D
    const t60 = 3.2 - Math.min(2.2, (midi - 40) * 0.045) // low strings ring longer
    const decay = Math.pow(10, -3 / (t60 * f))
    let lp = 0
    for (let i = 0; i < D + 2; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.55; y[i] = lp }
    for (let i = D + 2; i < len; i++) {
      const a = (1 - frac) * y[i - D] + frac * y[i - D - 1]
      const b = (1 - frac) * y[i - D - 1] + frac * y[i - D - 2]
      y[i] = decay * 0.5 * (a + b)
    }
    let peak = 0
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(y[i]))
    for (let i = 0; i < len; i++) y[i] /= peak || 1
    this.plucks.set(midi, buf)
    return buf
  }

  private harp(midi: number, t: number, vel: number): void {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.pluckBuffer(midi)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 2400 + vel * 2400
    const g = ctx.createGain()
    g.gain.value = 0.17 * vel
    src.connect(f).connect(g)
    this.route(g, 0.75, 0.55)
    src.start(t)
  }

  private flute(midi: number, t: number, dur: number): void {
    const ctx = this.ctx!
    const f0 = hz(midi)
    const o = ctx.createOscillator()
    o.frequency.value = f0
    const o2 = ctx.createOscillator()
    o2.type = 'triangle'
    o2.frequency.value = f0 * 2
    const o2g = ctx.createGain()
    o2g.gain.value = 0.08
    // Vibrato blooms after the note settles.
    const vib = ctx.createOscillator()
    vib.frequency.value = 5
    const vg = ctx.createGain()
    vg.gain.setValueAtTime(0, t)
    vg.gain.linearRampToValueAtTime(0, t + Math.min(0.35, dur * 0.4))
    vg.gain.linearRampToValueAtTime(f0 * 0.007, t + Math.min(0.9, dur))
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
    bg.gain.setValueAtTime(0.05, t)
    bg.gain.exponentialRampToValueAtTime(0.008, t + 0.12)
    const g = ctx.createGain()
    const peak = 0.075
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.07)
    g.gain.setValueAtTime(peak, t + Math.max(0.08, dur - 0.12))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08)
    o.connect(g)
    o2.connect(o2g).connect(g)
    breath.connect(bf).connect(bg).connect(g)
    this.route(g, 0.6, 0.45, 0.35)
    const end = t + dur + 0.1
    for (const n of [o, o2, vib]) { n.start(t); n.stop(end) }
    breath.start(t, Math.random())
    breath.stop(end)
  }

  private pad(chord: number[], t: number, len: number): void {
    const ctx = this.ctx!
    const dark = this.scene === 'tense'
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = dark ? 650 : 1000
    f.Q.value = 0.4
    const g = ctx.createGain()
    const lvl = this.scene === 'home' ? 0.02 : 0.028
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(lvl, t + len * 0.45)
    g.gain.setValueAtTime(lvl, t + len * 0.8)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len * 1.35)
    f.connect(g)
    this.route(g, 0.5, 0.8)
    const voices = [D3 + chord[0], D3 + chord[1] + 12, D3 + chord[2]]
    for (const m of voices) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = hz(m)
        o.detune.value = det
        o.connect(f)
        o.start(t)
        o.stop(t + len * 1.4)
      }
    }
  }

  private bodhran(t: number, vel: number): void {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(70, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.32 * vel, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
    const n = ctx.createBufferSource()
    n.buffer = this.noise
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = 900
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.09 * vel, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    o.connect(g)
    n.connect(nf).connect(ng).connect(g)
    this.route(g, 0.8, 0.25)
    o.start(t)
    o.stop(t + 0.3)
    n.start(t, Math.random())
    n.stop(t + 0.07)
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

  private bell(midi: number, t: number): void {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.05, t)
    g.gain.exponentialRampToValueAtTime(0.0005, t + 4)
    this.route(g, 0.4, 0.9)
    // Inharmonic partials give the metal its shimmer.
    for (const [ratio, amp] of [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]]) {
      const o = ctx.createOscillator()
      o.frequency.value = hz(midi) * ratio
      const og = ctx.createGain()
      og.gain.value = amp
      o.connect(og).connect(g)
      o.start(t)
      o.stop(t + 4)
    }
  }
}
