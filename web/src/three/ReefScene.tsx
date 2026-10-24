// «كنوز البحر العُماني»: a coral reef under the Omani sea. The turtle, the giant oyster and the clownfish
// open the three treasure cards (ui/ReefStation.tsx); everything here is procedural.
import { Html, OrbitControls, Sparkles } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { STATIONS } from '../stations'
import { useStore } from '../store'
import { toAr } from '../ui/Quiz'
import { useReef } from '../ui/ReefStation'
import { dispose, drawSea, makeBaghlah, reseed, rnd, std, tex, type Draw } from './kit'

const DEF = STATIONS.turtles
const ease = (k: number) => k * k * (3 - 2 * k)
const fovFor = (a: number) => (a < 0.8 ? 72 : a < 1.2 ? 60 : 50)
const TARGET = new THREE.Vector3(0, 1.3, 0)
const FROM = new THREE.Vector3(0, 7, 18)
const SEAT = new THREE.Vector3(0, 2.8, 9.2)
// the treasures, left to right as on the teacher's screens (keys of STATIONS.turtles.items)
const SPOT = { turtle: new THREE.Vector3(-3.6, 2.2, 0), pearl: new THREE.Vector3(0, 0, 0.8), fish: new THREE.Vector3(3.8, 0, -0.4) }
const TAG_Y = { turtle: 1.4, pearl: 1.5, fish: 2.3 }

/* ------------------------------------------------------------- textures */

const drawSand: Draw = (g, w, h) => {
  g.fillStyle = '#d4b985'
  g.fillRect(0, 0, w, h)
  for (let k = 0; k < 9000; k++) {
    const v = (170 + rnd() * 70) | 0
    g.fillStyle = `rgba(${v},${v - 22},${v - 70},0.35)`
    g.fillRect(rnd() * w, rnd() * h, 2, 2)
  }
  g.strokeStyle = 'rgba(140,105,60,0.22)'
  g.lineWidth = 5
  for (let y = 0; y < h; y += 24) {
    g.beginPath()
    for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.035 + y) * 6)
    g.stroke()
  }
}

const drawCaustics: Draw = (g, w, h) => {
  g.fillStyle = '#000'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = 'rgba(210,250,255,0.9)'
  g.lineWidth = 3
  g.shadowColor = '#c8f6ff'
  g.shadowBlur = 8
  for (let k = 0; k < 70; k++) {
    const cx = rnd() * w
    const cy = rnd() * h
    const r = 16 + rnd() * 28
    const pts: [number, number][] = []
    for (let a = 0; a < Math.PI * 2; a += 0.55) pts.push([Math.cos(a) * r * (0.7 + rnd() * 0.5), Math.sin(a) * r * (0.7 + rnd() * 0.5)])
    // drawn on all sides so the pattern tiles
    for (const dx of [-w, 0, w])
      for (const dy of [-h, 0, h]) {
        g.beginPath()
        pts.forEach(([x, y]) => g.lineTo(cx + dx + x, cy + dy + y))
        g.closePath()
        g.stroke()
      }
  }
}

const drawShell: Draw = (g, w, h) => {
  const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6)
  grd.addColorStop(0, '#8a6a3a')
  grd.addColorStop(1, '#3f2c18')
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)
  const s = w / 6
  for (let row = -1; row < 8; row++)
    for (let col = -1; col < 8; col++) {
      const x = col * s * 1.5
      const y = row * s * 1.73 + (col % 2 ? s * 0.87 : 0)
      g.beginPath()
      for (let a = 0; a < 6; a++) g.lineTo(x + Math.cos((a * Math.PI) / 3) * s * 0.92, y + Math.sin((a * Math.PI) / 3) * s * 0.92)
      g.closePath()
      const c = g.createRadialGradient(x, y, 2, x, y, s)
      c.addColorStop(0, 'rgba(214,170,96,0.75)')
      c.addColorStop(1, 'rgba(70,45,20,0.2)')
      g.fillStyle = c
      g.fill()
      g.strokeStyle = '#2a1c0e'
      g.lineWidth = 4
      g.stroke()
    }
}

