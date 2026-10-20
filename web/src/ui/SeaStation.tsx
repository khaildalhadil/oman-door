// واجهة المحطة الأولى «البحر بداية الحكاية» فوق غرفة البحّار ثلاثية الأبعاد (three/NavRoom.tsx):
// المخطوطات الأربع (فيديو + معلومات + مرجع)، ثم صندوق الكنز بثلاثة أقفال، ثم الختم في الجواز.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { sfx } from '../game/sfx'
import { STATIONS } from '../stations'
import { useStore } from '../store'
import { ChoiceStep, OrderStep } from './Challenge'
import { Narration, stopNarration } from './Narration'
import { toAr } from './Quiz'

const DEF = STATIONS.nav

interface NavRoomState {
  openKey: string | null
  mode: 'room' | 'chest'
  locks: number
  lid: boolean
  setOpen: (k: string | null) => void
  setMode: (m: 'room' | 'chest') => void
  unlock: () => void
  openLid: () => void
}
export const useNavRoom = create<NavRoomState>((set) => ({
  openKey: null,
  mode: 'room',
  locks: 0,
  lid: false,
  setOpen: (openKey) => set({ openKey }),
  setMode: (mode) => set({ mode }),
  unlock: () => set((s) => ({ locks: s.locks + 1 })),
  openLid: () => set({ lid: true }),
}))

function Manuscript({ itemKey }: { itemKey: string }) {
  const i = DEF.items.findIndex((x) => x.key === itemKey)
  const it = DEF.items[i]
  const close = () => useNavRoom.getState().setOpen(null)
  const seen = useStore((s) => s.progress.nav.seen.includes(itemKey))
  const markSeen = useStore((s) => s.markSeen)
  const showToast = useStore((s) => s.showToast)
  const done = () => {
    if (useStore.getState().progress.nav.seen.includes(it.key)) return
    markSeen('nav', it.key)
    sfx.ding()
    const n = useStore.getState().progress.nav.seen.length
    showToast(n >= DEF.items.length ? 'أحسنتِ! شاهدتِ المخطوطات الأربع، وصندوق الكنز ينتظركِ 🗝️' : `أحسنتِ! أنهيتِ «${it.title}» ✓`)
  }
  useEffect(() => {
    stopNarration()
    if (!it.video) done()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey])
  // portal: keeps the modal above the fixed HUD (passport button, top bar)
  return createPortal(
    <div className="modal" onClick={close} role="dialog" aria-modal aria-label={it.title}>
      <div className="modal__box nav-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <span className="kicker">
              المخطوطة {toAr(i + 1)} من {toAr(DEF.items.length)}
            </span>
            <h3>
              <span aria-hidden>{it.icon}</span> {it.title}
            </h3>
          </div>
          <button className="icon-btn" onClick={close} aria-label="إغلاق">
            ✕
          </button>
        </div>
        {it.video && <video src={it.video} poster={it.poster} controls autoPlay playsInline className="nav-scroll__video" onEnded={done} />}
        <div className="nav-scroll__text">
          {it.text.split('\n').map((p, k) => (
            <p key={k}>{p}</p>
          ))}
        </div>
        {it.ref && <p className="info__ref">📚 {it.ref}</p>}
        {it.video && !seen && <p className="nav-scroll__hint">شاهدي الفيديو حتى النهاية لتُحتسب المخطوطة ✓</p>}
        <button className="btn btn--primary nav-scroll__ok" onClick={close}>
          تم
        </button>
      </div>
    </div>,
    document.body,
  )
}

function LockRow({ n, open }: { n: number; open: number }) {
  return (
    <span className="treasure__locks" aria-label={`فُتح ${toAr(open)} من ${toAr(n)} أقفال`}>
      {Array.from({ length: n }, (_, k) => (
        <i key={k} className={k < open ? 'is-open' : ''}>
          {k < open ? '🔓' : '🔒'}
        </i>
      ))}
    </span>
  )
}

