// Sumhuram extras: the retro TV «أصداء سمهرم» on the quay and «صندوق أسرار سمهرم» beside the excavations.
// The port itself (quay, jetty, dhows, sea) is static geometry from blender/build_stations.py; UI in ui/Sumhuram.tsx.
import { Html, RoundedBox, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { asset } from '../content'
import { groundAt, type World } from '../game/world'
import { modalOpen, useStore } from '../store'
import { boxReady, newsDone } from '../ui/Sumhuram'
import { activityNav, usePromptZone } from './Activities'
import { worldPos, type V3 } from './helpers'
import { drawWood, makeBaghlah, tex } from './kit'
import { player } from './Player'

const near = (p: THREE.Vector3, r: number) => Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < r
const open = (a: string, p: THREE.Vector3) => (e: { stopPropagation: () => void }) => {
  e.stopPropagation()
  if (near(p, 6) && !modalOpen()) useStore.getState().setActivity(a)
}

function Ring({ at, done }: { at: V3; done: boolean }) {
  const ring = useRef<THREE.Mesh>(null!)
  useFrame((s) => ring.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 3) * 0.06))
  return (
    <mesh ref={ring} position={at} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.95, 1.1, 48]} />
      <meshBasicMaterial color={done ? '#3ad17e' : '#f5c451'} transparent opacity={0.65} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

/** a big wooden 1960s set; local front = +z, turned to face the city's south gate */
function TV({ pos, front, wood, done }: { pos: V3; front: THREE.Vector3; wood: THREE.Texture; done: boolean }) {
  const picture = useTexture(asset('video/sumhuram/welcome-poster.jpg'))
  picture.colorSpace = THREE.SRGBColorSpace
  const glow = useRef<THREE.MeshBasicMaterial>(null!)
  useFrame((s) => glow.current.color.setScalar(0.88 + Math.sin(s.clock.elapsedTime * 9) * 0.03 + Math.sin(s.clock.elapsedTime * 1.7) * 0.06))
  const dark = <meshStandardMaterial color="#24160c" roughness={0.45} />
  const brass = <meshStandardMaterial color="#c9a25a" metalness={0.8} roughness={0.3} />
  return (
    <group position={pos} rotation-y={Math.PI}>
      {[-1.05, 1.05].flatMap((x) =>
        [-0.3, 0.3].map((z) => (
          <mesh key={x + ':' + z} position={[x, 0.3, z]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 0.6, 8]} />
            {dark}
          </mesh>
        )),
      )}
      <RoundedBox args={[2.6, 1.9, 0.9]} radius={0.12} smoothness={3} position={[0, 1.5, 0]} castShadow receiveShadow onClick={open('sumhuram_tv', front)}>
        <meshStandardMaterial map={wood} color="#c08a55" roughness={0.55} />
      </RoundedBox>
      <RoundedBox args={[1.8, 1.38, 0.1]} radius={0.08} position={[-0.3, 1.5, 0.42]}>
        {dark}
      </RoundedBox>
      <mesh position={[-0.3, 1.5, 0.476]} onClick={open('sumhuram_tv', front)}>
        <planeGeometry args={[1.62, 1.2]} />
        <meshBasicMaterial ref={glow} map={picture} toneMapped={false} />
      </mesh>
      {[1.9, 1.52].map((y) => (
        <mesh key={y} position={[0.95, y, 0.47]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.11, 0.12, 0.08, 20]} />
          {brass}
        </mesh>
      ))}
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh key={k} position={[0.95, 1.12 - k * 0.09, 0.455]}>
          <boxGeometry args={[0.42, 0.035, 0.02]} />
          {dark}
        </mesh>
      ))}
      <mesh position={[0, 2.45, 0]}>
        <sphereGeometry args={[0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {dark}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.33, 3.0, 0]} rotation-z={-s * 0.6}>
          <cylinderGeometry args={[0.015, 0.015, 1.15, 6]} />
          {brass}
        </mesh>
      ))}
      <Ring at={[0, 0.05, 1.5]} done={done} />
      <Html position={[0, 3.9, 0]} center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
        <div className={'item-marker' + (done ? ' is-seen' : '')}>
          <span>{done ? '✓' : '📺'}</span>
          <b>أصداء سمهرم</b>
        </div>
      </Html>
    </group>
  )
}

