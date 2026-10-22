// المحطة الأولى «البحر بداية الحكاية»: غرفة البحّار ثلاثية الأبعاد.
// أربع مخطوطات فوق الطاولة (فيديو + معلومات + مرجع)، وصندوق كنز بثلاثة أقفال للتحدي.
// الواجهة فوق المشهد في ui/SeaStation.tsx، والحالة المشتركة في useNavRoom.
import { Html, OrbitControls } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { sfx } from '../game/sfx'
import { STATIONS } from '../stations'
import { useStore } from '../store'
import { toAr } from '../ui/Quiz'
import { useNavRoom } from '../ui/SeaStation'
import { Indoor } from './Atmosphere'
import { dispose, drawChart, drawCompass, drawPlanks, drawPlaster, drawRug, drawSea, drawWood, reseed, rnd, tex } from './kit'

const DEF = STATIONS.nav
const W = 8, D = 6, H = 3.2, T = 0.15
const TOP = 0.866 // table surface
const XS = [0.78, 0.26, -0.26, -0.78] // manuscripts right-to-left, like Arabic reading order
const YAW = [0.08, -0.11, 0.05, -0.07]
const TARGET = new THREE.Vector3(0, 0.85, 0)
const START = new THREE.Vector3(0, 1.7, 7.5)
const SEAT = new THREE.Vector3(0, 1.75, 2.55)
const CHEST_POS = new THREE.Vector3(2.3, 0, -1.0)
const CHEST_RY = -0.6
const LOCK_X = [0.24, 0, -0.24]

/* --------------------------------------------------------------- room */

type Std = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
interface Room {
  root: THREE.Group
  scrolls: { g: THREE.Group; paper: Std; base: number }[]
  lamp: THREE.PointLight
  sun: THREE.DirectionalLight
  lid: THREE.Group
  chestLight: THREE.PointLight
  gold: Std
  locks: { g: THREE.Group; shackle: THREE.Group }[]
}

