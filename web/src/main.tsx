import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installKeyboard } from './game/input'
import { useStore } from './store'
import { loadAllContent } from './contentStore'
import type { StationId } from './stations'
import './styles.css'
import './game.css'
import './journey.css'
import './challenge.css'

if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useStore }).__store = useStore
  // dev shortcuts: ?scene=fort jumps straight into a scene, ?station=0 opens a question, ?cert=1, ?teacher=1
  const q = new URLSearchParams(window.location.search)
  const scene = q.get('scene')
  if (scene && ['gate', 'plaza', 'fort', 'interior', 'nav', 'sumhuram', 'turtles', 'ivory', 'clothing'].includes(scene)) {
    installKeyboard()
    useStore.setState({ started: true, scene: scene as 'gate', busy: true })
  }
  if (q.get('device') === 'mobile' || q.get('device') === 'desktop') useStore.getState().setDevice(q.get('device') as 'mobile')
  setTimeout(() => {
    const st = useStore.getState()
    if (q.get('hotspot')) st.setHotspot(q.get('hotspot'))
    if (q.get('tab')) st.setTab(q.get('tab')!)
    if (q.get('video')) st.setVideoOpen(true)
    if (q.get('station')) st.openStation(Number(q.get('station')))
    if (q.get('answer')) st.answer(Number(q.get('station') ?? 0), q.get('answer') === '1')
    if (q.get('cert')) {
      st.round.forEach((_, i) => st.answer(i, i % 4 !== 3 ? st.round[i].answer : !st.round[i].answer))
      st.setCertificateOpen(true)
    }
    if (q.get('teacher')) st.setTeacherOpen(true)
    if (q.get('help')) st.setHelpOpen(true)
    if (q.get('passport')) st.setPassportOpen(true)
    if (q.get('stamp')) {
      const id = q.get('stamp') as 'nav'
      st.finishQuiz(id, 3)
    }
    if (q.get('name')) st.setPlayerName(q.get('name')!)
    if (q.get('final')) {
      for (const id of ['nav', 'sumhuram', 'turtles', 'ivory', 'clothing'] as const) st.finishQuiz(id, 3)
      useStore.setState({ stampAward: 'final' })
    }
    if (q.get('activity')) st.setActivity(q.get('activity'))
    if (q.get('squiz')) st.setStationQuiz(q.get('squiz') as 'nav')
    if (q.get('riddle')) st.setRiddleOpen(q.get('riddle') as 'nav')
  }, Number(q.get('delay') ?? 7000))
  // window.__dev: game internals for automated smoke tests / recording the demo video
  Promise.all([import('./three/Player'), import('./three/Activities'), import('./game/input'), import('./stations')]).then(([P, A, I, S]) => {
    ;(window as unknown as { __dev: object }).__dev = {
      player: P.player,
      activityNav: A.activityNav,
      input: I.input,
      camOverride: P.camOverride,
      pieces: A.PIECES,
      stations: S.STATIONS,
    }
  })
}

// student designs («استوديو التحديات») are applied before the game starts
loadAllContent().then((live) => {
  useStore.setState({ liveContent: live })
  // ?preview=<station>: open a station straight away to try a design applied from the studio on this device
  const pv = new URLSearchParams(window.location.search).get('preview') as StationId | null
  if (pv && live.includes(pv)) {
    installKeyboard()
    useStore.setState({ started: true, scene: pv, busy: true })
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