/** the challenge: one question per padlock, then the chest opens and the stamp is given */
function Treasure() {
  const steps = DEF.challenge
  const { locks, lid, unlock, openLid, setMode } = useNavRoom()
  const finish = useStore((s) => s.finishQuiz)
  const [score, setScore] = useState(0)
  const solved = locks >= steps.length
  useEffect(() => {
    if (!solved || lid) return
    const t = setTimeout(() => {
      openLid()
      sfx.win()
    }, 1100)
    return () => clearTimeout(t)
  }, [solved, lid, openLid])
  const step = steps[locks]
  const next = (first: boolean) => {
    setScore((s) => s + (first ? 1 : 0))
    unlock()
  }
  return (
    <div className="treasure" style={{ ['--c' as string]: DEF.color }}>
      <div className="treasure__head">
        <span className="quiz__badge" style={{ background: DEF.color }}>
          صندوق كنز البحّار 🗝️
        </span>
        <LockRow n={steps.length} open={Math.min(locks, steps.length)} />
      </div>
      {lid ? (
        <div className="treasure__win">
          <p className="treasure__msg">أحسنتِ يا قبطانتنا! لقد فككتِ شفرة البحار</p>
          <button
            className="btn btn--primary btn--xl"
            onClick={() => {
              finish('nav', score)
              setMode('room')
            }}
          >
            استلمي ختم {DEF.stampLabel} 🏅
          </button>
        </div>
      ) : solved ? (
        <p className="treasure__msg">انفتحت الأقفال الثلاثة… 🔓</p>
      ) : (
        <div key={locks} className="treasure__step">
          {'title' in step && step.title && <h3 className="treasure__title">{step.title}</h3>}
          {step.kind === 'choice' && step.image && <img className="treasure__img" src={step.image} alt="" />}
          {step.kind === 'choice' && <ChoiceStep step={step} onDone={next} />}
          {step.kind === 'order' && <OrderStep step={step} onDone={next} />}
        </div>
      )}
      {!lid && (
        <button className="quiz__later" onClick={() => setMode('room')}>
          لاحقاً
        </button>
      )}
    </div>
  )
}

export function SeaStation() {
  const { openKey, mode, setOpen, setMode } = useNavRoom()
  const seen = useStore((s) => s.progress.nav.seen)
  const stamped = useStore((s) => !!s.stamps.nav)
  const goTo = useStore((s) => s.goTo)
  const showToast = useStore((s) => s.showToast)
  const seenCount = DEF.items.filter((it) => seen.includes(it.key)).length
  const allSeen = seenCount === DEF.items.length

  // fresh state per visit; a stamped station keeps its chest open
  useEffect(() => {
    useNavRoom.setState({ openKey: null, mode: 'room', locks: stamped ? DEF.challenge.length : 0, lid: stamped })
    return () => useNavRoom.setState({ openKey: null, mode: 'room', locks: 0, lid: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chest = () => {
    if (stamped) return showToast('حصلتِ على ختم الملاحة العُمانية ✓')
    if (!allSeen) return showToast(`شاهدي المخطوطات الأربع أولًا (${toAr(seenCount)} من ${toAr(DEF.items.length)}) 📜`)
    setMode('chest')
  }

  return (
    <div className="nav-room">
      {mode === 'chest' ? (
        <Treasure />
      ) : (
        <div className="nav-room__bar">
          <div className="nav-room__chips">
            {DEF.items.map((it, i) => (
              <button key={it.key} className={'nav-tag' + (seen.includes(it.key) ? ' is-done' : '')} onClick={() => setOpen(it.key)}>
                <span className="nav-tag__n">{toAr(i + 1)}</span>
                <span className="nav-tag__t">{it.title}</span>
                {seen.includes(it.key) && <span className="nav-tag__ck">✓</span>}
              </button>
            ))}
          </div>
          <div className="nav-room__row">
            <Narration src={DEF.introAudio} label="رسالة الترحيب 🔊" />
            <span className="nav-room__hint">
              {stamped ? '✓ حصلتِ على ختم المحطة' : allSeen ? 'افتحي صندوق الكنز 🗝️' : `شاهدتِ ${toAr(seenCount)} من ${toAr(DEF.items.length)} مخطوطات`}
            </span>
            {stamped ? (
              <button className="btn btn--primary" onClick={() => goTo('plaza', 'nav')}>
                التالي: المحطة الثانية ←
              </button>
            ) : (
              <button className={'btn btn--primary' + (allSeen ? '' : ' is-locked')} onClick={chest}>
                {allSeen ? 'صندوق الكنز 🗝️' : '🔒 صندوق الكنز'}
              </button>
            )}
            <button className="btn btn--ghost btn--sm" onClick={() => goTo('plaza', 'nav')}>
              ↩ الساحة
            </button>
          </div>
        </div>
      )}
      {openKey && <Manuscript itemKey={openKey} />}
    </div>
  )
}
