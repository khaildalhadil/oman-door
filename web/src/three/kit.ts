// shared canvas textures and helpers for the hand-built station rooms (NavRoom, ShipScene)
import * as THREE from 'three'

/* ------------------------------------------------------------ textures */

let seed = 11
/** restart the texture noise so a room looks the same on every visit */
export const reseed = (n: number) => void (seed = n)
export const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
export type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void
export function tex(w: number, h: number, draw: Draw, rep?: [number, number]) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (rep) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(...rep)
  }
  return t
}
export const drawPlanks: Draw = (g, w, h) => {
  const rows = 8, rh = h / rows
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 300
    while (x < w) {
      const len = 260 + rnd() * 380
      g.fillStyle = `hsl(${24 + rnd() * 8}, ${38 + rnd() * 12}%, ${20 + rnd() * 9}%)`
      g.fillRect(x, r * rh, len, rh)
      g.strokeStyle = 'rgba(0,0,0,.18)'
      g.lineWidth = 1
      for (let k = 0; k < 7; k++) {
        const y = r * rh + rnd() * rh
        g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + len / 3, y + 4, x + len / 2, y - 4, x + len, y + rnd() * 3); g.stroke()
      }
      g.fillStyle = 'rgba(0,0,0,.55)'
      g.fillRect(x + len - 2, r * rh, 2, rh)
      x += len
    }
    g.fillStyle = 'rgba(0,0,0,.6)'
    g.fillRect(0, r * rh, w, 3)
  }
}
/** long horizontal boards with no end joints (ship cabin walls) */
export const drawBoards: Draw = (g, w, h) => {
  const rows = 10, rh = h / rows
  for (let r = 0; r < rows; r++) {
    g.fillStyle = `hsl(${26 + rnd() * 6}, ${40 + rnd() * 10}%, ${34 + rnd() * 8}%)`
    g.fillRect(0, r * rh, w, rh)
    g.strokeStyle = 'rgba(60,30,10,.22)'
    g.lineWidth = 1.5
    for (let k = 0; k < 6; k++) {
      const y = r * rh + rnd() * rh
      g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w / 3, y + 3, (2 * w) / 3, y - 3, w, y + rnd() * 2); g.stroke()
    }
    g.fillStyle = 'rgba(20,10,4,.55)'
    g.fillRect(0, r * rh, w, 3)
    g.fillStyle = 'rgba(40,24,12,.7)'
    for (const x of [w * 0.12, w * 0.62]) { g.beginPath(); g.arc(x, r * rh + rh / 2, 3, 0, 7); g.fill() }
  }
}
export const drawPlaster: Draw = (g, w, h) => {
  g.fillStyle = '#d6c19c'
  g.fillRect(0, 0, w, h)
  for (let k = 0; k < 60; k++) {
    g.fillStyle = `rgba(${rnd() > 0.5 ? '255,245,225' : '120,90,55'},${0.03 + rnd() * 0.04})`
    g.beginPath(); g.arc(rnd() * w, rnd() * h, 40 + rnd() * 140, 0, 7); g.fill()
  }
  for (let k = 0; k < 9000; k++) {
    g.fillStyle = `rgba(${rnd() > 0.5 ? '255,250,235' : '90,65,40'},${0.05 + rnd() * 0.08})`
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2)
  }
}
export const drawWood: Draw = (g, w, h) => {
  g.fillStyle = '#c99a6b'
  g.fillRect(0, 0, w, h)
  for (let k = 0; k < 90; k++) {
    const x = rnd() * w
    g.strokeStyle = `rgba(90,50,25,${0.08 + rnd() * 0.18})`
    g.lineWidth = 1 + rnd() * 3
    g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 18 * (rnd() - 0.5), h / 3, x + 18 * (rnd() - 0.5), h * 0.66, x + 10 * (rnd() - 0.5), h); g.stroke()
  }
}
export const drawSea: Draw = (g, w, h) => {
  const hz = h * 0.56
  let gr = g.createLinearGradient(0, 0, 0, hz)
  gr.addColorStop(0, '#6fb2d6'); gr.addColorStop(1, '#f4e3c2')
  g.fillStyle = gr; g.fillRect(0, 0, w, hz)
  g.fillStyle = 'rgba(255,240,200,.95)'; g.beginPath(); g.arc(w * 0.72, hz * 0.52, 34, 0, 7); g.fill()
  g.fillStyle = 'rgba(255,255,255,.55)'
  for (const [x, y] of [[0.2, 0.25], [0.45, 0.18], [0.8, 0.3]]) { g.beginPath(); g.ellipse(w * x, h * y, 70, 14, 0, 0, 7); g.fill() }
  g.fillStyle = '#9a8a62'; g.beginPath(); g.moveTo(0, hz); g.quadraticCurveTo(w * 0.12, hz - 22, w * 0.26, hz - 6); g.lineTo(w * 0.26, hz); g.fill()
  gr = g.createLinearGradient(0, hz, 0, h)
  gr.addColorStop(0, '#2f8796'); gr.addColorStop(1, '#174a5a')
  g.fillStyle = gr; g.fillRect(0, hz, w, h - hz)
  g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 2
  for (let k = 0; k < 70; k++) {
    const y = hz + 6 + rnd() * (h - hz), x = rnd() * w, l = 10 + (y - hz) * 0.15
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke()
  }
  const dhow = (x: number, y: number, s: number) => {
    g.fillStyle = '#3d2a1a'
    g.beginPath(); g.moveTo(x - 20 * s, y); g.lineTo(x + 24 * s, y - 2 * s); g.lineTo(x + 16 * s, y + 6 * s); g.lineTo(x - 14 * s, y + 6 * s); g.fill()
    g.fillStyle = '#f3ead6'
    g.beginPath(); g.moveTo(x - 6 * s, y - 2 * s); g.lineTo(x - 18 * s, y - 30 * s); g.lineTo(x + 20 * s, y - 6 * s); g.fill()
  }
  dhow(w * 0.34, hz + 18, 1.1)
  dhow(w * 0.6, hz + 8, 0.6)
}
export const drawRug: Draw = (g, w, h) => {
  g.fillStyle = '#8c2a22'; g.fillRect(0, 0, w, h)
  const band = (i: number, c: string) => { g.strokeStyle = c; g.lineWidth = 14; g.strokeRect(i, i, w - 2 * i, h - 2 * i) }
  band(14, '#e8d6ae'); band(40, '#25324f'); band(64, '#c9902f')
  g.fillStyle = '#25324f'
  for (let x = 110; x < w - 100; x += 64)
    for (const y of [110, h - 110]) { g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x + 18, y); g.lineTo(x, y + 18); g.lineTo(x - 18, y); g.fill() }
  g.strokeStyle = '#e8d6ae'; g.lineWidth = 6
  const cx = w / 2, cy = h / 2
  for (const s of [1, 0.7, 0.42]) {
    g.beginPath(); g.moveTo(cx - 260 * s, cy); g.lineTo(cx, cy - 170 * s); g.lineTo(cx + 260 * s, cy); g.lineTo(cx, cy + 170 * s); g.closePath(); g.stroke()
  }
  g.fillStyle = '#c9902f'; g.beginPath(); g.arc(cx, cy, 22, 0, 7); g.fill()
}
export const drawChart: Draw = (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7)
  gr.addColorStop(0, '#efe0bd'); gr.addColorStop(1, '#bf9d66')
  g.fillStyle = gr; g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(150,115,60,.55)'
  g.beginPath(); g.moveTo(w * 0.55, 0); g.bezierCurveTo(w * 0.62, h * 0.22, w * 0.9, h * 0.26, w, h * 0.3); g.lineTo(w, 0); g.fill()
  g.beginPath(); g.moveTo(0, h * 0.18); g.bezierCurveTo(w * 0.22, h * 0.3, w * 0.24, h * 0.55, w * 0.1, h); g.lineTo(0, h); g.fill()
  const cx = w * 0.55, cy = h * 0.6
  g.strokeStyle = 'rgba(80,50,20,.25)'; g.lineWidth = 1.5
  for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * w); g.stroke() }
  g.fillStyle = '#5a3418'
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2, r = k % 2 ? 40 : 90
    g.beginPath(); g.moveTo(cx, cy)
    g.lineTo(cx + Math.cos(a - 0.2) * 16, cy + Math.sin(a - 0.2) * 16); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(cx + Math.cos(a + 0.2) * 16, cy + Math.sin(a + 0.2) * 16)
    g.fill()
  }
  g.strokeStyle = '#a3242a'; g.lineWidth = 4; g.setLineDash([14, 10])
  g.beginPath(); g.moveTo(w * 0.86, h * 0.22); g.bezierCurveTo(w * 0.7, h * 0.5, w * 0.35, h * 0.6, w * 0.18, h * 0.78); g.stroke(); g.setLineDash([])
  g.fillStyle = '#a3242a'
  for (const [x, y] of [[0.86, 0.22], [0.18, 0.78]]) { g.beginPath(); g.arc(w * x, h * y, 9, 0, 7); g.fill() }
  g.fillStyle = '#4a2a12'; g.font = '700 40px Amiri, "Reem Kufi", serif'; g.textAlign = 'center'; g.direction = 'rtl'
  g.fillText('بحر العرب', w * 0.5, h * 0.4)
  g.strokeStyle = '#5a3418'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10)
}
export const drawCompass: Draw = (g, w) => {
  g.fillStyle = '#efe3c4'; g.fillRect(0, 0, w, w)
  const c = w / 2
  g.strokeStyle = '#4a2a12'; g.lineWidth = 4; g.beginPath(); g.arc(c, c, c - 8, 0, 7); g.stroke()
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2, r = k % 2 ? c * 0.45 : c * 0.8
    g.fillStyle = k === 0 ? '#a3242a' : '#4a2a12'
    g.beginPath(); g.moveTo(c, c)
    g.lineTo(c + Math.cos(a - 0.25) * 18, c + Math.sin(a - 0.25) * 18); g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); g.lineTo(c + Math.cos(a + 0.25) * 18, c + Math.sin(a + 0.25) * 18)
    g.fill()
  }
}

export function dispose(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh
    m.geometry?.dispose()
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose()
      mat.dispose()
    }
  })
}
