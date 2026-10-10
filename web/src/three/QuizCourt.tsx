import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { MODELS } from '../content'
import { sfx } from '../game/sfx'
import { useStore } from '../store'
import { loadFonts } from './boards'
import { useModel, worldPos, type V3 } from './helpers'
import { player } from './Player'

const toAr = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])
const GOLD = new THREE.Color('#f5c451')
const GREEN = new THREE.Color('#3ad17e')
const RED = new THREE.Color('#ff6a3d')
const GREY = new THREE.Color('#8a8076')

/* --------------------------------------------------------- canvas signs */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void) {
  const c = document.createElement('canvas')
  c.width = Math.round(w * 400)
  c.height = Math.round(h * 400)
  const g = c.getContext('2d')!
  draw(g, c.width, c.height)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function frame(g: CanvasRenderingContext2D, W: number, H: number) {
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#fbefd6')
  grad.addColorStop(1, '#e8d1a6')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  g.strokeStyle = '#7a1f1f'
  g.lineWidth = H * 0.05
  g.strokeRect(0, 0, W, H)
  g.strokeStyle = '#c9a14a'
  g.lineWidth = H * 0.012
  g.strokeRect(H * 0.06, H * 0.06, W - H * 0.12, H * 0.88)
}

function signTexture() {
  return canvasTex(3.1, 0.84, (g, W, H) => {
    frame(g, W, H)
    g.direction = 'rtl'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#7a1f1f'
    g.font = `700 ${H * 0.42}px "Reem Kufi", "Tajawal", sans-serif`
    g.fillText('ساحة التحدي', W / 2, H * 0.42)
    g.fillStyle = '#2a1a10'
    g.font = `600 ${H * 0.15}px "Tajawal", sans-serif`
    g.fillText('اقتربي من كل منصة وأجيبي: صح أم خطأ؟ ⭐', W / 2, H * 0.78)
  })
}

function scoreTexture(name: string, answers: ({ correct: boolean } | null)[]) {
  return canvasTex(3.0, 1.66, (g, W, H) => {
    frame(g, W, H)
    g.direction = 'rtl'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#7a1f1f'
    g.font = `700 ${H * 0.15}px "Reem Kufi", "Tajawal", sans-serif`
    g.fillText('لوحة النتائج', W / 2, H * 0.17)
    g.fillStyle = '#2a1a10'
    g.font = `600 ${H * 0.085}px "Tajawal", sans-serif`
    g.fillText(name ? `اللاعبة: ${name}` : 'أجيبي عن أسئلة المنصّات', W / 2, H * 0.33)
    const n = answers.length
    const size = Math.min(W * 0.8 / Math.max(n, 1), H * 0.2)
    const x0 = W / 2 + (size * n) / 2 - size / 2
    answers.forEach((a, i) => {
      const x = x0 - i * size
      const y = H * 0.56
      drawStar(g, x, y, size * 0.42, a ? (a.correct ? '#e8b931' : '#c9b9a0') : '#efe3c9', a ? '#7a5a12' : '#c9b38a')
      g.fillStyle = a ? (a.correct ? '#1f7a44' : '#b8432a') : '#8a7a60'
      g.font = `700 ${size * 0.3}px "Tajawal", sans-serif`
      g.fillText(a ? (a.correct ? '✓' : '✗') : toAr(i + 1), x, y + size * 0.62)
    })
    const correct = answers.filter((a) => a?.correct).length
    const done = answers.filter(Boolean).length
    g.fillStyle = '#7a1f1f'
    g.font = `700 ${H * 0.11}px "Reem Kufi", "Tajawal", sans-serif`
    g.fillText(`النجوم: ${toAr(correct)} / ${toAr(n)}   •   أُجيب: ${toAr(done)}`, W / 2, H * 0.86)
  })
}

function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke: string) {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  g.closePath()
  g.fillStyle = fill
  g.fill()
  g.lineWidth = r * 0.1
  g.strokeStyle = stroke
  g.stroke()
}

/* ------------------------------------------------------------ confetti */

const CONFETTI = 180
const PALETTE = ['#c8102e', '#ffffff', '#008a3e', '#f5c451', '#ff7aa8', '#4cc3ff']

