// واجهة المحطة الرابعة «كنوز البحر العُماني» فوق three/ReefScene.tsx:
// ثلاثة كنوز (بطاقات المعلمة مع الصوت) ← «مهمة إنقاذ كنوز البحر» بثلاث مهام بالترتيب ← ختم السلحفاة ← العودة إلى الساحة.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { asset } from '../content'
import { sfx } from '../game/sfx'
import { STATIONS, type ChallengeStep } from '../stations'
import { useStore } from '../store'
import { stopNarration } from './Narration'
import { toAr } from './Quiz'
import { AudioBar } from './ShipStation'

const DEF = STATIONS.turtles
const STEPS = DEF.challenge as Extract<ChallengeStep, { kind: 'choice' }>[]
const img = (f: string) => asset('images/reef/' + f)

interface ReefState {
  openKey: string | null
  /** null: exploring; 'hub': the three shells; 0..2: a mission */
  quiz: null | 'hub' | number
  solved: number
  setOpen: (k: string | null) => void
}
export const useReef = create<ReefState>((set) => ({
  openKey: null,
  quiz: null,
  solved: 0,
  setOpen: (openKey) => set({ openKey }),
}))
const reset = () => useReef.setState({ openKey: null, quiz: null, solved: 0 })

/** clickable areas over the buttons painted on the teacher's artwork, in % of the 1280×720 image */
type Spot = [left: number, top: number, width: number, height: number]
const at = ([l, t, w, h]: Spot) => ({ left: l + '%', top: t + '%', width: w + '%', height: h + '%' })
const CARD_SPOTS: Record<string, { back: Spot; next: Spot }> = {
  turtle: { back: [1.7, 3.5, 19.5, 8.8], next: [76, 85.6, 21.8, 9.6] },
  pearl: { back: [2.3, 86.6, 21.4, 9], next: [76, 85.8, 21.8, 9.6] },
  fish: { back: [1.7, 87.2, 21.8, 9.2], next: [75.6, 86.6, 22.4, 9.6] },
}
const SHELLS: Spot[] = [
  [18.6, 47.6, 19.4, 31.6],
  [40.2, 47.6, 19.4, 31.6],
  [62.5, 47.6, 19.4, 31.6],
]
const HUB_BACK: Spot = [2.7, 87.6, 21, 8.6]
const HUB_TICKS = [32, 40.3, 48]

const ORDINAL = ['الأولى', 'الثانية', 'الثالثة']
const ICONS = ['🐢', '🦪', '🐠']
const IDEAS = [
  'أيتها المستكشفة، أثناء رحلتكِ في أعماق البحر العُماني، شاهدتِ سلحفاة بحرية عالقة في شباك الصيد وتحتاج إلى مساعدتكِ! لكي تتمكني من إنقاذها، أجيبي عن السؤال التالي إجابة صحيحة.',
  'بعد نجاحكِ في إنقاذ السلحفاة، حان وقت الغوص لاكتشاف أحد كنوز البحر العُماني الثمينة! أمامكِ ثلاث محارات، فاكتشفي السر الذي يساعد المحار على تكوين اللؤلؤة الجميلة.',
  'وصلتِ إلى المهمة الأخيرة! تختبئ بين الشعاب المرجانية أسرار مذهلة عن الأسماك البحرية، فاكتشفي المكان الذي تعيش فيه أسماك شقائق النعمان.',
]
const WRONG = [
  'حاولي مجددًا! السلحفاة ما زالت تنتظر مساعدتكِ',
  'أوه! لم تكتشفي سر اللؤلؤة بعد! حاولي مرة أخرى',
  'أوه! ما زال أحد أسرار الأعماق ينتظر اكتشافكِ! حاولي مرة أخرى',
]
const EXPLAIN = [
  '',
  'اللؤلؤة طبقات من عرق اللؤلؤ يفرزها المحار حول جسم غريب أو مهيّج.',
  'تعيش أسماك شقائق النعمان بين أذرع شقائق النعمان البحرية، في علاقة تكافلية توفر لها الحماية.',
]