function buildRoom(): Room {
  reseed(11)
  const root = new THREE.Group()
  const std = (color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o })
  const woodMap = tex(512, 512, drawWood)
  const M = {
    wall: std(0xffffff, { map: tex(1024, 1024, drawPlaster) }),
    wood: std(0xffffff, { map: woodMap }),
    dark: std(0x6e4c38, { map: woodMap }),
    chest: std(0x5a3a26, { map: woodMap }),
    hull: std(0x8a5a3a, { map: woodMap }),
    paper: std(0xeadcbc, { roughness: 0.95 }),
    brass: std(0xc0913e, { metalness: 0.75, roughness: 0.35 }),
    iron: std(0x3b3936, { metalness: 0.6, roughness: 0.55 }),
    strap: std(0x8e2f1f, { roughness: 0.7 }),
    rope: std(0xb38b56, { roughness: 1 }),
    sail: std(0xf1e6cf, { side: THREE.DoubleSide, roughness: 0.95 }),
  }
  const mesh = <G extends THREE.BufferGeometry, Mt extends THREE.Material>(geo: G, mat: Mt, x = 0, y = 0, z = 0, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    parent.add(m)
    return m
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent)
  const cyl = (r1: number, r2: number, h: number, mat: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D, seg = 16) =>
    mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y, z, parent)
  const group = (x = 0, y = 0, z = 0, ry = 0, parent: THREE.Object3D = root) => {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.rotation.y = ry
    parent.add(g)
    return g
  }

  // shell: window in the back wall, door in the front wall
  const floor = mesh(new THREE.PlaneGeometry(W, D), std(0xffffff, { map: tex(1024, 1024, drawPlanks, [2, 1.5]) }))
  floor.rotation.x = -Math.PI / 2
  const ceil = mesh(new THREE.PlaneGeometry(W, D), std(0x3b2414), 0, H, 0)
  ceil.rotation.x = Math.PI / 2
  for (let k = 0; k < 6; k++) box(W, 0.18, 0.2, M.dark, 0, H - 0.09, -D / 2 + 0.5 + k)
  box(T, H, D, M.wall, -W / 2 - T / 2, H / 2, 0)
  box(T, H, D, M.wall, W / 2 + T / 2, H / 2, 0)
  const wx = 1.0, wy0 = 1.1, wy1 = 2.4, zb = -D / 2 - T / 2, side = W / 2 - wx
  box(side, H, T, M.wall, -(wx + side / 2), H / 2, zb); box(side, H, T, M.wall, wx + side / 2, H / 2, zb)
  box(2 * wx, wy0, T, M.wall, 0, wy0 / 2, zb); box(2 * wx, H - wy1, T, M.wall, 0, (H + wy1) / 2, zb)
  const dx = 0.65, dh = 2.3, zf = D / 2 + T / 2, fs = W / 2 - dx
  box(fs, H, T, M.wall, -(dx + fs / 2), H / 2, zf); box(fs, H, T, M.wall, dx + fs / 2, H / 2, zf)
  box(2 * dx, H - dh, T, M.wall, 0, (H + dh) / 2, zf)
  box(0.12, dh, 0.26, M.dark, -dx - 0.06, dh / 2, zf); box(0.12, dh, 0.26, M.dark, dx + 0.06, dh / 2, zf); box(2 * dx + 0.24, 0.14, 0.26, M.dark, 0, dh + 0.07, zf)
  const fz = -D / 2
  box(0.1, wy1 - wy0 + 0.1, 0.22, M.dark, -wx, (wy0 + wy1) / 2, fz); box(0.1, wy1 - wy0 + 0.1, 0.22, M.dark, wx, (wy0 + wy1) / 2, fz)
  box(2 * wx + 0.1, 0.1, 0.22, M.dark, 0, wy1, fz); box(2 * wx + 0.36, 0.08, 0.38, M.dark, 0, wy0, fz + 0.06)
  box(0.05, wy1 - wy0, 0.06, M.dark, 0, (wy0 + wy1) / 2, fz); box(2 * wx, 0.05, 0.06, M.dark, 0, (wy0 + wy1) / 2, fz)
  const view = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: tex(1024, 512, drawSea), toneMapped: false }))
  view.position.set(0, 1.9, -D / 2 - 2.5)
  root.add(view)

  // daylight through the window + the lantern
  const sun = new THREE.DirectionalLight(0xfff0d6, 3.2)
  sun.position.set(1.2, 4.2, -9)
  sun.target.position.set(0, 0.8, 0.5)
  sun.castShadow = true
  sun.shadow.bias = -0.0005
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 })
  root.add(sun, sun.target)
  const lamp = new THREE.PointLight(0xffb067, 7, 9, 1.6)
  lamp.position.set(0, 2.1, 0)
  root.add(lamp)
  const lan = group(0, 2.15, 0)
  mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 6), std(0xffd9a0, { emissive: 0xffa040, emissiveIntensity: 1.6, transparent: true, opacity: 0.9 }), 0, 0, 0, lan).castShadow = false
  mesh(new THREE.ConeGeometry(0.13, 0.12, 6), M.brass, 0, 0.17, 0, lan)
  cyl(0.11, 0.08, 0.04, M.brass, 0, -0.13, 0, lan, 6)
  for (let k = 0; k < 6; k++) box(0.015, 0.24, 0.015, M.brass, Math.cos((k * Math.PI) / 3) * 0.095, 0, Math.sin((k * Math.PI) / 3) * 0.095, lan)
  const chainLen = H - 2.15 - 0.23
  cyl(0.006, 0.006, chainLen, M.iron, 0, 0.23 + chainLen / 2, 0, lan, 6)

  // rug + table
  const rug = mesh(new THREE.PlaneGeometry(3.4, 2.4), std(0xffffff, { map: tex(1024, 720, drawRug) }), 0, 0.005, 0)
  rug.rotation.x = -Math.PI / 2
  box(2.4, 0.08, 1.3, M.wood, 0, 0.82, 0)
  box(2.2, 0.12, 1.1, M.dark, 0, 0.72, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.09, 0.7, 0.09, M.dark, sx * 1.08, 0.35, sz * 0.53)
  box(2.0, 0.006, 0.4, std(0x8f2a24), 0, 0.863, 0)

  // ship model: hull outline extruded upward, mast, lateen yard and sail
  function makeDhow(parent: THREE.Object3D, x: number, y: number, z: number, s: number, ry = 0, stand = true) {
    const g = group(x, y, z, ry, parent)
    g.scale.setScalar(s)
    const sh = new THREE.Shape()
    sh.moveTo(-0.5, 0); sh.quadraticCurveTo(-0.44, 0.13, -0.12, 0.14); sh.lineTo(0.25, 0.12); sh.quadraticCurveTo(0.5, 0.06, 0.64, 0)
    sh.quadraticCurveTo(0.5, -0.06, 0.25, -0.12); sh.lineTo(-0.12, -0.14); sh.quadraticCurveTo(-0.44, -0.13, -0.5, 0)
    const hg = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 14 })
    hg.rotateX(-Math.PI / 2)
    const p = hg.attributes.position
    for (let k = 0; k < p.count; k++) {
      const yy = p.getY(k)
      if (yy < 0.06) p.setZ(k, p.getZ(k) * (0.45 + yy * 9))
    }
    hg.computeVertexNormals()
    const by = stand ? 0.12 : 0
    mesh(hg, M.hull, 0, by, 0, g)
    box(1.0, 0.02, 0.2, M.dark, 0.05, by + 0.17, 0, g)
    cyl(0.012, 0.016, 0.78, M.dark, 0.1, by + 0.55, 0, g, 8).rotation.z = -0.1
    const A = new THREE.Vector2(0.62, by + 0.38), B = new THREE.Vector2(-0.4, by + 1.0), C = new THREE.Vector2(-0.28, by + 0.3)
    const yard = cyl(0.008, 0.008, A.distanceTo(B), M.dark, (A.x + B.x) / 2, (A.y + B.y) / 2, 0.02, g, 6)
    yard.rotation.z = Math.atan2(B.y - A.y, B.x - A.x) - Math.PI / 2
    const ss = new THREE.Shape()
    ss.moveTo(A.x, A.y); ss.lineTo(B.x, B.y); ss.quadraticCurveTo(-0.2, by + 0.55, C.x, C.y); ss.quadraticCurveTo(0.2, by + 0.28, A.x, A.y)
    mesh(new THREE.ShapeGeometry(ss, 12), M.sail, 0, 0, 0.03, g)
    if (stand) {
      box(0.7, 0.04, 0.18, M.dark, 0, 0.02, 0, g)
      for (const sx of [-0.2, 0.2]) box(0.03, 0.12, 0.03, M.brass, sx, 0.08, 0, g)
    }
    return g
  }
  const BOOK = [0x7a1f1f, 0x1f3d5a, 0x2f5a3a, 0x6b4b2a, 0x8a6d3b, 0x3b2a4a, 0x9a5b2a]
  function makeBooks(parent: THREE.Object3D, x0: number, x1: number, y: number, z: number) {
    let x = x0
    while (x < x1 - 0.06) {
      const t = 0.03 + rnd() * 0.04, hh = 0.18 + rnd() * 0.1, d = 0.16 + rnd() * 0.05
      if (rnd() < 0.12) { x += 0.05; continue }
      const b = box(t, hh, d, std(BOOK[Math.floor(rnd() * BOOK.length)]), x + t / 2, y + hh / 2, z, parent)
      box(t + 0.002, 0.012, d * 0.3, M.brass, 0, hh * 0.28, d * 0.36, b).castShadow = false
      x += t + 0.004
    }
  }

  // table decor: book stack, compass, inkwell + quill, small ship
  let sy = TOP
  ;([[0.32, 0.05, 0x7a1f1f], [0.29, 0.045, 0x1f3d5a], [0.26, 0.04, 0x6b4b2a]] as const).forEach(([w, h, c], k) => {
    box(w, h, w * 0.75, std(c), -0.98 + k * 0.01, sy + h / 2, -0.42).rotation.y = k * 0.18 - 0.1
    sy += h
  })
  cyl(0.085, 0.09, 0.035, M.brass, 0.98, TOP + 0.0175, -0.4, undefined, 32)
  const face = mesh(new THREE.CircleGeometry(0.072, 32), std(0xffffff, { map: tex(256, 256, drawCompass) }), 0.98, TOP + 0.036, -0.4)
  face.rotation.x = -Math.PI / 2
  cyl(0.03, 0.035, 0.05, std(0x1d2a3a, { roughness: 0.2, metalness: 0.2 }), -0.55, TOP + 0.025, -0.47)
  mesh(new THREE.ConeGeometry(0.012, 0.3, 8), std(0xf4efe6), -0.52, TOP + 0.15, -0.45).rotation.z = -0.35
  makeDhow(root, 0.5, TOP, -0.45, 0.3, 0.4)

  // four manuscripts (hit boxes and labels are JSX in NavRoomScene)
  const TIE = [0xa3242a, 0x23466b, 0x2f6b45, 0xb8862f]
  const scrolls = DEF.items.map((_, i) => {
    const g = group(XS[i] ?? 0, TOP + 0.05, 0.08, Math.PI / 2 + (YAW[i] ?? 0))
    const paper = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 24), M.paper.clone(), 0, 0, 0, g)
    paper.rotation.z = Math.PI / 2
    cyl(0.014, 0.014, 0.52, M.dark, 0, 0, 0, g, 10).rotation.z = Math.PI / 2
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.024, 12, 10), M.brass, s * 0.27, 0, 0, g)
    mesh(new THREE.TorusGeometry(0.053, 0.009, 8, 32), std(TIE[i % 4]), 0, 0, 0, g).rotation.y = Math.PI / 2
    cyl(0.022, 0.022, 0.012, std(TIE[i % 4], { roughness: 0.45 }), 0, 0.058, 0, g)
    return { g, paper, base: g.position.y }
  })

  // left wall: bookshelf with books, a globe and ships
  const shelf = group(-W / 2 + 0.22, 0, -0.6, Math.PI / 2)
  for (const y of [0.03, 0.6, 1.17, 1.74, 2.31]) box(2.2, 0.05, 0.4, M.dark, 0, y, 0, shelf)
  for (const sx of [-1.1, 1.1]) box(0.06, 2.36, 0.42, M.dark, sx, 1.17, 0, shelf)
  box(2.2, 2.34, 0.02, M.dark, 0, 1.17, -0.19, shelf)
  makeBooks(shelf, -1.04, 1.04, 0.055, 0.02)
  makeBooks(shelf, -1.04, 0.2, 0.625, 0.02)
  makeDhow(shelf, 0.6, 0.625, 0.02, 0.38, 0.2)
  makeDhow(shelf, -0.5, 1.195, 0.02, 0.42, -0.15)
  makeBooks(shelf, 0.25, 1.04, 1.195, 0.02)
  makeBooks(shelf, -1.04, -0.2, 1.765, 0.02)
  mesh(new THREE.SphereGeometry(0.15, 24, 16), std(0x3f6f7f, { roughness: 0.5 }), 0.5, 1.95, 0.02, shelf)
  cyl(0.05, 0.08, 0.06, M.brass, 0.5, 1.795, 0.02, shelf)
  makeDhow(shelf, 0, 2.335, 0, 0.45, 0.1)

  // back wall left: fishing net with floats, cabinet with a large ship
  const net = group(-2.5, 2.85, -D / 2 + 0.02)
  {
    const nx = 18, ny = 14, w = 2.2, h = 1.6, P: THREE.Vector3[] = []
    const pt = (i: number, j: number) => {
      const u = i / nx, v = j / ny
      return new THREE.Vector3((u - 0.5) * w * (1 - 0.18 * v) + 0.06 * Math.sin(v * 4 + u * 9) * v, -v * h - 0.22 * Math.sin(Math.PI * u) * v, 0.03 + 0.16 * Math.sin(Math.PI * u) * v * v)
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) P.push(pt(i, j), pt(i + 1, j + 1), pt(i + 1, j), pt(i, j + 1))
    net.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(P), new THREE.LineBasicMaterial({ color: 0xd2b27a })))
    cyl(0.025, 0.025, 2.5, M.dark, 0, 0.02, 0.05, net, 10).rotation.z = Math.PI / 2
    for (let i = 0; i <= nx; i += 3) mesh(new THREE.SphereGeometry(0.045, 14, 10), std(0xd0702a), pt(i, 0).x, -0.04, 0.07, net)
    for (let i = 1; i < nx; i += 4) { const q = pt(i, ny); cyl(0.03, 0.03, 0.05, std(0x8f8a80), q.x, q.y - 0.03, q.z, net, 10) }
  }
  box(1.4, 0.85, 0.5, M.dark, -2.5, 0.425, -D / 2 + 0.3)
  box(1.44, 0.04, 0.54, M.wood, -2.5, 0.87, -D / 2 + 0.3)
  makeDhow(root, -2.5, 0.89, -D / 2 + 0.32, 0.85, 0.15)

  // back wall right: crossed oars, barrel and rope coil
  for (const s of [-1, 1]) {
    const oar = group(2.6, 1.75, -D / 2 + 0.06)
    oar.rotation.z = s * 0.7
    cyl(0.022, 0.022, 1.9, M.wood, 0, 0, 0, oar, 10)
    box(0.16, 0.5, 0.02, M.wood, 0, -0.95, 0, oar)
  }
  mesh(new THREE.LatheGeometry([...Array(9)].map((_, k) => new THREE.Vector2(0.26 + 0.05 * Math.sin((Math.PI * k) / 8), k * 0.09)), 24), M.wood, 3.25, 0, -2.3)
  for (const y of [0.12, 0.6]) mesh(new THREE.TorusGeometry(0.29, 0.012, 8, 32), M.iron, 3.25, y, -2.3).rotation.x = Math.PI / 2
  {
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 160; k++) {
      const a = (k / 160) * Math.PI * 2 * 3.2, r = 0.18 + 0.025 * Math.floor(k / 50)
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.03 + k * 0.0006, Math.sin(a) * r))
    }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.028, 8), M.rope, 2.55, 0, -2.45)
  }

  // right wall: sea chart, shelf with ships, anchor
  const right = group(W / 2 - 0.02, 0, 0, -Math.PI / 2)
  mesh(new THREE.PlaneGeometry(1.7, 1.15), std(0xffffff, { map: tex(1024, 700, drawChart) }), 0.9, 1.9, 0.02, right)
  box(1.8, 1.25, 0.03, M.dark, 0.9, 1.9, 0, right)
  box(1.5, 0.05, 0.3, M.dark, -1.1, 1.05, 0.15, right)
  makeDhow(right, -1.45, 1.075, 0.15, 0.32, 0.3, false)
  makeDhow(right, -0.8, 1.075, 0.15, 0.28, -0.3, false)
  {
    const an = group(2.35, 1.0, 0.08, 0, right)
    cyl(0.03, 0.03, 0.9, M.iron, 0, 0.45, 0, an, 12)
    mesh(new THREE.TorusGeometry(0.07, 0.016, 10, 24), M.iron, 0, 0.97, 0, an).rotation.y = Math.PI / 2
    cyl(0.02, 0.02, 0.46, M.dark, 0, 0.8, 0, an, 10).rotation.z = Math.PI / 2
    mesh(new THREE.TorusGeometry(0.3, 0.03, 10, 24, Math.PI), M.iron, 0, 0.3, 0, an).rotation.z = Math.PI
    for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.06, 0.16, 4), M.iron, s * 0.3, 0.36, 0, an).rotation.z = -s * 0.5
  }

  // treasure chest: dark planks, red straps, brass corners, three padlocks
  const CW = 0.9, CH = 0.45, CD = 0.56, CR = CD / 2
  const chest = group(CHEST_POS.x, 0, CHEST_POS.z, CHEST_RY)
  box(CW, CH, CD, M.chest, 0, CH / 2, 0, chest)
  for (const y of [0.15, 0.3]) box(CW + 0.004, 0.008, CD + 0.004, std(0x2a1a10), 0, y, 0, chest).castShadow = false
  for (const sx of [-0.24, 0.24]) {
    box(0.07, CH + 0.01, CD + 0.012, M.strap, sx, CH / 2, 0, chest)
    for (const y of [0.08, 0.2, 0.36]) mesh(new THREE.SphereGeometry(0.012, 8, 6), M.brass, sx, y, CD / 2 + 0.008, chest)
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, CH + 0.02, 0.05, M.brass, (sx * (CW - 0.04)) / 2, CH / 2, (sz * (CD - 0.04)) / 2, chest)
  box(CW + 0.02, 0.04, CD + 0.02, M.brass, 0, CH - 0.02, 0, chest)
  box(CW + 0.02, 0.04, CD + 0.02, M.brass, 0, 0.02, 0, chest)
  for (const sx of [-1, 1]) {
    const handle = mesh(new THREE.TorusGeometry(0.06, 0.01, 8, 20, Math.PI), M.brass, (sx * CW) / 2 + sx * 0.012, 0.3, 0, chest)
    handle.rotation.set(0, Math.PI / 2, Math.PI)
  }
  const gold = mesh(
    new THREE.BoxGeometry(CW - 0.12, 0.06, CD - 0.12),
    new THREE.MeshStandardMaterial({ color: 0xe8b84a, emissive: 0xc08a20, emissiveIntensity: 0, metalness: 0.8, roughness: 0.3 }),
    0, CH - 0.03, 0, chest,
  )
  const lid = group(0, CH, -CR, 0, chest)
  const half = (r: number, len: number, mat: THREE.Material, x: number, open = false) => {
    const m = mesh(new THREE.CylinderGeometry(r, r, len, 28, 1, open, 0, Math.PI), mat, x, 0, CR, lid)
    m.rotation.z = Math.PI / 2
    return m
  }
  half(CR, CW, M.chest, 0)
  for (const sx of [-0.24, 0.24]) half(CR + 0.006, 0.07, M.strap, sx, true)
  for (const sx of [-1, 1]) half(CR + 0.008, 0.04, M.brass, (sx * (CW - 0.04)) / 2, true)
  const hasp = box(0.08, 0.13, 0.02, M.brass, 0, -0.05, CD + 0.012, lid)
  hasp.castShadow = false
  const chestLight = new THREE.PointLight(0xffc560, 0, 2.5, 1.5)
  chestLight.position.set(0, 0.6, 0.15)
  chest.add(chestLight)
  const locks = LOCK_X.map((x) => {
    const g = group(x, CH - 0.11, CD / 2 + 0.035, 0, chest)
    box(0.075, 0.06, 0.028, M.brass, 0, 0, 0, g)
    cyl(0.0375, 0.0375, 0.028, M.brass, 0, -0.03, 0, g, 20).rotation.x = Math.PI / 2
    box(0.012, 0.024, 0.004, std(0x1a120c), 0, -0.022, 0.015, g).castShadow = false
    const shackle = group(0, 0.03, 0, 0, g)
    mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 18, Math.PI), M.iron, 0, 0.02, 0, shackle)
    for (const s of [-1, 1]) cyl(0.007, 0.007, 0.02, M.iron, s * 0.025, 0.01, 0, shackle, 8)
    return { g, shackle }
  })

  return { root, scrolls, lamp, sun, lid, chestLight, gold, locks }
}