const drawRidges: Draw = (g, w, h) => {
  g.fillStyle = '#6d5a4a'
  g.fillRect(0, 0, w, h)
  for (let x = 0; x < w; x += 10) {
    g.fillStyle = x % 20 ? '#8d7864' : '#4f3f33'
    g.fillRect(x, 0, 5, h)
  }
  for (let y = 0; y < h; y += 14) {
    g.fillStyle = 'rgba(30,20,12,0.25)'
    g.fillRect(0, y, w, 3)
  }
}

const drawRay: Draw = (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h)
  grd.addColorStop(0, 'rgba(255,255,255,0.9)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)
  const side = g.createLinearGradient(0, 0, w, 0)
  side.addColorStop(0, 'rgba(0,0,0,1)')
  side.addColorStop(0.5, 'rgba(0,0,0,0)')
  side.addColorStop(1, 'rgba(0,0,0,1)')
  g.globalCompositeOperation = 'destination-out'
  g.fillStyle = side
  g.fillRect(0, 0, w, h)
}

/* ---------------------------------------------------------------- props */

/** a fish facing +z: body painted along its length (t 0 = tail … 1 = head), tail on a pivot that wags */
function makeFish(L: number, paint: (t: number) => string, fin: string) {
  const g = new THREE.Group()
  const geo = new THREE.SphereGeometry(1, 28, 14)
  const pos = geo.attributes.position
  const c = new THREE.Color()
  const cols: number[] = []
  for (let i = 0; i < pos.count; i++) {
    c.set(paint((pos.getZ(i) + 1) / 2))
    cols.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
  const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }))
  body.scale.set(L * 0.3, L * 0.48, L)
  g.add(body)
  const finMat = std(fin, { side: THREE.DoubleSide, roughness: 0.6 })
  const sh = new THREE.Shape()
  sh.moveTo(0, 0)
  sh.quadraticCurveTo(-0.3 * L, 0.45 * L, -0.65 * L, 0.55 * L)
  sh.lineTo(-0.5 * L, 0)
  sh.lineTo(-0.65 * L, -0.55 * L)
  sh.quadraticCurveTo(-0.3 * L, -0.45 * L, 0, 0)
  const tg = new THREE.ShapeGeometry(sh)
  tg.rotateY(-Math.PI / 2)
  const tail = new THREE.Group()
  tail.position.z = -L * 0.85
  tail.add(new THREE.Mesh(tg, finMat))
  g.add(tail)
  const dorsal = new THREE.Mesh(new THREE.CircleGeometry(L * 0.35, 12, 0, Math.PI), finMat)
  dorsal.rotation.y = Math.PI / 2
  dorsal.position.set(0, L * 0.38, -L * 0.05)
  g.add(dorsal)
  const eye = std(0x111111, { roughness: 0.2 })
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(L * 0.07, 8, 6), eye)
    e.position.set(s * L * 0.22, L * 0.12, L * 0.68)
    g.add(e)
  }
  return { g, tail }
}

const clown = (t: number) => {
  const bands: [number, number][] = [
    [0.7, 0.8],
    [0.42, 0.53],
    [0.1, 0.17],
  ]
  for (const [a, b] of bands) {
    if (t > a && t < b) return '#fbfbf6'
    if (t > a - 0.025 && t < b + 0.025) return '#151515'
  }
  return '#ff7417'
}

function makeTurtle() {
  const g = new THREE.Group()
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 18), std(0xffffff, { map: tex(512, 512, drawShell), roughness: 0.5 }))
  shell.scale.set(0.95, 0.33, 1.2)
  shell.castShadow = true
  g.add(shell)
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), std(0xe6d29c))
  belly.scale.set(0.82, 0.14, 1.05)
  belly.position.y = -0.08
  g.add(belly)
  const skin = std(0x7d8a5c, { roughness: 0.7 })
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), skin)
  head.scale.set(0.85, 0.72, 1.15)
  head.position.set(0, 0.04, 1.42)
  g.add(head)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.4, 12), skin)
  neck.rotation.x = Math.PI / 2
  neck.position.set(0, 0, 1.12)
  g.add(neck)
  const eye = std(0x0d0d0d, { roughness: 0.15 })
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eye)
    e.position.set(s * 0.17, 0.12, 1.6)
    g.add(e)
  }
  const flip = (w: number, l: number, x: number, z: number) => {
    const p = new THREE.Group()
    p.position.set(x, -0.03, z)
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), skin)
    m.scale.set(w, 0.05, l)
    m.position.x = Math.sign(x) * w * 0.9
    m.rotation.y = Math.sign(x) * -0.5
    m.castShadow = true
    p.add(m)
    g.add(p)
    return p
  }
  const front = [flip(0.75, 0.24, -0.7, 0.55), flip(0.75, 0.24, 0.7, 0.55)]
  const rear = [flip(0.3, 0.16, -0.55, -0.95), flip(0.3, 0.16, 0.55, -0.95)]
  return { g, front, rear }
}