/** three oysters drawn for mission 2: 0 pearl (nacre), 1 soft body, 2 a grain of sand */
function Oyster({ inside }: { inside: number }) {
  return (
    <svg viewBox="0 0 200 150" className="reef-opt__svg" aria-hidden>
      <defs>
        <radialGradient id={'nacre' + inside} cx="0.5" cy="0.4">
          <stop offset="0" stopColor="#fbf6f0" />
          <stop offset="0.7" stopColor="#d8c8d8" />
          <stop offset="1" stopColor="#8f7a86" />
        </radialGradient>
        <radialGradient id={'pearl' + inside} cx="0.35" cy="0.3">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#f1dfe6" />
          <stop offset="1" stopColor="#b7a3b2" />
        </radialGradient>
      </defs>
      <rect width="200" height="150" fill="#d8bf8f" />
      <path d="M0 128 Q50 118 100 126 T200 122 V150 H0Z" fill="#c9a874" />
      {/* upper valve, open */}
      <path d="M30 70 Q40 12 100 10 Q160 12 172 70 Q100 56 30 70Z" fill="#5b4334" />
      <path d="M40 66 Q50 24 100 22 Q150 24 162 66 Q100 54 40 66Z" fill={`url(#nacre${inside})`} opacity="0.9" />
      {/* lower valve */}
      <path d="M22 84 Q100 66 180 84 Q170 132 100 136 Q30 132 22 84Z" fill="#4a3628" />
      <path d="M34 86 Q100 72 168 86 Q160 122 100 126 Q40 122 34 86Z" fill={`url(#nacre${inside})`} />
      {[44, 70, 100, 130, 156].map((x) => (
        <path key={x} d={`M${x} 128 Q${x + (100 - x) * 0.2} 110 100 92`} stroke="#6b5040" strokeWidth="1.5" fill="none" opacity="0.5" />
      ))}
      {inside === 0 && (
        <>
          <circle cx="100" cy="98" r="22" fill={`url(#pearl${inside})`} />
          <circle cx="92" cy="90" r="6" fill="#fff" opacity="0.85" />
        </>
      )}
      {inside === 1 && <path d="M66 100 Q70 84 92 88 Q104 78 120 88 Q140 86 136 102 Q128 116 100 114 Q72 116 66 100Z" fill="#efe1c8" stroke="#cdb48f" strokeWidth="2" />}
      {inside === 2 && (
        <>
          <circle cx="100" cy="100" r="7" fill="#c9a46a" stroke="#9c7a45" strokeWidth="1.5" />
          <circle cx="98" cy="98" r="1.5" fill="#f5e3bf" />
        </>
      )}
    </svg>
  )
}

const OPTION_ART: (string | number)[][] = [
  ['opt-leather.jpg', 'opt-green.jpg', 'opt-hawksbill.jpg'],
  [0, 1, 2],
  ['opt-deep.jpg', 'opt-sand.jpg', 'opt-anemone.jpg'],
]

function Treasure({ itemKey }: { itemKey: string }) {
  const i = DEF.items.findIndex((x) => x.key === itemKey)
  const it = DEF.items[i]
  const seen = useStore((s) => s.progress.turtles.seen.includes(itemKey))
  const close = () => useReef.getState().setOpen(null)
  const done = () => {
    const st = useStore.getState()
    if (st.progress.turtles.seen.includes(it.key)) return
    st.markSeen('turtles', it.key)
    sfx.ding()
    const n = useStore.getState().progress.turtles.seen.length
    st.showToast(n >= DEF.items.length ? 'أحسنتِ! اكتشفتِ الكنوز الثلاثة، والتحدي بانتظاركِ 🦪' : `أحسنتِ! اكتشفتِ كنز «${it.title}» ✓`)
  }
  useEffect(() => {
    stopNarration()
    // until the teacher's recording arrives, opening the card is enough
    if (!it.audio) done()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey])
  const toMission = () => {
    const st = useStore.getState()
    const n = DEF.items.filter((x) => st.progress.turtles.seen.includes(x.key)).length
    if (n < DEF.items.length) {
      close()
      st.showToast(`اكتشفي الكنوز الثلاثة أولًا (${toAr(n)} من ${toAr(DEF.items.length)}) 🐢🦪🐠`)
      return
    }
    useReef.setState({ openKey: null, quiz: 'hub' })
  }
  const spots = CARD_SPOTS[it.key]
  // portal: above the fixed HUD (passport button, top bar)
  return createPortal(
    <div className="modal" onClick={close} role="dialog" aria-modal aria-label={it.title}>
      <div className="reef-card" onClick={(e) => e.stopPropagation()}>
        <div className="reef-art">
          <img src={it.image} alt={`الكنز ${ORDINAL[i]}: ${it.title}`} />
          <button className="reef-spot" style={at(spots.back)} onClick={close} aria-label="العودة إلى الساحة" />
          <button className="reef-spot" style={at(spots.next)} onClick={toMission} aria-label="انتقلي إلى المهمة" />
        </div>
        <div className="reef-card__bar">
          {it.audio ? <AudioBar src={it.audio} onEnded={done} /> : <span className="nav-scroll__hint">🔊 الصوت يُضاف قريبًا</span>}
          {it.audio && !seen && <span className="nav-scroll__hint">استمعي حتى النهاية ليُحتسب الكنز ✓</span>}
          <button className="btn btn--primary btn--sm" onClick={close}>
            تم
          </button>
        </div>
        <button className="icon-btn reef-card__x" onClick={close} aria-label="إغلاق">
          ✕
        </button>
      </div>
    </div>,
    document.body,
  )
}