function RelicBox({ pos, wood }: { pos: V3; wood: THREE.Texture }) {
  const g = useRef<THREE.Group>(null!)
  const t0 = useRef(-1)
  const p = useMemo(() => new THREE.Vector3(...pos), [pos])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (t0.current < 0) t0.current = t
    const k = Math.min(1, (t - t0.current) / 0.9)
    g.current.scale.setScalar(Math.max(0.001, 1 - Math.pow(1 - k, 3)))
    g.current.position.y = 0.04 + Math.sin(t * 2) * 0.03
  })
  const brass = <meshStandardMaterial color="#d8b25e" metalness={0.85} roughness={0.28} emissive="#5a3a08" emissiveIntensity={0.4} />
  return (
    <group position={pos}>
      <group ref={g} onClick={open('sumhuram_box', p)}>
        <RoundedBox args={[1.0, 0.55, 0.62]} radius={0.04} position={[0, 0.3, 0]} castShadow>
          <meshStandardMaterial map={wood} color="#8a5630" roughness={0.6} />
        </RoundedBox>
        <mesh position={[0, 0.575, 0]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.31, 0.31, 1.0, 20, 1, false, 0, Math.PI]} />
          <meshStandardMaterial map={wood} color="#764622" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        {[-0.36, 0.36].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.3, 0]}>
              <boxGeometry args={[0.07, 0.56, 0.64]} />
              {brass}
            </mesh>
            <mesh position={[x, 0.575, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.325, 0.325, 0.07, 20, 1, false, 0, Math.PI]} />
              {brass}
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.5, 0.32]}>
          <boxGeometry args={[0.16, 0.2, 0.03]} />
          {brass}
        </mesh>
      </group>
      <Ring at={[0, 0.05, 0]} done={false} />
      <pointLight position={[0, 1.3, 0.5]} color="#ffcf6b" intensity={4} distance={4.5} decay={1.6} />
      <Html position={[0, 2.1, 0]} center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
        <div className="relic-tag">
          <b>🗝️ صندوق أسرار سمهرم</b>
          <span>قبل مغادرة سمهرم… هل تستطيعين اكتشاف الكنز الذي تركه التاريخ؟</span>
        </div>
      </Html>
    </group>
  )
}

// two baghlahs moored on either side of the jetty (blender: JX0 4.6 .. JX1 7.4, sea level y = -1)
const MOORED: [number, number, number][] = [
  [2.85, 30.5, 0],
  [9.15, 29.8, 1.7],
]

function Moored() {
  const ships = useMemo(
    () =>
      MOORED.map(([x, z]) => {
        const g = makeBaghlah()
        g.scale.setScalar(4.5)
        g.position.set(x, -1.38, z)
        g.rotation.y = -Math.PI / 2 // bow out to sea
        return g
      }),
    [],
  )
  useFrame((s) => {
    const t = s.clock.elapsedTime
    ships.forEach((g, i) => {
      const ph = MOORED[i][2]
      g.position.y = -1.38 + Math.sin(t * 0.8 + ph) * 0.05
      g.rotation.x = Math.sin(t * 0.7 + ph) * 0.025
    })
  })
  return (
    <>
      {ships.map((g, i) => (
        <primitive key={i} object={g} />
      ))}
    </>
  )
}

export function SumhuramPort({ empties, world }: { empties: Record<string, THREE.Object3D>; world: World }) {
  const wood = useMemo(() => tex(256, 256, drawWood), [])
  // feet height from below: the TV stands on its own (tall) collider
  const at = (name: string): V3 => {
    const p = worldPos(empties[name])
    return [p[0], groundAt(world, p[0], p[2], p[1]), p[2]]
  }
  const tv = useMemo(() => at('TV'), [empties, world]) // eslint-disable-line react-hooks/exhaustive-deps
  const box = useMemo(() => at('Box'), [empties, world]) // eslint-disable-line react-hooks/exhaustive-deps
  // the TV faces -z (towards the city), so its viewing spot is 1.5 m in front of it
  const tvFront = useMemo(() => new THREE.Vector3(tv[0], tv[1], tv[2] - 1.5), [tv])
  const boxAt = useMemo(() => new THREE.Vector3(...box), [box])
  const done = useStore((s) => newsDone(s.progress.sumhuram.seen))
  const showBox = useStore((s) => !!s.stamps.sumhuram || boxReady(s.progress.sumhuram))
  const tvZone = usePromptZone('tv')
  const boxZone = usePromptZone('relic')
  useEffect(
    () => () => {
      activityNav.quest = null
    },
    [],
  )
  useFrame(() => {
    const st = useStore.getState()
    activityNav.quest = !done ? tvFront : showBox ? boxAt : null
    activityNav.questLabel = !done ? 'شاشة «أصداء سمهرم» في الميناء' : 'صندوق أسرار سمهرم'
    if (st.busy || modalOpen()) return
    if (tvZone(near(tvFront, 2.0))) st.setActivity('sumhuram_tv')
    if (boxZone(showBox && near(boxAt, 1.9))) st.setActivity('sumhuram_box')
  })
  return (
    <>
      <TV pos={tv} front={tvFront} wood={wood} done={done} />
      <Moored />
      {showBox && <RelicBox pos={box} wood={wood} />}
    </>
  )
}