function makeOyster() {
  const g = new THREE.Group()
  const outer = std(0x9a8676, { map: tex(256, 256, drawRidges), roughness: 0.9 })
  const nacre = std(0xf1e6ee, { roughness: 0.25, metalness: 0.2, side: THREE.BackSide })
  const half = (lower: boolean) => {
    const geo = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, lower ? Math.PI / 2 : 0, Math.PI / 2)
    const o = new THREE.Group()
    const out = new THREE.Mesh(geo, outer)
    const inn = new THREE.Mesh(geo, nacre)
    inn.scale.setScalar(0.97)
    out.castShadow = true
    o.add(out, inn)
    o.scale.set(1.25, 0.38, 1.0)
    return o
  }
  const bottom = half(true)
  bottom.position.y = 0.38
  g.add(bottom)
  // the upper valve hinges at the back
  const lid = new THREE.Group()
  lid.position.set(0, 0.38, -1.0)
  const top = half(false)
  top.position.z = 1.0
  lid.add(top)
  g.add(lid)
  const pearl = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 32, 20),
    new THREE.MeshPhysicalMaterial({ color: 0xfff6fa, roughness: 0.12, clearcoat: 1, iridescence: 1, emissive: 0xffe7f2, emissiveIntensity: 0.35 }),
  )
  pearl.position.set(0, 0.5, 0.05)
  g.add(pearl)
  return { g, lid, pearl }
}

function makeAnemone() {
  const g = new THREE.Group()
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.4, 20), std(0x8a3d6a, { roughness: 0.8 }))
  base.position.y = 0.2
  g.add(base)
  const N = 90
  const geo = new THREE.CylinderGeometry(0.03, 0.05, 1, 6)
  geo.translate(0, 0.5, 0)
  const tent = new THREE.InstancedMesh(geo, std(0xf2a0c8, { roughness: 0.55, emissive: 0x5a1838, emissiveIntensity: 0.3 }), N)
  const dirs: { a: number; r: number; tilt: number; len: number }[] = []
  reseed(41)
  for (let k = 0; k < N; k++) dirs.push({ a: rnd() * Math.PI * 2, r: Math.sqrt(rnd()) * 0.55, tilt: 0.2 + rnd() * 0.7, len: 0.6 + rnd() * 0.5 })
  g.add(tent)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  const sway = (t: number) => {
    dirs.forEach((d, k) => {
      p.set(Math.cos(d.a) * d.r, 0.38, Math.sin(d.a) * d.r)
      const w = Math.sin(t * 1.6 + k * 0.7) * 0.18
      e.set(Math.sin(d.a) * (d.tilt * d.r * 1.6 + w), 0, -Math.cos(d.a) * (d.tilt * d.r * 1.6 + w), 'XYZ')
      q.setFromEuler(e)
      s.set(1, d.len, 1)
      tent.setMatrixAt(k, m.compose(p, q, s))
    })
    tent.instanceMatrix.needsUpdate = true
  }
  sway(0)
  return { g, sway }
}

