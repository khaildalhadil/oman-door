// واجهة المحطة الثالثة «سفن صنعت التاريخ» فوق three/ShipScene.tsx:
// اصعدي إلى السفينة ← ثلاث حلقات بودكاست في مقصورة القبطان ← تحدي القبطان ← ختم «خبيرة السفن» في الجواز.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { sfx } from '../game/sfx'
import { STATIONS } from '../stations'
import { useStore } from '../store'
import { ChoiceStep } from './Challenge'
import { stopNarration } from './Narration'
import { toAr } from './Quiz'

const DEF = STATIONS.ivory

interface ShipState {
  phase: 'sea' | 'cabin'
  boarding: boolean
  openKey: string | null
  quiz: boolean
  setOpen: (k: string | null) => void
}
export const useShip = create<ShipState>((set) => ({
  phase: 'sea',
  boarding: false,
  openKey: null,
  quiz: false,
  setOpen: (openKey) => set({ openKey }),
}))
const reset = () => useShip.setState({ phase: 'sea', boarding: false, openKey: null, quiz: false })
const clock = (s: number) => {
  if (!isFinite(s)) return '٠:٠٠'
  const sec = Math.floor(s % 60)
  return `${toAr(Math.floor(s / 60))}:${sec < 10 ? '٠' : ''}${toAr(sec)}`
}

function Episode({ itemKey }: { itemKey: string }) {
  const i = DEF.items.findIndex((x) => x.key === itemKey)
  const it = DEF.items[i]
  const close = () => useShip.getState().setOpen(null)
  const seen = useStore((s) => s.progress.ivory.seen.includes(itemKey))
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  useEffect(() => stopNarration(), [itemKey])
  const done = () => {
    setPlaying(false)
    const st = useStore.getState()
    if (st.progress.ivory.seen.includes(it.key)) return
    st.markSeen('ivory', it.key)
    sfx.ding()
    const n = useStore.getState().progress.ivory.seen.length
    st.showToast(n >= DEF.items.length ? 'أحسنتِ! استمعتِ إلى الحلقات الثلاث، وتحدي القبطان بانتظاركِ 🧭' : `أحسنتِ! أنهيتِ حلقة «${it.title}» ✓`)
  }
  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }
  return createPortal(
    <div className="modal" onClick={close} role="dialog" aria-modal aria-label={it.title}>
      <div className="modal__box nav-scroll podcast" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <span className="kicker">
              بودكاست أسرار السفن العُمانية · الحلقة {toAr(i + 1)} من {toAr(DEF.items.length)}
            </span>
            <h3>
              <span aria-hidden>{it.icon}</span> {it.title}
            </h3>
          </div>
          <button className="icon-btn" onClick={close} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <audio
          ref={audio}
          src={it.audio}
          autoPlay
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onEnded={done}
        />
        <div className="podcast__player">
          <button className="podcast__play" onClick={toggle} aria-label={playing ? 'إيقاف' : 'تشغيل'}>
            {playing ? '⏸' : '▶'}
          </button>
          <input
            className="podcast__bar"
            type="range"
            min={0}
            max={dur || 1}
            step={0.1}
            value={t}
            onChange={(e) => audio.current && (audio.current.currentTime = Number(e.target.value))}
            aria-label="شريط التقدم"
            style={{ ['--p' as string]: `${dur ? (t / dur) * 100 : 0}%` }}
          />
          <span className="podcast__time" dir="ltr">
            {clock(t)} / {clock(dur)}
          </span>
        </div>
        <p className="nav-scroll__text">{it.text}</p>
        <p className="info__ref">📚 {it.ref ?? 'الموسوعة العُمانية — المجلد والصفحة: يُضافان قريبًا'}</p>
        {!seen && <p className="nav-scroll__hint">استمعي إلى الحلقة حتى النهاية لتُحتسب ✓</p>}
        <button className="btn btn--primary nav-scroll__ok" onClick={close}>
          تم
        </button>
      </div>
    </div>,
    document.body,
  )
}

