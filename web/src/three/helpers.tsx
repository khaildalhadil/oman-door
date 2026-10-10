import { useGLTF, Html } from '@react-three/drei'
import type { CameraControlsImpl } from '@react-three/drei'
import { useFrame, useLoader } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MODELS } from '../content'
import type { Collider, WorldData } from '../game/world'
import { nav } from '../game/nav'
import { useStore } from '../store'

export type V3 = [number, number, number]
type Controls = CameraControlsImpl

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ models */

export function useModel(url: string) {
  const gltf = useGLTF(url, false, false)
  // Suspense hides the outgoing scene by setting visible = false on its objects, and the glTF scene is cached:
  // without this, a scene visited a second time (e.g. back to the plaza) would mount invisible.
  useLayoutEffect(() => {
    gltf.scene.visible = true
  }, [gltf])
  return useMemo(() => {
    const empties: Record<string, THREE.Object3D> = {}
    const materials: Record<string, THREE.MeshStandardMaterial> = {}
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
        const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]
        for (const mat of mats) {
          materials[mat.name] = mat
          for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap'] as const) {
            const t = mat[key]
            if (t) t.anisotropy = 8
          }
        }
      } else {
        empties[o.name] = o
      }
    })
    return { scene: gltf.scene, nodes: gltf.nodes, empties, materials }
  }, [gltf])
}

export function nodesWithPrefix(root: THREE.Object3D, prefix: string) {
  const out: THREE.Object3D[] = []
  root.traverse((o) => {
    if (o.name.startsWith(prefix) && !(o as THREE.Mesh).isMesh) out.push(o)
  })
  return out
}

export function worldPos(o: THREE.Object3D | undefined, fallback: V3 = [0, 0, 0]): V3 {
  if (!o) return fallback
  const v = new THREE.Vector3()
  o.getWorldPosition(v)
  return [v.x, v.y, v.z]
}

Object.values(MODELS).forEach((u) => useGLTF.preload(u, false, false))

/* ----------------------------------------------------------- world data */

export function useWorldData(url: string): WorldData {
  const txt = useLoader(THREE.FileLoader, url) as unknown as string
  return useMemo(() => JSON.parse(txt) as WorldData, [txt])
}

export function palmColliders(root: THREE.Object3D): Collider[] {
  root.updateMatrixWorld(true)
  return nodesWithPrefix(root, 'Palm').map((o) => {
    const p = new THREE.Vector3()
    o.getWorldPosition(p)
    return { t: 'c', x: p.x, z: p.z, r: 0.36, h: 9 } as Collider
  })
}

/** Intro flight that ends behind the player, then hands the camera over to the follow logic. */
export async function introToPlayer(
  c: CameraControlsImpl | null,
  from: { pos: V3; target: V3 },
  spawn: { x: number; z: number; yaw: number },
  y = 0,
  dist = 7,
  height = 2.6,
  smooth = 1.6,
) {
  if (!c) return
  applyLimits(c, {})
  c.setLookAt(...from.pos, ...from.target, false)
  await wait(250)
  const bx = spawn.x - Math.sin(spawn.yaw) * dist
  const bz = spawn.z - Math.cos(spawn.yaw) * dist
  await fly(c, [bx, y + height + 1.15, bz], [spawn.x, y + 1.15, spawn.z], smooth, 6000)
  c.smoothTime = 0.25
  applyLimits(c, { minPolarAngle: 0.35, maxPolarAngle: 1.62 })
}

export function useNavCamera(controls: { current: CameraControlsImpl | null }) {
  useFrame(() => {
    if (controls.current) nav.camAz = controls.current.azimuthAngle
  })
}

/* --------------------------------------------------------------- camera */

export const OPEN_LIMITS = {
  minDistance: 0,
  maxDistance: Infinity,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI,
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity,
}

export type Limits = Partial<typeof OPEN_LIMITS>

export function applyLimits(c: Controls, l: Limits) {
  Object.assign(c, { ...OPEN_LIMITS, ...l })
}

