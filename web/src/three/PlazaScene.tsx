import { CameraControls, Html } from '@react-three/drei'
import type { CameraControlsImpl } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { MODELS, WORLDS } from '../content'
import { setNav } from '../game/nav'
import { sfx } from '../game/sfx'
import { makeWorld } from '../game/world'
import { JOURNEY, STATION_ORDER, STATIONS, type StationId } from '../stations'
import { useStore } from '../store'
import { Outdoor } from './Atmosphere'
import { loadFonts } from './boards'
import {
  applyLimits,
  blendTerrain,
  fly,
  introToPlayer,
  palmColliders,
  Palms,
  useModel,
  useNavCamera,
  useWater,
  useWorldData,
  wait,
  worldPos,
  type V3,
} from './helpers'
import { player, Player } from './Player'

type PavId = StationId | 'bonus'
const PIN_ICON: Record<StationId, string> = { nav: '⛵', sumhuram: '🏛', turtles: '🐢', ivory: '🐘', clothing: '👘' }
const PAVS: PavId[] = [...STATION_ORDER, 'bonus']

/* ----------------------------------------------------------- sign boards */

const ICON_PATHS: Record<StationId, string[]> = {
  nav: ['M10 62 Q50 82 92 58 L86 70 Q50 88 16 72 Z', 'M28 22 L82 8 L58 58 Z', 'M54 64 L56 64 L62 12 L60 12 Z'],
  sumhuram: ['M10 24 L50 6 L90 24 Z', 'M10 24 H90 V33 H10 Z', 'M18 36 H30 V78 H18 Z', 'M44 36 H56 V78 H44 Z', 'M70 36 H82 V78 H70 Z', 'M6 84 H94 V92 H6 Z'],
  turtles: ['M26 54 A24 28 0 1 0 74 54 A24 28 0 1 0 26 54 Z', 'M41 18 A9 9 0 1 0 59 18 A9 9 0 1 0 41 18 Z', 'M8 34 Q22 26 34 44 Q20 46 8 34 Z', 'M92 34 Q78 26 66 44 Q80 46 92 34 Z', 'M22 86 Q28 74 38 76 Q32 88 22 86 Z', 'M78 86 Q72 74 62 76 Q68 88 78 86 Z'],
  ivory: ['M26 50 A30 20 0 1 0 86 50 A30 20 0 1 0 26 50 Z', 'M11 44 A15 15 0 1 0 41 44 A15 15 0 1 0 11 44 Z', 'M10 50 Q2 66 10 82 L16 80 Q10 66 18 52 Z', 'M36 60 H45 V84 H36 Z', 'M46 60 H55 V84 H46 Z', 'M64 60 H73 V84 H64 Z', 'M74 60 H83 V84 H74 Z'],
  clothing: ['M38 10 L62 10 L76 24 L71 36 L66 31 L69 90 L31 90 L34 31 L29 36 L24 24 Z'],
}

