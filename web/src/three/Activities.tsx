import { Html, Line } from '@react-three/drei'
import type { CameraControlsImpl } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { consumeInteract } from '../game/input'
import { sfx } from '../game/sfx'
import { groundAt, type World } from '../game/world'
import type { StationId } from '../stations'
import { modalOpen, useStore } from '../store'
import { worldPos, type V3 } from './helpers'
import { camOverride, player } from './Player'

/** Objective marker published by the running activity (read by StationScene). */
export const activityNav = { target: null as THREE.Vector3 | null, label: '' }

interface Props {
  id: StationId
  scene: THREE.Object3D
  nodes: Record<string, THREE.Object3D>
  empties: Record<string, THREE.Object3D>
  world: World
  controls: RefObject<CameraControlsImpl | null>
}

export function StationActivity(p: Props) {
  if (p.id === 'nav') return <StarsActivity {...p} />
  if (p.id === 'sumhuram') return <DigActivity {...p} />
  if (p.id === 'turtles') return <TurtleActivity {...p} />
  if (p.id === 'ivory') return <TradeActivity {...p} />
  return <ClothingActivity {...p} />
}

const xzDist = (a: THREE.Vector3 | V3, b: THREE.Vector3) => {
  const ax = Array.isArray(a) ? a[0] : a.x
  const az = Array.isArray(a) ? a[2] : a.z
  return Math.hypot(ax - b.x, az - b.z)
}

/** Show an interaction prompt while the player is inside `active`; returns true when E / the button is pressed. */
function usePromptZone(key: string) {
  return (active: boolean) => {
    const st = useStore.getState()
    if (active) {
      if (st.prompt !== key) st.setPrompt(key)
      return consumeInteract()
    }
    if (st.prompt === key) st.setPrompt(null)
    return false
  }
}

/* ===================================================== 1. navigation: stars */

const ALT = (23 * Math.PI) / 180 // Polaris altitude ≈ latitude of Oman
const R = 260
const DIR = new THREE.Vector3(0, Math.sin(ALT), -Math.cos(ALT))
const UPT = new THREE.Vector3(0, Math.cos(ALT), Math.sin(ALT))
const RIGHT = new THREE.Vector3(1, 0, 0)
const sky = (ox: number, oy: number) => DIR.clone().multiplyScalar(R).addScaledVector(RIGHT, ox * R).addScaledVector(UPT, oy * R)
// Little Dipper (الدب الأصغر) hanging from Polaris
const DIPPER = [
  [0, 0], [0.05, -0.035], [0.085, -0.09], [0.115, -0.15], [0.095, -0.215], [0.165, -0.25], [0.19, -0.185], [0.115, -0.15],
].map(([x, y]) => sky(x, y))
const BIG_STARS = Array.from({ length: 26 }, (_, i) => {
  const a = (i * 2.399) % (Math.PI * 2)
  const r = 0.12 + ((i * 37) % 23) / 23 * 0.5
  return sky(Math.cos(a) * r * 1.4, Math.sin(a) * r * 0.55 - 0.05)
})