/** Smooth cinematic move. Resolves when the camera rests (or after a timeout). */
export async function fly(c: Controls | null, pos: V3, target: V3, smooth = 1.0, timeout = 4500) {
  if (!c) return
  c.smoothTime = smooth
  await Promise.race([c.setLookAt(pos[0], pos[1], pos[2], target[0], target[1], target[2], true), wait(timeout)])
}

/* --------------------------------------------------------------- doors */

export function useDoors(nodes: Record<string, THREE.Object3D>, open: boolean, angle = 1.45, speed = 1.6) {
  const l = nodes['DoorL']
  const r = nodes['DoorR']
  useFrame((_, dt) => {
    const t = open ? angle : 0
    if (l) l.rotation.y = THREE.MathUtils.damp(l.rotation.y, t, speed, dt)
    if (r) r.rotation.y = THREE.MathUtils.damp(r.rotation.y, -t, speed, dt)
  })
  useLayoutEffect(() => {
    if (l) l.rotation.y = 0
    if (r) r.rotation.y = 0
  }, [l, r])
}

/* --------------------------------------------------------------- palms */

const swayUniform = { value: 0 }

function addSway(mat: THREE.Material, kind: 'trunk' | 'leaf') {
  const m = mat.clone() as THREE.MeshStandardMaterial
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSway = swayUniform
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSway;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 ip = instanceMatrix[3];
        #else
          vec4 ip = vec4(0.0);
        #endif
        float ph = ip.x * 0.13 + ip.z * 0.071;
        ${
          kind === 'leaf'
            ? `float hh = max(position.y - 7.0, 0.0) + length(position.xz) * 0.55;
               transformed.x += sin(uSway * 1.4 + ph + position.y) * 0.035 * hh * hh;
               transformed.z += cos(uSway * 1.1 + ph * 1.3) * 0.03 * hh * hh;
               transformed.y += sin(uSway * 2.1 + ph + position.x * 2.0) * 0.02 * hh;`
            : ''
        }
        float th = position.y / 7.6;
        transformed.x += sin(uSway * 0.7 + ph) * 0.12 * th * th;
        transformed.z += cos(uSway * 0.6 + ph) * 0.09 * th * th;`,
      )
  }
  m.customProgramCacheKey = () => 'sway-' + kind
  return m
}

export function Palms({ root, limit = 999 }: { root: THREE.Object3D; limit?: number }) {
  const palm = useGLTF(MODELS.palm, false, false)
  const quality = useStore((s) => s.quality)
  const matrices = useMemo(() => {
    root.updateMatrixWorld(true)
    const list = nodesWithPrefix(root, 'Palm').map((o) => o.matrixWorld.clone())
    const n = quality === 'low' ? Math.ceil(list.length * 0.6) : list.length
    return list.slice(0, Math.min(n, limit))
  }, [root, quality, limit])
  const parts = useMemo(() => {
    const list: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4; leaf: boolean }[] = []
    palm.scene.updateMatrixWorld(true)
    palm.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      const leaf = mats[0].name.startsWith('M_Frond') || mats[0].name === 'M_Dates'
      list.push({ geometry: m.geometry, material: addSway(mats[0], leaf ? 'leaf' : 'trunk'), matrix: m.matrixWorld.clone(), leaf })
    })
    return list
  }, [palm])
  useFrame((s) => {
    swayUniform.value = s.clock.elapsedTime
  })
  if (!matrices.length) return null
  return (
    <group>
      {parts.map((p, i) => (
        <PalmPart key={i} part={p} matrices={matrices} />
      ))}
    </group>
  )
}

function PalmPart({
  part,
  matrices,
}: {
  part: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }
  matrices: THREE.Matrix4[]
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    matrices.forEach((mw, i) => ref.current.setMatrixAt(i, m.multiplyMatrices(mw, part.matrix)))
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [matrices, part])
  return (
    <instancedMesh
      ref={ref}
      args={[part.geometry, part.material, matrices.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  )
}

/* ---------------------------------------------------------------- flag */

function omanFlagTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')!
  const band = 512 * 0.27
  g.fillStyle = '#ffffff'
  g.fillRect(band, 0, 512 - band, 86)
  g.fillStyle = '#c8102e'
  g.fillRect(0, 0, 512, 256)
  g.fillStyle = '#ffffff'
  g.fillRect(band, 0, 512 - band, 85.3)
  g.fillStyle = '#008000'
  g.fillRect(band, 170.6, 512 - band, 85.4)
  g.fillStyle = '#c8102e'
  g.fillRect(band, 85.3, 512 - band, 85.3)
  // simplified national emblem (khanjar and crossed swords) in white
  g.save()
  g.translate(band / 2, 62)
  g.strokeStyle = '#ffffff'
  g.fillStyle = '#ffffff'
  g.lineWidth = 5
  g.lineCap = 'round'
  for (const s of [-1, 1]) {
    g.beginPath()
    g.moveTo(-34 * s, -34)
    g.quadraticCurveTo(0, -6, 34 * s, 34)
    g.stroke()
  }
  g.beginPath()
  g.moveTo(-4, -30)
  g.lineTo(4, -30)
  g.lineTo(4, 8)
  g.quadraticCurveTo(10, 26, 22, 30)
  g.quadraticCurveTo(4, 32, -4, 10)
  g.closePath()
  g.fill()
  g.fillRect(-26, -4, 52, 7)
  g.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

let flagTex: THREE.Texture | null = null
const flagTime = { value: 0 }

export function Flag({ position, width = 3.2 }: { position: V3; width?: number }) {
  const h = width / 2
  const mat = useMemo(() => {
    flagTex = flagTex || omanFlagTexture()
    const m = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.75 })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = flagTime
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <beginnormal_vertex>',
          `float fx = uv.x;
           float wph = uv.x * 7.0 - uTime * 5.0 + uv.y * 1.3;
           float amp = 0.16 * fx * ${width.toFixed(2)};
           float dzdx = (cos(wph) * 7.0 * amp + sin(wph) * 0.16 * ${width.toFixed(2)}) / ${width.toFixed(2)};
           vec3 objectNormal = normalize(vec3(-dzdx, 0.0, 1.0));
           #ifdef USE_TANGENT
             vec3 objectTangent = vec3( tangent.xyz );
           #endif`,
        )
        .replace(
          '#include <begin_vertex>',
          `vec3 transformed = vec3(position);
           transformed.z += sin(wph) * amp;
           transformed.y -= fx * fx * 0.08 * ${width.toFixed(2)};`,
        )
    }
    m.customProgramCacheKey = () => 'flag'
    return m
  }, [width])
  useFrame((s) => {
    flagTime.value = s.clock.elapsedTime
  })
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, h, 32, 12)
    g.translate(width / 2, -h / 2, 0)
    return g
  }, [width, h])
  return <mesh geometry={geo} material={mat} position={position} rotation={[0, 0.5, 0]} castShadow />
}

