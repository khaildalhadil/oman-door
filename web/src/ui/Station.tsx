import { useEffect, useMemo, useState } from 'react'
import { sfx } from '../game/sfx'
import { JOURNEY, STATION_ORDER, STATIONS, type StationId } from '../stations'
import { useStore } from '../store'
import { PIECES } from '../three/Activities'
import { CollapseToggle, useCollapsible } from './collapse'
import { IvoryRoute } from './Challenge'
import { Narration } from './Narration'
import { StationIcon } from './Passport'
import { toAr } from './Quiz'

export const isStation = (s: string): s is StationId => (STATION_ORDER as string[]).includes(s)

/* ------------------------------------------------------- plaza mission */

export function PlazaMission() {
  const busy = useStore((s) => s.busy)
  const stamps = useStore((s) => s.stamps)
  const requestStation = useStore((s) => s.requestStation)
  const setPassportOpen = useStore((s) => s.setPassportOpen)
  const count = STATION_ORDER.filter((id) => stamps[id]).length
  const next = STATION_ORDER.find((id) => !stamps[id])
  const { collapsed, toggle } = useCollapsible()
  const step = next
    ? `الأختام ${toAr(count)}/${toAr(STATION_ORDER.length)} · التالية: ${STATIONS[next].short} (اتبعي السهم)`
    : 'جمعتِ الأختام الأربعة! 🏅 افتحي جوازكِ'
  return (
    <section className={'mission' + (busy ? ' is-hidden' : '') + (collapsed ? ' is-collapsed' : '')}>
      <div className="mission__bar" role="button" tabIndex={0} aria-expanded={!collapsed} onClick={toggle} onKeyDown={(e) => e.key === 'Enter' && toggle()}>
        <div>
          <span className="kicker">رحلة «{JOURNEY.title}»</span>
          <span className="mission__step">{step}</span>
        </div>
        <CollapseToggle collapsed={collapsed} />
      </div>
      <p>زوري المحطات الأربع بالترتيب الذي تحبينه، وفي كل محطة تحصلين على ختم في جوازكِ. ادخلي من أي مدخل في الساحة، أو اضغطي على اسم المحطة هنا 👇</p>
      <ul className="station-list">
        {STATION_ORDER.map((id) => (
          <li key={id}>
            <button className={stamps[id] ? 'is-done' : ''} style={{ ['--c' as string]: STATIONS[id].color }} onClick={() => requestStation(id)}>
              <svg viewBox="0 0 100 100" width="26" height="26" aria-hidden>
                <StationIcon id={id} color={stamps[id] ? '#3ad17e' : STATIONS[id].color} />
              </svg>
              <span>{STATIONS[id].short}</span>
              <b>{stamps[id] ? '✓' : '›'}</b>
            </button>
          </li>
        ))}
      </ul>
      <div className="mission__actions">
        <button className="btn btn--ghost btn--sm" onClick={() => setPassportOpen(true)}>
          📘 جوازي ({toAr(count)}/{toAr(STATION_ORDER.length)})
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => requestStation('bonus')}>
          🏰 قلعة نزوى (إضافية)
        </button>
      </div>
    </section>
  )
}

/* ----------------------------------------------------- station mission */

