// المحطة الثالثة «سفن صنعت التاريخ»: سفينة عُمانية قديمة وسط البحر، ثم مقصورة القبطان
// وفيها طاولة عليها ثلاثة ميكروفونات (حلقات بودكاست). الواجهة في ui/ShipStation.tsx، والحالة في useShip.
// (المعرّف ivory بقي من محطة «تجارة العاج» التي حلّت محلها)
import { Html, OrbitControls } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { STATIONS } from '../stations'
import { useStore } from '../store'
import { toAr } from '../ui/Quiz'
import { useShip } from '../ui/ShipStation'
import { Indoor, Outdoor } from './Atmosphere'
import { dispose, drawBoards, drawChart, drawPlanks, drawSea, drawWood, reseed, tex } from './kit'

const DEF = STATIONS.ivory
const ease = (k: number) => k * k * (3 - 2 * k)
const fovFor = (a: number) => (a < 0.8 ? 76 : a < 1.2 ? 64 : 55)

const std = (color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o })
function add<G extends THREE.BufferGeometry, M extends THREE.Material>(parent: THREE.Object3D, geo: G, mat: M, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = m.receiveShadow = true
  parent.add(m)
  return m
}
const box = (p: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => add(p, new THREE.BoxGeometry(w, h, d), mat, x, y, z)
const cyl = (p: THREE.Object3D, r1: number, r2: number, h: number, mat: THREE.Material, x: number, y: number, z: number, seg = 14) =>
  add(p, new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y, z)

/** a lateen sail: triangle A (tack) - B (peak) - C (clew), billowed out along +z */
function sailGeometry(A: THREE.Vector2, B: THREE.Vector2, C: THREE.Vector2, bulge: number, n = 14) {
  const pos: number[] = []
  const idx: number[] = []
  const id = (i: number, j: number) => (i * (2 * n + 3 - i)) / 2 + j
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n - i; j++) {
      const u = i / n, v = j / n
      pos.push(A.x + (B.x - A.x) * u + (C.x - A.x) * v, A.y + (B.y - A.y) * u + (C.y - A.y) * v, 27 * bulge * u * v * (1 - u - v))
    }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n - i; j++) {
      idx.push(id(i, j), id(i + 1, j), id(i, j + 1))
      if (j < n - i - 1) idx.push(id(i + 1, j), id(i + 1, j + 1), id(i, j + 1))
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** an Omani baghlah: long raked bow, tall square carved stern, two masts with lateen sails (bow = +x, ~2.2 units long) */
function makeBaghlah() {
  const ship = new THREE.Group()
  const wood = tex(512, 512, drawWood)
  const M = {
    hull: std(0x9a6a3e, { map: wood }),
    dark: std(0x5a3a22, { map: wood }),
    deck: std(0xc9a578, { map: wood }),
    sail: std(0xf3ead6, { side: THREE.DoubleSide, roughness: 0.95 }),
    rope: new THREE.LineBasicMaterial({ color: 0x3b2a1a }),
    glass: std(0xf6d58c, { emissive: 0xffb050, emissiveIntensity: 0.4 }),
    red: std(0x8e2f1f),
  }
  const sh = new THREE.Shape()
  sh.moveTo(-1.0, -0.26); sh.lineTo(-1.0, 0.26); sh.quadraticCurveTo(-0.7, 0.33, -0.2, 0.33); sh.lineTo(0.35, 0.31)
  sh.quadraticCurveTo(0.9, 0.2, 1.18, 0); sh.quadraticCurveTo(0.9, -0.2, 0.35, -0.31); sh.lineTo(-0.2, -0.33); sh.quadraticCurveTo(-0.7, -0.33, -1.0, -0.26)
  const hg = new THREE.ExtrudeGeometry(sh, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 18, steps: 4 })
  hg.rotateX(-Math.PI / 2)
  const p = hg.attributes.position
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k)
    if (y < 0.14) p.setZ(k, p.getZ(k) * (0.3 + y * 5)) // V-shaped keel
    // sheer line: the bow and the stern rise
    p.setY(k, y + (y / 0.34) * (Math.max(0, x - 0.55) * 0.25 + Math.max(0, -0.6 - x) * 0.3))
  }
  hg.computeVertexNormals()
  add(ship, hg, M.hull, 0, -0.12, 0)
  box(ship, 1.9, 0.03, 0.02, M.red, 0.05, 0.09, 0.335).rotation.y = 0.02
  box(ship, 1.9, 0.03, 0.02, M.red, 0.05, 0.09, -0.335).rotation.y = -0.02
  const deck = new THREE.Shape(sh.getPoints(24).map((v) => new THREE.Vector2(v.x * 0.97, v.y * 0.9)))
  const dg = new THREE.ShapeGeometry(deck)
  dg.rotateX(-Math.PI / 2)
  add(ship, dg, M.deck, 0, 0.215, 0)
  // stern castle with a carved, windowed transom
  box(ship, 0.42, 0.16, 0.56, M.dark, -0.82, 0.3, 0)
  box(ship, 0.03, 0.3, 0.58, M.hull, -1.03, 0.26, 0)
  for (const z of [-0.18, -0.06, 0.06, 0.18]) box(ship, 0.012, 0.07, 0.07, M.glass, -1.05, 0.3, z)
  box(ship, 0.014, 0.025, 0.56, M.red, -1.045, 0.4, 0)
  // long projecting stem
  cyl(ship, 0.012, 0.02, 0.5, M.dark, 1.28, 0.33, 0).rotation.z = -0.95
  // masts, yards and lateen sails
  const masts: [number, number, number, THREE.Vector2, THREE.Vector2, THREE.Vector2][] = [
    [0.22, 1.55, -0.12, new THREE.Vector2(0.98, 0.42), new THREE.Vector2(-0.62, 1.62), new THREE.Vector2(-0.36, 0.32)],
    [-0.55, 1.05, -0.1, new THREE.Vector2(-0.2, 0.42), new THREE.Vector2(-1.1, 1.14), new THREE.Vector2(-0.98, 0.36)],
  ]
  const ropes: THREE.Vector3[] = []
  for (const [x, h, rake, A, B, C] of masts) {
    const m = cyl(ship, 0.014, 0.022, h, M.dark, x, 0.2 + h / 2, 0, 10)
    m.rotation.z = rake
    const yard = cyl(ship, 0.008, 0.01, A.distanceTo(B), M.dark, (A.x + B.x) / 2, (A.y + B.y) / 2, 0.035, 8)
    yard.rotation.z = Math.atan2(B.y - A.y, B.x - A.x) - Math.PI / 2
    add(ship, sailGeometry(A, B, C, 0.09), M.sail, 0, 0, 0.04)
    const top = new THREE.Vector3(x - Math.sin(rake) * h * -1, 0.2 + h, 0)
    ropes.push(top, new THREE.Vector3(1.15, 0.3, 0), top, new THREE.Vector3(x - 0.15, 0.24, 0.3), top, new THREE.Vector3(x - 0.15, 0.24, -0.3))
    ropes.push(new THREE.Vector3(C.x, C.y, 0.04), new THREE.Vector3(C.x - 0.1, 0.24, 0.2))
  }
  ship.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ropes), M.rope))
  // deck cargo: a few chests and sacks
  for (const [x, z] of [[0.55, 0.12], [0.62, -0.1], [-0.2, 0.15]] as const) box(ship, 0.1, 0.07, 0.08, M.dark, x, 0.25, z)
  return ship
}