function signTexture(title: string, subtitle: string, color: string, icon: string[] | null, done: boolean, w = 3.6, h = 1.1) {
  const c = document.createElement('canvas')
  c.width = Math.round(w * 300)
  c.height = Math.round(h * 300)
  const g = c.getContext('2d')!
  const W = c.width
  const H = c.height
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#5b3a22')
  grad.addColorStop(1, '#3c2414')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  g.strokeStyle = '#d9b26a'
  g.lineWidth = H * 0.05
  g.strokeRect(H * 0.04, H * 0.04, W - H * 0.08, H * 0.92)
  // icon medallion on the right (RTL start)
  const r = H * 0.34
  const cx = W - H * 0.55
  const cy = H / 2
  g.fillStyle = '#f6e7c4'
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.fill()
  g.lineWidth = H * 0.03
  g.strokeStyle = color
  g.stroke()
  if (icon) {
    g.save()
    g.translate(cx - r * 0.72, cy - r * 0.72)
    g.scale((r * 1.44) / 100, (r * 1.44) / 100)
    g.fillStyle = color
    icon.forEach((d) => g.fill(new Path2D(d)))
    g.restore()
  }
  g.direction = 'rtl'
  g.textAlign = 'right'
  g.textBaseline = 'middle'
  g.fillStyle = '#fbe7b5'
  g.font = `700 ${H * 0.36}px "Reem Kufi", "Tajawal", sans-serif`
  g.fillText(title, W - H * 1.05, H * 0.4)
  g.fillStyle = '#e7cf9c'
  g.font = `500 ${H * 0.19}px "Tajawal", sans-serif`
  g.fillText(subtitle, W - H * 1.05, H * 0.76)
  if (done) {
    g.save()
    g.translate(H * 0.55, H / 2)
    g.rotate(-0.2)
    g.strokeStyle = '#e8b931'
    g.fillStyle = 'rgba(232,185,49,0.15)'
    g.lineWidth = H * 0.04
    g.beginPath()
    g.arc(0, 0, H * 0.33, 0, Math.PI * 2)
    g.fill()
    g.stroke()
    g.fillStyle = '#f5cf5c'
    g.textAlign = 'center'
    g.font = `800 ${H * 0.2}px "Tajawal", sans-serif`
    g.fillText('✓ خُتِم', 0, 0)
    g.restore()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/* --------------------------------------------------------------- portal */

export function portalMaterial(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 p = vUv - vec2(0.5, 0.36);
        p.x *= 1.25;
        float r = length(p);
        float a = atan(p.y, p.x);
        float swirl = 0.5 + 0.5 * sin(a * 5.0 + r * 16.0 - uTime * 2.2);
        float glow = smoothstep(0.85, 0.0, r);
        vec3 col = mix(uColor * 0.35, uColor * 1.8 + 0.25, swirl * glow);
        col += vec3(1.0, 0.92, 0.75) * pow(glow, 3.0) * 1.2;
        float sparkle = step(0.995, fract(sin(dot(floor(vUv * 60.0 + uTime * 2.0), vec2(12.9898, 78.233))) * 43758.5453));
        col += sparkle * 0.8;
        gl_FragColor = vec4(col, 1.0);
      }`,
    toneMapped: false,
  })
}

/* ----------------------------------------------------------------- scene */

export function PlazaScene() {
  const { scene, nodes, empties, materials } = useModel(MODELS.plaza)
  const data = useWorldData(WORLDS.plaza)
  const ref = useRef<CameraControlsImpl>(null)
  const spawnKey = useStore((s) => s.spawnKey)
  const stamps = useStore((s) => s.stamps)
  const [fonts, setFonts] = useState(false)
  const entering = useRef(false)
  useWater(scene)
  useNavCamera(ref)
  useLayoutEffect(() => blendTerrain(scene, materials), [scene, materials])
  useEffect(() => {
    loadFonts().finally(() => setFonts(true))
  }, [])

  const pavs = useMemo(() => {
    const out = {} as Record<PavId, { pos: THREE.Vector3; quat: THREE.Quaternion; fwd: THREE.Vector3; inv: THREE.Quaternion }>
    for (const id of PAVS) {
      const o = empties['Pav_' + id]
      if (!o) continue
      const pos = o.getWorldPosition(new THREE.Vector3())
      const quat = o.getWorldQuaternion(new THREE.Quaternion())
      out[id] = { pos, quat, fwd: new THREE.Vector3(0, 0, 1).applyQuaternion(quat), inv: quat.clone().invert() }
    }
    return out
  }, [empties])

  const world = useMemo(() => makeWorld([data], palmColliders(scene)), [data, scene])
  const spawn = useMemo(() => {
    const p = pavs[spawnKey as PavId]
    if (!p) return data.spawn
    const at = p.pos.clone().addScaledVector(p.fwd, 6)
    return { x: at.x, z: at.z, yaw: Math.atan2(p.fwd.x, p.fwd.z) }
  }, [spawnKey, pavs, data])

  // portals and signs
  const portalMats = useMemo(() => {
    const m = {} as Record<PavId, THREE.ShaderMaterial>
    for (const id of PAVS) m[id] = portalMaterial(id === 'bonus' ? '#c9a14a' : STATIONS[id].color)
    return m
  }, [])
  useLayoutEffect(() => {
    for (const id of PAVS) {
      const portal = nodes['Portal_' + id] as THREE.Mesh | undefined
      if (portal) {
        portal.material = portalMats[id]
        portal.castShadow = false
      }
    }
  }, [nodes, portalMats])
  const signs = useMemo(() => {
    if (!fonts) return []
    return PAVS.map((id) => {
      const n = nodes['Sign_' + id] as THREE.Mesh | undefined
      if (!n) return null
      const tex =
        id === 'bonus'
          ? signTexture('قلعة نزوى', 'رحلة إضافية', '#7a1f1f', null, false, 3.0, 0.84)
          : signTexture(STATIONS[id].title, STATIONS[id].subtitle, STATIONS[id].color, ICON_PATHS[id], !!stamps[id])
      return { id, n, tex, w: id === 'bonus' ? 3.0 : 3.6, h: id === 'bonus' ? 0.84 : 1.1 }
    }).filter(Boolean) as { id: PavId; n: THREE.Mesh; tex: THREE.Texture; w: number; h: number }[]
  }, [fonts, nodes, stamps])

  useFrame((s) => {
    for (const id of PAVS) portalMats[id].uniforms.uTime.value = s.clock.elapsedTime
  })

  // arrival
  useEffect(() => {
    let alive = true
    const from = spawnKey === 'default' ? { pos: [0, 46, 70] as V3, target: [0, 0, 0] as V3 } : null
    ;(async () => {
      const p = pavs[spawnKey as PavId]
      const start = from ?? {
        pos: p ? ([p.pos.x + p.fwd.x * 2, 3.5, p.pos.z + p.fwd.z * 2] as V3) : ([0, 10, 30] as V3),
        target: [0, 1, 0] as V3,
      }
      await introToPlayer(ref.current, start, spawn, 0.06, 7.5, 2.8, from ? 2.0 : 1.0)
      if (!alive) return
      useStore.getState().setBusy(false)
      useStore.getState().playAnim('wave')
    })()
    return () => {
      alive = false
      setNav(null)
    }
  }, [spawn, spawnKey, pavs])

  const enter = async (id: PavId) => {
    const st = useStore.getState()
    if (entering.current || st.busy) return
    entering.current = true
    st.setBusy(true)
    sfx.whoosh()
    const p = pavs[id]
    const c = ref.current
    if (c && p) {
      applyLimits(c, {})
      const camPos = p.pos.clone().addScaledVector(p.fwd, 8.5)
      fly(c, [camPos.x, 3.2, camPos.z], [p.pos.x, 2.0, p.pos.z], 0.9, 2500)
      await wait(1300)
    }
    st.goTo(id === 'bonus' ? 'fort' : id)
  }

  const stationRequest = useStore((s) => s.stationRequest)
  useEffect(() => {
    if (!stationRequest) return
    useStore.getState().requestStation(null)
    enter(stationRequest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationRequest])

  useFrame(() => {
    const st = useStore.getState()
    // objective: the next station without a stamp
    const next = STATION_ORDER.find((id) => !st.stamps[id])
    if (next && pavs[next]) setNav(pavs[next].pos.clone().addScaledVector(pavs[next].fwd, 2), STATIONS[next].title)
    else setNav(null)
    if (st.busy || entering.current) return
    // walking into a doorway
    for (const id of PAVS) {
      const p = pavs[id]
      if (!p) continue
      const local = player.pos.clone().sub(p.pos).applyQuaternion(p.inv)
      if (Math.abs(local.x) < 1.25 && local.z < 1.0 && local.z > -1.5) {
        enter(id)
        break
      }
    }
  })

  const onPick = (id: PavId) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    enter(id)
  }

  return (
    <>
      <CameraControls ref={ref} makeDefault truckSpeed={0} draggingSmoothTime={0.12} dollySpeed={0.5} />
      <Outdoor sun={[-0.45, 0.42, 0.78]} shadowSize={48} fog={[150, 1200]} center={[0, 0, 0]} />
      <primitive object={scene} />
      <Palms root={scene} />
      <Player world={world} controls={ref} spawn={spawn} camRange={[3, 16]} />
      {signs.map((s) => (
        <group key={s.id} position={s.n.position} quaternion={s.n.quaternion}>
          <mesh position={[0, 0, 0.035]} onClick={onPick(s.id)}>
            <planeGeometry args={[s.w, s.h]} />
            <meshStandardMaterial map={s.tex} roughness={0.7} />
          </mesh>
        </group>
      ))}
      {PAVS.map((id) => {
        const p = pavs[id]
        if (!p) return null
        return (
          <mesh
            key={id}
            position={[p.pos.x, 3.5, p.pos.z]}
            quaternion={p.quat}
            onClick={onPick(id)}
            onPointerOver={() => (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = '')}
          >
            <boxGeometry args={[11, 7.5, 4]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        )
      })}
      {STATION_ORDER.map((id) => {
        const pos = worldPos(empties['Pin_' + id])
        return (
          <Html key={id} position={[pos[0], pos[1] + 0.5, pos[2]]} center zIndexRange={[30, 10]}>
            <button className={'map-pin' + (stamps[id] ? ' is-done' : '')} style={{ ['--c' as string]: STATIONS[id].color }} onClick={() => enter(id)}>
              <span className="map-pin__dot">
                <i>{stamps[id] ? '✓' : PIN_ICON[id]}</i>
              </span>
              <span className="map-pin__label">{STATIONS[id].title}</span>
            </button>
          </Html>
        )
      })}
      <Html position={[0, 3.6, 0]} center zIndexRange={[20, 5]} style={{ pointerEvents: 'none' }}>
        <div className="map-title">{JOURNEY.title}</div>
      </Html>
    </>
  )
}