function StarsActivity({ empties, controls }: Props) {
  const done = useStore((s) => s.progress.nav.activity)
  const [gazing, setGazing] = useState(false)
  const halo = useRef<THREE.Mesh>(null!)
  const spot = useMemo(() => new THREE.Vector3(...worldPos(empties['StarSpot'])), [empties])
  const zone = usePromptZone('stars')
  useEffect(() => {
    activityNav.target = done ? null : spot
    activityNav.label = 'نهاية الرصيف'
  }, [done, spot])
  useEffect(
    () => () => {
      camOverride.range = null
      camOverride.lift = 0
    },
    [],
  )

  const prevDist = useRef(6)
  const lookUp = () => {
    const c = controls.current
    if (!c) return
    setGazing(true)
    prevDist.current = c.distance
    // close behind her and above her head, looking up (setting the range alone does not move the camera)
    camOverride.range = [2.0, 2.6]
    camOverride.lift = 1.3
    c.maxPolarAngle = 2.1
    c.minDistance = 2.0 // dollyTo clamps to the current range
    c.dollyTo(2.3, true)
    c.rotateTo(0, 2.02, true)
    useStore.getState().showToast('ابحث في السماء الشمالية عن «نجم الجاه» واضغط عليه ✨')
  }
  const restore = () => {
    const c = controls.current
    camOverride.range = null
    camOverride.lift = 0
    if (c) {
      c.maxPolarAngle = 1.62
      c.rotateTo(c.azimuthAngle, 1.25, true)
      c.maxDistance = Math.max(c.maxDistance, prevDist.current)
      c.dollyTo(prevDist.current, true)
    }
    setGazing(false)
  }

  useFrame((s) => {
    const st = useStore.getState()
    const near = !st.busy && !modalOpen() && !done && !gazing && xzDist(spot, player.pos) < 2.6
    if (zone(near)) lookUp()
    if (gazing && !done && xzDist(spot, player.pos) > 4.5) restore()
    if (halo.current) {
      const k = 1 + Math.sin(s.clock.elapsedTime * 3) * 0.25
      halo.current.scale.setScalar(gazing && !done ? k * 1.6 : k)
      halo.current.lookAt(s.camera.position)
    }
  })

  const found = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (done) return
    sfx.correct()
    useStore.getState().setActivityDone('nav')
    useStore.getState().showToast('أحسنت! هذا «نجم الجاه» (النجم القطبي)؛ اهتدى به البحّارة إلى جهة الشمال ⭐')
    setTimeout(restore, 3500)
  }

  return (
    <group>
      {BIG_STARS.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.9 + (i % 3) * 0.3, 8, 6]} />
          <meshBasicMaterial color={i % 4 ? '#e8efff' : '#ffe6c4'} toneMapped={false} fog={false} />
        </mesh>
      ))}
      {DIPPER.slice(1, 7).map((p, i) => (
        <mesh key={'d' + i} position={p}>
          <sphereGeometry args={[1.3, 8, 6]} />
          <meshBasicMaterial color="#f2f5ff" toneMapped={false} fog={false} />
        </mesh>
      ))}
      <mesh position={DIPPER[0]}>
        <sphereGeometry args={[2.0, 12, 8]} />
        <meshBasicMaterial color="#fff4d0" toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={halo} position={DIPPER[0]}>
        <ringGeometry args={[4, 5.2, 32]} />
        <meshBasicMaterial color="#ffd36b" transparent opacity={done ? 0.0 : 0.55} toneMapped={false} fog={false} depthWrite={false} />
      </mesh>
      <mesh position={DIPPER[0]} onClick={found} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
        <sphereGeometry args={[11, 8, 6]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {done && <Line points={DIPPER} color="#ffd36b" lineWidth={2} transparent opacity={0.8} />}
      {done && (
        <Html position={DIPPER[0].clone().add(new THREE.Vector3(0, 9, 0))} center zIndexRange={[25, 5]} style={{ pointerEvents: 'none' }}>
          <div className="sky-label">نجم الجاه ⭐</div>
        </Html>
      )}
    </group>
  )
}

/* ================================================== 2. sumhuram: excavation */