/* ---------------------------------------------------------------- sea */

function SeaView() {
  const quality = useStore((s) => s.quality)
  const boarding = useShip((s) => s.boarding)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const ship = useMemo(() => {
    const g = makeBaghlah()
    g.scale.setScalar(6.5)
    return g
  }, [])
  const N = quality === 'high' ? 140 : 80
  const sea = useMemo(() => {
    const g = new THREE.PlaneGeometry(220, 220, N, N)
    g.rotateX(-Math.PI / 2)
    return g
  }, [N])
  const base = useMemo(() => Float32Array.from(sea.attributes.position.array), [sea])
  const birds = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let k = 0; k < 5; k++) pts.push(new THREE.Vector3(-0.5, 0.18, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 0.18, 0))
    return new THREE.BufferGeometry().setFromPoints(pts.slice(0, 4))
  }, [])
  const birdRefs = useRef<THREE.LineSegments[]>([])
  const board = useRef<{ t0: number; from: THREE.Vector3 } | null>(null)
  useEffect(() => () => dispose(ship), [ship])
  useEffect(() => {
    camera.fov = fovFor(size.width / size.height)
    camera.near = 0.1
    camera.updateProjectionMatrix()
  }, [camera, size])
  useEffect(() => {
    if (boarding) board.current = { t0: performance.now(), from: camera.position.clone() }
  }, [boarding, camera])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // gentle swell
    const pos = sea.attributes.position
    for (let k = 0; k < pos.count; k++) {
      const x = base[k * 3], z = base[k * 3 + 2]
      pos.setY(k, Math.sin(x * 0.18 + t * 0.9) * 0.22 + Math.sin(z * 0.23 - t * 0.7) * 0.18 + Math.sin((x + z) * 0.6 + t * 1.6) * 0.05)
    }
    pos.needsUpdate = true
    sea.computeVertexNormals()
    ship.position.y = -0.55 + Math.sin(t * 0.8) * 0.12
    ship.rotation.set(Math.sin(t * 0.9) * 0.02, 0.35, Math.sin(t * 0.7) * 0.035)
    birdRefs.current.forEach((b, k) => {
      if (!b) return
      const a = t * 0.25 + k * 1.3
      b.position.set(Math.cos(a) * (14 + k * 3), 15 + k * 1.2 + Math.sin(t * 2 + k) * 0.4, Math.sin(a) * (14 + k * 3) - 4)
      b.rotation.y = -a
      b.scale.set(1.4, 1 + Math.sin(t * 6 + k) * 0.6, 1)
    })
    // camera: a slow orbit around the ship, then a glide to the deck when boarding
    const orbit = new THREE.Vector3(Math.sin(0.6 + t * 0.04) * 26, 7.5, Math.cos(0.6 + t * 0.04) * 26)
    const look = new THREE.Vector3(0, 4, 0)
    if (board.current) {
      const k = ease(Math.min(1, (performance.now() - board.current.t0) / 1600))
      camera.position.lerpVectors(board.current.from, new THREE.Vector3(-3, 4.2, 2), k)
      look.lerp(new THREE.Vector3(-6, 2.5, 0), k)
    } else camera.position.copy(orbit)
    camera.lookAt(look)
  })

  return (
    <>
      <Outdoor sun={[-0.5, 0.45, 0.6]} shadowSize={20} fog={[70, 420]} />
      <mesh geometry={sea} receiveShadow>
        <meshStandardMaterial color="#1d6f80" roughness={0.22} metalness={0.05} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.3}>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color="#1a6576" roughness={0.3} />
      </mesh>
      <primitive object={ship} />
      {[0, 1, 2, 3, 4].map((k) => (
        <lineSegments key={k} ref={(r) => void (birdRefs.current[k] = r!)} geometry={birds}>
          <lineBasicMaterial color="#3a3a3a" />
        </lineSegments>
      ))}
    </>
  )
}

