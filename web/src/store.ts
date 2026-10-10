import { create } from 'zustand'
import { loadBank, pickRound, STATION_COUNT, type Question } from './game/quiz'
import { setMuted } from './game/sfx'
import { STATION_ORDER, type StationId } from './stations'

export type SceneId = 'gate' | 'plaza' | 'fort' | 'interior' | StationId
export type { StationId }

export interface StationProgress {
  seen: string[]
  activity: boolean
  quizDone: boolean
  correct: number
}

const emptyProgress = (): Record<StationId, StationProgress> =>
  Object.fromEntries(STATION_ORDER.map((id) => [id, { seen: [], activity: false, quizDone: false, correct: 0 }])) as unknown as Record<
    StationId,
    StationProgress
  >

const JKEY = 'oman3d.journey.v1'
function loadJourney() {
  try {
    const raw = localStorage.getItem(JKEY)
    if (raw) {
      const j = JSON.parse(raw)
      return {
        stamps: (j.stamps ?? {}) as Partial<Record<StationId, number>>,
        progress: { ...emptyProgress(), ...(j.progress ?? {}) } as Record<StationId, StationProgress>,
        school: (j.school ?? '') as string,
      }
    }
  } catch {
    /* ignore */
  }
  return { stamps: {} as Partial<Record<StationId, number>>, progress: emptyProgress(), school: '' }
}
function saveJourney(s: { stamps: Partial<Record<StationId, number>>; progress: Record<StationId, StationProgress>; school: string }) {
  try {
    localStorage.setItem(JKEY, JSON.stringify({ stamps: s.stamps, progress: s.progress, school: s.school }))
  } catch {
    /* ignore */
  }
}
export type Quality = 'high' | 'low'
export type Device = 'desktop' | 'mobile'
export type Anim = 'cheer' | 'oops' | 'wave' | null

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface Answer {
  choice: boolean
  correct: boolean
}

interface State {
  started: boolean
  scene: SceneId
  /** where the player appears when a scene mounts ('default' | 'back' | a station id) */
  spawnKey: string
  fading: boolean
  /** cinematic running: player input frozen, buttons hidden */
  busy: boolean
  enterTick: number
  hotspot: string | null
  tab: string
  panelOpen: boolean
  videoOpen: boolean
  quality: Quality
  device: Device
  playerName: string
  muted: boolean
  // quiz
  round: Question[]
  answers: (Answer | null)[]
  activeStation: number | null
  lastResult: { station: number; correct: boolean; t: number } | null
  certificateOpen: boolean
  teacherOpen: boolean
  helpOpen: boolean
  // missions
  boardsRead: string[]
  videoWatched: boolean
  anim: { name: Anim; t: number }
  prompt: string | null
  // journey «عُمان تُروى من جديد»
  stamps: Partial<Record<StationId, number>>
  progress: Record<StationId, StationProgress>
  school: string
  passportOpen: boolean
  stampAward: StationId | 'final' | null
  info: { station: StationId; key: string } | null
  stationQuiz: StationId | null
  activity: string | null
  markSeen: (id: StationId, key: string) => void
  setInfo: (v: { station: StationId; key: string } | null) => void
  setActivityDone: (id: StationId) => void
  setStationQuiz: (id: StationId | null) => void
  finishQuiz: (id: StationId, correct: number) => void
  setPassportOpen: (b: boolean) => void
  closeStampAward: () => void
  setSchool: (s: string) => void
  setActivity: (a: string | null) => void
  resetJourney: () => void

  start: () => void
  requestEnter: () => void
  outfit: string
  setOutfit: (o: string) => void
  stationRequest: StationId | 'bonus' | null
  requestStation: (id: StationId | 'bonus' | null) => void
  toast: { text: string; t: number } | null
  showToast: (text: string) => void
  setBusy: (b: boolean) => void
  goTo: (scene: SceneId, spawnKey?: string) => Promise<void>
  setHotspot: (id: string | null) => void
  setTab: (id: string) => void
  setPanelOpen: (b: boolean) => void
  setVideoOpen: (b: boolean) => void
  setQuality: (q: Quality) => void
  setDevice: (d: Device) => void
  setPlayerName: (n: string) => void
  toggleMuted: () => void
  openStation: (i: number) => void
  answer: (i: number, choice: boolean) => void
  closeStation: () => void
  newRound: () => void
  setCertificateOpen: (b: boolean) => void
  setTeacherOpen: (b: boolean) => void
  setHelpOpen: (b: boolean) => void
  markBoard: (id: string) => void
  playAnim: (a: Anim) => void
  setPrompt: (p: string | null) => void
}

const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const savedName = (() => {
  try {
    return localStorage.getItem('oman3d.name') ?? ''
  } catch {
    return ''
  }
})()

function freshRound() {
  const round = pickRound(loadBank(), STATION_COUNT)
  return { round, answers: round.map(() => null) as (Answer | null)[] }
}