function DigActivity({ nodes, empties, world }: Props) {
  const done = useStore((s) => s.progress.sumhuram.activity)
  const spots = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((n) => {
        const p = worldPos(empties['Dig_' + n])
        return new THREE.Vector3(p[0], groundAt(world, p[0], p[2], 50), p[2])
      }),
    [empties, world],
  )
  const arts = useMemo(() => [1, 2, 3, 4, 5].map((n) => nodes['Art_' + n]), [nodes])
  const [dug, setDug] = useState<boolean[]>(() => (done ? [true, true, true, true, true] : [false, false, false, false, false]))
  const t0 = useRef<number[]>([0, 0, 0, 0, 0])
  const zone = usePromptZone('dig')

  useEffect(() => {
    arts.forEach((a, i) => {
      if (!a) return
      a.visible = dug[i]
      a.position.y = dug[i] ? 0.7 : -0.6
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arts])

  const dig = (i: number) => {
    if (dug[i]) return
    sfx.dig()
    t0.current[i] = performance.now()
    const next = dug.slice()
    next[i] = true
    setDug(next)
    const st = useStore.getState()
    st.setInfo({ station: 'sumhuram', key: 'art_' + (i + 1) })
    setTimeout(() => sfx.ding(), 700)
    if (next.every(Boolean)) {
      setTimeout(() => {
        st.setActivityDone('sumhuram')
        st.showToast('رائع! اكتشفت القطع الخمس مثل علماء الآثار 🏺')
      }, 1600)
    }
  }

  useFrame((s) => {
    const now = performance.now()
    arts.forEach((a, i) => {
      if (!a || !dug[i]) return
      a.visible = true
      const k = Math.min(1, (now - t0.current[i]) / 1300)
      const e = 1 - Math.pow(1 - k, 3)
      a.position.set(spots[i].x, spots[i].y - 0.5 + e * 1.15 + Math.sin(s.clock.elapsedTime * 2 + i) * 0.05, spots[i].z)
      a.rotation.y += 0.01
    })
    const next = dug.findIndex((d) => !d)
    activityNav.target = next >= 0 ? spots[next] : null
    activityNav.label = 'موقع حفر'
    const st = useStore.getState()
    if (st.busy || modalOpen()) return
    let near = -1
    spots.forEach((p, i) => {
      if (!dug[i] && xzDist(p, player.pos) < 1.7) near = i
    })
    if (zone(near >= 0)) dig(near)
  })

  return (
    <group>
      {spots.map((p, i) =>
        dug[i] ? (
          <mesh key={i} position={[p.x, p.y + 0.02, p.z]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.65, 24]} />
            <meshStandardMaterial color="#4a3422" roughness={1} />
          </mesh>
        ) : (
          <group key={i} position={[p.x, p.y, p.z]}>
            <mesh scale={[0.75, 0.32, 0.75]} castShadow receiveShadow onClick={(e) => (e.stopPropagation(), xzDist(p, player.pos) < 4 && dig(i))}>
              <sphereGeometry args={[1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#d9b27a" roughness={1} />
            </mesh>
            <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
              <ringGeometry args={[0.85, 1.0, 40]} />
              <meshBasicMaterial color="#ffd36b" transparent opacity={0.7} toneMapped={false} depthWrite={false} />
            </mesh>
            <Html position={[0, 1.1, 0]} center zIndexRange={[25, 5]} style={{ pointerEvents: 'none' }}>
              <div className="dig-badge">⛏</div>
            </Html>
          </group>
        ),
      )}
    </group>
  )
}

/* ================================================= 3. turtles: to the sea */

type HState = 'idle' | 'crawl' | 'confused' | 'safe' | 'gone'

function TurtleActivity({ nodes, empties, scene, world }: Props) {
  const done = useStore((s) => s.progress.turtles.activity)
  const lamps = useMemo(() => [1, 2, 3].map((n) => new THREE.Vector3(...worldPos(empties['Lamp_' + n]))), [empties])
  const [on, setOn] = useState<boolean[]>(() => (done ? [false, false, false] : [true, true, true]))
  const onRef = useRef(on)
  onRef.current = on
  const warned = useRef(false)
  const lampZone = usePromptZone('lamp')
  const hatch = useMemo(() => {
    const tpl = nodes['Hatchling']
    // a little bigger and faintly lit so they read on the night beach
    const lit = new Map<THREE.Material, THREE.Material>()
    const glow = (mat: THREE.Material) => {
      if (!lit.has(mat)) {
        const g = mat.clone() as THREE.MeshStandardMaterial
        if (g.emissive) {
          g.emissive.set('#5d8a70')
          g.emissiveIntensity = 0.55
        }
        lit.set(mat, g)
      }
      return lit.get(mat)!
    }
    return Array.from({ length: 8 }, (_, i) => {
      const p = worldPos(empties['Hatch_' + (i + 1)])
      const o = tpl ? tpl.clone(true) : new THREE.Object3D()
      o.position.set(p[0], groundAt(world, p[0], p[2], 50), p[2])
      o.rotation.y = Math.PI + (Math.random() - 0.5)
      o.scale.multiplyScalar(1.5)
      o.traverse((m) => {
        const mesh = m as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = true
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(glow) : glow(mesh.material)
      })
      return { o, state: (done ? 'gone' : 'idle') as HState, t: Math.random() * 10 }
    })
  }, [nodes, empties, world, done])
  useEffect(() => {
    const tpl = nodes['Hatchling']
    if (tpl) tpl.visible = false
    hatch.forEach((h) => scene.add(h.o))
    return () => hatch.forEach((h) => scene.remove(h.o))
  }, [hatch, scene, nodes])

  useFrame((s, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const st = useStore.getState()
    const anyOn = onRef.current.some(Boolean)
    let safe = 0
    for (const h of hatch) {
      const o = h.o
      h.t += dt
      if (h.state === 'gone') {
        o.visible = false
        safe++
        continue
      }
      if (h.state === 'idle' && xzDist(o.position, player.pos) < 3.4) h.state = 'crawl'
      if (h.state === 'confused' && !anyOn) h.state = 'crawl'
      if (h.state === 'crawl') {
        let tx = o.position.x
        let tz = o.position.z - 5
        if (anyOn) {
          let best = Infinity
          lamps.forEach((l, i) => {
            if (!onRef.current[i]) return
            const d = xzDist(l, o.position)
            if (d < best) {
              best = d
              tx = l.x
              tz = l.z
            }
          })
          if (best < 1.6) {
            h.state = 'confused'
            if (!warned.current) {
              warned.current = true
              st.showToast('الضوء القوي يربك صغار السلاحف فتتجه إليه بدل البحر! أطفئ المصابيح 💡')
            }
          }
        }
        const dx = tx - o.position.x
        const dz = tz - o.position.z
        const len = Math.hypot(dx, dz) || 1
        const sp = 0.85
        o.position.x += (dx / len) * sp * dt + Math.sin(h.t * 9) * 0.004
        o.position.z += (dz / len) * sp * dt
        o.rotation.y = Math.atan2(dx, dz) + Math.sin(h.t * 12) * 0.25
        o.position.y = groundAt(world, o.position.x, o.position.z, 50)
        if (o.position.z < -10.1) {
          h.state = 'safe'
          sfx.splash()
        }
      } else if (h.state === 'confused') {
        o.rotation.y += Math.sin(h.t * 3) * 0.05
      } else if (h.state === 'safe') {
        o.position.y -= dt * 0.25
        o.position.z -= dt * 0.4
        if (o.position.y < -0.9) h.state = 'gone'
      }
    }
    if (!done && safe === hatch.length) {
      st.setActivityDone('turtles')
      st.showToast('أحسنت! وصلت صغار السلاحف كلها إلى البحر بأمان 🐢🌊')
    }
    // objective marker
    const lampIdx = onRef.current.findIndex(Boolean)
    if (lampIdx >= 0) {
      activityNav.target = lamps[lampIdx]
      activityNav.label = 'أطفئ المصباح'
    } else {
      const h = hatch.find((x) => x.state === 'idle' || x.state === 'crawl')
      activityNav.target = h ? h.o.position : null
      activityNav.label = 'صغار السلاحف'
    }
    if (st.busy || modalOpen()) return
    let near = -1
    lamps.forEach((l, i) => {
      if (onRef.current[i] && xzDist(l, player.pos) < 2.3) near = i
    })
    if (lampZone(near >= 0)) {
      sfx.click()
      const next = onRef.current.slice()
      next[near] = false
      setOn(next)
      if (!next.some(Boolean)) st.showToast('ممتاز! الآن اقترب من صغار السلاحف لترافقها إلى البحر 🌙')
    }
    void s
  })

  return (
    <group>
      {lamps.map((l, i) =>
        on[i] ? (
          <group key={i} position={l}>
            <pointLight intensity={32} distance={18} decay={1.6} color="#fff0cc" />
            <mesh>
              <sphereGeometry args={[0.28, 12, 8]} />
              <meshBasicMaterial color="#fff6dc" toneMapped={false} />
            </mesh>
          </group>
        ) : null,
      )}
    </group>
  )
}

/* =================================================== 4. ivory: trade map */

function mapTexture() {
  const W = 1600
  const H = 1010
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7)
  grad.addColorStop(0, '#f8ecd0')
  grad.addColorStop(1, '#dcc093')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  // sea tint
  g.fillStyle = 'rgba(70,130,150,0.18)'
  g.fillRect(0, 0, W, H)
  const land = (pts: number[][], fill = '#e8d3a6') => {
    g.beginPath()
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)))
    g.closePath()
    g.fillStyle = fill
    g.fill()
    g.lineWidth = 4
    g.strokeStyle = '#8a6a3c'
    g.stroke()
  }
  // Arabia with Oman, East Africa, India (stylised)
  land([[0.18, 0.0], [0.62, 0.0], [0.6, 0.1], [0.55, 0.16], [0.5, 0.26], [0.44, 0.33], [0.36, 0.36], [0.27, 0.33], [0.2, 0.25], [0.16, 0.12]])
  land([[0.5, 0.12], [0.55, 0.16], [0.53, 0.24], [0.5, 0.3], [0.45, 0.33], [0.42, 0.29], [0.47, 0.2]], '#d6b27a')
  land([[0.0, 0.3], [0.1, 0.33], [0.2, 0.42], [0.26, 0.45], [0.22, 0.6], [0.18, 0.75], [0.12, 0.9], [0.08, 1.0], [0.0, 1.0]])
  land([[0.66, 0.0], [1.0, 0.0], [1.0, 0.25], [0.9, 0.3], [0.82, 0.55], [0.78, 0.62], [0.74, 0.5], [0.7, 0.32], [0.66, 0.2]])
  g.beginPath()
  g.arc(0.215 * W, 0.66 * H, 12, 0, Math.PI * 2)
  g.fillStyle = '#d6b27a'
  g.fill()
  g.stroke()
  // routes
  g.setLineDash([18, 14])
  g.lineWidth = 6
  g.strokeStyle = '#7a1f1f'
  const route = (a: number[], b: number[], c2: number[]) => {
    g.beginPath()
    g.moveTo(a[0] * W, a[1] * H)
    g.quadraticCurveTo(c2[0] * W, c2[1] * H, b[0] * W, b[1] * H)
    g.stroke()
  }
  route([0.52, 0.22], [0.23, 0.66], [0.42, 0.55])
  route([0.53, 0.2], [0.74, 0.42], [0.66, 0.24])
  g.setLineDash([])
  // ports
  const port = (x: number, y: number, name: string) => {
    g.beginPath()
    g.arc(x * W, y * H, 16, 0, Math.PI * 2)
    g.fillStyle = '#7a1f1f'
    g.fill()
    g.direction = 'rtl'
    g.textAlign = 'center'
    g.font = '700 46px "Reem Kufi", "Tajawal", sans-serif'
    g.fillStyle = '#3a2412'
    g.fillText(name, x * W, y * H - 34)
  }
  port(0.52, 0.2, 'عُمان')
  port(0.225, 0.66, 'زنجبار')
  port(0.75, 0.42, 'الهند')
  g.font = '600 40px "Tajawal", sans-serif'
  g.fillStyle = 'rgba(40,70,90,0.7)'
  g.fillText('بحر العرب', 0.6 * W, 0.45 * H)
  g.fillText('المحيط الهندي', 0.5 * W, 0.82 * H)
  g.fillText('شرق أفريقيا', 0.1 * W, 0.5 * H)
  // compass rose
  g.save()
  g.translate(0.88 * W, 0.82 * H)
  g.fillStyle = '#7a5a30'
  for (let k = 0; k < 4; k++) {
    g.rotate(Math.PI / 2)
    g.beginPath()
    g.moveTo(0, -80)
    g.lineTo(14, 0)
    g.lineTo(-14, 0)
    g.closePath()
    g.fill()
  }
  g.restore()
  g.font = '700 34px "Tajawal", sans-serif'
  g.fillStyle = '#7a5a30'
  g.fillText('ش', 0.88 * W, 0.82 * H - 96)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = false
  t.anisotropy = 8
  return t
}