export function StationMission({ id }: { id: StationId }) {
  const def = STATIONS[id]
  const busy = useStore((s) => s.busy)
  const pr = useStore((s) => s.progress[id])
  const stamped = useStore((s) => !!s.stamps[id])
  const setStationQuiz = useStore((s) => s.setStationQuiz)
  const setRiddleOpen = useStore((s) => s.setRiddleOpen)
  const goTo = useStore((s) => s.goTo)
  const seen = def.items.filter((it) => pr.seen.includes(it.key)).length
  const itemsDone = seen === def.items.length
  // the station template: اكتشفي ← المعلومات ← النشاط ← تحدي المستكشف
  const steps: { label: string; hint: string; done: boolean }[] = []
  if (def.riddle)
    steps.push({
      label: def.riddle.kicker,
      hint: `حلّي اللغز: «${def.riddle.question}» (اضغطي الزر بالأسفل)`,
      done: pr.riddle || stamped,
    })
  steps.push({
    label: `المعلومات المضيئة (${toAr(seen)}/${toAr(def.items.length)})`,
    hint: 'اتبعي السهم الذهبي، واقتربي من كل دائرة مضيئة لتظهر لكِ معلومة ✨',
    done: itemsDone,
  })
  steps.push({ label: `النشاط: ${def.activityTitle}`, hint: def.activityHint, done: pr.activity })
  steps.push({ label: 'تحدي المستكشف 🗝️ ثم الختم', hint: 'اضغطي «ابدئي تحدي المستكشف» ⭐', done: pr.quizDone || stamped })
  const nowIdx = steps.findIndex((st) => !st.done)
  const now = nowIdx < 0 ? steps.length : nowIdx
  const ready = steps.slice(0, -1).every((st) => st.done)
  const riddlePending = !!def.riddle && !pr.riddle && !stamped
  const { collapsed, toggle } = useCollapsible((ready && !stamped) || riddlePending)
  const step =
    now < steps.length ? `${toAr(now + 1)}/${toAr(steps.length)} · ${steps[now].label}` : '✓ أنهيتِ المحطة، عودي إلى الساحة'
  return (
    <section
      className={'mission mission--station' + (busy ? ' is-hidden' : '') + (collapsed ? ' is-collapsed' : '')}
      style={{ ['--c' as string]: def.color }}
    >
      <div className="mission__bar" role="button" tabIndex={0} aria-expanded={!collapsed} onClick={toggle} onKeyDown={(e) => e.key === 'Enter' && toggle()}>
        <div className="mission__head">
          <svg viewBox="0 0 100 100" width="40" height="40" aria-hidden>
            <StationIcon id={id} color={def.color} />
          </svg>
          <div>
            <span className="kicker">محطة · {def.subtitle}</span>
            <h3>{def.short}</h3>
            <span className="mission__step">{step}</span>
          </div>
        </div>
        <CollapseToggle collapsed={collapsed} />
      </div>
      <ul className="checks">
        {steps.map((st, k) => (
          <li key={k} className={st.done ? 'done' : k === now ? 'is-now' : ''}>
            {toAr(k + 1)}. {st.label}
            {k === now && <small>{st.hint}</small>}
          </li>
        ))}
      </ul>
      <div className="mission__actions">
        {riddlePending ? (
          <button className="btn btn--primary btn--sm" onClick={() => setRiddleOpen(id)}>
            🔍 حلّي اللغز
          </button>
        ) : !stamped ? (
          <button className="btn btn--primary btn--sm" disabled={!ready} onClick={() => setStationQuiz(id)}>
            {ready ? 'ابدئي تحدي المستكشف 🗝️' : '🔒 تحدي المستكشف'}
          </button>
        ) : (
          <span className="stamp-ok">✓ حصلتِ على ختم المحطة</span>
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => goTo('plaza', id)}>
          ↩ الساحة
        </button>
      </div>
      {!ready && !stamped && !riddlePending && <small className="mission__lock">🔒 يُفتح التحدي بعد إكمال الخطوات السابقة</small>}
    </section>
  )
}

/* ------------------------------------------------------------ info card */

export function StationInfo() {
  const info = useStore((s) => s.info)
  const busy = useStore((s) => s.busy)
  const setInfo = useStore((s) => s.setInfo)
  if (!info || busy) return null
  const def = STATIONS[info.station]
  const it = def.items.find((x) => x.key === info.key) ?? def.extras?.find((x) => x.key === info.key)
  if (!it) return null
  return (
    <aside className="info info--station" key={info.key} style={{ ['--c' as string]: def.color }}>
      <button className="info__close" onClick={() => setInfo(null)} aria-label="إغلاق">
        ✕
      </button>
      <span className="kicker">
        {info.key.startsWith('art_') ? '🏺 اكتشاف أثري' : info.key.startsWith('scroll_') ? '📜 مخطوطة جديدة' : '✨ معلومة جديدة'}
      </span>
      <h3 className="info__title">
        <span className="info__icon">{it.icon}</span> {it.title}
      </h3>
      <p className="info__text">{it.text}</p>
      {it.note && <p className="info__note">{it.note}</p>}
      {it.ref && <p className="info__ref">📚 {it.ref}</p>}
      <Narration src={it.audio} />
    </aside>
  )
}

/* ---------------------------------------------------------------- toast */

export function Toast() {
  const toast = useStore((s) => s.toast)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 5200)
    return () => clearTimeout(t)
  }, [toast])
  if (!toast || !visible) return null
  return (
    <div className="toast" key={toast.t} onClick={() => setVisible(false)}>
      {toast.text}
    </div>
  )
}