/* -------------------------------------------------------------- cabin */

const W = 6, D = 5, H = 2.6, TOP = 0.86
const MIC_X = [0.62, 0, -0.62] // right-to-left, like Arabic reading order
const TARGET = new THREE.Vector3(0, 0.95, 0)
const SEAT = new THREE.Vector3(0, 1.75, 2.15)
const MIC_COLORS = [0xa3242a, 0x23466b, 0x2f6b45]

function buildCabin() {
  reseed(23)
  const root = new THREE.Group()
  const wood = tex(512, 512, drawWood)
  const boards = tex(1024, 1024, drawBoards, [1, 1])
  const M = {
    wall: std(0xffffff, { map: boards }),
    floor: std(0xffffff, { map: tex(1024, 1024, drawPlanks, [2, 1.5]) }),
    dark: std(0x5a3a22, { map: wood }),
    wood: std(0xffffff, { map: wood }),
    brass: std(0xc0913e, { metalness: 0.75, roughness: 0.35 }),
    iron: std(0x3b3936, { metalness: 0.6, roughness: 0.5 }),
    rope: std(0xb38b56, { roughness: 1 }),
    grille: std(0xd8d2c4, { metalness: 0.8, roughness: 0.3 }),
  }
  const T = 0.12
  const floor = add(root, new THREE.PlaneGeometry(W, D), M.floor)
  floor.rotation.x = -Math.PI / 2
  const ceil = add(root, new THREE.PlaneGeometry(W, D), std(0x3b2414), 0, H, 0)
  ceil.rotation.x = Math.PI / 2
  for (let k = 0; k < 5; k++) box(root, W, 0.16, 0.18, M.dark, 0, H - 0.08, -D / 2 + 0.5 + k)
  // side walls lean in a little, like a hull
  for (const s of [-1, 1]) {
    const w = box(root, T, H + 0.2, D, M.wall, s * (W / 2 + T / 2), H / 2, 0)
    w.rotation.z = s * 0.06
  }
  box(root, W, H, T, M.wall, 0, H / 2, D / 2 + T / 2)
  // stern wall: a row of four windows looking out to sea
  const zb = -D / 2 - T / 2, y0 = 0.95, y1 = 1.85, wins = [-1.8, -0.6, 0.6, 1.8], ww = 0.8
  box(root, W, y0, T, M.wall, 0, y0 / 2, zb)
  box(root, W, H - y1, T, M.wall, 0, (H + y1) / 2, zb)
  const xs = [-W / 2, ...wins.flatMap((x) => [x - ww / 2, x + ww / 2]), W / 2]
  for (let k = 0; k < xs.length; k += 2) if (xs[k + 1] - xs[k] > 0.01) box(root, xs[k + 1] - xs[k], y1 - y0, T, M.wall, (xs[k] + xs[k + 1]) / 2, (y0 + y1) / 2, zb)
  for (const x of wins) {
    box(root, ww + 0.08, 0.07, 0.16, M.dark, x, y1, -D / 2)
    box(root, ww + 0.12, 0.07, 0.22, M.dark, x, y0, -D / 2 + 0.03)
    box(root, 0.04, y1 - y0, 0.06, M.dark, x, (y0 + y1) / 2, -D / 2)
    box(root, ww, 0.04, 0.06, M.dark, x, (y0 + y1) / 2, -D / 2)
  }
  const view = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), new THREE.MeshBasicMaterial({ map: tex(1024, 512, drawSea), toneMapped: false }))
  view.position.set(0, 1.4, -D / 2 - 2)
  root.add(view)
  // light: daylight through the stern windows + a lantern over the table
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.6)
  sun.position.set(0.8, 3.2, -7)
  sun.target.position.set(0, 0.8, 0.3)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.bias = -0.0005
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 16 })
  root.add(sun, sun.target)
  const lamp = new THREE.PointLight(0xffb067, 6, 7, 1.6)
  lamp.position.set(0, 1.95, 0.1)
  root.add(lamp)
  add(root, new THREE.CylinderGeometry(0.08, 0.08, 0.2, 6), std(0xffd9a0, { emissive: 0xffa040, emissiveIntensity: 1.6, transparent: true, opacity: 0.9 }), 0, 2.0, 0.1).castShadow = false
  add(root, new THREE.ConeGeometry(0.11, 0.1, 6), M.brass, 0, 2.15, 0.1)
  cyl(root, 0.005, 0.005, H - 2.2, M.iron, 0, 2.2 + (H - 2.2) / 2, 0.1, 6)
  // sea charts on the side walls
  for (const s of [-1, 1]) {
    const chart = add(root, new THREE.PlaneGeometry(1.5, 1.0), std(0xffffff, { map: tex(1024, 700, drawChart) }), s * (W / 2 - 0.08), 1.55, -0.6)
    chart.rotation.y = -s * Math.PI / 2
    chart.rotation.x = 0
  }
  // ropes, barrel and a sea chest
  {
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 160; k++) {
      const a = (k / 160) * Math.PI * 2 * 3.2, r = 0.18 + 0.025 * Math.floor(k / 50)
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.03 + k * 0.0006, Math.sin(a) * r))
    }
    add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.028, 8), M.rope, -2.3, 0, -1.6)
  }
  add(root, new THREE.LatheGeometry([...Array(9)].map((_, k) => new THREE.Vector2(0.24 + 0.05 * Math.sin((Math.PI * k) / 8), k * 0.085)), 24), M.wood, 2.35, 0, -1.7)
  box(root, 0.8, 0.42, 0.48, M.dark, -2.2, 0.21, 1.2).rotation.y = 0.4
  // a coil of rope hanging on a peg and a few hanging ropes
  for (const x of [-2.9, 2.9]) {
    const r = add(root, new THREE.TorusGeometry(0.22, 0.03, 8, 28), M.rope, x * 0.97, 1.4, 1.3)
    r.rotation.y = Math.PI / 2
  }
  // table + three podcast microphones
  box(root, 2.2, 0.08, 1.1, M.wood, 0, TOP - 0.04, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(root, 0.08, TOP - 0.08, 0.08, M.dark, sx * 1.0, (TOP - 0.08) / 2, sz * 0.45)
  const map = add(root, new THREE.PlaneGeometry(1.2, 0.8), std(0xffffff, { map: tex(1024, 700, drawChart) }), 0, TOP + 0.002, 0.05)
  map.rotation.x = -Math.PI / 2
  map.castShadow = false
  const mics = MIC_X.map((x, i) => {
    const g = new THREE.Group()
    g.position.set(x, TOP, 0.05)
    root.add(g)
    cyl(g, 0.09, 0.1, 0.025, M.iron, 0, 0.0125, 0, 24)
    cyl(g, 0.012, 0.012, 0.22, M.brass, 0, 0.13, 0, 10)
    const yoke = add(g, new THREE.TorusGeometry(0.075, 0.008, 8, 20, Math.PI), M.brass, 0, 0.245, 0)
    yoke.rotation.z = Math.PI
    const head = add(g, new THREE.CapsuleGeometry(0.06, 0.09, 8, 18), M.grille.clone(), 0, 0.31, 0)
    head.rotation.z = Math.PI / 2
    const band = add(g, new THREE.CylinderGeometry(0.064, 0.064, 0.03, 24), std(MIC_COLORS[i % 3], { roughness: 0.5 }), 0, 0.31, 0)
    band.rotation.z = Math.PI / 2
    return { g, head, base: 0 }
  })
  return { root, mics, lamp }
}

