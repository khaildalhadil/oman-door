import * as THREE from 'three'

// Collider data is exported from the Blender build scripts (three.js space, metres).
export type Collider =
  | { t: 'b'; x0: number; x1: number; z0: number; z1: number; h: number; door?: number }
  | { t: 'c'; x: number; z: number; r: number; h: number; door?: number }
  | { t: 'r'; x0: number; x1: number; za: number; zb: number; ha: number; hb: number }

export interface Spawn {
  x: number
  z: number
  yaw: number
}

export interface WorldData {
  colliders: Collider[]
  bounds: { x0: number; x1: number; z0: number; z1: number }
  ground: number
  spawn: Spawn
  spawnBack?: Spawn
}

export interface World extends WorldData {
  doorsOpen: () => boolean
}

export const PLAYER_RADIUS = 0.3
const STEP_UP = 0.32

export function makeWorld(parts: WorldData[], extra: Collider[] = [], doorsOpen: () => boolean = () => false): World {
  const base = parts[0]
  return {
    ...base,
    colliders: parts.flatMap((p) => p.colliders).concat(extra),
    doorsOpen,
  }
}

/** Height of the walkable surface under (x, z) for a body currently at height y. */
export function groundAt(w: World, x: number, z: number, y: number) {
  let g = w.ground
  for (const c of w.colliders) {
    if (c.t === 'r') {
      if (x < c.x0 || x > c.x1) continue
      const lo = Math.min(c.za, c.zb)
      const hi = Math.max(c.za, c.zb)
      if (z < lo || z > hi) continue
      const t = (z - c.za) / (c.zb - c.za)
      g = Math.max(g, c.ha + (c.hb - c.ha) * t)
      continue
    }
    if (c.door && w.doorsOpen()) continue
    if (c.h > y + STEP_UP) continue
    if (c.t === 'b') {
      if (x >= c.x0 - 0.05 && x <= c.x1 + 0.05 && z >= c.z0 - 0.05 && z <= c.z1 + 0.05) g = Math.max(g, c.h)
    } else if ((x - c.x) ** 2 + (z - c.z) ** 2 <= (c.r + 0.05) ** 2) {
      g = Math.max(g, c.h)
    }
  }
  return g
}

/** Push a circle (player) out of every obstacle taller than a step. Mutates p (x, z). */
export function resolve(w: World, p: THREE.Vector3, r = PLAYER_RADIUS) {
  for (let iter = 0; iter < 2; iter++) {
    for (const c of w.colliders) {
      if (c.t === 'r') continue
      if (c.door && w.doorsOpen()) continue
      if (c.h <= p.y + STEP_UP) continue
      if (c.t === 'c') {
        const dx = p.x - c.x
        const dz = p.z - c.z
        const d = Math.hypot(dx, dz)
        const min = c.r + r
        if (d < min) {
          if (d < 1e-5) {
            p.x += min
          } else {
            p.x = c.x + (dx / d) * min
            p.z = c.z + (dz / d) * min
          }
        }
      } else {
        const qx = Math.max(c.x0, Math.min(p.x, c.x1))
        const qz = Math.max(c.z0, Math.min(p.z, c.z1))
        const dx = p.x - qx
        const dz = p.z - qz
        const d = Math.hypot(dx, dz)
        if (d < r) {
          if (d > 1e-5) {
            p.x = qx + (dx / d) * r
            p.z = qz + (dz / d) * r
          } else {
            // centre is inside the box: leave through the closest face
            const left = p.x - c.x0
            const right = c.x1 - p.x
            const back = p.z - c.z0
            const front = c.z1 - p.z
            const m = Math.min(left, right, back, front)
            if (m === left) p.x = c.x0 - r
            else if (m === right) p.x = c.x1 + r
            else if (m === back) p.z = c.z0 - r
            else p.z = c.z1 + r
          }
        }
      }
    }
  }
  const b = w.bounds
  p.x = Math.max(b.x0 + r, Math.min(b.x1 - r, p.x))
  p.z = Math.max(b.z0 + r, Math.min(b.z1 - r, p.z))
}

/** Invisible proxy meshes for tall obstacles, used to stop the camera going through walls. */
export function cameraBlockers(w: World, minHeight = 3) {
  const mat = new THREE.MeshBasicMaterial({ visible: false })
  const out: THREE.Mesh[] = []
  for (const c of w.colliders) {
    if (c.t === 'r' || c.h < minHeight) continue
    let m: THREE.Mesh
    if (c.t === 'b') {
      m = new THREE.Mesh(new THREE.BoxGeometry(c.x1 - c.x0, c.h, c.z1 - c.z0), mat)
      m.position.set((c.x0 + c.x1) / 2, c.h / 2, (c.z0 + c.z1) / 2)
    } else {
      if (c.r < 1) continue
      m = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.h, 24), mat)
      m.position.set(c.x, c.h / 2, c.z)
    }
    m.updateMatrixWorld()
    out.push(m)
  }
  return out
}
