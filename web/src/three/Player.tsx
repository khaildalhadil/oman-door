import { useGLTF } from '@react-three/drei'
import type { CameraControlsImpl } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { asset, MODELS } from '../content'
import { consumeJump, moveVector } from '../game/input'
import { sfx } from '../game/sfx'
import { groundAt, resolve, type Spawn, type World } from '../game/world'
import { modalOpen, useStore } from '../store'

/** Live player state shared with the scenes (triggers) and the HUD (compass). */
export const player = {
  pos: new THREE.Vector3(),
  yaw: 0,
  speed: 0,
  vy: 0,
  grounded: true,
  vel: new THREE.Vector3(),
}

/** Temporary camera distance range set by activities (e.g. looking at the stars). */
export const camOverride = { range: null as [number, number] | null, lift: 0 }

const WALK = 3.0
const RUN = 6.2
const JUMP_V = 5.6
const GRAVITY = 15
const HEAD = 1.15
const LEG_MAX = 0.27 // largest leg swing (rad) that stays inside the dress (measured, incl. the dress sway)

const JOINTS = ['Hips', 'Spine', 'Head', 'ArmL', 'ArmR', 'ForearmL', 'ForearmR', 'LegL', 'LegR', 'Skirt', 'ScarfTail'] as const
type Joint = (typeof JOINTS)[number]

function wrapAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

