import { CameraControls, Html } from '@react-three/drei'
import type { CameraControlsImpl } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { INTERIOR, MODELS, VIDEO, WORLDS } from '../content'
import { consumeInteract } from '../game/input'
import { setNav } from '../game/nav'
import { sfx } from '../game/sfx'
import { makeWorld } from '../game/world'
import { useStore } from '../store'
import { Indoor } from './Atmosphere'
import { introToPlayer, nodesWithPrefix, useModel, useNavCamera, useWorldData, worldPos, type V3 } from './helpers'
import { drawBoard, loadFonts } from './boards'
import { Player, player } from './Player'

/* ----------------------------------------------------------------- video */

function useScreenVideo() {
  const video = useMemo(() => {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'
    v.loop = true
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    return v
  }, [])
  const texture = useMemo(() => {
    const t = new THREE.VideoTexture(video)
    t.colorSpace = THREE.SRGBColorSpace
    t.flipY = false // glTF UVs are already flipped
    return t
  }, [video])
  useEffect(() => {
    video.src = VIDEO.src
    video.play().catch(() => {})
    return () => {
      // keep the texture alive (StrictMode re-runs effects); just release the stream
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [video])
  return { video, texture }
}

/* ---------------------------------------------------------- light shafts */

function LightShaft({ from, to, r0 = 0.55, r1 = 1.5 }: { from: V3; to: V3; r0?: number; r1?: number }) {
  const { geo, quat, mid } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const d = a.clone().sub(b)
    const g = new THREE.CylinderGeometry(r0, r1, d.length(), 24, 1, true)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
    return { geo: g, quat: q, mid: a.clone().add(new THREE.Vector3(...to)).multiplyScalar(0.5) }
  }, [from, to, r0, r1])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffcf8a') } },
        vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){
            float along = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
            float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
            float streak = 0.75 + 0.25 * sin(vUv.x * 50.0 + uTime * 0.4) * sin(vUv.x * 17.0 - uTime * 0.25);
            gl_FragColor = vec4(uColor * along * rim * streak * 0.085, 1.0);
          }`,
      }),
    [],
  )
  useFrame((s) => {
    mat.uniforms.uTime.value = s.clock.elapsedTime
  })
  return <mesh geometry={geo} material={mat} position={mid} quaternion={quat} renderOrder={5} />
}

/* ---------------------------------------------------------------- scene */

const SCREEN_SPOT = new THREE.Vector3(0, 0, -3.4)

export function InteriorScene() {
  const { scene, nodes } = useModel(MODELS.interior)
  const data = useWorldData(WORLDS.interior)
  const ref = useRef<CameraControlsImpl>(null)
  const [fonts, setFonts] = useState(false)
  const videoOpen = useStore((s) => s.videoOpen)
  const { video, texture } = useScreenVideo()
  const [muted, setMuted] = useState(true)
  const [playing, setPlaying] = useState(true)
  const leaving = useRef(false)
  const nearBoard = useRef<string | null>(null)
  useNavCamera(ref)

  const world = useMemo(() => makeWorld([data]), [data])
  const spawn = data.spawn

  useEffect(() => {
    loadFonts().finally(() => setFonts(true))
  }, [])

  // swap the video screen material
  useLayoutEffect(() => {
    const screen = nodes['VideoScreen'] as THREE.Mesh | undefined
    if (screen) {
      screen.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
      screen.castShadow = false
    }
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && (m.material as THREE.Material).name === 'M_WindowGlow') m.castShadow = false
    })
  }, [nodes, scene, texture])

  // pause the 3D screen while the full-screen player is open
  useEffect(() => {
    if (videoOpen) video.pause()
    else if (playing) video.play().catch(() => {})
  }, [videoOpen, video, playing])

  // board textures
  const boards = useMemo(() => {
    if (!fonts) return []
    return INTERIOR.boards.map((b) => {
      const node = nodes[b.node] as THREE.Mesh
      node.geometry.computeBoundingBox()
      const size = new THREE.Vector3()
      node.geometry.boundingBox!.getSize(size)
      const tex = drawBoard(b.title, b.lines, size.x, size.y)
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(node.quaternion)
      const spot = node.position.clone().addScaledVector(normal, 1.6)
      spot.y = 0
      return { ...b, mesh: node, w: size.x, h: size.y, tex, spot }
    })
  }, [fonts, nodes])

  // invisible walls so the follow camera never leaves the room
  const blockers = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ visible: false })
    const mk = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      m.updateMatrixWorld()
      return m
    }
    return [
      mk(0.4, 8, 14, -9.2, 3, 0),
      mk(0.4, 8, 14, 9.2, 3, 0),
      mk(20, 8, 0.4, 0, 3, -6.2),
      mk(20, 8, 0.4, 0, 3, 6.2),
      mk(20, 0.4, 14, 0, 6.3, 0),
    ]
  }, [])
  useEffect(() => {
    const c = ref.current
    if (c) c.colliderMeshes = blockers
  }, [blockers])

  // arrival
  useEffect(() => {
    let alive = true
    ;(async () => {
      await introToPlayer(ref.current, { pos: [0, 1.8, 6.4], target: [0, 1.8, 0] }, spawn, 0.025, 3.6, 1.0, 1.0)
      if (!alive) return
      useStore.getState().setBusy(false)
      useStore.getState().playAnim('wave')
    })()
    return () => {
      alive = false
      setNav(null)
    }
  }, [spawn])

  useFrame(() => {
    const st = useStore.getState()
    // objective: unread boards, then the video screen, then the door
    const unread = boards.find((b) => !st.boardsRead.includes(b.node))
    if (unread) setNav(unread.spot, unread.title)
    else if (!st.videoWatched) setNav(SCREEN_SPOT, 'شاشة الفيديو')
    else setNav([0, 0, 5.8], 'باب الخروج')
    if (st.busy) return

    // exit through the door
    if (!leaving.current && player.pos.z > 5.42 && Math.abs(player.pos.x) < 0.95) {
      leaving.current = true
      st.goTo('fort', 'back')
      return
    }
    // boards
    let near: (typeof boards)[number] | null = null
    for (const b of boards) if (Math.hypot(player.pos.x - b.spot.x, player.pos.z - b.spot.z) < 1.9) near = b
    if ((near?.node ?? null) !== nearBoard.current) {
      if (near) {
        st.markBoard(near.node)
        st.setTab(near.tab)
        sfx.ding()
      } else st.setPanelOpen(false)
      nearBoard.current = near?.node ?? null
    }
    // the video screen
    const dScreen = Math.hypot(player.pos.x - SCREEN_SPOT.x, player.pos.z - SCREEN_SPOT.z)
    if (dScreen < 2.6) {
      st.setPrompt('screen')
      if (consumeInteract()) st.setVideoOpen(true)
    } else if (st.prompt === 'screen') st.setPrompt(null)
  })

  const shafts = useMemo(() => {
    return nodesWithPrefix(scene, 'Window').map((o) => {
      const p = worldPos(o)
      const inward = p[0] < 0 ? 1 : -1
      return { from: p, to: [p[0] + inward * 5.2, 0.0, p[2] + (p[2] < 0 ? 1.2 : -1.2)] as V3 }
    })
  }, [scene])

  const spots = useMemo(
    () =>
      shafts.map((s) => {
        const l = new THREE.SpotLight('#ffd7a3', 26, 14, 0.55, 0.7, 1.6)
        l.position.set(...s.from)
        l.target.position.set(...s.to)
        return l
      }),
    [shafts],
  )

  const lanterns = useMemo(() => nodesWithPrefix(scene, 'Light').map((o) => worldPos(o)), [scene])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.object.name !== 'VideoScreen') return
    e.stopPropagation()
    if (video.paused) {
      video.play().catch(() => {})
      setPlaying(true)
    } else if (video.muted) {
      video.muted = false
      setMuted(false)
    } else {
      video.pause()
      setPlaying(false)
    }
  }

  const screenPos = worldPos(nodes['VideoScreen'], [0, 2.95, -5.9])

  return (
    <>
      <CameraControls ref={ref} makeDefault truckSpeed={0} draggingSmoothTime={0.12} dollySpeed={0.5} />
      <Indoor />
      <primitive object={scene} onClick={onClick} />
      <Player world={world} controls={ref} spawn={spawn} camRange={[1.6, 4.2]} />
      {lanterns.map((p, i) => (
        <pointLight key={i} position={p} intensity={i === 4 ? 9 : 6} distance={11} decay={1.8} color="#ffb066" />
      ))}
      {spots.map((l, i) => (
        <group key={i}>
          <primitive object={l} />
          <primitive object={l.target} />
        </group>
      ))}
      {shafts.map((s, i) => (
        <LightShaft key={i} from={s.from} to={s.to} />
      ))}
      <LightShaft from={[0, 2.6, 6.4]} to={[0, 0, 2.6]} r0={0.9} r1={1.6} />
      <spotLight position={[0, 2.8, 7.5]} intensity={20} distance={12} angle={0.6} penumbra={0.8} color="#ffe2b8" />
      {boards.map((b) => (
        <group key={b.node} position={b.mesh.position} quaternion={b.mesh.quaternion}>
          <mesh position={[0, 0, 0.026]}>
            <planeGeometry args={[b.w, b.h]} />
            <meshStandardMaterial map={b.tex} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {!videoOpen && (
        <Html position={[screenPos[0], screenPos[1] - 1.62, screenPos[2] + 0.05]} center zIndexRange={[30, 10]}>
          <button
            className="screen-chip"
            onClick={() => {
              if (video.paused) {
                video.play().catch(() => {})
                setPlaying(true)
              }
              video.muted = !video.muted
              setMuted(video.muted)
            }}
          >
            {!playing ? '▶ تشغيل' : muted ? '🔈 تشغيل الصوت' : '🔊 كتم الصوت'}
          </button>
        </Html>
      )}
    </>
  )
}
