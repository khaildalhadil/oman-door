// المحطة الثالثة «سمهرم بوابة الحضارات»: نشرة «أصداء سمهرم» على شاشة التلفاز في الميناء،
// ثم «صندوق أسرار سمهرم» بجانب الحفريات (خريطة، جرة، مفتاح — سؤال لكل قطعة) ← الختم في الجواز.
// الأجسام ثلاثية الأبعاد في three/SumhuramPort.tsx
import { useEffect, useRef, useState } from 'react'
import { asset } from '../content'
import { sfx } from '../game/sfx'
import { STATIONS, type ChallengeStep } from '../stations'
import { useStore } from '../store'
import { ChoiceStep } from './Challenge'
import { stopNarration } from './Narration'
import { StationIcon } from './Passport'
import { toAr } from './Quiz'

const DEF = STATIONS.sumhuram
// left → right on the TV, as in the teacher's mockup (the button row is laid out ltr on purpose)
export const NEWS = [
  { key: 'news1', title: 'سمهرم... ميناء يربط عُمان بالعالم!' },
  { key: 'news2', title: 'اكتشفي موقع مدينة سمهرم!' },
  { key: 'news3', title: 'اللبان العُماني... كنز عبر البحار!' },
  { key: 'news4', title: 'اكتشاف أسرار خلف أسوار سمهرم!' },
  { key: 'closing', title: 'ختام الصحيفة' },
]
export const tvKey = (k: string) => 'tv_' + k
export const newsDone = (seen: string[]) => NEWS.every((n) => seen.includes(tvKey(n.key)))
/** the box shows up once the station's other steps (riddle, info points, dig, newscast) are done */
export const boxReady = (pr: { seen: string[]; riddle: boolean; activity: boolean }) =>
  pr.riddle && pr.activity && newsDone(pr.seen) && DEF.items.every((it) => pr.seen.includes(it.key))

const video = (k: string) => asset(`video/sumhuram/${k}.mp4`)
const poster = (k: string) => asset(`video/sumhuram/${k}-poster.jpg`)
const closeActivity = () => useStore.getState().setActivity(null)
const toPlaza = () => {
  closeActivity()
  useStore.getState().goTo('plaza', 'sumhuram')
}

export function SumhuramTV() {
  const seen = useStore((s) => s.progress.sumhuram.seen)
  const ready = useStore((s) => !!s.stamps.sumhuram || boxReady(s.progress.sumhuram))
  const [cur, setCur] = useState('welcome')
  useEffect(() => stopNarration(), [])
  const watched = NEWS.filter((n) => seen.includes(tvKey(n.key))).length
  const ended = () => {
    const it = NEWS.find((n) => n.key === cur)
    const st = useStore.getState()
    if (!it || st.progress.sumhuram.seen.includes(tvKey(cur))) return
    st.markSeen('sumhuram', tvKey(cur))
    sfx.ding()
    const pr = useStore.getState().progress.sumhuram
    st.showToast(
      !newsDone(pr.seen)
        ? `أحسنتِ! شاهدتِ «${it.title}» ✓`
        : boxReady(pr) || st.stamps.sumhuram
          ? 'أحسنتِ! شاهدتِ النشرة كاملة 📺 وظهر «صندوق أسرار سمهرم» بجانب الحفريات 🗝️'
          : 'أحسنتِ! شاهدتِ النشرة كاملة 📺 أكملي بقية مهام المحطة ليظهر صندوق الأسرار 🗝️',
    )
  }
  return (
    <div className="modal" onClick={closeActivity} role="dialog" aria-modal aria-label="أصداء سمهرم">
      <div className="tv" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn tv__x" onClick={closeActivity} aria-label="إغلاق">
          ✕
        </button>
        <header className="tv__plaque">
          <h3>أصداء سمهرم</h3>
          <span>نشرة إخبارية من قلب التاريخ</span>
        </header>
        <div className="tv__set">
          <div className="tv__screen">
            <video key={cur} src={video(cur)} poster={poster(cur)} controls autoPlay playsInline onEnded={ended} />
          </div>
          <div className="tv__side" aria-hidden>
            <i className="tv__knob" />
            <i className="tv__knob" />
            <span className="tv__grille" />
          </div>
        </div>
        <div className="tv__buttons" dir="ltr">
          {NEWS.map((n) => (
            <button
              key={n.key}
              dir="rtl"
              className={'tv__btn' + (cur === n.key ? ' is-on' : '') + (seen.includes(tvKey(n.key)) ? ' is-done' : '')}
              onClick={() => {
                sfx.click()
                setCur(n.key)
              }}
            >
              {seen.includes(tvKey(n.key)) && <b>✓ </b>}
              {n.title}
            </button>
          ))}
        </div>
        <div className="tv__foot">
          <span>
            {watched < NEWS.length
              ? `شاهدتِ ${toAr(watched)} من ${toAr(NEWS.length)} — شاهدي كل خبر حتى نهايته`
              : ready
                ? '✓ شاهدتِ النشرة كاملة — الصندوق الأثري ينتظركِ بجانب الحفريات 🗝️'
                : '✓ شاهدتِ النشرة كاملة — أكملي بقية مهام المحطة ليظهر صندوق الأسرار 🗝️'}
          </span>
          <button className="btn btn--ghost btn--sm" onClick={toPlaza}>
            ↩ العودة إلى ساحة المحطات
          </button>
        </div>
      </div>
    </div>
  )
}

