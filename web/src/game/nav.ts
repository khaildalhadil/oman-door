import * as THREE from 'three'

/** Current objective marker (read by the HUD compass every animation frame). */
export const nav = {
  target: null as THREE.Vector3 | null,
  label: '',
  camAz: 0,
}

export function setNav(target: THREE.Vector3 | [number, number, number] | null, label = '') {
  if (!target) {
    nav.target = null
    nav.label = ''
    return
  }
  const v = Array.isArray(target) ? new THREE.Vector3(...target) : target
  if (!nav.target) nav.target = new THREE.Vector3()
  nav.target.copy(v)
  nav.label = label
}