function TradeActivity({ nodes }: Props) {
  const done = useStore((s) => s.progress.ivory.activity)
  const top = nodes['MapTop'] as THREE.Mesh | undefined
  const center = useMemo(() => (top ? top.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3()), [top])
  const zone = usePromptZone('map')
  useEffect(() => {
    if (!top) return
    const tex = mapTexture()
    top.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
    activityNav.target = done ? null : center
    activityNav.label = 'طاولة الخريطة'
  }, [top, center, done])
  useFrame(() => {
    const st = useStore.getState()
    if (st.busy || modalOpen()) return
    if (zone(xzDist(center, player.pos) < 2.9)) st.setActivity('trade')
  })
  return top ? (
    <mesh position={[center.x, center.y + 0.02, center.z]} onClick={(e) => (e.stopPropagation(), useStore.getState().setActivity('trade'))}>
      <boxGeometry args={[3.8, 0.05, 2.4]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  ) : null
}

/* ================================================ 5. clothing: pieces */

export const PIECES: { key: string; name: string; hint: string }[] = [
  { key: 'dishdasha', name: 'الدشداشة', hint: 'ثوب رجالي طويل بلا ياقة.' },
  { key: 'kumma', name: 'الكمّة', hint: 'قبعة رجالية مطرّزة.' },
  { key: 'masar', name: 'المصر', hint: 'عمامة تُلف على الرأس.' },
  { key: 'khanjar', name: 'الخنجر', hint: 'رمز عُماني يُلبس على الحزام.' },
  { key: 'lihaf', name: 'اللحاف', hint: 'غطاء رأس المرأة العُمانية.' },
  { key: 'sirwal', name: 'السروال', hint: 'مطرّز عند الكاحلين.' },
]

function ClothingActivity({ empties }: Props) {
  const seen = useStore((s) => s.progress.clothing.seen)
  const done = useStore((s) => s.progress.clothing.activity)
  const pieces = useMemo(
    () => PIECES.map((p) => ({ ...p, pos: new THREE.Vector3(...worldPos(empties['Piece_' + p.key])) })),
    [empties],
  )
  const mirror = useMemo(() => new THREE.Vector3(...worldPos(empties['Mirror'])), [empties])
  const zone = usePromptZone('piece')
  const mirrorZone = usePromptZone('mirror')
  useEffect(() => {
    if (!done && pieces.every((p) => seen.includes('piece_' + p.key))) {
      useStore.getState().setActivityDone('clothing')
      useStore.getState().showToast('أحسنت! عرفت أسماء قطع الزي العُماني كلها 👘 جرّب الآن أزياء مريم أمام المرآة 🪞')
    }
  }, [seen, done, pieces])
  useFrame(() => {
    const st = useStore.getState()
    const next = pieces.find((p) => !st.progress.clothing.seen.includes('piece_' + p.key))
    activityNav.target = next ? next.pos : null
    activityNav.label = 'قطعة ملابس'
    if (st.busy || modalOpen()) return
    let near: string | null = null
    for (const p of pieces) if (!st.progress.clothing.seen.includes('piece_' + p.key) && xzDist(p.pos, player.pos) < 1.9) near = p.key
    if (zone(!!near)) st.setActivity('piece:' + near)
    if (!near && mirrorZone(xzDist(mirror, player.pos) < 1.8)) st.setActivity('wardrobe')
  })
  return (
    <group>
      {pieces.map((p) => {
        const ok = seen.includes('piece_' + p.key)
        return (
          <Html key={p.key} position={p.pos} center zIndexRange={[25, 5]}>
            <button className={'piece-badge' + (ok ? ' is-ok' : '')} onClick={() => !ok && useStore.getState().setActivity('piece:' + p.key)}>
              {ok ? '✓ ' + p.name : '؟'}
            </button>
          </Html>
        )
      })}
      <Html position={[mirror.x - 0.6, 2.9, mirror.z]} center zIndexRange={[25, 5]}>
        <button className="piece-badge is-mirror" onClick={() => useStore.getState().setActivity('wardrobe')}>
          🪞 خزانة مريم
        </button>
      </Html>
    </group>
  )
}