/** the static reef: sand, caustics, rocks, corals, kelp, a sunken ship */
function buildReef() {
  const root = new THREE.Group()
  reseed(7)
  // sand floor rising into a bowl so the horizon is hidden in the blue
  const fg = new THREE.PlaneGeometry(100, 100, 100, 100)
  fg.rotateX(-Math.PI / 2)
  const fp = fg.attributes.position
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i)
    const z = fp.getZ(i)
    const r = Math.hypot(x, z * 1.2)
    fp.setY(i, Math.sin(x * 0.35) * Math.cos(z * 0.3) * 0.18 + Math.max(0, r - 13) ** 1.5 * 0.12)
  }
  fg.computeVertexNormals()
  const sand = new THREE.Mesh(fg, std(0xffffff, { map: tex(512, 512, drawSand, [14, 14]), roughness: 0.95 }))
  sand.receiveShadow = true
  root.add(sand)
  const ctex = tex(256, 256, drawCaustics, [9, 9])
  const caustics = new THREE.Mesh(
    fg,
    new THREE.MeshBasicMaterial({ map: ctex, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x9fe6ff }),
  )
  caustics.position.y = 0.03
  root.add(caustics)
  // the bright surface far above
  const surf = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshBasicMaterial({ map: tex(512, 512, drawSea, [6, 6]), color: 0xa8ecff, transparent: true, opacity: 0.75, side: THREE.DoubleSide, fog: true }),
  )
  surf.rotation.x = Math.PI / 2
  surf.position.y = 13
  root.add(surf)
  // rocks
  const rockMat = std(0x8a7d6e, { roughness: 0.95, flatShading: true })
  const rock = (x: number, z: number, s: number) => {
    const geo = new THREE.IcosahedronGeometry(1, 2)
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + rnd() * 0.4), p.getY(i) * (0.6 + rnd() * 0.3), p.getZ(i) * (0.8 + rnd() * 0.4))
    geo.computeVertexNormals()
    const m = new THREE.Mesh(geo, rockMat)
    m.position.set(x, s * 0.25, z)
    m.scale.setScalar(s)
    m.rotation.y = rnd() * 6
    m.castShadow = m.receiveShadow = true
    root.add(m)
  }
  for (let k = 0; k < 26; k++) {
    const a = -Math.PI * 0.95 + rnd() * Math.PI * 0.9
    const r = 6 + rnd() * 8
    rock(Math.cos(a) * r, Math.sin(a) * r * 0.8 - 1, 0.5 + rnd() * 1.3)
  }
  rock(0, 0.8, 0.6) // under the oyster
  rock(3.8, -0.4, 0.7) // under the anemone
  // branching corals
  const cyl = new THREE.CylinderGeometry(0.6, 1, 1, 6)
  cyl.translate(0, 0.5, 0)
  const coralMats = [0xff7a4a, 0xff5c8a, 0xffb347, 0xb066e0, 0xff8fb0].map((c) => std(c, { roughness: 0.7, emissive: c, emissiveIntensity: 0.12 }))
  const coral = (x: number, z: number, s: number, mat: THREE.Material) => {
    const c = new THREE.Group()
    const grow = (parent: THREE.Object3D, depth: number) => {
      const n = depth === 0 ? 4 : 2 + Math.floor(rnd() * 2)
      for (let k = 0; k < n; k++) {
        const b = new THREE.Group()
        b.rotation.set((rnd() - 0.5) * (depth ? 1.2 : 0.8), rnd() * Math.PI * 2, (rnd() - 0.5) * (depth ? 1.2 : 0.8))
        const len = (0.6 - depth * 0.14) * (0.7 + rnd() * 0.6)
        const r = 0.07 - depth * 0.018
        const m = new THREE.Mesh(cyl, mat)
        m.scale.set(r, len, r)
        b.add(m)
        parent.add(b)
        if (depth < 2) {
          const tip = new THREE.Group()
          tip.position.y = len
          b.add(tip)
          grow(tip, depth + 1)
        }
      }
    }
    grow(c, 0)
    c.position.set(x, 0, z)
    c.scale.setScalar(s)
    root.add(c)
  }
  const corals: [number, number, number][] = [
    [-6.5, -2, 1.6], [-2, -4.5, 1.3], [1.8, -3.6, 1.1], [6.2, -2.4, 1.5], [-5.4, 2.8, 1.0], [5.6, 2.6, 1.1], [-8.5, -6, 2.2], [8.8, -5.5, 2.0],
  ]
  corals.forEach(([x, z, s], k) => coral(x, z, s, coralMats[k % coralMats.length]))
  // brain corals and fan corals
  const brain = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)
  const bp = brain.attributes.position
  for (let i = 0; i < bp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(bp, i)
    v.multiplyScalar(1 + Math.sin(v.x * 9) * Math.sin(v.z * 9) * 0.05)
    bp.setXYZ(i, v.x, v.y, v.z)
  }
  brain.computeVertexNormals()
  for (const [x, z, s, c] of [[-1.6, -2.4, 0.7, 0xd8955a], [2.6, 2.4, 0.5, 0xc7c06a], [-4.6, -4.2, 0.9, 0xd27b6a]] as const) {
    const m = new THREE.Mesh(brain, std(c, { roughness: 0.85 }))
    m.position.set(x, 0, z)
    m.scale.set(s, s * 0.7, s)
    m.castShadow = true
    root.add(m)
  }
  const fans: THREE.Mesh[] = []
  for (const [x, z, s, c, a] of [[-3, -5.5, 1.6, 0x9a4fd0, 0.3], [4.4, -5, 1.4, 0xe0567a, -0.4], [-7.4, 0.6, 1.2, 0xff8a3d, 1.2]] as const) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24, 0, Math.PI), std(c, { side: THREE.DoubleSide, roughness: 0.8, transparent: true, opacity: 0.92 }))
    m.position.set(x, 0, z)
    m.scale.setScalar(s)
    m.rotation.y = a
    root.add(m)
    fans.push(m)
  }
  // kelp
  const blade = new THREE.PlaneGeometry(0.16, 1, 1, 6)
  blade.translate(0, 0.5, 0)
  const kelpMat = std(0x3f9a52, { side: THREE.DoubleSide, roughness: 0.7 })
  const kelp: THREE.Object3D[] = []
  for (const [x, z] of [[-7.5, -3.2], [-2.6, -6], [7.4, -1.2], [3.2, -6.6], [-9.5, 2.2], [9.6, 1.8]]) {
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(blade, kelpMat)
      m.position.set(x + (rnd() - 0.5) * 0.8, 0, z + (rnd() - 0.5) * 0.8)
      m.scale.set(1, 1.6 + rnd() * 2, 1)
      m.rotation.y = rnd() * 3
      root.add(m)
      kelp.push(m)
    }
  }
  // starfish
  const star = new THREE.Shape()
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 0.12 : 0.32
    const a = (k / 10) * Math.PI * 2
    if (k) star.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    else star.moveTo(r, 0)
  }
  const sg = new THREE.ShapeGeometry(star)
  sg.rotateX(-Math.PI / 2)
  for (const [x, z, c] of [[1.6, 3.4, 0xff7a3a], [-2.2, 2.6, 0xe8483a], [5, 4, 0xffa24a]] as const) {
    const m = new THREE.Mesh(sg, std(c, { roughness: 0.8, side: THREE.DoubleSide }))
    m.position.set(x, 0.05, z)
    m.rotation.y = rnd() * 6
    root.add(m)
  }
  // a sunken dhow in the blue, sails gone
  const wreck = makeBaghlah()
  wreck.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mat = m.material as THREE.MeshStandardMaterial
    if (mat.side === THREE.DoubleSide) m.visible = false
    else mat.color.multiplyScalar(0.55)
  })
  wreck.scale.setScalar(6)
  wreck.position.set(-9, 0.4, -14)
  wreck.rotation.set(0.15, 0.75, 0.42)
  root.add(wreck)
  // light shafts from the surface
  const rayMat = new THREE.MeshBasicMaterial({ map: tex(64, 256, drawRay), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xd8f8ff, side: THREE.DoubleSide })
  const rays: THREE.Mesh[] = []
  for (const [x, z, w] of [[-5, -3, 2.4], [-1.5, -5, 1.6], [2.5, -2.5, 2.8], [6, -4.5, 2], [0.5, 2, 1.4], [-8, -7, 3]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 16), rayMat)
    m.position.set(x, 7, z)
    m.rotation.z = 0.12
    root.add(m)
    rays.push(m)
  }
  return { root, ctex, fans, kelp, rays }
}

