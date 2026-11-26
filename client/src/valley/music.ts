// Generative elven-medieval score: harp arpeggios, a breathy flute line,
// a low drone and war drums for market ticks. Web Audio only, no files.

type Scene = 'home' | 'game' | 'tense' | 'end'

// D Dorian. Chords as scale degrees (semitones from D).
const ROOT = 50 // D3
const DORIAN = [0, 2, 3, 5, 7, 9, 10]
const PROGRESSIONS: number[][][] = [
  [[0, 3, 7], [-2, 2, 5], [5, 9, 12], [0, 3, 7]], // Dm C G Dm
  [[0, 3, 7], [3, 7, 10], [-2, 2, 5], [-5, -2, 2]], // Dm F C Am/G
  [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7]], // Dm Bb C Dm
]

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

export class Music {
  private ctx: AudioContext | null = null
  private out: GainNode | null = null
  private verb: ConvolverNode | null = null
  private timer = 0
  private step = 0
  private bar = 0
  private prog = 0
  private scene: Scene = 'home'
  enabled = true
  volume = 0.55

  start(): void {
    if (this.ctx) { void this.ctx.resume(); return }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = this.enabled ? this.volume : 0
    this.verb = ctx.createConvolver()
    this.verb.buffer = this.impulse(3.2)
    const wet = ctx.createGain()
    wet.gain.value = 0.45
    this.verb.connect(wet).connect(this.out)
    this.out.connect(ctx.destination)
    this.drone()
    this.timer = window.setInterval(() => this.tick(), 60_000 / 84 / 2) // 8th notes at 84 bpm
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

  /** Three-hit war drum roll for market ticks and Age changes. */
  drums(hits = 3): void {
    if (!this.ctx || !this.out) return
    const t0 = this.ctx.currentTime
    for (let i = 0; i < hits; i++) this.drum(t0 + i * 0.22, i === hits - 1 ? 1 : 0.7)
  }

  private impulse(sec: number): AudioBuffer {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * sec)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6)
    }
    return buf
  }

  private send(node: AudioNode, dry = 0.6): void {
    const g = this.ctx!.createGain()
    g.gain.value = dry
    node.connect(g).connect(this.out!)
    node.connect(this.verb!)
  }

  private drone(): void {
    const ctx = this.ctx!
    for (const [m, v] of [[ROOT - 12, 0.05], [ROOT - 5, 0.025]] as const) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = hz(m)
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 380
      const g = ctx.createGain()
      g.gain.value = v
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.07
      const lg = ctx.createGain()
      lg.gain.value = 120
      lfo.connect(lg).connect(f.frequency)
      o.connect(f).connect(g)
      this.send(g, 0.5)
      o.start()
      lfo.start()
    }
  }

  private harp(midi: number, t: number, vel: number): void {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const o2 = ctx.createOscillator()
    o.type = 'triangle'
    o2.type = 'sine'
    o.frequency.value = hz(midi)
    o2.frequency.value = hz(midi + 12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.11 * vel, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0008, t + 2.2)
    const g2 = ctx.createGain()
    g2.gain.value = 0.25
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(4200, t)
    f.frequency.exponentialRampToValueAtTime(900, t + 1)
    o.connect(f)
    o2.connect(g2).connect(f)
    f.connect(g)
    this.send(g)
    o.start(t)
    o2.start(t)
    o.stop(t + 2.3)
    o2.stop(t + 2.3)
  }

  private flute(midi: number, t: number, dur: number): void {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = hz(midi)
    const vib = ctx.createOscillator()
    vib.frequency.value = 5.2
    const vg = ctx.createGain()
    vg.gain.setValueAtTime(0, t)
    vg.gain.linearRampToValueAtTime(hz(midi) * 0.006, t + 0.4)
    vib.connect(vg).connect(o.frequency)
    // Breath noise gives the flute its air.
    const n = ctx.createBufferSource()
    const nb = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate)
    const nd = nb.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
    n.buffer = nb
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = hz(midi) * 2
    nf.Q.value = 3
    const ng = ctx.createGain()
    ng.gain.value = 0.012
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.06, t + 0.18)
    g.gain.setValueAtTime(0.06, t + dur - 0.3)
    g.gain.linearRampToValueAtTime(0, t + dur)
    o.connect(g)
    n.connect(nf).connect(ng).connect(g)
    this.send(g, 0.45)
    o.start(t)
    vib.start(t)
    n.start(t)
    o.stop(t + dur)
    vib.stop(t + dur)
    n.stop(t + dur)
  }

  private drum(t: number, vel: number): void {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(110, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.35)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.5 * vel, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    o.connect(g)
    this.send(g, 0.8)
    o.start(t)
    o.stop(t + 0.65)
  }

  private tick(): void {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime + 0.05
    const chords = PROGRESSIONS[this.prog]
    const chord = chords[this.bar % 4]
    const s = this.step % 8
    // Arpeggio: up through the chord and an octave, gentler on the home screen.
    const pattern = [0, 1, 2, 3, 2, 1, 0, 2]
    const tones = [...chord, chord[0] + 12]
    if (this.scene !== 'end' || s % 2 === 0) this.harp(ROOT + tones[pattern[s]], t, s === 0 ? 1 : 0.7)
    if (s === 0) this.harp(ROOT - 12 + chord[0], t, 0.9)
    // Flute phrase on bars 2 and 4, notes drawn from Dorian near the chord.
    if (s === 0 && this.bar % 2 === 1 && this.scene !== 'home') {
      const deg = DORIAN[(chord[0] + 14 + Math.floor(Math.random() * 3) * 2) % 7] ?? 0
      this.flute(ROOT + 12 + deg, t, 1.3)
      this.flute(ROOT + 12 + DORIAN[(DORIAN.indexOf(deg) + 1) % 7], t + 1.4, 1.3)
    }
    if (this.scene === 'tense' && (s === 0 || s === 3 || s === 6)) this.drum(t, s === 0 ? 0.6 : 0.35)
    this.step++
    if (this.step % 8 === 0) {
      this.bar++
      if (this.bar % 8 === 0) this.prog = (this.prog + 1) % PROGRESSIONS.length
    }
  }

  dispose(): void {
    clearInterval(this.timer)
    void this.ctx?.close()
    this.ctx = null
  }
}
