// Tiny synthesised sound effects (no audio files needed).
let ctx: AudioContext | null = null
let muted = false

export function setMuted(m: boolean) {
  muted = m
}

export function unlockAudio() {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    ctx = null
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18, slide = 0) {
  if (!ctx || muted) return
  const t0 = ctx.currentTime + start
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(ctx.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.05)
}

function noise(start: number, dur: number, gain = 0.1) {
  if (!ctx || muted) return
  const t0 = ctx.currentTime + start
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const g = ctx.createGain()
  g.gain.value = gain
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 900
  src.connect(f).connect(g).connect(ctx.destination)
  src.start(t0)
}

export const sfx = {
  correct() {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.35, 'triangle', 0.16))
    tone(1568, 0.36, 0.5, 'sine', 0.08)
  },
  wrong() {
    tone(330, 0, 0.22, 'square', 0.07, 0.8)
    tone(247, 0.2, 0.35, 'square', 0.07, 0.75)
  },
  ding() {
    tone(880, 0, 0.25, 'sine', 0.12)
    tone(1320, 0.06, 0.3, 'sine', 0.07)
  },
  jump() {
    tone(420, 0, 0.16, 'sine', 0.06, 1.8)
  },
  whoosh() {
    tone(220, 0, 0.5, 'sawtooth', 0.03, 2.5)
  },
  win() {
    const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5]
    seq.forEach((f, i) => tone(f, i * 0.13, 0.4, 'triangle', 0.15))
    tone(1046.5, 0.95, 1.2, 'sine', 0.1)
  },
  click() {
    tone(660, 0, 0.06, 'triangle', 0.06)
  },
  stamp() {
    // a soft rubber-stamp "thump"
    tone(110, 0, 0.18, 'sine', 0.35, 0.5)
    tone(70, 0.01, 0.25, 'triangle', 0.2, 0.6)
    noise(0.0, 0.08, 0.12)
  },
  dig() {
    noise(0, 0.12, 0.1)
    noise(0.15, 0.12, 0.08)
  },
  splash() {
    noise(0, 0.35, 0.06)
    tone(600, 0, 0.2, 'sine', 0.04, 0.4)
  },
}
