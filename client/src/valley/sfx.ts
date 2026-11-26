// Spatial + tactile audio. Web Audio API only, no assets.
// Preserves the original drone/bass/chime/click palette and adds
// material cues: wood placement, coins, steam, rail clacks, card slide.

export class SoundScape {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  enabled = true
  volume = 0.7

  resume(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.5 * this.volume
        // Gentle limiting keeps overlapping cues clean and warm.
        const comp = this.ctx.createDynamicsCompressor()
        comp.threshold.value = -18
        comp.knee.value = 26
        comp.ratio.value = 5
        comp.attack.value = 0.005
        comp.release.value = 0.22
        this.master.connect(comp)
        comp.connect(this.ctx.destination)
        this.startDrone()
      } catch {
        this.ctx = null
        return
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v))
    if (this.master && this.ctx && this.enabled) {
      this.master.gain.setTargetAtTime(0.5 * this.volume, this.ctx.currentTime, 0.08)
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.5 * this.volume : 0, this.ctx.currentTime, 0.08)
    }
  }

  updateListener(cameraPos: { x: number; y: number; z: number }, fwd: { x: number; y: number; z: number }): void {
    if (!this.ctx || !this.enabled) return
    const l = this.ctx.listener
    if (l.positionX) {
      const t = this.ctx.currentTime
      l.positionX.setTargetAtTime(cameraPos.x, t, 0.02)
      l.positionY.setTargetAtTime(cameraPos.y, t, 0.02)
      l.positionZ.setTargetAtTime(cameraPos.z, t, 0.02)
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02)
      l.forwardY.setTargetAtTime(fwd.y, t, 0.02)
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.02)
      l.upX.setTargetAtTime(0, t, 0.02)
      l.upY.setTargetAtTime(1, t, 0.02)
      l.upZ.setTargetAtTime(0, t, 0.02)
    } else {
      l.setPosition(cameraPos.x, cameraPos.y, cameraPos.z)
      l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0)
    }
  }

  private panner(x: number, y: number, z: number): PannerNode | null {
    if (!this.ctx) return null
    const p = this.ctx.createPanner()
    p.panningModel = 'HRTF'
    p.distanceModel = 'inverse'
    p.refDistance = 5
    p.maxDistance = 90
    p.rolloffFactor = 1.0
    p.positionX.value = x
    p.positionY.value = y
    p.positionZ.value = z
    return p
  }

  private route(node: AudioNode, pan: PannerNode | null): void {
    if (!this.ctx || !this.master) return
    if (pan) {
      node.connect(pan)
      pan.connect(this.master)
    } else {
      node.connect(this.master)
    }
  }

  private noiseBuffer(seconds: number): AudioBuffer | null {
    if (!this.ctx) return null
    const len = Math.floor(this.ctx.sampleRate * seconds)
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  // Deep resonant whoosh for route/camera moves.
  bass(x: number, y: number, z: number): void {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(95, t)
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.6)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.7, t + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    osc.connect(gain)
    this.route(gain, this.panner(x, y, z))
    osc.start(t)
    osc.stop(t + 1)
  }

  chime(x: number, y: number, z: number): void {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    const partials: [number, number, number][] = [
      [1244.5, 0.085, 2.2],
      [1866.8, 0.055, 1.8],
      [2489.0, 0.034, 1.4],
    ]
    for (const [freq, vol, dur] of partials) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.connect(gain)
      this.route(gain, this.panner(x, y, z))
      osc.start(t)
      osc.stop(t + dur + 0.1)
    }
  }

  click(x: number, y: number, z: number): void {
    this.metalClick(x, y, z, 2100, 0.16)
  }

  private metalClick(x: number, y: number, z: number, freq: number, vol: number): void {
    if (!this.ctx || !this.enabled) return
    const buf = this.noiseBuffer(0.06)
    if (!buf) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = 6
    const gain = this.ctx.createGain()
    gain.gain.value = vol
    src.connect(bp)
    bp.connect(gain)
    this.route(gain, this.panner(x, y, z))
    src.start(t)
  }

  // Wooden tile settling onto the board.
  woodPlace(x: number, y: number, z: number): void {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(160, t)
    osc.frequency.exponentialRampToValueAtTime(58, t + 0.12)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.38, t + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    osc.connect(gain)
    this.route(gain, this.panner(x, y, z))
    osc.start(t)
    osc.stop(t + 0.3)
    const buf = this.noiseBuffer(0.05)
    if (buf) {
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 900
      const ng = this.ctx.createGain()
      ng.gain.value = 0.16
      src.connect(lp)
      lp.connect(ng)
      this.route(ng, this.panner(x, y, z))
      src.start(t)
    }
  }

  coins(x: number, y: number, z: number): void {
    if (!this.ctx || !this.enabled) return
    const times = [0, 0.07, 0.15]
    for (const off of times) {
      const t = this.ctx.currentTime + off
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 2400 + Math.random() * 900
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.06, t + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
      osc.connect(gain)
      this.route(gain, this.panner(x, y, z))
      osc.start(t)
      osc.stop(t + 0.12)
    }
  }

  steam(x: number, y: number, z: number, vol = 0.14): void {
    if (!this.ctx || !this.enabled) return
    const buf = this.noiseBuffer(0.7)
    if (!buf) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const hp = this.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1400
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.linearRampToValueAtTime(vol, t + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65)
    src.connect(hp)
    hp.connect(gain)
    this.route(gain, this.panner(x, y, z))
    src.start(t)
  }

  railClack(x: number, y: number, z: number): void {
    this.metalClick(x, y, z, 900, 0.2)
    window.setTimeout(() => this.metalClick(x, y, z, 700, 0.26), 110)
  }

  cardSlide(): void {
    if (!this.ctx || !this.enabled) return
    const buf = this.noiseBuffer(0.12)
    if (!buf) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(600, t)
    bp.frequency.linearRampToValueAtTime(1400, t + 0.12)
    bp.Q.value = 1.4
    const gain = this.ctx.createGain()
    gain.gain.value = 0.1
    src.connect(bp)
    bp.connect(gain)
    this.route(gain, null)
    src.start(t)
  }

  eraFanfare(): void {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    ;[98, 147, 196].forEach((f, i) => {
      const osc = this.ctx!.createOscillator()
      const gain = this.ctx!.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f
      const st = t + i * 0.18
      gain.gain.setValueAtTime(0.0001, st)
      gain.gain.linearRampToValueAtTime(0.22, st + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, st + 1.4)
      osc.connect(gain)
      this.route(gain, null)
      osc.start(st)
      osc.stop(st + 1.5)
    })
  }

  // Dedicated Canal→Railway transition: the world descends into iron.
  eraShift(): void {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    // Deep descending drone.
    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(130, t)
    osc.frequency.exponentialRampToValueAtTime(46, t + 1.9)
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(420, t)
    lp.frequency.exponentialRampToValueAtTime(140, t + 2)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.25)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3)
    osc.connect(lp)
    lp.connect(g)
    this.route(g, null)
    osc.start(t)
    osc.stop(t + 2.4)
    // Machinery breath.
    window.setTimeout(() => this.steam(0, 2, 0, 0.09), 350)
    // Iron clanks as the rails arrive.
    window.setTimeout(() => this.metalClick(0, 1, 0, 520, 0.18), 950)
    window.setTimeout(() => this.metalClick(0, 1, 0, 430, 0.15), 1180)
    // Low metallic resonance tail.
    const tail = this.ctx.createOscillator()
    tail.type = 'triangle'
    tail.frequency.value = 82.4
    const tg = this.ctx.createGain()
    tg.gain.setValueAtTime(0.0001, t + 1.3)
    tg.gain.exponentialRampToValueAtTime(0.12, t + 1.45)
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 3.1)
    tail.connect(tg)
    this.route(tg, null)
    tail.start(t + 1.3)
    tail.stop(t + 3.2)
  }

  private startDrone(): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 54
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 130
    lp.Q.value = 6
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 38
    lfo.connect(lfoGain)
    lfoGain.connect(lp.frequency)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.linearRampToValueAtTime(0.04, t + 4)
    osc.connect(lp)
    lp.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    lfo.start(t)
  }
}
