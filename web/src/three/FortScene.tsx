import { CameraControls } from '@react-three/drei'
import type { CameraControlsImpl } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { FORT_HOTSPOTS, MODELS, WORLDS } from '../content'
import { setNav } from '../game/nav'
import { sfx } from '../game/sfx'
import { makeWorld } from '../game/world'
import { useStore } from '../store'
import { Outdoor } from './Atmosphere'
import {
  blendTerrain,
  Flag,
  HotspotMarker,
  introToPlayer,
  LanternLights,
  palmColliders,
  Palms,
  useDoors,
  useModel,
  useNavCamera,
  useWater,
  useWorldData,
  worldPos,
  type V3,
} from './helpers'
import { player, Player } from './Player'
import { QuizCourt, stationPositions } from './QuizCourt'

const DOOR = new THREE.Vector3(-23, 0, 7.6)

/** Where the player must stand to "discover" each landmark (three.js space). */
const DISCOVER: Record<string, { p: [number, number]; r: number }> = {
  tower: { p: [6, 8], r: 7 },
  gate: { p: [-23, 14], r: 5.5 },
  mosque: { p: [-67, 15.5], r: 8 },
  souq: { p: [-43, 36.5], r: 7 },
}

export function FortScene() {
  const { scene, nodes, empties, materials } = useModel(MODELS.fort)
  const quiz = useModel(MODELS.quiz)
  const fortData = useWorldData(WORLDS.fort)
  const quizData = useWorldData(WORLDS.quiz)
  const ref = useRef<CameraControlsImpl>(null)
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const leaving = useRef(false)
  const discovered = useRef<string | null>(null)
  const enterTick = useStore((s) => s.enterTick)
  const firstTick = useRef(enterTick)
  const hotspot = useStore((s) => s.hotspot)
  const spawnKey = useStore((s) => s.spawnKey)
  useDoors(nodes, open, 1.5, 1.4)
  useWater(scene)
  useNavCamera(ref)
  useLayoutEffect(() => blendTerrain(scene, materials), [scene, materials])

  const world = useMemo(
    () => makeWorld([fortData, quizData], palmColliders(scene), () => openRef.current),
    [fortData, quizData, scene],
  )
  const spawn = spawnKey === 'back' && fortData.spawnBack ? fortData.spawnBack : fortData.spawn
  const stations = useMemo(() => stationPositions(quiz.empties), [quiz.empties])

  useEffect(() => {
    let alive = true
    const from = spawnKey === 'back'
      ? { pos: [-23, 6, 4] as V3, target: [-23, 2, 20] as V3 }
      : { pos: [95, 85, 260] as V3, target: [-8, 12, -4] as V3 }
    ;(async () => {
      await introToPlayer(ref.current, from, spawn, 0.06, 7.5, 2.6, spawnKey === 'back' ? 1.0 : 1.8)
      if (!alive) return
      useStore.getState().setBusy(false)
      if (spawnKey !== 'back') useStore.getState().playAnim('wave')
    })()
    return () => {
      alive = false
      setNav(null)
    }
  }, [spawn, spawnKey])

  // quick "ادخل القلعة" button
  useEffect(() => {
    if (enterTick === firstTick.current) return
    openRef.current = true
    setOpen(true)
    setTimeout(() => useStore.getState().goTo('interior'), 900)
  }, [enterTick])

  useFrame(() => {
    const st = useStore.getState()
    // objective marker: next quiz station, then the fort door
    const next = st.answers.findIndex((a, i) => !a && st.round[i])
    if (next >= 0 && stations[next]) setNav(stations[next], `منصة السؤال ${String(next + 1).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])}`)
    else setNav(DOOR, 'باب القلعة')

    // doors
    const dDoor = Math.hypot(player.pos.x - DOOR.x, player.pos.z - (DOOR.z + 1.5))
    if (dDoor < 7 && !openRef.current) {
      openRef.current = true
      setOpen(true)
      sfx.whoosh()
    }
    if (!leaving.current && openRef.current && player.pos.z < DOOR.z - 0.4 && Math.abs(player.pos.x - DOOR.x) < 1.9) {
      leaving.current = true
      st.goTo('interior')
    }

    // landmark discovery
    if (st.busy) return
    let found: string | null = null
    for (const [id, d] of Object.entries(DISCOVER)) {
      if (Math.hypot(player.pos.x - d.p[0], player.pos.z - d.p[1]) < d.r) found = id
    }
    if (!found && Math.abs(player.pos.z - 40) < 3.2 && Math.abs(player.pos.x + 23) > 6) found = 'falaj'
    if (found !== discovered.current) {
      if (found) {
        st.setHotspot(found)
        sfx.ding()
      } else if (st.hotspot === discovered.current) st.setHotspot(null)
      discovered.current = found
    }
  })

  return (
    <>
      <CameraControls ref={ref} makeDefault truckSpeed={0} draggingSmoothTime={0.12} dollySpeed={0.5} />
      <Outdoor sun={[-0.6, 0.5, 0.7]} shadowSize={95} fog={[220, 1500]} center={[-10, 0, 14]} />
      <primitive object={scene} />
      <QuizCourt />
      <Palms root={scene} />
      <Player world={world} controls={ref} spawn={spawn} camRange={[3, 14]} />
      <Flag position={worldPos(empties['Flag_Tower'])} width={4.4} />
      <LanternLights root={scene} names={['Light000', 'Light001']} intensity={5} distance={8} />
      {FORT_HOTSPOTS.map((h) => (
        <HotspotMarker
          key={h.id}
          position={worldPos(empties[h.node])}
          label={h.title}
          active={hotspot === h.id}
          onClick={() => useStore.getState().setHotspot(hotspot === h.id ? null : h.id)}
        />
      ))}
    </>
  )
}