const ARTS = [
  { icon: '🗺️', name: 'خريطة' },
  { icon: '🏺', name: 'جرة لبان' },
  { icon: '🗝️', name: 'مفتاح' },
]
const WIN = 'أحسنتِ أيتها المستكشفة! لقد كشفتِ أسرار سمهرم، واستحققتِ ختم بوابة الحضارات!'

function GoldPiece() {
  return (
    <svg viewBox="-100 -100 200 200" className="relic__seal" aria-label="ختم سمهرم بوابة الحضارات">
      <defs>
        <radialGradient id="relicGold" cx="0.4" cy="0.35">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.55" stopColor="#e3b44a" />
          <stop offset="1" stopColor="#a8741c" />
        </radialGradient>
      </defs>
      <circle r="94" fill="url(#relicGold)" stroke="#8a5d14" strokeWidth="5" />
      <circle r="80" fill="none" stroke="#8a5d14" strokeWidth="2" strokeDasharray="3 5" />
      <g transform="translate(-30 -70) scale(0.6)">
        <StationIcon id="sumhuram" color="#6b3f0c" />
      </g>
      <text y="22" textAnchor="middle" fontSize="26" fontWeight="800" fill="#5a3208" fontFamily="'Reem Kufi', Tajawal, sans-serif">
        سمهرم
      </text>
      <text y="52" textAnchor="middle" fontSize="20" fontWeight="700" fill="#5a3208" fontFamily="'Reem Kufi', Tajawal, sans-serif">
        بوابة الحضارات
      </text>
    </svg>
  )
}

export function SumhuramBox() {
  const steps = DEF.challenge as Extract<ChallengeStep, { kind: 'choice' }>[]
  const finish = useStore((s) => s.finishQuiz)
  const [solved, setSolved] = useState<number[]>([])
  const [open, setOpen] = useState<number | null>(null)
  const score = useRef(0)
  const awarded = useRef(false)
  const won = solved.length === steps.length
  const award = () => {
    if (awarded.current) return
    awarded.current = true
    // a replay (stamp already earned) shows the passport again without a second stamp
    if (useStore.getState().stamps.sumhuram) useStore.setState({ stampAward: 'sumhuram' })
    else finish('sumhuram', score.current)
  }
  useEffect(() => {
    if (!won) return
    sfx.win()
    const t = setTimeout(award, 2600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won])
  const step = open === null ? null : steps[open]
  return (
    <div className="modal" role="dialog" aria-modal aria-label="صندوق أسرار سمهرم">
      <div className="modal__box relic" style={{ ['--c' as string]: DEF.color }}>
        <div className="modal__head">
          <div>
            <span className="kicker">التحدي الأخير · {DEF.short}</span>
            <h3>صندوق أسرار سمهرم 🗝️</h3>
          </div>
          {!won && (
            <button className="icon-btn" onClick={closeActivity} aria-label="إغلاق">
              ✕
            </button>
          )}
        </div>
        {won ? (
          <div className="relic__win">
            <GoldPiece />
            <p className="treasure__msg">{WIN}</p>
            <div className="relic__actions">
              <button className="btn btn--primary" onClick={award}>
                افتحي جوازكِ 📘
              </button>
              <button className="btn btn--ghost" onClick={toPlaza}>
                ↩ العودة إلى ساحة المحطات
              </button>
            </div>
          </div>
        ) : step && open !== null ? (
          <div key={open} className="relic__q">
            <h3 className="treasure__title">
              {ARTS[open].icon} {step.title}
            </h3>
            <ChoiceStep
              step={step}
              onDone={(first) => {
                score.current += first ? 1 : 0
                setSolved((s) => [...s, open])
                setOpen(null)
              }}
            />
            {step.ref && <p className="info__ref">📚 {step.ref}</p>}
            <button className="quiz__later" onClick={() => setOpen(null)}>
              رجوع إلى الصندوق
            </button>
          </div>
        ) : (
          <>
            <p className="relic__lead">قبل مغادرة سمهرم… هل تستطيعين اكتشاف الكنز الذي تركه التاريخ؟</p>
            <p className="nav-scroll__hint">اضغطي على كل قطعة أثرية لتكشفي سرّها 👇</p>
            <div className="relic__arts">
              {ARTS.map((a, i) => (
                <button
                  key={i}
                  className={'relic__art' + (solved.includes(i) ? ' is-glow' : '')}
                  disabled={solved.includes(i)}
                  onClick={() => {
                    sfx.click()
                    setOpen(i)
                  }}
                >
                  <span className="relic__icon">{a.icon}</span>
                  <b>{steps[i].title}</b>
                  <small>{solved.includes(i) ? '✓ كُشف السر' : a.name}</small>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
