import { useEffect, useMemo, useState } from 'react'
import { sfx } from '../game/sfx'
import { JOURNEY, STATION_ORDER, STATIONS, type StationId } from '../stations'
import { useStore } from '../store'
import { PIECES } from '../three/Activities'
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
  return (
    <section className={'mission' + (busy ? ' is-hidden' : '')}>
      <span className="kicker">رحلة «{JOURNEY.title}»</span>
      <p>زُر المحطات الخمس، أنجز أنشطتها، واجمع أختام جوازك. ادخل من أي مدخل أو اضغط على اسم المحطة.</p>
      <ul className="station-list">
        {STATION_ORDER.map((id) => (
          <li key={id}>
            <button className={stamps[id] ? 'is-done' : ''} style={{ ['--c' as string]: STATIONS[id].color }} onClick={() => requestStation(id)}>
              <svg viewBox="0 0 100 100" width="26" height="26" aria-hidden>
                <StationIcon id={id} color={stamps[id] ? '#3ad17e' : STATIONS[id].color} />
              </svg>
              <span>{STATIONS[id].title}</span>
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
  const goTo = useStore((s) => s.goTo)
  const seen = def.items.filter((it) => pr.seen.includes(it.key)).length
  const itemsDone = seen === def.items.length
  const ready = itemsDone && pr.activity
  return (
    <section className={'mission mission--station' + (busy ? ' is-hidden' : '')} style={{ ['--c' as string]: def.color }}>
      <div className="mission__head">
        <svg viewBox="0 0 100 100" width="40" height="40" aria-hidden>
          <StationIcon id={id} color={def.color} />
        </svg>
        <div>
          <span className="kicker">محطة · {def.subtitle}</span>
          <h3>{def.title}</h3>
        </div>
      </div>
      <ul className="checks">
        <li className={itemsDone ? 'done' : ''}>
          اكتشف المعلومات المضيئة ({toAr(seen)}/{toAr(def.items.length)})
        </li>
        <li className={pr.activity ? 'done' : ''}>
          نشاط: {def.activityTitle}
          {!pr.activity && <small>{def.activityHint}</small>}
        </li>
        <li className={pr.quizDone ? 'done' : ''}>تحدي المحطة ثم الختم 🏅</li>
      </ul>
      <div className="mission__actions">
        {!stamped ? (
          <button className="btn btn--primary btn--sm" disabled={!ready} onClick={() => setStationQuiz(id)} title={ready ? '' : 'أكمل المعلومات والنشاط أولاً'}>
            {ready ? 'ابدأ تحدي المحطة ⭐' : '🔒 تحدي المحطة'}
          </button>
        ) : (
          <span className="stamp-ok">✓ حصلت على ختم المحطة</span>
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => goTo('plaza', id)}>
          ↩ الساحة
        </button>
      </div>
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
      <span className="kicker">{info.key.startsWith('art_') ? '🏺 اكتشاف أثري' : '✨ معلومة جديدة'}</span>
      <h3 className="info__title">
        <span className="info__icon">{it.icon}</span> {it.title}
      </h3>
      <p className="info__text">{it.text}</p>
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

/* ------------------------------------------------------- station quiz */

export function StationQuiz() {
  const id = useStore((s) => s.stationQuiz)
  const close = useStore((s) => s.setStationQuiz)
  const finish = useStore((s) => s.finishQuiz)
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<boolean[]>([])
  useEffect(() => {
    setI(0)
    setAnswers([])
  }, [id])
  const def = id ? STATIONS[id] : null
  const q = def?.quiz[i]
  const a = answers[i]
  useEffect(() => {
    if (a === undefined || !q) return
    if (a === q.answer) sfx.correct()
    else sfx.wrong()
  }, [a, q])
  if (!def || !q || !id) return null
  const correct = answers.filter((x, k) => x === def.quiz[k].answer).length
  const last = i === def.quiz.length - 1
  const answered = a !== undefined
  const ok = answered && a === q.answer
  return (
    <div className="modal modal--quiz" role="dialog" aria-modal aria-label="تحدي المحطة">
      <div className={'quiz' + (answered ? (ok ? ' is-correct' : ' is-wrong') : '')}>
        <div className="quiz__head">
          <span className="quiz__badge" style={{ background: def.color }}>
            تحدي {def.title}
          </span>
          <span className="quiz__progress">
            {def.quiz.map((qq, k) => (
              <i key={k} className={answers[k] === undefined ? (k === i ? 'cur' : '') : answers[k] === qq.answer ? 'ok' : 'bad'} />
            ))}
          </span>
        </div>
        <p className="quiz__kicker">
          سؤال {toAr(i + 1)} من {toAr(def.quiz.length)} — صح أم خطأ؟
        </p>
        <h2 className="quiz__text">{q.text}</h2>
        {!answered ? (
          <div className="quiz__choices">
            <button className="choice choice--true" onClick={() => setAnswers((x) => Object.assign(x.slice(), { [i]: true }))}>
              <span className="choice__icon">✓</span>
              صح
            </button>
            <button className="choice choice--false" onClick={() => setAnswers((x) => Object.assign(x.slice(), { [i]: false }))}>
              <span className="choice__icon">✗</span>
              خطأ
            </button>
          </div>
        ) : (
          <div className="quiz__result">
            <div className="quiz__verdict">{ok ? 'أحسنت! 🌟' : `الإجابة الصحيحة: «${q.answer ? 'صح' : 'خطأ'}»`}</div>
            <p className="quiz__explain">
              <b>هل تعلم؟ </b>
              {q.explain}
            </p>
            <button
              className="btn btn--primary btn--xl"
              autoFocus
              onClick={() => {
                if (last) finish(id, correct)
                else setI(i + 1)
              }}
            >
              {last ? 'احصل على الختم 🏅' : 'السؤال التالي'}
            </button>
          </div>
        )}
        {!answered && (
          <button className="quiz__later" onClick={() => close(null)}>
            لاحقاً
          </button>
        )}
      </div>
    </div>
  )
}

/* --------------------------------------------------- trade route game */

const GOODS = [
  { key: 'frank', name: 'اللبان', icon: '✨', to: 'oman' },
  { key: 'dates', name: 'التمور', icon: '🌴', to: 'oman' },
  { key: 'cloves', name: 'القرنفل', icon: '🌿', to: 'zanzibar' },
  { key: 'ivory', name: 'العاج', icon: '🐘', to: 'zanzibar' },
  { key: 'spices', name: 'التوابل', icon: '🌶️', to: 'india' },
  { key: 'cloth', name: 'الأقمشة القطنية', icon: '🧵', to: 'india' },
]
const PORTS = [
  { key: 'oman', name: 'عُمان', x: 520, y: 150 },
  { key: 'zanzibar', name: 'زنجبار (شرق أفريقيا)', x: 230, y: 470 },
  { key: 'india', name: 'الهند', x: 760, y: 300 },
]

function TradeGame() {
  const setActivity = useStore((s) => s.setActivity)
  const done = useStore((s) => s.progress.ivory.activity)
  const [placed, setPlaced] = useState<Record<string, string>>({})
  const [sel, setSel] = useState<string | null>(null)
  const [msg, setMsg] = useState('اختر سلعة ثم اضغط على المكان الذي جاءت منه.')
  const all = GOODS.every((g) => placed[g.key])
  const drop = (port: string) => {
    if (!sel) return setMsg('اختر سلعة أولاً 👇')
    const g = GOODS.find((x) => x.key === sel)!
    if (g.to === port) {
      sfx.correct()
      setPlaced((p) => ({ ...p, [g.key]: port }))
      setSel(null)
      setMsg(`صحيح! ${g.name} ✓`)
    } else {
      sfx.wrong()
      setMsg(`ليس هنا… فكّر من أين يأتي «${g.name}» 🤔`)
    }
  }
  useEffect(() => {
    if (all && !done) {
      useStore.getState().setActivityDone('ivory')
      setMsg('أحسنت! هكذا ربطت التجارة البحرية بين عُمان وشرق أفريقيا والهند 🌊')
    }
  }, [all, done])
  return (
    <div className="modal" role="dialog" aria-modal aria-label="طريق السلع">
      <div className="modal__box game">
        <div className="modal__head">
          <div>
            <span className="kicker">نشاط</span>
            <h3>طريق السلع 🗺️</h3>
          </div>
          <button className="icon-btn" onClick={() => setActivity(null)} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <div className="trade">
          <svg viewBox="0 0 1000 620" className="trade__map">
            <rect width="1000" height="620" rx="24" fill="#e9d6ae" />
            <rect width="1000" height="620" rx="24" fill="#4a8aa0" opacity="0.25" />
            <path d="M180 0 L620 0 L600 70 L550 110 L500 170 L440 210 L360 230 L270 210 L200 160 L160 80 Z" fill="#ead7ab" stroke="#8a6a3c" strokeWidth="4" />
            <path d="M0 190 L100 210 L200 270 L260 290 L220 380 L180 470 L120 570 L80 620 L0 620 Z" fill="#ead7ab" stroke="#8a6a3c" strokeWidth="4" />
            <path d="M660 0 L1000 0 L1000 160 L900 190 L820 350 L780 400 L740 320 L700 200 L660 130 Z" fill="#ead7ab" stroke="#8a6a3c" strokeWidth="4" />
            <path d="M520 150 Q420 360 230 470 M520 150 Q650 160 760 300" stroke="#7a1f1f" strokeWidth="5" strokeDasharray="16 12" fill="none" />
            <text x="600" y="300" fontSize="26" fill="#2c5568" textAnchor="middle" fontFamily="Tajawal">بحر العرب</text>
            <text x="520" y="540" fontSize="26" fill="#2c5568" textAnchor="middle" fontFamily="Tajawal">المحيط الهندي</text>
            {PORTS.map((p) => {
              const here = GOODS.filter((g) => placed[g.key] === p.key)
              return (
                <g key={p.key} className={'trade__port' + (sel ? ' is-target' : '')} onClick={() => drop(p.key)}>
                  <circle cx={p.x} cy={p.y} r="70" fill="#7a1f1f" opacity="0.14" />
                  <circle cx={p.x} cy={p.y} r="18" fill="#7a1f1f" />
                  <text x={p.x} y={p.y - 32} textAnchor="middle" fontSize="28" fontWeight="800" fill="#3a2412" fontFamily="'Reem Kufi', Tajawal">
                    {p.name}
                  </text>
                  {here.map((g, k) => (
                    <text key={g.key} x={p.x - 30 + k * 60} y={p.y + 58} textAnchor="middle" fontSize="38">
                      {g.icon}
                    </text>
                  ))}
                </g>
              )
            })}
          </svg>
          <div className="trade__goods">
            {GOODS.map((g) => (
              <button
                key={g.key}
                disabled={!!placed[g.key]}
                className={'good' + (sel === g.key ? ' is-sel' : '') + (placed[g.key] ? ' is-placed' : '')}
                onClick={() => (setSel(g.key), sfx.click())}
              >
                <span>{g.icon}</span>
                {g.name}
              </button>
            ))}
          </div>
          <p className="trade__msg">{msg}</p>
          {all && (
            <button className="btn btn--primary" onClick={() => setActivity(null)}>
              متابعة ✓
            </button>
          )}
        </div>
      </div>
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
        <p className="muted">اختر لون ثوب مريم ولحافها، وسترى التغيير عليها مباشرة.</p>
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
  if (activity === 'trade') return <TradeGame />
  if (activity === 'wardrobe') return <Wardrobe />
  if (activity.startsWith('piece:')) return <NameGame pieceKey={activity.slice(6)} />
  return null
}