/* -------------------------------------------------------------- terrain */

export function blendTerrain(root: THREE.Object3D, materials: Record<string, THREE.MeshStandardMaterial>) {
  const sand = materials['M_Sand']
  const rock = materials['M_Rock']
  if (!sand || !rock || (sand.userData as { blended?: boolean }).blended) return
  const m = sand.clone()
  m.name = 'M_TerrainBlend'
  m.roughness = 1
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rockMap = { value: rock.map }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vWNorm = normalize(mat3(modelMatrix) * objectNormal);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D rockMap;\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace(
        '#include <map_fragment>',
        `vec3 sandA = texture2D(map, vWPos.xz / 7.0).rgb;
         vec3 sandB = texture2D(map, vWPos.xz / 43.0 + 0.37).rgb;
         vec3 sandC = mix(sandA, sandB, 0.4);
         vec3 rockA = texture2D(rockMap, vWPos.xz / 36.0).rgb;
         vec3 rockB = texture2D(rockMap, vec2(vWPos.x + vWPos.z, vWPos.y * 1.6) / 21.0).rgb;
         vec3 rockC = mix(rockA, rockB, 0.5) * vec3(0.92, 0.86, 0.82);
         float macro = texture2D(map, vWPos.xz / 611.0).g;
         float slope = 1.0 - clamp(vWNorm.y, 0.0, 1.0);
         float t = smoothstep(7.0, 24.0, vWPos.y + (macro - 0.6) * 16.0);
         t = max(t, smoothstep(0.28, 0.52, slope) * smoothstep(2.5, 8.0, vWPos.y));
         vec3 tcol = mix(sandC, rockC, t) * (0.86 + 0.28 * macro);
         diffuseColor.rgb *= tcol;`,
      )
  }
  m.customProgramCacheKey = () => 'terrain-blend'
  m.userData.blended = true
  sand.userData.blended = true
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mn = (mesh.material as THREE.Material).name
    if (mn === 'M_Sand' || mn === 'M_Rock' || mn === 'M_TerrainBlend') {
      mesh.material = m
      mesh.castShadow = false
      mesh.receiveShadow = true
    }
  })
}