function Confetti() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const lastResult = useStore((s) => s.lastResult)
  const parts = useMemo(
    () =>
      Array.from({ length: CONFETTI }, () => ({
        p: new THREE.Vector3(0, -100, 0),
        v: new THREE.Vector3(),
        r: new THREE.Euler(),
        w: new THREE.Vector3(),
        life: 0,
      })),
    [],
  )
  useEffect(() => {
    const m = ref.current
    const c = new THREE.Color()
    for (let i = 0; i < CONFETTI; i++) m.setColorAt(i, c.set(PALETTE[i % PALETTE.length]))
    m.instanceColor!.needsUpdate = true
  }, [])
  useEffect(() => {
    if (!lastResult?.correct) return
    const origin = player.pos.clone().add(new THREE.Vector3(0, 1.6, 0))
    parts.forEach((q) => {
      q.p.copy(origin)
      const a = Math.random() * Math.PI * 2
      const sp = 2 + Math.random() * 4
      q.v.set(Math.cos(a) * sp, 5 + Math.random() * 5, Math.sin(a) * sp)
      q.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10)
      q.life = 3 + Math.random()
    })
  }, [lastResult, parts])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, dt) => {
    const m = ref.current
    parts.forEach((q, i) => {
      if (q.life > 0) {
        q.life -= dt
        q.v.y -= 9 * dt
        q.v.multiplyScalar(1 - 1.2 * dt)
        q.p.addScaledVector(q.v, dt)
        q.r.x += q.w.x * dt
        q.r.y += q.w.y * dt
        q.r.z += q.w.z * dt
      }
      dummy.position.copy(q.p)
      dummy.rotation.copy(q.r)
      dummy.scale.setScalar(q.life > 0 ? 1 : 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, CONFETTI]} frustumCulled={false}>
      <planeGeometry args={[0.09, 0.14]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  )
}

/* -------------------------------------------------------------- stations */

function Station({ index, pos, state, next }: { index: number; pos: V3; state: 'idle' | 'ok' | 'bad' | 'off'; next: boolean }) {
  const gem = useRef<THREE.Mesh>(null!)
  const ring = useRef<THREE.Mesh>(null!)
  const color = state === 'ok' ? GREEN : state === 'bad' ? RED : state === 'off' ? GREY : GOLD
  useFrame((s) => {
    const t = s.clock.elapsedTime + index
    gem.current.rotation.y = t * 1.4
    gem.current.position.y = pos[1] + 0.55 + Math.sin(t * 2) * 0.08
    const k = next ? 1 + Math.sin(t * 4) * 0.08 : 1
    ring.current.scale.setScalar(k)
    ;(ring.current.material as THREE.MeshBasicMaterial).opacity = next ? 0.55 + Math.sin(t * 4) * 0.25 : 0.35
  })
  return (
    <group>
      <mesh ref={gem} position={[pos[0], pos[1] + 0.55, pos[2]]} castShadow>
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={state === 'idle' ? 2.2 : 1.6} roughness={0.25} metalness={0.4} />
      </mesh>
      <mesh ref={ring} position={[pos[0], 0.14, pos[2]]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.25, 1.42, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} toneMapped={false} depthWrite={false} />
      </mesh>
      {next && <Beacon pos={pos} />}
      {state !== 'off' && (
        <Html position={[pos[0], pos[1] + 1.25, pos[2]]} center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
          <div className={'station-badge is-' + state + (next ? ' is-next' : '')}>
            {state === 'ok' ? '✓' : state === 'bad' ? '✗' : toAr(index + 1)}
          </div>
        </Html>
      )}
    </group>
  )
}

function Beacon({ pos }: { pos: V3 }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uTime; varying vec2 vUv;
          void main(){ float a = (1.0 - vUv.y) * (0.55 + 0.45 * sin(vUv.y * 20.0 - uTime * 4.0));
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.35) * a * 0.55, 1.0); }`,
      }),
    [],
  )
  useFrame((s) => {
    mat.uniforms.uTime.value = s.clock.elapsedTime
  })
  return (
    <mesh position={[pos[0], 6, pos[2]]} material={mat}>
      <cylinderGeometry args={[0.35, 0.5, 12, 20, 1, true]} />
    </mesh>
  )
}

/* ----------------------------------------------------------------- court */

export function QuizCourt() {
  const { scene, nodes, empties } = useModel(MODELS.quiz)
  const round = useStore((s) => s.round)
  const answers = useStore((s) => s.answers)
  const name = useStore((s) => s.playerName)
  const [fonts, setFonts] = useState(false)
  const inside = useRef<boolean[]>([])

  useEffect(() => {
    loadFonts().finally(() => setFonts(true))
  }, [])

  const stations = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => worldPos(empties[`Station_${String(i + 1).padStart(2, '0')}`])).filter(
        (p) => p[0] !== 0 || p[2] !== 0,
      ),
    [empties],
  )

  const sign = useMemo(() => {
    if (!fonts) return null
    const n = nodes['Sign_Court'] as THREE.Mesh | undefined
    return n ? { n, tex: signTexture() } : null
  }, [fonts, nodes])

  const score = useMemo(() => {
    if (!fonts) return null
    const n = nodes['Scoreboard'] as THREE.Mesh | undefined
    return n ? { n, tex: scoreTexture(name, answers) } : null
  }, [fonts, nodes, name, answers])

  const nextIdx = answers.findIndex((a, i) => !a && round[i])

  useFrame(() => {
    const st = useStore.getState()
    if (st.busy || st.activeStation !== null) return
    let near: string | null = null
    stations.forEach((p, i) => {
      const d = Math.hypot(player.pos.x - p[0], player.pos.z - p[2])
      if (d > 2.4) inside.current[i] = false
      if (d < 1.6) {
        if (!st.round[i]) return
        if (st.answers[i]) near = 'تمت الإجابة عن هذا السؤال ✓'
        else if (!inside.current[i]) {
          inside.current[i] = true
          sfx.ding()
          st.openStation(i)
        }
      }
    })
    st.setPrompt(near)
  })

  return (
    <>
      <primitive object={scene} />
      {stations.map((p, i) => (
        <Station
          key={i}
          index={i}
          pos={p}
          next={i === nextIdx}
          state={!round[i] ? 'off' : answers[i] ? (answers[i]!.correct ? 'ok' : 'bad') : 'idle'}
        />
      ))}
      {sign && (
        <group position={sign.n.position} quaternion={sign.n.quaternion}>
          <mesh position={[0, 0, 0.045]}>
            <planeGeometry args={[3.1, 0.84]} />
            <meshStandardMaterial map={sign.tex} roughness={0.85} />
          </mesh>
        </group>
      )}
      {score && (
        <group position={score.n.position} quaternion={score.n.quaternion}>
          <mesh position={[0, 0, 0.045]}>
            <planeGeometry args={[3.0, 1.66]} />
            <meshStandardMaterial map={score.tex} roughness={0.85} />
          </mesh>
        </group>
      )}
      <Confetti />
    </>
  )
}

export function stationPositions(empties: Record<string, THREE.Object3D>) {
  return Array.from({ length: 10 }, (_, i) => worldPos(empties[`Station_${String(i + 1).padStart(2, '0')}`]))
}