function Hub() {
  const solved = useReef((s) => s.solved)
  const open = (k: number) => {
    if (k < solved) return sfx.click()
    if (k > solved) return useStore.getState().showToast(`ابدئي بالمهمة ${ORDINAL[solved]} ${ICONS[solved]}`)
    sfx.click()
    useReef.setState({ quiz: k })
  }
  // portal: above the fixed HUD (passport button, top bar)
  return createPortal(
    <div className="modal" role="dialog" aria-modal aria-label="مهمة إنقاذ كنوز البحر">
      <div className="reef-card">
        <div className="reef-art">
          <img src={img('challenge.jpg')} alt="التحدي: مهمة إنقاذ كنوز البحر" />
          {SHELLS.map((sp, k) => (
            <button key={k} className={'reef-spot reef-shell' + (k < solved ? ' is-done' : k === solved ? ' is-next' : '')} style={at(sp)} onClick={() => open(k)} aria-label={`المهمة ${ORDINAL[k]}: ${STEPS[k].title}`}>
              {k < solved && <span className="reef-shell__pearl">✓</span>}
            </button>
          ))}
          {HUB_TICKS.map((top, k) => k < solved && <span key={k} className="reef-tick" style={{ left: '79.6%', top: top + '%' }}>✓</span>)}
          <button className="reef-spot" style={at(HUB_BACK)} onClick={() => useReef.setState({ quiz: null })} aria-label="العودة إلى المهمة" />
        </div>
        <div className="reef-card__bar">
          <span className="nav-scroll__hint">
            اضغطي على المحارة {ORDINAL[Math.min(solved, 2)]} لتبدئي المهمة · جمعتِ {toAr(solved)} من {toAr(STEPS.length)} لآلئ
          </span>
        </div>
        <button className="icon-btn reef-card__x" onClick={() => useReef.setState({ quiz: null })} aria-label="إغلاق">
          ✕
        </button>
      </div>
    </div>,
    document.body,
  )
}