/* ---------------------------------------------------------------- water */

function waveNormalTexture() {
  const n = 128
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = (x / n) * Math.PI * 2
      const v = (y / n) * Math.PI * 2
      const dx = Math.cos(u * 3 + Math.sin(v * 2)) * 0.5 + Math.cos(u * 7 + v * 3) * 0.25
      const dy = Math.cos(v * 4 + Math.sin(u)) * 0.5 + Math.sin(v * 5 - u * 2) * 0.25
      const len = Math.hypot(dx * 0.4, dy * 0.4, 1)
      const i = (y * n + x) * 4
      data[i] = ((-dx * 0.4) / len * 0.5 + 0.5) * 255
      data[i + 1] = ((-dy * 0.4) / len * 0.5 + 0.5) * 255
      data[i + 2] = (1 / len * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  const t = new THREE.DataTexture(data, n, n)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}

export function useWater(root: THREE.Object3D) {
  const water = useMemo(() => {
    const nm = waveNormalTexture()
    nm.repeat.set(0.6, 0.6)
    return new THREE.MeshStandardMaterial({
      color: '#2f7f86',
      roughness: 0.06,
      metalness: 0.15,
      normalMap: nm,
      normalScale: new THREE.Vector2(0.6, 0.6),
      envMapIntensity: 1.4,
    })
  }, [])
  useLayoutEffect(() => {
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && (m.material as THREE.Material).name === 'M_Water') {
        m.material = water
        m.receiveShadow = true
        m.castShadow = false
      }
    })
  }, [root, water])
  useFrame((_, dt) => {
    if (water.normalMap) water.normalMap.offset.x -= dt * 0.25
  })
}

/* -------------------------------------------------------------- hotspot */

export function HotspotMarker({
  position,
  label,
  active,
  onClick,
}: {
  position: V3
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Html position={position} center zIndexRange={[40, 10]} style={{ pointerEvents: 'none' }}>
      <button className={'hotspot' + (active ? ' is-active' : '')} onClick={onClick} style={{ pointerEvents: 'auto' }}>
        <span className="hotspot__ring" />
        <span className="hotspot__dot" />
        <span className="hotspot__label">{label}</span>
      </button>
    </Html>
  )
}

/* ------------------------------------------------------------- lanterns */

export function LanternLights({
  root,
  names,
  intensity = 6,
  distance = 9,
}: {
  root: THREE.Object3D
  names?: string[]
  intensity?: number
  distance?: number
}) {
  const pts = useMemo(() => {
    const all = nodesWithPrefix(root, 'Light')
    const chosen = names ? all.filter((o) => names.includes(o.name)) : all
    return chosen.map((o) => worldPos(o))
  }, [root, names])
  return (
    <>
      {pts.map((p, i) => (
        <pointLight key={i} position={p} intensity={intensity} distance={distance} decay={2} color="#ffb067" />
      ))}
    </>
  )
}
