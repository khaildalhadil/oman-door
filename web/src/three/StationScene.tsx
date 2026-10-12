import { CameraControls, Html, Stars } from '@react-three/drei'
import type { CameraControlsImpl } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { setNav } from '../game/nav'
import { sfx } from '../game/sfx'
import { groundAt, makeWorld, type World } from '../game/world'
import { STATIONS, type StationId } from '../stations'
import { modalOpen, useStore } from '../store'
import { Indoor, Outdoor } from './Atmosphere'
import { drawBoard, loadFonts } from './boards'
import {
  blendTerrain,
  introToPlayer,
  nodesWithPrefix,
  palmColliders,
  Palms,
  useModel,
  useNavCamera,
  useWater,
  useWorldData,
  worldPos,
  type V3,
} from './helpers'
import { activityNav, StationActivity } from './Activities'
import { portalMaterial } from './PlazaScene'
import { narrate } from '../ui/Narration'
import { player, Player } from './Player'

const INDOOR: StationId[] = ['nav', 'ivory', 'clothing']

/* ----------------------------------------------------------- environments */

function GradientSky({ top, mid, bottom }: { top: string; mid: string; bottom: string }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bottom: { value: new THREE.Color(bottom) } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }`,
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vDir;
          void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, bottom, smoothstep(0.0, 0.15, -h));
          gl_FragColor = vec4(c, 1.0); }`,
      }),
    [top, mid, bottom],
  )
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[900, 32, 16]} />
    </mesh>
  )
}

function SkyLight({ color, intensity, dir, size = 45, bias = -0.0004 }: { color: string; intensity: number; dir: V3; size?: number; bias?: number }) {
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight(color, intensity)
    l.castShadow = true
    l.shadow.mapSize.set(2048, 2048)
    l.shadow.bias = bias
    l.shadow.normalBias = 0.04
    const cam = l.shadow.camera
    cam.left = cam.bottom = -size
    cam.right = cam.top = size
    cam.near = 5
    cam.far = 500
    cam.updateProjectionMatrix()
    l.position.set(...dir).normalize().multiplyScalar(200)
    return l
  }, [color, intensity, dir, size, bias])
  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  )
}

function StationEnv({ id }: { id: StationId }) {
  if (id === 'turtles')
    return (
      <>
        <GradientSky top="#070d22" mid="#1d2c52" bottom="#0a0f1e" />
        <Stars radius={320} depth={40} count={3000} factor={5} saturation={0} fade speed={0.3} />
        <mesh position={[160, 150, -330]}>
          <sphereGeometry args={[14, 32, 16]} />
          <meshBasicMaterial color="#fff6dc" toneMapped={false} />
        </mesh>
        <fog attach="fog" args={['#0d1834', 40, 260]} />
        <hemisphereLight args={['#5d76b8', '#241a12', 0.55]} />
        <SkyLight color="#b9c9ff" intensity={0.9} dir={[0.4, 0.45, -0.8]} size={35} />
      </>
    )
  if (id === 'sumhuram') return <Outdoor sun={[0.55, 0.5, 0.45]} shadowSize={45} fog={[140, 900]} center={[0, 0, 0]} />
  return <Indoor />
}

/* --------------------------------------------------------------- markers */

function ItemMarker({ pos, icon, title, seen }: { pos: V3; icon: string; title: string; seen: boolean }) {
  const ring = useRef<THREE.Mesh>(null!)
  useFrame((s) => {
    const k = 1 + Math.sin(s.clock.elapsedTime * 3) * 0.06
    ring.current.scale.setScalar(k)
  })
  return (
    <group>
      <mesh ref={ring} position={[pos[0], pos[1] + 0.05, pos[2]]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.95, 1.1, 48]} />
        <meshBasicMaterial color={seen ? '#3ad17e' : '#f5c451'} transparent opacity={0.65} toneMapped={false} depthWrite={false} />
      </mesh>
      <Html position={[pos[0], pos[1] + 2.15, pos[2]]} center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
        <div className={'item-marker' + (seen ? ' is-seen' : '')}>
          <span>{seen ? '✓' : icon}</span>
          <b>{title}</b>
        </div>
      </Html>
    </group>
  )
}

/* ----------------------------------------------------------------- scene */