/* -------------------------------------------------------------- scene */

const ease = (k: number) => k * k * (3 - 2 * k)
const fovFor = (a: number) => (a < 0.8 ? 76 : a < 1.2 ? 64 : 55)

export function NavRoomScene() {
  const room = useMemo(buildRoom, [])
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null
  const quality = useStore((s) => s.quality)
  const seen = useStore((s) => s.progress.nav.seen)
  const stamped = useStore((s) => !!s.stamps.nav)
  const showToast = useStore((s) => s.showToast)
  const { mode, locks, lid, setOpen, setMode } = useNavRoom()
  const [ready, setReady] = useState(false)
  const [hover, setHover] = useState(-1)
  const allSeen = DEF.items.every((it) => seen.includes(it.key))
  const fly = useRef<{ from: THREE.Vector3; to: THREE.Vector3; lookFrom: THREE.Vector3; lookTo: THREE.Vector3; t0: number; dur: number; done?: () => void } | null>(null)
  const look = useRef(TARGET.clone())
  const lockAnim = useRef<number[]>([]) // start time of each lock's opening
  const lidK = useRef(0)

  const flyTo = (to: THREE.Vector3, lookTo: THREE.Vector3, dur: number, done?: () => void) => {
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches
    fly.current = { from: camera.position.clone(), to, lookFrom: look.current.clone(), lookTo, t0: performance.now(), dur: fast ? 0.01 : dur, done }
  }

  // chest close-up: in front of the chest, framed beside (desktop) or above (phone) the question panel
  const chestView = () => {
    const f = new THREE.Vector3(Math.sin(CHEST_RY), 0, Math.cos(CHEST_RY))
    const portrait = size.width / size.height < 0.9
    const pos = CHEST_POS.clone().addScaledVector(f, portrait ? 2.1 : 1.9).add(new THREE.Vector3(0, portrait ? 1.1 : 0.95, 0))
    const target = CHEST_POS.clone().add(new THREE.Vector3(0, 0.3, 0))
    if (portrait) target.y -= 0.45
    else target.addScaledVector(new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)), -0.5)
    return { pos, target }
  }

  useLayoutEffect(() => {
    const near = camera.near
    camera.near = 0.05
    camera.position.copy(START)
    camera.lookAt(TARGET)
    camera.updateProjectionMatrix()
    flyTo(SEAT.clone(), TARGET.clone(), 2.6, () => setReady(true))
    return () => {
      camera.near = near
      camera.fov = 50
      camera.updateProjectionMatrix()
      document.body.style.cursor = ''
      dispose(room.root)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    camera.fov = fovFor(size.width / size.height)
    camera.updateProjectionMatrix()
  }, [camera, size])

  useEffect(() => {
    const m = quality === 'high' ? 2048 : 1024
    room.sun.shadow.mapSize.set(m, m)
    room.sun.shadow.map?.dispose()
    room.sun.shadow.map = null
  }, [quality, room])

  // each solved question opens the next padlock; a replay puts them back
  useEffect(() => {
    if (locks < lockAnim.current.length) lockAnim.current = []
    while (lockAnim.current.length < locks) {
      lockAnim.current.push(performance.now())
      sfx.ding()
    }
  }, [locks])

  // camera follows the mode: the chest close-up or back to the table
  const first = useRef(true)
  useEffect(() => {
    if (first.current) return void (first.current = false)
    setReady(false)
    if (mode === 'chest') {
      const v = chestView()
      flyTo(v.pos, v.target, 1.4)
    } else {
      if (controls) look.current.copy(controls.target)
      flyTo(SEAT.clone(), TARGET.clone(), 1.4, () => setReady(true))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const f = fly.current
    if (f) {
      const k = Math.min(1, (performance.now() - f.t0) / 1000 / f.dur)
      const e = ease(k)
      camera.position.lerpVectors(f.from, f.to, e)
      look.current.lerpVectors(f.lookFrom, f.lookTo, e)
      camera.lookAt(look.current)
      if (k >= 1) {
        fly.current = null
        f.done?.()
      }
    }
    room.scrolls.forEach((s, i) => {
      const idle = !seen.includes(DEF.items[i]?.key)
      s.g.position.y = s.base + (idle ? 0.012 + Math.sin(t * 2 + i) * 0.012 : 0)
      s.g.scale.setScalar(THREE.MathUtils.lerp(s.g.scale.x, hover === i ? 1.12 : 1, 0.2))
      s.paper.material.emissive.setHex(0xffb35c)
      s.paper.material.emissiveIntensity = idle ? 0.14 + 0.1 * Math.sin(t * 3 + i) : 0
    })
    room.lamp.intensity = 7 + Math.sin(t * 7) * 0.3 + Math.sin(t * 13) * 0.2
    // padlocks: shackle pops up and turns, then the lock drops away
    const now = performance.now()
    room.locks.forEach(({ g, shackle }, i) => {
      const s0 = lockAnim.current[i]
      const k = s0 === undefined ? 0 : (now - s0) / 1000
      shackle.position.y = 0.03 + Math.min(1, k / 0.25) * 0.022
      shackle.rotation.y = Math.min(1, Math.max(0, (k - 0.25) / 0.25)) * (Math.PI / 2)
      const fall = Math.max(0, k - 0.7)
      g.position.y = 0.34 - 2.2 * fall * fall
      g.rotation.z = fall * 3
      g.visible = fall < 0.5
    })
    lidK.current += ((lid ? 1 : 0) - lidK.current) * 0.04
    room.lid.rotation.x = -1.2 * lidK.current
    const glow = allSeen && !lid ? 0.6 + 0.4 * Math.sin(t * 3) : 0
    room.chestLight.intensity = 5 * lidK.current + glow
    room.gold.material.emissiveIntensity = 0.9 * lidK.current
  })

  const tap = (e: ThreeEvent<MouseEvent>, fn: () => void) => {
    if (e.delta > 6 || !ready) return
    e.stopPropagation()
    fn()
  }
  const openChest = () => {
    if (!allSeen) return showToast(`شاهدي المخطوطات الأربع أولًا (${toAr(seen.length)} من ${toAr(DEF.items.length)}) 📜`)
    useNavRoom.setState({ locks: 0, lid: false })
    setMode('chest')
  }
  const pointer = (on: boolean) => () => (document.body.style.cursor = on ? 'pointer' : '')
  const showTags = ready && mode === 'room'

  return (
    <>
      <Indoor />
      <primitive object={room.root} />
      <OrbitControls
        makeDefault
        enabled={ready && mode === 'room'}
        target={[TARGET.x, TARGET.y, TARGET.z]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        minDistance={1.3}
        maxDistance={2.85}
        minPolarAngle={0.45}
        maxPolarAngle={1.42}
        minAzimuthAngle={-1.15}
        maxAzimuthAngle={1.15}
      />
      {DEF.items.map((it, i) => {
        const done = seen.includes(it.key)
        return (
          <group key={it.key} position={[XS[i] ?? 0, TOP + 0.05, 0.08]} rotation-y={Math.PI / 2 + (YAW[i] ?? 0)}>
            <mesh
              onClick={(e) => tap(e, () => setOpen(it.key))}
              onPointerOver={() => (setHover(i), pointer(true)())}
              onPointerOut={() => (setHover(-1), pointer(false)())}
            >
              <boxGeometry args={[0.62, 0.26, 0.3]} />
              <meshBasicMaterial visible={false} />
            </mesh>
            {showTags && (
              <Html position={[0, i % 2 ? 0.36 : 0.22, 0]} center zIndexRange={[30, 0]}>
                <button className={'nav-tag' + (done ? ' is-done' : '')} onClick={() => setOpen(it.key)}>
                  <span className="nav-tag__n">{toAr(i + 1)}</span>
                  <span className="nav-tag__t">{it.title}</span>
                  {done && <span className="nav-tag__ck">✓</span>}
                </button>
              </Html>
            )}
          </group>
        )
      })}
      <group position={CHEST_POS} rotation-y={CHEST_RY}>
        <mesh position={[0, 0.35, 0]} onClick={(e) => tap(e, openChest)} onPointerOver={pointer(true)} onPointerOut={pointer(false)}>
          <boxGeometry args={[1, 0.8, 0.7]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {showTags && (
          <Html position={[0, 1.0, 0]} center zIndexRange={[30, 0]}>
            <button className={'nav-tag nav-tag--chest' + (allSeen ? ' is-open' : '') + (stamped ? ' is-done' : '')} onClick={openChest}>
              <span aria-hidden>{stamped ? '✓' : allSeen ? '🗝️' : '🔒'}</span>
              <span className="nav-tag__t">صندوق الكنز</span>
            </button>
          </Html>
        )}
      </group>
    </>
  )
}