/* ---------------------------------------------------------------- scene */

function Tag({ i, done, onOpen }: { i: number; done: boolean; onOpen: () => void }) {
  const it = DEF.items[i]
  return (
    <button className={'nav-tag' + (done ? ' is-done' : '')} onClick={onOpen}>
      <span className="nav-tag__n">{toAr(i + 1)}</span>
      <span className="nav-tag__t">
        {it.icon} {it.title}
      </span>
      {done && <span className="nav-tag__ck">✓</span>}
    </button>
  )
}

export function ReefScene() {
  const reef = useMemo(buildReef, [])
  const turtle = useMemo(makeTurtle, [])
  const oyster = useMemo(makeOyster, [])
  const anemone = useMemo(makeAnemone, [])
  const clowns = useMemo(() => [0, 1, 2, 3, 4].map(() => makeFish(0.16, clown, '#ff8a2a')), [])
  const school = useMemo(
    () =>
      Array.from({ length: 14 }, (_, k) =>
        k % 2 ? makeFish(0.2, (t) => (t > 0.85 ? '#1d2a6b' : '#f6d02c'), '#f6d02c') : makeFish(0.22, (t) => (t < 0.15 ? '#f6d02c' : '#2a63c9'), '#f6d02c'),
      ),
    [],
  )
  const turtleAt = useRef<THREE.Group>(null!)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const seen = useStore((s) => s.progress.turtles.seen)
  const setOpen = useReef((s) => s.setOpen)
  const [ready, setReady] = useState(false)
  const t0 = useRef(performance.now())

  useLayoutEffect(() => {
    camera.near = 0.05
    camera.position.copy(FROM)
    camera.lookAt(TARGET)
    camera.updateProjectionMatrix()
    return () => {
      document.body.style.cursor = ''
      ;[reef.root, turtle.g, oyster.g, anemone.g, ...clowns.map((c) => c.g), ...school.map((c) => c.g)].forEach(dispose)
    }
  }, [camera, reef, turtle, oyster, anemone, clowns, school])
  useEffect(() => {
    camera.fov = fovFor(size.width / size.height)
    camera.updateProjectionMatrix()
  }, [camera, size])
  useEffect(() => {
    if (ready) useStore.getState().showToast(DEF.intro)
  }, [ready])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (!ready) {
      const k = ease(Math.min(1, (performance.now() - t0.current) / 2200))
      camera.position.lerpVectors(FROM, SEAT, k)
      camera.lookAt(TARGET)
      if (k >= 1) setReady(true)
    }
    reef.ctex.offset.set(t * 0.012, t * 0.008)
    reef.fans.forEach((f, k) => (f.rotation.z = Math.sin(t * 0.8 + k) * 0.06))
    reef.kelp.forEach((m, k) => {
      m.rotation.z = Math.sin(t * 0.9 + k * 0.5) * 0.18
      m.rotation.x = Math.cos(t * 0.7 + k) * 0.1
    })
    reef.rays.forEach((r, k) => {
      r.rotation.y = Math.atan2(camera.position.x - r.position.x, camera.position.z - r.position.z)
      ;(r.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(t * 0.5 + k) * 0.04
    })
    // the turtle glides on a slow loop, flapping
    const a = t * 0.22
    turtleAt.current.position.set(SPOT.turtle.x + Math.sin(a) * 1.3, SPOT.turtle.y + Math.sin(t * 0.5) * 0.18, SPOT.turtle.z + Math.cos(a) * 0.7)
    turtle.g.rotation.y = Math.atan2(Math.cos(a) * 1.3, -Math.sin(a) * 0.7)
    turtle.g.rotation.z = Math.sin(t * 0.5) * 0.06
    const fl = Math.sin(t * 2.2)
    turtle.front[0].rotation.z = -0.25 - fl * 0.45
    turtle.front[1].rotation.z = 0.25 + fl * 0.45
    turtle.front.forEach((f, k) => (f.rotation.y = (k ? -1 : 1) * fl * 0.25))
    turtle.rear[0].rotation.y = Math.sin(t * 2.2 + 1) * 0.3
    turtle.rear[1].rotation.y = -Math.sin(t * 2.2 + 1) * 0.3
    // the oyster breathes open and shut; the pearl shimmers
    oyster.lid.rotation.x = -(0.55 + Math.sin(t * 0.7) * 0.2)
    ;(oyster.pearl.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.3 + Math.sin(t * 2) * 0.15
    anemone.sway(t)
    clowns.forEach((f, k) => {
      const dir = k % 2 ? 1 : -1
      const ang = t * (0.7 + k * 0.08) * dir + k * 1.3
      const r = 0.55 + (k % 3) * 0.18
      f.g.position.set(SPOT.fish.x + Math.cos(ang) * r, 1.35 + k * 0.13 + Math.sin(t * 1.5 + k) * 0.08, SPOT.fish.z + Math.sin(ang) * r)
      f.g.rotation.y = Math.atan2(-Math.sin(ang) * dir, Math.cos(ang) * dir)
      f.tail.rotation.y = Math.sin(t * 12 + k) * 0.45
    })
    school.forEach((f, k) => {
      const ang = t * 0.18 + (k / school.length) * 1.4
      const r = 9 + (k % 4) * 0.5
      f.g.position.set(Math.cos(ang) * r, 3.5 + (k % 5) * 0.35 + Math.sin(t + k) * 0.1, Math.sin(ang) * r * 0.6 - 4)
      f.g.rotation.y = Math.atan2(-Math.sin(ang), Math.cos(ang) * 0.6)
      f.tail.rotation.y = Math.sin(t * 10 + k) * 0.4
    })
  })

  const tap = (e: ThreeEvent<MouseEvent>, key: string) => {
    if (e.delta > 6 || !ready) return
    e.stopPropagation()
    setOpen(key)
  }
  const hover = (on: boolean) => () => (document.body.style.cursor = on ? 'pointer' : '')
  const hit = (key: string) => ({ onClick: (e: ThreeEvent<MouseEvent>) => tap(e, key), onPointerOver: hover(true), onPointerOut: hover(false) })
  const done = (key: string) => seen.includes(key)
  const glowAt = (p: THREE.Vector3, y: number, key: string) =>
    !done(key) && <Sparkles count={18} scale={[2.2, 1.6, 2.2]} position={[p.x, p.y + y, p.z]} size={5} speed={0.4} color="#ffe08a" />

  return (
    <>
      <color attach="background" args={['#0b5574']} />
      <fogExp2 attach="fog" args={['#0d5f80', 0.048]} />
      <hemisphereLight args={['#c4f3ff', '#7a6844', 1.25]} />
      <directionalLight position={[3, 12, 5]} intensity={1.7} color="#e6fbff" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      <primitive object={reef.root} />
      <Sparkles count={90} scale={[22, 10, 14]} position={[0, 4, -1]} size={3} speed={0.35} opacity={0.55} color="#e8fbff" noise={0.8} />
      {school.map((f, k) => (
        <primitive key={k} object={f.g} />
      ))}
      {/* 1. the sea turtle */}
      <group ref={turtleAt}>
        <primitive object={turtle.g} />
        <mesh {...hit('turtle')} scale={[1.7, 0.9, 2.1]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {ready && (
          <Html position={[0, TAG_Y.turtle, 0]} center zIndexRange={[30, 0]}>
            <Tag i={0} done={done('turtle')} onOpen={() => setOpen('turtle')} />
          </Html>
        )}
      </group>
      {glowAt(SPOT.turtle, 0, 'turtle')}
      {/* 2. the giant oyster and its pearl */}
      <group position={[SPOT.pearl.x, 0.42, SPOT.pearl.z]}>
        <primitive object={oyster.g} scale={0.62} />
        <pointLight position={[0, 0.8, 0.5]} color="#ffe6f3" intensity={3} distance={3.5} decay={1.6} />
        <mesh {...hit('pearl')} position={[0, 0.35, 0]} scale={[1.0, 0.7, 0.95]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {ready && (
          <Html position={[0, TAG_Y.pearl, 0]} center zIndexRange={[30, 0]}>
            <Tag i={1} done={done('pearl')} onOpen={() => setOpen('pearl')} />
          </Html>
        )}
      </group>
      {glowAt(SPOT.pearl, 1.0, 'pearl')}
      {/* 3. clownfish in their anemone */}
      <group position={[SPOT.fish.x, 0.5, SPOT.fish.z]}>
        <primitive object={anemone.g} />
        <mesh {...hit('fish')} position={[0, 0.7, 0]} scale={[1.3, 1.1, 1.3]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {ready && (
          <Html position={[0, TAG_Y.fish, 0]} center zIndexRange={[30, 0]}>
            <Tag i={2} done={done('fish')} onOpen={() => setOpen('fish')} />
          </Html>
        )}
      </group>
      {clowns.map((f, k) => (
        <primitive key={k} object={f.g} />
      ))}
      {glowAt(SPOT.fish, 1.2, 'fish')}
      <OrbitControls
        makeDefault
        enabled={ready}
        target={[TARGET.x, TARGET.y, TARGET.z]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        minDistance={5}
        maxDistance={11.5}
        minPolarAngle={0.85}
        maxPolarAngle={1.5}
        minAzimuthAngle={-1.1}
        maxAzimuthAngle={1.1}
      />
    </>
  )
}