/** «تحدي القبطان»: three missions, then the passport shows the «خبيرة السفن» stamp */
function CaptainChallenge() {
  const steps = DEF.challenge
  const finish = useStore((s) => s.finishQuiz)
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const awarded = useRef(false)
  const won = i >= steps.length
  const award = () => {
    if (awarded.current) return
    awarded.current = true
    if (useStore.getState().stamps.ivory) useStore.setState({ stampAward: 'ivory' })
    else finish('ivory', score)
    useShip.setState({ quiz: false })
  }
  useEffect(() => {
    if (!won) return
    sfx.win()
    const t = setTimeout(award, 2600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won])
  const step = steps[i]
  return (
    <div className="treasure" style={{ ['--c' as string]: DEF.color }}>
      <div className="treasure__head">
        <span className="quiz__badge" style={{ background: DEF.color }}>
          تحدي القبطان 🧭
        </span>
        <span className="quiz__progress">
          {steps.map((_, k) => (
            <i key={k} className={k < i ? 'ok' : k === i ? 'cur' : ''} />
          ))}
        </span>
      </div>
      {won ? (
        <div className="treasure__win">
          <p className="treasure__msg">{DEF.outro?.text ?? 'أحسنتِ!'}</p>
          <button className="btn btn--primary btn--xl" onClick={award}>
            افتحي جوازكِ 📘
          </button>
        </div>
      ) : (
        <div key={i} className="treasure__step">
          {'title' in step && step.title && <h3 className="treasure__title">{step.title}</h3>}
          {step.kind === 'choice' && step.image && <img className="treasure__img" src={step.image} alt="" />}
          {step.kind === 'choice' && (
            <ChoiceStep
              step={step}
              onDone={(first) => {
                setScore((s) => s + (first ? 1 : 0))
                setI((k) => k + 1)
              }}
            />
          )}
        </div>
      )}
      {!won && (
        <button className="quiz__later" onClick={() => useShip.setState({ quiz: false })}>
          لاحقاً
        </button>
      )}
    </div>
  )
}

export function ShipStation() {
  const { phase, boarding, openKey, quiz, setOpen } = useShip()
  const seen = useStore((s) => s.progress.ivory.seen)
  const stamped = useStore((s) => !!s.stamps.ivory)
  const goTo = useStore((s) => s.goTo)
  const [fade, setFade] = useState(false)
  const heard = DEF.items.filter((it) => seen.includes(it.key)).length
  const allHeard = heard === DEF.items.length

  useEffect(() => {
    reset()
    return reset
  }, [])

  const board = () => {
    sfx.whoosh()
    useShip.setState({ boarding: true })
    setTimeout(() => setFade(true), 1100)
    setTimeout(() => useShip.setState({ phase: 'cabin', boarding: false }), 1600)
    setTimeout(() => setFade(false), 1800)
  }
  const back = (
    <button className="btn btn--ghost btn--sm" onClick={() => goTo('plaza', 'ivory')}>
      ↩ ساحة المحطات
    </button>
  )

  return (
    <div className="nav-room">
      {phase === 'sea' ? (
        !boarding && (
          <div className="ship-intro">
            <span className="kicker">المحطة الثالثة</span>
            <h2>{DEF.title}</h2>
            <p>{DEF.intro}</p>
            <button className="btn btn--primary btn--xl" onClick={board}>
              اصعدي إلى السفينة ⛵
            </button>
            {back}
          </div>
        )
      ) : quiz ? (
        <CaptainChallenge />
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
            <span className="nav-room__hint">
              {stamped ? '✓ حصلتِ على ختم «خبيرة السفن»' : allHeard ? 'تحدي القبطان بانتظاركِ 🧭' : `استمعتِ إلى ${toAr(heard)} من ${toAr(DEF.items.length)} حلقات`}
            </span>
            {allHeard && (
              <button className={'btn ' + (stamped ? 'btn--ghost' : 'btn--primary captain-btn')} onClick={() => useShip.setState({ quiz: true })}>
                تحدي القبطان 🧭
              </button>
            )}
            {stamped && (
              <button className="btn btn--primary" onClick={() => goTo('plaza', 'ivory')}>
                التالي: المحطة الرابعة ←
              </button>
            )}
            {back}
          </div>
        </div>
      )}
      {openKey && <Episode itemKey={openKey} />}
      <div className={'ship-fade' + (fade ? ' is-on' : '')} />
    </div>
  )
}