export const useStore = create<State>((set, get) => ({
  started: false,
  scene: 'gate',
  spawnKey: 'default',
  fading: false,
  busy: false,
  enterTick: 0,
  hotspot: null,
  tab: 'about',
  panelOpen: false,
  videoOpen: false,
  quality: coarse ? 'low' : 'high',
  device: coarse ? 'mobile' : 'desktop',
  playerName: savedName,
  muted: false,
  ...freshRound(),
  activeStation: null,
  lastResult: null,
  certificateOpen: false,
  teacherOpen: false,
  helpOpen: false,
  boardsRead: [],
  videoWatched: false,
  anim: { name: null, t: 0 },
  prompt: null,
  ...loadJourney(),
  passportOpen: false,
  stampAward: null,
  info: null,
  stationQuiz: null,
  activity: null,
  markSeen: (id, key) => {
    const p = get().progress[id]
    if (p.seen.includes(key)) return
    const progress = { ...get().progress, [id]: { ...p, seen: [...p.seen, key] } }
    set({ progress })
    saveJourney({ ...get(), progress })
  },
  setInfo: (info) => set({ info }),
  setActivityDone: (id) => {
    const p = get().progress[id]
    if (p.activity) return
    const progress = { ...get().progress, [id]: { ...p, activity: true } }
    set({ progress, anim: { name: 'cheer', t: performance.now() } })
    saveJourney({ ...get(), progress })
  },
  setStationQuiz: (stationQuiz) => set({ stationQuiz }),
  finishQuiz: (id, correct) => {
    const p = get().progress[id]
    const progress = { ...get().progress, [id]: { ...p, quizDone: true, correct: Math.max(p.correct, correct) } }
    const had = !!get().stamps[id]
    const stamps = had ? get().stamps : { ...get().stamps, [id]: Date.now() }
    set({ progress, stamps, stationQuiz: null, stampAward: had ? null : id })
    saveJourney({ ...get(), progress, stamps })
  },
  setPassportOpen: (passportOpen) => set({ passportOpen }),
  closeStampAward: () => {
    const s = get()
    const all = STATION_ORDER.every((id) => s.stamps[id])
    set({ stampAward: s.stampAward !== 'final' && all ? 'final' : null })
  },
  setSchool: (school) => {
    set({ school })
    saveJourney({ ...get(), school })
  },
  setActivity: (activity) => set({ activity }),
  resetJourney: () => {
    const progress = emptyProgress()
    set({ stamps: {}, progress, stampAward: null })
    saveJourney({ stamps: {}, progress, school: get().school })
  },

  start: () => set({ started: true, busy: true }),
  outfit: (() => {
    try {
      return localStorage.getItem('oman3d.outfit') ?? 'emerald'
    } catch {
      return 'emerald'
    }
  })(),
  setOutfit: (outfit) => {
    try {
      localStorage.setItem('oman3d.outfit', outfit)
    } catch {
      /* ignore */
    }
    set({ outfit })
  },
  stationRequest: null,
  requestStation: (stationRequest) => set({ stationRequest }),
  toast: null,
  showToast: (text) => set({ toast: { text, t: performance.now() } }),
  requestEnter: () => {
    if (get().busy) return
    set((s) => ({ enterTick: s.enterTick + 1, busy: true, hotspot: null }))
  },
  setBusy: (busy) => set({ busy }),
  goTo: async (scene, spawnKey = 'default') => {
    if (get().fading) return
    set({ fading: true, busy: true, prompt: null })
    await wait(850)
    set({ scene, spawnKey, hotspot: null, panelOpen: false })
    await wait(350)
    set({ fading: false })
  },
  setHotspot: (hotspot) => set({ hotspot }),
  setTab: (tab) => set({ tab, panelOpen: true }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setVideoOpen: (videoOpen) => set(videoOpen ? { videoOpen, videoWatched: true } : { videoOpen }),
  setQuality: (quality) => set({ quality }),
  setDevice: (device) => set({ device, quality: device === 'mobile' ? 'low' : get().quality }),
  setPlayerName: (playerName) => {
    try {
      localStorage.setItem('oman3d.name', playerName)
    } catch {
      /* ignore */
    }
    set({ playerName })
  },
  toggleMuted: () => {
    const m = !get().muted
    setMuted(m)
    set({ muted: m })
  },
  openStation: (i) => {
    if (get().activeStation !== null || !get().round[i]) return
    set({ activeStation: i })
  },
  answer: (i, choice) => {
    const q = get().round[i]
    if (!q || get().answers[i]) return
    const correct = q.answer === choice
    const answers = get().answers.slice()
    answers[i] = { choice, correct }
    set({ answers, lastResult: { station: i, correct, t: performance.now() }, anim: { name: correct ? 'cheer' : 'oops', t: performance.now() } })
  },
  closeStation: () => {
    set({ activeStation: null })
    const s = get()
    if (s.answers.length && s.answers.every(Boolean)) setTimeout(() => set({ certificateOpen: true }), 700)
  },
  newRound: () => set({ ...freshRound(), certificateOpen: false, lastResult: null }),
  setCertificateOpen: (certificateOpen) => set({ certificateOpen }),
  setTeacherOpen: (teacherOpen) => set({ teacherOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  markBoard: (id) => {
    if (!get().boardsRead.includes(id)) set({ boardsRead: [...get().boardsRead, id] })
  },
  playAnim: (name) => set({ anim: { name, t: performance.now() } }),
  setPrompt: (prompt) => {
    if (get().prompt !== prompt) set({ prompt })
  },
}))

export const modalOpen = () => {
  const s = useStore.getState()
  return (
    s.activeStation !== null ||
    s.certificateOpen ||
    s.teacherOpen ||
    s.videoOpen ||
    s.helpOpen ||
    s.passportOpen ||
    s.stampAward !== null ||
    s.stationQuiz !== null ||
    s.activity !== null
  )
}