function Mission({ k }: { k: number }) {
  const step = STEPS[k]
  const last = k === STEPS.length - 1
  const finish = useStore((s) => s.finishQuiz)
  const [wrong, setWrong] = useState<number | null>(null)
  const [ok, setOk] = useState(false)
  const firstTry = useRef(true)
  const pick = (i: number) => {
    if (ok) return
    if (i === step.answer) {
      sfx.correct()
      setWrong(null)
      setOk(true)
    } else {
      sfx.wrong()
      firstTry.current = false
      setWrong(i)
    }
  }
  const next = () => {
    useReef.setState({ solved: k + 1, quiz: last ? null : k + 1 })
    if (!last) return
    sfx.win()
    if (useStore.getState().stamps.turtles) useStore.setState({ stampAward: 'turtles' })
    else finish('turtles', STEPS.length)
  }
  // portal: above the fixed HUD (passport button, top bar)
  return createPortal(
    <div className="modal" role="dialog" aria-modal aria-label={`المهمة ${ORDINAL[k]}: ${step.title}`}>
      <div className="reef-q" style={{ ['--bg' as string]: `url(${img('challenge.jpg')})` }}>
        <button className="reef-q__back" onClick={() => useReef.setState({ quiz: 'hub' })}>
          ← العودة إلى المهمة
        </button>
        <header className="reef-q__sign">
          <span>المهمة {ORDINAL[k]}</span>
          <h3>{step.title}</h3>
        </header>
        <p className="reef-q__idea">{IDEAS[k]}</p>
        <h2 className="reef-q__prompt">{step.prompt}</h2>
        <div className="reef-q__opts">
          {step.options.map((o, i) => {
            const art = OPTION_ART[k][i]
            return (
              <button
                key={o}
                className={'reef-opt' + (ok && i === step.answer ? ' is-right' : '') + (wrong === i ? ' is-wrong' : '')}
                onClick={() => pick(i)}
                disabled={ok}
              >
                {typeof art === 'number' ? <Oyster inside={art} /> : <img src={img(art)} alt="" className={k === 0 ? 'is-round' : ''} />}
                <b>{o}</b>
              </button>
            )
          })}
        </div>
        {step.ref && <p className="info__ref">📚 {step.ref}</p>}
        {(ok || wrong !== null) && (
          <div className="reef-q__verdict">
            <div className={'reef-q__msg' + (ok ? ' is-ok' : ' is-bad')}>
              <p>{ok ? step.success : WRONG[k]}</p>
              {ok && EXPLAIN[k] && <small>{EXPLAIN[k]}</small>}
              {ok ? (
                <button className="btn btn--primary btn--xl" autoFocus onClick={next}>
                  {last ? 'احصلي على الختم 🐢' : 'انتقلي إلى المهمة التالية ←'}
                </button>
              ) : (
                <button className="btn btn--ghost" autoFocus onClick={() => setWrong(null)}>
                  العودة إلى المهمة
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function ReefStation() {
  const { openKey, quiz, setOpen } = useReef()
  const seen = useStore((s) => s.progress.turtles.seen)
  const stamped = useStore((s) => !!s.stamps.turtles)
  const goTo = useStore((s) => s.goTo)
  const found = DEF.items.filter((it) => seen.includes(it.key)).length
  const allFound = found === DEF.items.length
  useEffect(() => {
    reset()
    return reset
  }, [])
  return (
    <div className="nav-room">
      {quiz === null && (
        <div className="nav-room__bar">
          <div className="nav-room__chips">
            {DEF.items.map((it, i) => (
              <button key={it.key} className={'nav-tag' + (seen.includes(it.key) ? ' is-done' : '')} onClick={() => setOpen(it.key)}>
                <span className="nav-tag__n">{toAr(i + 1)}</span>
                <span className="nav-tag__t">
                  {it.icon} {it.title}
                </span>
                {seen.includes(it.key) && <span className="nav-tag__ck">✓</span>}
              </button>
            ))}
          </div>
          <div className="nav-room__row">
            <span className="nav-room__hint">
              {stamped
                ? '✓ حصلتِ على ختم «كنوز البحر العُماني» 🐢'
                : allFound
                  ? 'مهمة إنقاذ كنوز البحر بانتظاركِ 🦪'
                  : `اضغطي على السلحفاة والمحارة والسمكة · اكتشفتِ ${toAr(found)} من ${toAr(DEF.items.length)}`}
            </span>
            {allFound && (
              <button
                className={'btn ' + (stamped ? 'btn--ghost' : 'btn--primary captain-btn')}
                onClick={() => useReef.setState({ quiz: 'hub', solved: 0 })}
              >
                التحدي: إنقاذ كنوز البحر 🐚
              </button>
            )}
            <button className={'btn btn--sm ' + (stamped ? 'btn--primary' : 'btn--ghost')} onClick={() => goTo('plaza', 'turtles')}>
              ↩ العودة إلى الساحة
            </button>
          </div>
        </div>
      )}
      {openKey && <Treasure itemKey={openKey} />}
      {quiz === 'hub' && <Hub />}
      {typeof quiz === 'number' && <Mission key={quiz} k={quiz} />}
    </div>
  )
}
