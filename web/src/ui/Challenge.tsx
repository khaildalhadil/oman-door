import { useEffect, useMemo, useState } from 'react'
import { sfx } from '../game/sfx'
import { STATIONS, type ChallengeStep, type StationId, type TFQuestion } from '../stations'
import { useStore } from '../store'
import { Narration } from './Narration'
import { StationIcon } from './Passport'
import { toAr } from './Quiz'

/** shuffle that never returns the original order (so ordering puzzles are never pre-solved) */
function shuffled<T>(xs: T[]): T[] {
  if (xs.length < 2) return xs.slice()
  for (let k = 0; k < 20; k++) {
    const a = xs.slice().sort(() => Math.random() - 0.5)
    if (a.some((x, i) => x !== xs[i])) return a
  }
  return xs.slice().reverse()
}

/* =============================================================== riddle */

/** «اكتشفي الشخصية / المكان / الكائن» — opens when the student arrives at a station */
export function StationRiddle() {
  const id = useStore((s) => s.riddleOpen)
  const close = useStore((s) => s.setRiddleOpen)
  const solve = useStore((s) => s.solveRiddle)
  const [wrong, setWrong] = useState<number[]>([])
  const [solved, setSolved] = useState(false)
  useEffect(() => {
    setWrong([])
    setSolved(false)
  }, [id])
  const def = id ? STATIONS[id] : null
  const r = def?.riddle
  if (!id || !def || !r) return null
  const pick = (i: number) => {
    if (solved || wrong.includes(i)) return
    if (i === r.answer) {
      sfx.correct()
      setSolved(true)
      solve(id)
    } else {
      sfx.wrong()
      setWrong((w) => [...w, i])
    }
  }
  const start = () => {
    close(null)
    useStore.getState().showToast(def.intro)
  }
  return (
    <div className="modal modal--quiz" role="dialog" aria-modal aria-label={r.kicker}>
      <div className={'quiz riddle' + (solved ? ' is-correct' : '')} style={{ ['--c' as string]: def.color }}>
        <span className="quiz__badge" style={{ background: def.color }}>
          {r.kicker}
        </span>
        {!solved ? (
          <>
            <Narration src={def.introAudio} label="استمعي للمقدمة" />
            <p className="riddle__text">{r.text}</p>
            <h2 className="quiz__text">{r.question}</h2>
            <div className="quiz__choices quiz__choices--3">
              {r.options.map((o, i) => (
                <button
                  key={o}
                  className={'choice choice--name' + (wrong.includes(i) ? ' is-wrong' : '')}
                  disabled={wrong.includes(i)}
                  onClick={() => pick(i)}
                >
                  {o}
                </button>
              ))}
            </div>
            {wrong.length > 0 && <p className="challenge__msg is-bad">ليست هذه… اقرئي اللغز مرة أخرى 🤔</p>}
            <button className="quiz__later" onClick={() => close(null)}>
              لاحقاً
            </button>
          </>
        ) : (
          <div className="riddle__reveal">
            <svg viewBox="0 0 100 100" className="riddle__icon" aria-hidden>
              <StationIcon id={id} color={def.color} />
            </svg>
            <p className="quiz__kicker">أحسنتِ! 🌟</p>
            <h2 className="quiz__text">{r.reveal.title}</h2>
            <p className="riddle__sub">{r.reveal.subtitle}</p>
            <button className="btn btn--primary btn--xl" autoFocus onClick={start}>
              ابدئي الجولة ✨
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================ challenge */

type Done = (firstTry: boolean) => void

export function OrderStep({ step, onDone }: { step: Extract<ChallengeStep, { kind: 'order' }>; onDone: Done }) {
  const pool0 = useMemo(() => shuffled(step.items), [step])
  const [slots, setSlots] = useState<(string | null)[]>(() => step.items.map(() => null))
  const [locked, setLocked] = useState<boolean[]>(() => step.items.map(() => false))
  const [bad, setBad] = useState<number[]>([])
  const [tries, setTries] = useState(0)
  const [ok, setOk] = useState(false)
  const pool = pool0.filter((x) => !slots.includes(x))
  const put = (x: string) => {
    const i = slots.indexOf(null)
    if (i < 0) return
    sfx.click()
    setBad([])
    setSlots((s) => Object.assign(s.slice(), { [i]: x }))
  }
  const remove = (i: number) => {
    if (locked[i] || ok) return
    setBad([])
    setSlots((s) => Object.assign(s.slice(), { [i]: null }))
  }
  const check = () => {
    const wrong = slots.map((x, i) => (x === step.items[i] ? -1 : i)).filter((i) => i >= 0)
    setLocked(slots.map((x, i) => x === step.items[i]))
    if (!wrong.length) {
      sfx.correct()
      setOk(true)
      return
    }
    sfx.wrong()
    setTries((t) => t + 1)
    setBad(wrong)
    setTimeout(() => {
      setSlots((s) => s.map((x, i) => (wrong.includes(i) ? null : x)))
      setBad([])
    }, 1300)
  }
  return (
    <>
      <h2 className="quiz__text challenge__prompt">{step.prompt}</h2>
      <ol className="order">
        {slots.map((x, i) => (
          <li key={i}>
            <button
              className={'order__slot' + (x ? ' is-filled' : '') + (locked[i] ? ' is-ok' : '') + (bad.includes(i) ? ' is-bad' : '')}
              onClick={() => remove(i)}
              disabled={!x || locked[i] || ok}
            >
              <b>{toAr(i + 1)}</b>
              <span>{x ?? (i === slots.indexOf(null) ? 'اضغطي على محطة من الأسفل 👇' : '…')}</span>
            </button>
          </li>
        ))}
      </ol>
      {!ok && (
        <div className="chips-pool">
          {pool.map((x) => (
            <button key={x} className="pool-chip" onClick={() => put(x)}>
              {x}
            </button>
          ))}
        </div>
      )}
      <StepFooter
        ok={ok}
        success={step.success}
        bad={bad.length > 0}
        badText="بعضها في غير مكانه… سنعيدها لكِ، حاولي مرة أخرى 🤔"
        canCheck={!slots.includes(null)}
        onCheck={check}
        onNext={() => onDone(tries === 0)}
      />
    </>
  )
}

export function MatchStep({ step, onDone }: { step: Extract<ChallengeStep, { kind: 'match' }>; onDone: Done }) {
  const rights = useMemo(() => shuffled(step.pairs.map((p) => p[1])), [step])
  const [placed, setPlaced] = useState<(string | null)[]>(() => step.pairs.map(() => null))
  const [active, setActive] = useState(0)
  const [locked, setLocked] = useState<boolean[]>(() => step.pairs.map(() => false))
  const [bad, setBad] = useState<number[]>([])
  const [tries, setTries] = useState(0)
  const [ok, setOk] = useState(false)
  const pool = rights.filter((x) => !placed.includes(x))
  const firstEmpty = (p: (string | null)[]) => p.findIndex((x) => x === null)
  const put = (x: string) => {
    const i = placed[active] === null ? active : firstEmpty(placed)
    if (i < 0) return
    sfx.click()
    setBad([])
    const next = Object.assign(placed.slice(), { [i]: x })
    setPlaced(next)
    const n = firstEmpty(next)
    if (n >= 0) setActive(n)
  }
  const tapRow = (i: number) => {
    if (locked[i] || ok) return
    setBad([])
    if (placed[i] !== null) setPlaced((p) => Object.assign(p.slice(), { [i]: null }))
    setActive(i)
  }
  const check = () => {
    const wrong = placed.map((x, i) => (x === step.pairs[i][1] ? -1 : i)).filter((i) => i >= 0)
    setLocked(placed.map((x, i) => x === step.pairs[i][1]))
    if (!wrong.length) {
      sfx.correct()
      setOk(true)
      return
    }
    sfx.wrong()
    setTries((t) => t + 1)
    setBad(wrong)
    setTimeout(() => {
      setPlaced((p) => p.map((x, i) => (wrong.includes(i) ? null : x)))
      setBad([])
      setActive(wrong[0])
    }, 1300)
  }
  return (
    <>
      <h2 className="quiz__text challenge__prompt">{step.prompt}</h2>
      <ul className="match">
        {step.pairs.map(([left], i) => (
          <li key={left}>
            <button
              className={
                'match__row' +
                (i === active && placed[i] === null && !ok ? ' is-active' : '') +
                (locked[i] ? ' is-ok' : '') +
                (bad.includes(i) ? ' is-bad' : '')
              }
              onClick={() => tapRow(i)}
              disabled={locked[i] || ok}
            >
              <b>{left}</b>
              <span>{placed[i] ?? (i === active ? '← اختاري الصفة من الأسفل' : '…')}</span>
            </button>
          </li>
        ))}
      </ul>
      {!ok && (
        <div className="chips-pool">
          {pool.map((x) => (
            <button key={x} className="pool-chip" onClick={() => put(x)}>
              {x}
            </button>
          ))}
        </div>
      )}
      <StepFooter
        ok={ok}
        success={step.success}
        bad={bad.length > 0}
        badText="بعض الصفات في غير مكانها… حاولي مرة أخرى 🤔"
        canCheck={!placed.includes(null)}
        onCheck={check}
        onNext={() => onDone(tries === 0)}
      />
    </>
  )
}

export function ChoiceStep({ step, onDone }: { step: Extract<ChallengeStep, { kind: 'choice' }>; onDone: Done }) {
  const [wrong, setWrong] = useState<number[]>([])
  const [ok, setOk] = useState(false)
  const pick = (i: number) => {
    if (ok || wrong.includes(i)) return
    if (i === step.answer) {
      sfx.correct()
      setOk(true)
    } else {
      sfx.wrong()
      setWrong((w) => [...w, i])
    }
  }
  return (
    <>
      <h2 className="quiz__text challenge__prompt">{step.prompt}</h2>
      <div className="quiz__choices quiz__choices--3">
        {step.options.map((o, i) => (
          <button
            key={o}
            className={'choice choice--name' + (wrong.includes(i) ? ' is-wrong' : '') + (ok && i === step.answer ? ' is-right' : '')}
            disabled={wrong.includes(i) || ok}
            onClick={() => pick(i)}
          >
            {toAr(i + 1)}. {o}
          </button>
        ))}
      </div>
      <StepFooter
        ok={ok}
        success={step.success}
        bad={wrong.length > 0 && !ok}
        badText="فكّري مرة أخرى 🤔"
        onNext={() => onDone(wrong.length === 0)}
      />
    </>
  )
}

export function MultiStep({ step, onDone }: { step: Extract<ChallengeStep, { kind: 'multi' }>; onDone: Done }) {
  const [sel, setSel] = useState<number[]>([])
  const [bad, setBad] = useState<number[]>([])
  const [tries, setTries] = useState(0)
  const [ok, setOk] = useState(false)
  const need = step.answers.length
  const toggle = (i: number) => {
    if (ok) return
    sfx.click()
    setBad([])
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < need ? [...s, i] : s))
  }
  const check = () => {
    const wrong = sel.filter((i) => !step.answers.includes(i))
    if (!wrong.length) {
      sfx.correct()
      setOk(true)
      return
    }
    sfx.wrong()
    setTries((t) => t + 1)
    setBad(wrong)
    setTimeout(() => {
      setSel((s) => s.filter((i) => !wrong.includes(i)))
      setBad([])
    }, 1300)
  }
  return (
    <>
      <h2 className="quiz__text challenge__prompt">{step.prompt}</h2>
      <div className="multi">
        {step.options.map((o, i) => (
          <button
            key={o}
            className={
              'multi__opt' +
              (sel.includes(i) ? ' is-sel' : '') +
              (bad.includes(i) ? ' is-bad' : '') +
              (ok && sel.includes(i) ? ' is-ok' : '')
            }
            onClick={() => toggle(i)}
            disabled={ok}
            aria-pressed={sel.includes(i)}
          >
            <i>{sel.includes(i) ? '✓' : ''}</i>
            {o}
          </button>
        ))}
      </div>
      {!ok && (
        <p className="challenge__count">
          اخترتِ {toAr(sel.length)} من {toAr(need)}
        </p>
      )}
      <StepFooter
        ok={ok}
        success={step.success}
        bad={bad.length > 0}
        badText="اقتربتِ! الاختيار الأحمر ليس من العوامل، اختاري غيره 🤔"
        canCheck={sel.length === need}
        onCheck={check}
        onNext={() => onDone(tries === 0)}
      />
    </>
  )
}

export function TFStep({ questions, onDone }: { questions: TFQuestion[]; onDone: Done }) {
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<boolean[]>([])
  const q = questions[i]
  const a = answers[i]
  const answered = a !== undefined
  const ok = answered && a === q.answer
  const last = i === questions.length - 1
  const pick = (v: boolean) => {
    if (answered) return
    if (v === q.answer) sfx.correct()
    else sfx.wrong()
    setAnswers((x) => Object.assign(x.slice(), { [i]: v }))
  }
  return (
    <>
      <p className="quiz__kicker">
        سؤال {toAr(i + 1)} من {toAr(questions.length)} — صح أم خطأ؟
      </p>
      <h2 className="quiz__text">{q.text}</h2>
      {!answered ? (
        <div className="quiz__choices">
          <button className="choice choice--true" onClick={() => pick(true)}>
            <span className="choice__icon">✓</span>
            صح
          </button>
          <button className="choice choice--false" onClick={() => pick(false)}>
            <span className="choice__icon">✗</span>
            خطأ
          </button>
        </div>
      ) : (
        <div className="quiz__result">
          <div className="quiz__verdict">{ok ? 'أحسنتِ! 🌟' : `الإجابة الصحيحة: «${q.answer ? 'صح' : 'خطأ'}»`}</div>
          <p className="quiz__explain">
            <b>هل تعلمين؟ </b>
            {q.explain}
          </p>
          <button
            className="btn btn--primary btn--xl"
            autoFocus
            onClick={() => (last ? onDone(answers.every((x, k) => x === questions[k].answer)) : setI(i + 1))}
          >
            {last ? 'التالي ✨' : 'السؤال التالي'}
          </button>
        </div>
      )}
    </>
  )
}

function StepFooter(p: {
  ok: boolean
  success: string
  bad: boolean
  badText: string
  canCheck?: boolean
  onCheck?: () => void
  onNext: () => void
}) {
  if (p.ok)
    return (
      <div className="quiz__result">
        <div className="quiz__verdict">{p.success}</div>
        <button className="btn btn--primary btn--xl" autoFocus onClick={p.onNext}>
          التالي ✨
        </button>
      </div>
    )
  return (
    <>
      {p.bad && <p className="challenge__msg is-bad">{p.badText}</p>}
      {p.onCheck && (
        <button className="btn btn--primary btn--xl challenge__check" disabled={!p.canCheck} onClick={p.onCheck}>
          تحقّقي ✓
        </button>
      )}
    </>
  )
}

/** the reward: «اكتشفي معلومة» card (tap to open) + المرجع + the stamp button */
function Reward({ id, onFinish }: { id: StationId; onFinish: () => void }) {
  const def = STATIONS[id]
  const [open, setOpen] = useState(0) // how many fact lines are shown
  const fact = def.fact
  return (
    <div className="reward">
      <p className="quiz__kicker">🎉 أنجزتِ تحدي المستكشف</p>
      {fact && (
        <div className={'fact' + (open ? ' is-open' : '')}>
          {!open ? (
            <button
              className="fact__closed"
              onClick={() => {
                sfx.ding()
                setOpen(1)
              }}
            >
              <span className="fact__bulb">💡</span>
              <b>{fact.title}</b>
              <small>اضغطي لفتح البطاقة</small>
            </button>
          ) : (
            <div className="fact__body">
              <b>{fact.title}</b>
              {fact.lines.slice(0, open).map((l) => (
                <p key={l}>{l}</p>
              ))}
              {open < fact.lines.length && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    sfx.ding()
                    setOpen((n) => n + 1)
                  }}
                >
                  ✨ معلومة أخرى
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {def.ref && (
        <p className="ref">
          <b>📚 المرجع:</b> {def.ref}
        </p>
      )}
      {def.outro && (
        <div className="outro">
          {def.outro.text && <p>{def.outro.text}</p>}
          <Narration src={def.outro.audio} auto={!!open || !fact} />
        </div>
      )}
      <button className="btn btn--primary btn--xl" disabled={!!fact && !open} onClick={onFinish}>
        احصلي على الختم 🏅
      </button>
      {!!fact && !open && <small className="reward__hint">افتحي بطاقة المعلومة أولاً 👆</small>}
    </div>
  )
}

export function StationChallenge() {
  const id = useStore((s) => s.stationQuiz)
  const close = useStore((s) => s.setStationQuiz)
  const finish = useStore((s) => s.finishQuiz)
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [reward, setReward] = useState(false)
  useEffect(() => {
    setI(0)
    setScore(0)
    setReward(false)
  }, [id])
  if (!id) return null
  const def = STATIONS[id]
  const steps = def.challenge
  const step = steps[i]
  const next: Done = (first) => {
    const s = score + (first ? 1 : 0)
    setScore(s)
    if (i < steps.length - 1) setI(i + 1)
    else setReward(true)
  }
  return (
    <div className="modal modal--quiz" role="dialog" aria-modal aria-label="تحدي المستكشف">
      <div className="quiz challenge" style={{ ['--c' as string]: def.color }}>
        <div className="quiz__head">
          <span className="quiz__badge" style={{ background: def.color }}>
            تحدي المستكشف 🗝️ · {def.short}
          </span>
          {steps.length > 1 && !reward && (
            <span className="quiz__progress">
              {steps.map((_, k) => (
                <i key={k} className={k < i ? 'ok' : k === i ? 'cur' : ''} />
              ))}
            </span>
          )}
        </div>
        {reward ? (
          <Reward id={id} onFinish={() => finish(id, score)} />
        ) : (
          <div key={i}>
            {step.kind === 'order' && <OrderStep step={step} onDone={next} />}
            {step.kind === 'match' && <MatchStep step={step} onDone={next} />}
            {step.kind === 'choice' && <ChoiceStep step={step} onDone={next} />}
            {step.kind === 'multi' && <MultiStep step={step} onDone={next} />}
            {step.kind === 'tf' && <TFStep questions={step.questions} onDone={next} />}
          </div>
        )}
        {!reward && (
          <button className="quiz__later" onClick={() => close(null)}>
            لاحقاً
          </button>
        )}
      </div>
    </div>
  )
}

/* ================================================= ivory: trader's route */

const ROUTE = [
  { key: 'inland', name: 'داخل إفريقيا', x: 80, y: 380, ask: '١. من أين كان يُجلب العاج؟', say: 'يُجلب العاج من مناطق داخل القارة الإفريقية 🐘' },
  { key: 'coast', name: 'الساحل', x: 196, y: 398, ask: '٢. إلى أين تنقله القوافل؟', say: 'تنقل القوافل العاج إلى الساحل 🐫' },
  {
    key: 'zanzibar',
    name: 'زنجبار',
    x: 262,
    y: 468,
    ask: '٣. اختاري طريق التاجر: داخل إفريقيا ← الساحل ← ؟',
    say: 'أحسنتِ! كانت زنجبار محطة رئيسية لتجميع العاج وتصديره إلى الأسواق الخارجية.',
  },
  { key: 'markets', name: 'الأسواق العالمية', x: 880, y: 96, ask: '٤. وأخيرًا… إلى أين يُصدَّر؟', say: 'ومن زنجبار يُصدَّر العاج إلى الأسواق العالمية في آسيا وأوروبا وأمريكا 🌍' },
]
// decoys for the «?» step
const DECOYS = [
  { key: 'nizwa', name: 'نزوى', x: 520, y: 118 },
  { key: 'salalah', name: 'صلالة', x: 392, y: 212 },
]

export function IvoryRoute() {
  const setActivity = useStore((s) => s.setActivity)
  const doneBefore = useStore((s) => s.progress.ivory.activity)
  const [n, setN] = useState(doneBefore ? ROUTE.length : 0) // stops reached
  const [msg, setMsg] = useState(doneBefore ? 'رسمتِ رحلة العاج كاملة ✓' : 'اضغطي على المحطات على الخريطة بالترتيب 👇')
  const [bad, setBad] = useState<string | null>(null)
  const done = n >= ROUTE.length
  const tap = (key: string) => {
    if (done) return
    if (key === ROUTE[n].key) {
      sfx.correct()
      setBad(null)
      setMsg(ROUTE[n].say)
      const next = n + 1
      setN(next)
      if (next >= ROUTE.length) useStore.getState().setActivityDone('ivory')
    } else {
      sfx.wrong()
      setBad(key)
      setMsg(n === 2 && (key === 'nizwa' || key === 'salalah') ? 'ليس هنا… أين كانت تُجمع شحنات العاج قبل تصديرها؟ 🤔' : 'ليس بعد… تتبّعي الرحلة خطوة خطوة 🤔')
    }
  }
  const pts = ROUTE.slice(0, n)
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ')
  return (
    <div className="modal" role="dialog" aria-modal aria-label="اختاري طريق التاجر">
      <div className="modal__box game">
        <div className="modal__head">
          <div>
            <span className="kicker">نشاط</span>
            <h3>اختاري طريق التاجر 🧭</h3>
          </div>
          <button className="icon-btn" onClick={() => setActivity(null)} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <p className="route__ask">{done ? '✓ اكتملت رحلة العاج' : ROUTE[n].ask}</p>
        <div className="trade">
          <svg viewBox="0 0 1000 620" className="trade__map">
            <rect width="1000" height="620" rx="24" fill="#e9d6ae" />
            <rect width="1000" height="620" rx="24" fill="#4a8aa0" opacity="0.25" />
            <path d="M180 0 L620 0 L600 70 L550 110 L500 170 L440 210 L360 230 L270 210 L200 160 L160 80 Z" fill="#ead7ab" stroke="#8a6a3c" strokeWidth="4" />
            <path d="M0 190 L100 210 L200 270 L260 290 L220 380 L180 470 L120 570 L80 620 L0 620 Z" fill="#ead7ab" stroke="#8a6a3c" strokeWidth="4" />
            <path d="M660 0 L1000 0 L1000 160 L900 190 L820 350 L780 400 L740 320 L700 200 L660 130 Z" fill="#ead7ab" stroke="#8a6a3c" strokeWidth="4" />
            <ellipse cx="262" cy="468" rx="16" ry="24" fill="#ead7ab" stroke="#8a6a3c" strokeWidth="3" />
            <text x="470" y="60" fontSize="30" fill="#6b5232" textAnchor="middle" fontFamily="Tajawal">عُمان</text>
            <text x="600" y="330" fontSize="26" fill="#2c5568" textAnchor="middle" fontFamily="Tajawal">بحر العرب</text>
            <text x="520" y="540" fontSize="26" fill="#2c5568" textAnchor="middle" fontFamily="Tajawal">المحيط الهندي</text>
            <text x="70" y="270" fontSize="26" fill="#6b5232" textAnchor="middle" fontFamily="Tajawal">إفريقيا</text>
            {path && <path d={path} stroke="#7a1f1f" strokeWidth="7" strokeDasharray="18 12" fill="none" strokeLinecap="round" className="route__line" />}
            {[...ROUTE, ...DECOYS].map((p) => {
              const i = ROUTE.findIndex((r) => r.key === p.key)
              const reached = i >= 0 && i < n
              return (
                <g
                  key={p.key}
                  className={'trade__port route__stop' + (reached ? ' is-done' : '') + (bad === p.key ? ' is-bad' : '') + (!done ? ' is-target' : '')}
                  onClick={() => tap(p.key)}
                >
                  <circle cx={p.x} cy={p.y} r="46" fill="#7a1f1f" opacity="0.001" />
                  {p.key === 'markets' ? (
                    <text x={p.x} y={p.y + 14} fontSize="46" textAnchor="middle">
                      🌍
                    </text>
                  ) : (
                    <circle cx={p.x} cy={p.y} r="15" fill={reached ? '#3ad17e' : '#7a1f1f'} stroke="#fff3d6" strokeWidth="4" />
                  )}
                  <text
                    x={p.x}
                    y={p.key === 'markets' ? p.y + 58 : p.y - 26}
                    textAnchor="middle"
                    fontSize="26"
                    fontWeight="800"
                    fill="#3a2412"
                    fontFamily="'Reem Kufi', Tajawal"
                    paintOrder="stroke"
                    stroke="#f3e4c2"
                    strokeWidth="6"
                  >
                    {p.name}
                  </text>
                </g>
              )
            })}
          </svg>
          <p className="trade__msg">{msg}</p>
          {done && (
            <button className="btn btn--primary" onClick={() => setActivity(null)}>
              متابعة ✓
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