/* ------------------------------------------------------- piece names */

function NameGame({ pieceKey }: { pieceKey: string }) {
  const setActivity = useStore((s) => s.setActivity)
  const markSeen = useStore((s) => s.markSeen)
  const piece = PIECES.find((p) => p.key === pieceKey)!
  const options = useMemo(() => {
    const others = PIECES.filter((p) => p.key !== pieceKey).sort(() => Math.random() - 0.5).slice(0, 2)
    return [piece, ...others].sort(() => Math.random() - 0.5)
  }, [pieceKey, piece])
  const [wrong, setWrong] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  return (
    <div className="modal modal--quiz" role="dialog" aria-modal aria-label="ما اسم القطعة؟">
      <div className={'quiz' + (ok ? ' is-correct' : wrong ? ' is-wrong' : '')} key={wrong ?? 'q'}>
        <p className="quiz__kicker">خزانة الأزياء العُمانية 👘</p>
        <h2 className="quiz__text">ما اسم هذه القطعة؟</h2>
        <p className="muted-dark">تلميح: {piece.hint}</p>
        {!ok ? (
          <div className="quiz__choices quiz__choices--3">
            {options.map((o) => (
              <button
                key={o.key}
                className="choice choice--name"
                onClick={() => {
                  if (o.key === pieceKey) {
                    sfx.correct()
                    setOk(true)
                    markSeen('clothing', 'piece_' + pieceKey)
                  } else {
                    sfx.wrong()
                    setWrong(o.key)
                  }
                }}
              >
                {o.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="quiz__result">
            <div className="quiz__verdict">صحيح! هذه «{piece.name}» ✓</div>
            <button className="btn btn--primary btn--xl" autoFocus onClick={() => setActivity(null)}>
              متابعة
            </button>
          </div>
        )}
        {!ok && (
          <button className="quiz__later" onClick={() => setActivity(null)}>
            لاحقاً
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ wardrobe */

const OUTFITS = [
  { key: 'emerald', name: 'الزمرّدي', dress: '#0e7a55', scarf: '#c0294a' },
  { key: 'ruby', name: 'الياقوتي', dress: '#b3364f', scarf: '#d9a43a' },
  { key: 'turquoise', name: 'الفيروزي', dress: '#178fa6', scarf: '#c0294a' },
  { key: 'violet', name: 'البنفسجي', dress: '#7b3fa3', scarf: '#d85a8a' },
]

function Wardrobe() {
  const setActivity = useStore((s) => s.setActivity)
  const outfit = useStore((s) => s.outfit)
  const setOutfit = useStore((s) => s.setOutfit)
  return (
    <div className="modal" role="dialog" aria-modal aria-label="خزانة مريم">
      <div className="modal__box wardrobe">
        <div className="modal__head">
          <div>
            <span className="kicker">المرآة 🪞</span>
            <h3>خزانة مريم</h3>
          </div>
          <button className="icon-btn" onClick={() => setActivity(null)} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <p className="muted">اختاري لون ثوب مريم ولحافها، وسترين التغيير عليها مباشرة.</p>
        <div className="outfits">
          {OUTFITS.map((o) => (
            <button key={o.key} className={'outfit' + (outfit === o.key ? ' is-active' : '')} onClick={() => (setOutfit(o.key), sfx.click())}>
              <span className="outfit__swatch" style={{ background: `linear-gradient(135deg, ${o.scarf} 0 35%, ${o.dress} 35%)` }} />
              {o.name}
            </button>
          ))}
        </div>
        <button className="btn btn--primary" onClick={() => setActivity(null)}>
          تم ✓
        </button>
      </div>
    </div>
  )
}

export function ActivityModals() {
  const activity = useStore((s) => s.activity)
  if (!activity) return null
  if (activity === 'trade') return <IvoryRoute />
  if (activity === 'wardrobe') return <Wardrobe />
  if (activity.startsWith('piece:')) return <NameGame pieceKey={activity.slice(6)} />
  return null
}
