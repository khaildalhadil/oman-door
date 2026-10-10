import { CameraControls } from '@react-three/drei'
import type { CameraControlsImpl } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MODELS, WORLDS } from '../content'
import { setNav } from '../game/nav'
import { sfx } from '../game/sfx'
import { makeWorld } from '../game/world'
import { useStore } from '../store'
import { Outdoor } from './Atmosphere'
import {
  blendTerrain,
  Flag,
  introToPlayer,
  LanternLights,
  palmColliders,
  Palms,
  useDoors,
  useModel,
  useNavCamera,
  useWorldData,
  worldPos,
} from './helpers'
import { player, Player } from './Player'

// three.js space: the gate faces +Z, the passage is |x| < 3 around z = 0.
export function GateScene() {
  const { scene, nodes, empties, materials } = useModel(MODELS.gate)
  const data = useWorldData(WORLDS.gate)
  const ref = useRef<CameraControlsImpl>(null)
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const leaving = useRef(false)
  const enterTick = useStore((s) => s.enterTick)
  const firstTick = useRef(enterTick)
  useDoors(nodes, open)
  useNavCamera(ref)
  useLayoutEffect(() => blendTerrain(scene, materials), [scene, materials])

  const world = useMemo(() => makeWorld([data], palmColliders(scene), () => openRef.current), [data, scene])
  const spawn = data.spawn

  useEffect(() => {
    let alive = true
    setNav([0, 0, 0], 'بوابة عُمان')
    ;(async () => {
      await introToPlayer(ref.current, { pos: [-46, 22, 132], target: [0, 9, 0] }, spawn, 0.06, 7, 2.4, 1.6)
      if (!alive) return
      useStore.getState().setBusy(false)
      useStore.getState().playAnim('wave')
    })()
    return () => {
      alive = false
      setNav(null)
    }
  }, [spawn])

  // "تخطَّ" button: open the doors and move on
  useEffect(() => {
    if (enterTick === firstTick.current) return
    openRef.current = true
    setOpen(true)
    setTimeout(() => useStore.getState().goTo('plaza'), 900)
  }, [enterTick])

  useFrame(() => {
    const near = Math.hypot(player.pos.x, player.pos.z - 1) < 9
    if (near && !openRef.current) {
      openRef.current = true
      setOpen(true)
      sfx.whoosh()
    }
    if (!leaving.current && openRef.current && player.pos.z < -1.2 && Math.abs(player.pos.x) < 3.2) {
      leaving.current = true
      useStore.getState().goTo('plaza')
    }
  })

  return (
    <>
      <CameraControls ref={ref} makeDefault truckSpeed={0} draggingSmoothTime={0.12} dollySpeed={0.5} />
      <Outdoor sun={[-0.78, 0.4, 0.48]} shadowSize={75} fog={[160, 1150]} center={[0, 0, 10]} />
      <primitive object={scene} />
      <Palms root={scene} />
      <Player world={world} controls={ref} spawn={spawn} camRange={[3, 14]} />
      <Flag position={worldPos(empties['Flag_L'])} width={3.2} />
      <Flag position={worldPos(empties['Flag_R'])} width={3.2} />
      <LanternLights root={scene} names={['Light000', 'Light001', 'Light002', 'Light003']} intensity={5} distance={8} />
    </>
  )
}