export function Player({
  world,
  controls,
  spawn,
  camRange = [3, 13],
  fill,
}: {
  world: World
  controls: RefObject<CameraControlsImpl | null>
  spawn: Spawn
  camRange?: [number, number]
  /** soft light that follows her (night scenes), e.g. { intensity: 7, color: '#bcd2ff' } */
  fill?: { intensity: number; color?: string }
}) {
  const gltf = useGLTF(MODELS.girl, false, false)
  const root = gltf.scene
  const rig = useMemo(() => {
    const j = {} as Record<Joint, THREE.Object3D>
    const rest = {} as Record<Joint, { r: THREE.Euler; p: THREE.Vector3; s: THREE.Vector3 }>
    for (const n of JOINTS) {
      const o = root.getObjectByName(n)
      if (!o) continue
      j[n] = o
      rest[n] = { r: o.rotation.clone(), p: o.position.clone(), s: o.scale.clone() }
    }
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    return { j, rest }
  }, [root])

  // outfit colours chosen in the wardrobe (clothing station)
  const outfit = useStore((s) => s.outfit)
  useEffect(() => {
    const table: Record<string, [string | null, string | null]> = {
      emerald: [null, null],
      ruby: ['#b3364f', '#d9a43a'],
      turquoise: ['#178fa6', null],
      violet: ['#7b3fa3', '#d85a8a'],
    }
    const [dress, scarf] = table[outfit] ?? table.emerald
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]
      for (const mat of mats) {
        const target = mat.name === 'G_Dress' ? dress : mat.name === 'G_Scarf' ? scarf : undefined
        if (target === undefined) continue
        if (!mat.userData.origMap) mat.userData.origMap = mat.map ?? 'none'
        const orig = mat.userData.origMap === 'none' ? null : (mat.userData.origMap as THREE.Texture)
        mat.map = target ? null : orig
        mat.color.set(target ?? '#ffffff')
        mat.needsUpdate = true
      }
    })
  }, [outfit, root])

  const follow = useRef(new THREE.Vector3())
  const lastUser = useRef(0)
  const phase = useRef(0)
  const blink = useRef({ next: 2, until: 0 })
  // blinking: the face is a painted texture, so swap in the closed-eyes version for a moment
  const face = useMemo(() => {
    const found: THREE.MeshStandardMaterial[] = []
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) for (const x of [m.material].flat() as THREE.MeshStandardMaterial[]) if (x.name === 'G_Face') found.push(x)
    })
    const mat = found[0]
    if (!mat?.map) return null
    const open = mat.map
    const closed = new THREE.TextureLoader().load(asset('images/face_closed.png'))
    closed.flipY = false
    closed.colorSpace = open.colorSpace
    closed.wrapS = open.wrapS
    closed.wrapT = open.wrapT
    closed.anisotropy = open.anisotropy
    return { mat, open, closed }
  }, [root])

  useLayoutEffect(() => {
    root.visible = true // shared cached model: the previous scene's Suspense transition may have hidden it
    player.pos.set(spawn.x, 0, spawn.z)
    player.pos.y = groundAt(world, spawn.x, spawn.z, 50)
    player.yaw = spawn.yaw
    player.speed = 0
    player.vy = 0
    player.vel.set(0, 0, 0)
    follow.current.copy(player.pos).add(new THREE.Vector3(0, HEAD, 0))
    root.position.copy(player.pos)
    root.rotation.set(0, player.yaw, 0)
  }, [spawn, world, root])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const mark = () => (lastUser.current = performance.now())
    c.addEventListener('controlstart', mark)
    c.addEventListener('control', mark)
    return () => {
      c.removeEventListener('controlstart', mark)
      c.removeEventListener('control', mark)
    }
  }, [controls])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = state.clock.elapsedTime
    const st = useStore.getState()
    const c = controls.current
    const frozen = st.busy || modalOpen()
    const mv = frozen ? { x: 0, y: 0, mag: 0, run: false } : moveVector()
    const wantJump = consumeJump() && !frozen

    // ------------------------------------------------ movement (camera relative)
    const az = c ? c.azimuthAngle : player.yaw + Math.PI
    const fx = -Math.sin(az)
    const fz = -Math.cos(az)
    const rx = Math.cos(az)
    const rz = -Math.sin(az)
    let dx = rx * mv.x + fx * mv.y
    let dz = rz * mv.x + fz * mv.y
    const len = Math.hypot(dx, dz)
    if (len > 1e-3) {
      dx /= len
      dz /= len
    }
    const target = mv.mag * (mv.run ? RUN : WALK)
    const k = 1 - Math.exp(-(player.grounded ? 10 : 3) * dt)
    player.vel.x += (dx * target - player.vel.x) * k
    player.vel.z += (dz * target - player.vel.z) * k
    player.speed = Math.hypot(player.vel.x, player.vel.z)
    if (player.speed > 0.15 && len > 1e-3) {
      const want = Math.atan2(dx, dz)
      player.yaw += wrapAngle(want - player.yaw) * (1 - Math.exp(-12 * dt))
    }
    player.pos.x += player.vel.x * dt
    player.pos.z += player.vel.z * dt

    // vertical
    if (wantJump && player.grounded) {
      player.vy = JUMP_V
      player.grounded = false
      sfx.jump()
    }
    player.vy -= GRAVITY * dt
    player.pos.y += player.vy * dt
    resolve(world, player.pos)
    const floor = groundAt(world, player.pos.x, player.pos.z, player.pos.y)
    if (player.pos.y <= floor) {
      player.pos.y = floor
      player.vy = 0
      player.grounded = true
    } else if (player.pos.y - floor > 0.05) {
      player.grounded = false
    }

    root.position.copy(player.pos)
    root.rotation.y = player.yaw

    // ------------------------------------------------------- camera follow
    if (c && !st.busy) {
      const goal = new THREE.Vector3(player.pos.x, player.pos.y + HEAD + camOverride.lift, player.pos.z)
      follow.current.lerp(goal, 1 - Math.exp(-10 * dt))
      c.moveTo(follow.current.x, follow.current.y, follow.current.z, false)
      // gently swing the camera behind her while walking forward
      if (player.speed > 0.5 && performance.now() - lastUser.current > 1400 && mv.y >= -0.2) {
        const desired = player.yaw + Math.PI
        const diff = wrapAngle(desired - c.azimuthAngle)
        c.rotate(diff * Math.min(1, dt * 0.9) * Math.min(1, player.speed / WALK), 0, false)
      }
      const range = camOverride.range ?? camRange
      c.minDistance = range[0]
      c.maxDistance = range[1]
    }

    // ----------------------------------------------------------- animation
    const { j, rest } = rig
    if (!j.Hips) return
    const walk = Math.min(1, player.speed / WALK)
    const run = Math.max(0, Math.min(1, (player.speed - WALK) / (RUN - WALK)))
    // short strides → quicker steps (walking ≈ 2.6 steps/s, running ≈ 3.8)
    phase.current += dt * (2.7 * Math.min(player.speed, WALK) + 1.2 * Math.max(0, player.speed - WALK) + 0.0001)
    const ph = phase.current
    const s = Math.sin(ph)
    const air = player.grounded ? 0 : 1
    const animAge = (performance.now() - st.anim.t) / 1000
    const cheer = st.anim.name === 'cheer' && animAge < 1.9 ? 1 : 0
    const oops = st.anim.name === 'oops' && animAge < 1.5 ? 1 : 0
    const wave = st.anim.name === 'wave' && animAge < 2.2 ? 1 : 0
    const breath = Math.sin(t * 1.7)

    // short strides: the legs pivot 0.51 m above the hem (radius 0.265 m), so wider swings poke out of the dress
    const legAmp = 0.24 * walk + 0.03 * run
    const leg = (a: number) => Math.max(-LEG_MAX, Math.min(LEG_MAX, a))
    set(j.LegL, rest.LegL, leg(-s * legAmp - air * 0.3), 0, 0)
    set(j.LegR, rest.LegR, leg(s * legAmp - air * 0.12), 0, 0)
    const armAmp = 0.45 * walk + 0.35 * run
    const raise = cheer ? 2.5 + Math.sin(t * 14) * 0.25 : air * 0.9
    set(j.ArmL, rest.ArmL, s * armAmp - run * 0.15, 0, raise + (1 - walk) * breath * 0.02)
    set(j.ArmR, rest.ArmR, -s * armAmp - run * 0.15, 0, -(cheer ? raise : air * 0.9) - (wave ? 2.6 : 0))
    set(j.ForearmL, rest.ForearmL, -0.25 * walk - 0.55 * run - cheer * 0.3, 0, 0)
    set(j.ForearmR, rest.ForearmR, -0.25 * walk - 0.55 * run - cheer * 0.3, wave ? Math.sin(t * 12) * 0.5 : 0, wave ? -0.4 : 0)
    set(j.Spine, rest.Spine, 0.04 * walk + 0.12 * run + breath * 0.012 * (1 - walk), s * 0.08 * walk, 0)
    const look = (1 - walk) * Math.sin(t * 0.45) * 0.22
    set(j.Head, rest.Head, -0.05 * run - oops * 0.15, look + oops * Math.sin(t * 16) * 0.38, Math.sin(t * 0.7) * 0.03 * (1 - walk))
    set(j.Skirt, rest.Skirt, -s * 0.025 * walk, 0, Math.cos(ph) * 0.02 * walk)
    set(j.ScarfTail, rest.ScarfTail, 0.12 * walk + 0.25 * run + air * 0.3 + Math.sin(t * 2.2) * 0.04, 0, Math.sin(t * 1.3) * 0.03)
    // body bob + cheerful hops
    const hop = cheer ? Math.abs(Math.sin(t * 9)) * 0.12 : 0
    j.Hips.position.y = rest.Hips.p.y + Math.abs(s) * (0.03 * walk + 0.04 * run) + hop - air * 0.03
    // blink
    const b = blink.current
    if (t > b.next) {
      b.until = t + 0.12
      b.next = t + 2.5 + Math.random() * 3
    }
    if (face) {
      const want = t < b.until ? face.closed : face.open
      if (face.mat.map !== want) face.mat.map = want
    }
  })

  return (
    <primitive object={root}>
      {fill && <pointLight position={[0.4, 2.4, -1.3]} intensity={fill.intensity} distance={7} decay={2} color={fill.color ?? '#ffffff'} />}
    </primitive>
  )
}

function set(o: THREE.Object3D | undefined, r: { r: THREE.Euler } | undefined, x: number, y: number, z: number) {
  if (!o || !r) return
  o.rotation.set(r.r.x + x, r.r.y + y, r.r.z + z)
}

useGLTF.preload(MODELS.girl, false, false)