function Cabin() {
  const cabin = useMemo(buildCabin, [])
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const seen = useStore((s) => s.progress.ivory.seen)
  const setOpen = useShip((s) => s.setOpen)
  const [ready, setReady] = useState(false)
  const [hover, setHover] = useState(-1)
  const t0 = useRef(performance.now())
  const from = useMemo(() => new THREE.Vector3(0, 1.9, 4.6), [])
  useLayoutEffect(() => {
    camera.near = 0.05
    camera.position.copy(from)
    camera.lookAt(TARGET)
    camera.updateProjectionMatrix()
    return () => {
      document.body.style.cursor = ''
      dispose(cabin.root)
    }
  }, [camera, cabin, from])
  useEffect(() => {
    camera.fov = fovFor(size.width / size.height)
    camera.updateProjectionMatrix()
  }, [camera, size])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (!ready) {
      const k = ease(Math.min(1, (performance.now() - t0.current) / 1600))
      camera.position.lerpVectors(from, SEAT, k)
      camera.lookAt(TARGET)
      if (k >= 1) setReady(true)
    }
    // the ship rolls gently
    cabin.root.rotation.z = Math.sin(t * 0.6) * 0.012
    cabin.root.rotation.x = Math.sin(t * 0.45) * 0.006
    cabin.lamp.intensity = 6 + Math.sin(t * 7) * 0.25
    cabin.mics.forEach((m, i) => {
      const idle = !seen.includes(DEF.items[i]?.key)
      m.g.scale.setScalar(THREE.MathUtils.lerp(m.g.scale.x, hover === i ? 1.12 : 1, 0.2))
      const mat = m.head.material as THREE.MeshStandardMaterial
      mat.emissive.setHex(0xffb35c)
      mat.emissiveIntensity = idle ? 0.12 + 0.1 * Math.sin(t * 3 + i) : 0
    })
  })
  const tap = (e: ThreeEvent<MouseEvent>, fn: () => void) => {
    if (e.delta > 6 || !ready) return
    e.stopPropagation()
    fn()
  }
  const pointer = (on: boolean) => () => (document.body.style.cursor = on ? 'pointer' : '')
  return (
    <>
      <Indoor />
      <primitive object={cabin.root} />
      <OrbitControls
        makeDefault
        enabled={ready}
        target={[TARGET.x, TARGET.y, TARGET.z]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        minDistance={1.2}
        maxDistance={2.3}
        minPolarAngle={0.5}
        maxPolarAngle={1.4}
        minAzimuthAngle={-1.0}
        maxAzimuthAngle={1.0}
      />
      {DEF.items.map((it, i) => {
        const done = seen.includes(it.key)
        return (
          <group key={it.key} position={[MIC_X[i] ?? 0, TOP, 0.05]}>
            <mesh
              position={[0, 0.2, 0]}
              onClick={(e) => tap(e, () => setOpen(it.key))}
              onPointerOver={() => (setHover(i), pointer(true)())}
              onPointerOut={() => (setHover(-1), pointer(false)())}
            >
              <boxGeometry args={[0.3, 0.45, 0.3]} />
              <meshBasicMaterial visible={false} />
            </mesh>
            {ready && (
              <Html position={[0, i % 2 ? 0.62 : 0.5, 0]} center zIndexRange={[30, 0]}>
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
    </>
  )
}

export function ShipScene() {
  const phase = useShip((s) => s.phase)
  return phase === 'sea' ? <SeaView /> : <Cabin />
}
