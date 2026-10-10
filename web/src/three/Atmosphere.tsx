import { Environment, Lightformer, Sky, Sparkles } from '@react-three/drei'
import { EffectComposer, Bloom, N8AO, SMAA, ToneMapping, Vignette, HueSaturation } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'
import type { V3 } from './helpers'

export function Outdoor({
  sun,
  shadowSize = 80,
  fog = [160, 1100],
  center = [0, 0, 0],
}: {
  sun: V3
  shadowSize?: number
  fog?: [number, number]
  center?: V3
}) {
  const quality = useStore((s) => s.quality)
  const sunDir = useMemo(() => new THREE.Vector3(...sun).normalize(), [sun])
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight('#ffdcb0', 2.9)
    l.castShadow = true
    l.shadow.bias = -0.00035
    l.shadow.normalBias = 0.045
    return l
  }, [])
  useMemo(() => {
    const c = new THREE.Vector3(...center)
    light.position.copy(sunDir).multiplyScalar(260).add(c)
    light.target.position.copy(c)
    light.target.updateMatrixWorld()
    const cam = light.shadow.camera
    cam.left = -shadowSize
    cam.right = shadowSize
    cam.top = shadowSize
    cam.bottom = -shadowSize
    cam.near = 10
    cam.far = 600
    cam.updateProjectionMatrix()
    const size = quality === 'high' ? 4096 : 2048
    if (light.shadow.mapSize.x !== size) {
      light.shadow.mapSize.set(size, size)
      light.shadow.map?.dispose()
      light.shadow.map = null
    }
  }, [light, sunDir, shadowSize, center, quality])
  const sky = (
    <Sky
      distance={4500}
      sunPosition={sunDir.toArray()}
      turbidity={7.5}
      rayleigh={1.4}
      mieCoefficient={0.006}
      mieDirectionalG={0.86}
    />
  )
  return (
    <>
      {sky}
      <Environment frames={1} resolution={256} environmentIntensity={0.32}>
        {sky}
      </Environment>
      <fog attach="fog" args={['#e6cba6', fog[0], fog[1]]} />
      <hemisphereLight args={['#c9dcff', '#b98a5c', 0.32]} />
      <primitive object={light} />
      <primitive object={light.target} />
      <Sparkles count={quality === 'high' ? 160 : 60} scale={[90, 18, 90]} position={[center[0], 7, center[2] + 20]}
        size={3} speed={0.25} opacity={0.55} color="#ffe1b0" noise={1.5} />
    </>
  )
}

export function Indoor() {
  return (
    <>
      <color attach="background" args={['#120c08']} />
      <Environment frames={1} resolution={64} environmentIntensity={0.55}>
        <Lightformer form="rect" intensity={2.2} color="#ffd29a" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[14, 10, 1]} />
        <Lightformer form="rect" intensity={3} color="#fff1d6" position={[-9, 2.5, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={3} color="#fff1d6" position={[9, 2.5, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ff9a4a" position={[0, 1, 6]} scale={[10, 3, 1]} />
      </Environment>
      <hemisphereLight args={['#ffe2bf', '#5a3420', 0.55]} />
      <Sparkles count={140} scale={[16, 5, 11]} position={[0, 2.6, 0]} size={1.6} speed={0.15} opacity={0.5} color="#ffe2b8" noise={0.6} />
    </>
  )
}

export function Effects({ indoor }: { indoor: boolean }) {
  const quality = useStore((s) => s.quality)
  const high = quality === 'high'
  return (
    <EffectComposer multisampling={0}>
      {high ? (
        <N8AO halfRes aoRadius={indoor ? 0.9 : 2.6} intensity={indoor ? 2.4 : 1.7} distanceFalloff={indoor ? 0.6 : 1.2} color="black" />
      ) : (
        <></>
      )}
      <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.2} intensity={indoor ? 0.9 : 0.55} radius={0.62} />
      <HueSaturation saturation={indoor ? 0.08 : 0.1} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.28} darkness={indoor ? 0.62 : 0.48} />
      <SMAA />
    </EffectComposer>
  )
}
