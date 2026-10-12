import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Suspense } from 'react'
import { useStore } from './store'
import { GateScene } from './three/GateScene'
import { FortScene } from './three/FortScene'
import { InteriorScene } from './three/InteriorScene'
import { PlazaScene } from './three/PlazaScene'
import { StationScene } from './three/StationScene'
import { Effects } from './three/Atmosphere'
import {
  Compass,
  ControlsLayer,
  Fade,
  Help,
  HotspotInfo,
  InteriorPanel,
  Intro,
  Mission,
  Prompt,
  TopBar,
  VideoModal,
} from './ui/Overlay'
import { Certificate, QuizModal } from './ui/Quiz'
import { TeacherPanel } from './ui/Teacher'
import { PassportButton, PassportModal, StampAward } from './ui/Passport'
import { ActivityModals, isStation, PlazaMission, StationInfo, StationMission, Toast } from './ui/Station'
import { StationChallenge, StationRiddle } from './ui/Challenge'

const params = new URLSearchParams(window.location.search)
const FX = params.get('fx') !== '0'
const INDOOR = ['interior', 'ivory', 'clothing']

function DevExpose() {
  const state = useThree()
  if (import.meta.env.DEV) (window as unknown as { __three: typeof state }).__three = state
  return null
}

function Experience() {
  const scene = useStore((s) => s.scene)
  const started = useStore((s) => s.started)
  return (
    <>
      <Suspense fallback={null}>
        {started && scene === 'gate' && <GateScene key="gate" />}
        {started && scene === 'plaza' && <PlazaScene key="plaza" />}
        {started && isStation(scene) && <StationScene key={scene} id={scene} />}
        {started && scene === 'fort' && <FortScene key="fort" />}
        {started && scene === 'interior' && <InteriorScene key="interior" />}
      </Suspense>
      {FX && <Effects indoor={INDOOR.includes(scene)} />}
      <DevExpose />
      <PerformanceMonitor bounds={() => [22, 45]} flipflops={3} onDecline={() => useStore.getState().setQuality('low')} />
    </>
  )
}

/** this device shows a design applied from «استوديو التحديات» */
function StudioBanner() {
  const live = useStore((s) => s.liveContent)
  if (!live.length) return null
  return (
    <a className="studio-banner" href="./studio.html" title="العودة إلى استوديو التحديات">
      ✏️ تصميم من استوديو التحديات
    </a>
  )
}

export default function App() {
  const quality = useStore((s) => s.quality)
  const scene = useStore((s) => s.scene)
  const started = useStore((s) => s.started)
  const device = useStore((s) => s.device)
  return (
    <div className={`app scene-${scene} device-${device}`}>
      <Canvas
        className="canvas"
        shadows="percentage"
        flat={FX}
        dpr={quality === 'high' ? [1, 1.75] : [0.75, 1]}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 50, near: 0.1, far: 4000, position: [-46, 22, 132] }}
      >
        <color attach="background" args={['#d9b98f']} />
        <Experience />
      </Canvas>
      {started && (
        <>
          <TopBar />
          {scene === 'plaza' ? <PlazaMission /> : isStation(scene) ? <StationMission id={scene} /> : <Mission />}
          <Compass />
          <Prompt />
          {scene === 'fort' && <HotspotInfo />}
          {scene === 'interior' && <InteriorPanel />}
          {isStation(scene) && <StationInfo />}
          <ControlsLayer />
          <PassportButton />
          <Toast />
        </>
      )}
      <QuizModal />
      <StationRiddle />
      <StationChallenge />
      <ActivityModals />
      <Certificate />
      <PassportModal />
      <StampAward />
      <TeacherPanel />
      <Help />
      <VideoModal />
      <Fade />
      <Intro />
      <StudioBanner />
    </div>
  )
}