export function StationScene({ id }: { id: StationId }) {
  const def = STATIONS[id]
  const { scene, nodes, empties, materials } = useModel(def.model)
  const data = useWorldData(def.colliders)
  const ref = useRef<CameraControlsImpl>(null)
  const leaving = useRef(false)
  const nearItem = useRef<string | null>(null)
  const progress = useStore((s) => s.progress[id])
  const [fonts, setFonts] = useState(false)
  const indoor = INDOOR.includes(id)
  useWater(scene)
  useNavCamera(ref)
  useLayoutEffect(() => blendTerrain(scene, materials), [scene, materials])
  useEffect(() => {
    loadFonts().finally(() => setFonts(true))
    // (no reset here: the activity child sets its target in its own effect, which runs before this one)
    return () => {
      activityNav.target = null
      useStore.getState().setInfo(null)
      useStore.getState().setPrompt(null)
    }
  }, [])

  const world: World = useMemo(() => makeWorld([data], palmColliders(scene)), [data, scene])
  // indoors the arrival point is close to the back wall: start 1.6 m further in so the camera has room behind her
  const spawn = useMemo(() => {
    const s = data.spawn
    return indoor ? { ...s, x: s.x + Math.sin(s.yaw) * 1.6, z: s.z + Math.cos(s.yaw) * 1.6 } : s
  }, [data, indoor])

  const items = useMemo(
    () =>
      def.items
        .filter((it) => empties['Item_' + it.key])
        .map((it) => {
          const p = worldPos(empties['Item_' + it.key])
          return { ...it, pos: [p[0], groundAt(world, p[0], p[2], 50), p[2]] as V3 }
        }),
    [def, empties, world],
  )
  const exit = useMemo(() => {
    const p = worldPos(empties['Exit'])
    return new THREE.Vector3(p[0], p[1], p[2])
  }, [empties])

  // portal shader, glass, lamp-glass tweaks
  const portalMat = useMemo(() => portalMaterial(def.color), [def.color])
  useLayoutEffect(() => {
    const portal = nodes['Portal_exit'] as THREE.Mesh | undefined
    if (portal) {
      portal.material = portalMat
      portal.castShadow = false
    }
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = m.material as THREE.MeshStandardMaterial
      if (mat.name === 'ST_Glass') {
        const g = mat.clone()
        g.transparent = true
        g.opacity = 0.16
        g.depthWrite = false
        g.roughness = 0.05
        m.material = g
        m.castShadow = false
      }
      if (mat.name === 'ST_LampGlass') mat.emissiveIntensity = 0.15
      if (mat.name === 'M_WindowGlow') m.castShadow = false
    })
  }, [nodes, scene, portalMat])
  useFrame((s) => {
    portalMat.uniforms.uTime.value = s.clock.elapsedTime
  })

  // painted information boards
  const boards = useMemo(() => {
    if (!fonts) return []
    return Object.values(nodes)
      .filter((n) => n.name.startsWith('Board_') && (n as THREE.Mesh).isMesh)
      .map((n) => {
        const key = n.name.replace('Board_', '')
        const it = key === 'name' ? { title: def.title, text: def.subtitle } : def.items.find((x) => x.key === key)
        if (!it) return null
        const mesh = n as THREE.Mesh
        mesh.geometry.computeBoundingBox()
        const size = new THREE.Vector3()
        mesh.geometry.boundingBox!.getSize(size)
        return { key, mesh, w: size.x, h: size.y, tex: drawBoard(it.title, [it.text], size.x, size.y) }
      })
      .filter(Boolean) as { key: string; mesh: THREE.Mesh; w: number; h: number; tex: THREE.Texture }[]
  }, [fonts, nodes, scene, def])

  // invisible walls for indoor stations so the camera stays in the room
  const blockers = useMemo(() => {
    if (!indoor) return []
    const b = data.bounds
    const mat = new THREE.MeshBasicMaterial({ visible: false })
    const mk = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      m.updateMatrixWorld()
      return m
    }
    const W = b.x1 - b.x0
    const D = b.z1 - b.z0
    return [
      mk(0.4, 9, D + 2, b.x0 - 0.2, 3, 0),
      mk(0.4, 9, D + 2, b.x1 + 0.2, 3, 0),
      mk(W + 2, 9, 0.4, 0, 3, b.z0 - 0.2),
      mk(W + 2, 9, 0.4, 0, 3, b.z1 + 0.2),
      mk(W + 2, 0.4, D + 2, 0, 6.15, 0),
    ]
  }, [indoor, data])
  useEffect(() => {
    if (ref.current) ref.current.colliderMeshes = blockers
  }, [blockers])

  const lights = useMemo(() => nodesWithPrefix(scene, 'Light_').map((o) => worldPos(o)), [scene])

  // arrival
  useEffect(() => {
    let alive = true
    const back = Math.atan2(Math.sin(spawn.yaw), Math.cos(spawn.yaw))
    const from = indoor
      ? { pos: [spawn.x - Math.sin(back) * 1.5, 1.8, spawn.z - Math.cos(back) * 1.5] as V3, target: [spawn.x + Math.sin(back) * 4, 1.6, spawn.z + Math.cos(back) * 4] as V3 }
      : { pos: [spawn.x - Math.sin(back) * 30, 18, spawn.z - Math.cos(back) * 30] as V3, target: [spawn.x, 1, spawn.z] as V3 }
    ;(async () => {
      const gy = groundAt(world, spawn.x, spawn.z, 50)
      await introToPlayer(ref.current, from, spawn, gy, indoor ? 3.0 : 7, indoor ? 1.45 : 2.6, indoor ? 1.0 : 1.6)
      if (!alive) return
      const st = useStore.getState()
      st.setBusy(false)
      st.playAnim('wave')
      if (def.riddle && !st.progress[id].riddle && !st.stamps[id]) st.setRiddleOpen(id)
      else {
        st.showToast(def.intro)
        if (def.introAudio && !st.stamps[id]) narrate(def.introAudio)
      }
    })()
    return () => {
      alive = false
      setNav(null)
    }
  }, [spawn, indoor, world, def, id])

  useFrame(() => {
    const st = useStore.getState()
    const pr = st.progress[id]
    // objective marker
    const unseen = items.find((it) => !pr.seen.includes(it.key))
    if (def.riddle && !pr.riddle && !st.stamps[id]) setNav(null)
    else if (unseen) setNav(unseen.pos, unseen.title)
    else if (!pr.activity && activityNav.target) setNav(activityNav.target, activityNav.label)
    else if (!pr.quizDone) setNav(null)
    else setNav(exit, 'العودة إلى الساحة')
    if (st.busy || modalOpen()) return
    // exit portal
    if (!leaving.current && Math.hypot(player.pos.x - exit.x, player.pos.z - exit.z) < 1.3) {
      leaving.current = true
      sfx.whoosh()
      st.goTo('plaza', id)
      return
    }
    // information points
    let near: string | null = null
    let best = 2.2
    for (const it of items) {
      const d = Math.hypot(player.pos.x - it.pos[0], player.pos.z - it.pos[2])
      if (d < best) {
        best = d
        near = it.key
      }
    }
    if (near !== nearItem.current) {
      if (near) {
        st.markSeen(id, near)
        st.setInfo({ station: id, key: near })
        sfx.ding()
      } else if (st.info && st.info.station === id && items.some((it) => it.key === st.info!.key)) st.setInfo(null)
      nearItem.current = near
    }
  })

  return (
    <>
      <CameraControls ref={ref} makeDefault truckSpeed={0} draggingSmoothTime={0.12} dollySpeed={0.5} />
      <StationEnv id={id} />
      <primitive object={scene} />
      <Palms root={scene} />
      <Player
        world={world}
        controls={ref}
        spawn={spawn}
        camRange={indoor ? [1.8, 4.6] : [3, 13]}
        fill={id === 'turtles' ? { intensity: 7, color: '#bcd2ff' } : undefined}
      />
      {lights.map((p, i) => (
        <pointLight key={i} position={p} intensity={indoor ? 7 : 5} distance={indoor ? 11 : 9} decay={1.8} color="#ffb066" />
      ))}
      {items.map((it) => (
        <ItemMarker key={it.key} pos={it.pos} icon={it.icon} title={it.title} seen={progress.seen.includes(it.key)} />
      ))}
      {boards.map((b) => (
        <group key={b.key} position={b.mesh.position} quaternion={b.mesh.quaternion}>
          <mesh position={[0, 0, 0.065]}>
            <planeGeometry args={[b.w, b.h]} />
            <meshStandardMaterial map={b.tex} roughness={0.85} />
          </mesh>
        </group>
      ))}
      <Html position={[exit.x, exit.y + 3.4, exit.z]} center zIndexRange={[25, 5]} style={{ pointerEvents: 'none' }}>
        <div className="exit-marker">↩ الساحة</div>
      </Html>
      <StationActivity id={id} scene={scene} nodes={nodes} empties={empties} world={world} controls={ref} />
    </>
  )
}
