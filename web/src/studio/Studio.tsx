// «استوديو التحديات» — students design a station's riddle, cards, challenges and narration without code.
// Their design is saved on the device automatically, can be tried with the game's own windows, applied to
// the game on this device, and exported as a file for the teacher.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { applyContent, contentOf, db, type StationContent } from '../contentStore'
import { sfx } from '../game/sfx'
import { STATION_ORDER, STATIONS, type ChallengeStep, type StationId } from '../stations'
import { useStore } from '../store'
import { ChoiceStep, MatchStep, MultiStep, OrderStep, StationChallenge, StationRiddle, TFStep } from '../ui/Challenge'
import { StationIcon } from '../ui/Passport'
import { toAr } from '../ui/Quiz'

/* ------------------------------------------------------------- constants */

// the original content of each station (built-in + published), before any preview touches it
const ORIGINAL = Object.fromEntries(STATION_ORDER.map((id) => [id, contentOf(id)])) as Record<StationId, StationContent>

/** where each card appears in the 3D scene */
const POINTS: Record<StationId, Record<string, string>> = {
  nav: {
    origin: 'عند الصندوق قرب النافذة',
    nizwa: 'عند الرَّحل في الزاوية',
    judge: 'أمام مجلس القاضي',
    manuscripts: 'أمام خزانة المخطوطات',
    books: 'أمام رفوف الكتب',
  },
  sumhuram: {
    gate: 'أمام بوابة المدينة',
    store: 'عند غرف التخزين والجرار',
    secrets: 'بين تلال الحفر',
    fort: 'عند الأبراج قرب المدخل',
    tomb: 'عند المقبرة خارج السور',
  },
  turtles: { nest: 'عند العش والبيض', green: 'عند السلحفاة الأم', protect: 'عند لوحة الشاطئ', reserve: 'عند لوحة المحمية' },
  ivory: {
    ivory: 'عند خزانة العاج',
    zanzibar: 'عند نموذج السفينة',
    network: 'عند طاولة الخريطة',
    cloves: 'عند أكياس البضائع',
    protect: 'عند اللوحة الجانبية',
  },
  clothing: {
    dishdasha: 'عند الدشداشة',
    kumma: 'عند طاولة الكمّة',
    khanjar: 'عند الخنجر والبشت',
    women: 'عند زي المرأة',
    dhofar: 'عند الزي الظفاري',
  },
}

const ICONS = ['📜', '📚', '🏡', '🕌', '⚖️', '🏛️', '🏺', '⛏️', '🛡️', '🪨', '🐢', '💚', '🔎', '🏝️', '🐘', '🐫', '🌍', '👗', '✨', '💡', '⭐', '🗺️']
const KICKERS = ['اكتشفي الشخصية 🔍', 'اكتشفي المكان 🔍', 'اكتشفي الكائن 🔍', 'اكتشفي السلعة 🔍']
const QUESTIONS = ['فمن أنا؟', 'فأين أنا؟', 'فما أنا؟']

const KINDS: { kind: ChallengeStep['kind']; icon: string; name: string; hint: string }[] = [
  { kind: 'choice', icon: '🔘', name: 'اختيار من متعدد', hint: 'سؤال وإجابة واحدة صحيحة' },
  { kind: 'order', icon: '↕️', name: 'ترتيب', hint: 'خطوات تُرتَّب بالترتيب الصحيح' },
  { kind: 'match', icon: '🔗', name: 'مطابقة', hint: 'صِلي كل عنصر بما يناسبه' },
  { kind: 'multi', icon: '☑️', name: 'عدة إجابات', hint: 'أكثر من إجابة صحيحة' },
  { kind: 'tf', icon: '✅', name: 'صح أو خطأ', hint: 'عبارات يُحكم عليها' },
]
const kindInfo = (k: ChallengeStep['kind']) => KINDS.find((x) => x.kind === k)!

function newStep(kind: ChallengeStep['kind']): ChallengeStep {
  if (kind === 'choice') return { kind, prompt: '', options: ['', '', ''], answer: -1, success: 'أحسنتِ! ' }
  if (kind === 'order') return { kind, prompt: 'رتّبي من الأقدم إلى الأحدث:', items: ['', '', '', ''], success: 'أحسنتِ! ' }
  if (kind === 'match') return { kind, prompt: 'صِلي كل عنصر بما يناسبه:', pairs: [['', ''], ['', ''], ['', '']], success: 'أحسنتِ! ' }
  if (kind === 'multi') return { kind, prompt: '', options: ['', '', '', ''], answers: [], success: 'أحسنتِ! ' }
  return { kind: 'tf', questions: [{ text: '', answer: true, explain: '' }] }
}

/* ------------------------------------------------------------ validation */

interface Issue {
  where: string
  msg: string
  tip?: boolean
}

const filled = (s?: string) => !!s && s.trim().length > 0
const unique = (xs: string[]) => new Set(xs.map((x) => x.trim())).size === xs.length

function check(doc: StationContent): Issue[] {
  const out: Issue[] = []
  const r = doc.riddle
  if (r) {
    if (!filled(r.text)) out.push({ where: 'اللغز', msg: 'اكتبي وصف اللغز' })
    if (r.options.some((o) => !filled(o))) out.push({ where: 'اللغز', msg: 'اكتبي كل خيارات اللغز' })
    else if (!unique(r.options)) out.push({ where: 'اللغز', msg: 'لا تكرّري الخيار نفسه' })
    if (r.answer < 0 || r.answer >= r.options.length) out.push({ where: 'اللغز', msg: 'اختاري الإجابة الصحيحة للغز' })
    if (!filled(r.reveal.title)) out.push({ where: 'اللغز', msg: 'اكتبي ما يظهر بعد الحل (الاسم)' })
  }
  const cards = (doc.items ?? []).filter((it) => filled(it.text))
  if (!cards.length) out.push({ where: 'البطاقات', msg: 'اكتبي بطاقة واحدة على الأقل' })
  doc.items?.forEach((it, i) => {
    if (filled(it.text) && !filled(it.title)) out.push({ where: `البطاقة ${toAr(i + 1)}`, msg: 'اكتبي عنوان البطاقة' })
    if (filled(it.text) && !filled(it.ref)) out.push({ where: `البطاقة ${toAr(i + 1)}`, msg: 'يُفضَّل كتابة المرجع (المجلد والصفحة)', tip: true })
  })
  const steps = doc.challenge ?? []
  if (!steps.length) out.push({ where: 'التحديات', msg: 'أضيفي تحدياً واحداً على الأقل' })
  steps.forEach((st, i) => out.push(...checkStep(st).map((msg) => ({ where: `التحدي ${toAr(i + 1)}`, msg }))))
  return out
}

function checkStep(st: ChallengeStep): string[] {
  const out: string[] = []
  if (st.kind !== 'tf') {
    if (!filled(st.prompt)) out.push('اكتبي نص السؤال')
    if (!filled(st.success)) out.push('اكتبي رسالة الإجابة الصحيحة')
  }
  if (st.kind === 'choice') {
    if (st.options.some((o) => !filled(o))) out.push('اكتبي كل الخيارات أو احذفي الفارغ')
    else if (!unique(st.options)) out.push('لا تكرّري الخيار نفسه')
    if (st.answer < 0 || st.answer >= st.options.length) out.push('اختاري الإجابة الصحيحة (الدائرة بجانبها)')
  } else if (st.kind === 'multi') {
    if (st.options.some((o) => !filled(o))) out.push('اكتبي كل الخيارات أو احذفي الفارغ')
    else if (!unique(st.options)) out.push('لا تكرّري الخيار نفسه')
    if (!st.answers.length) out.push('علّمي الإجابات الصحيحة')
    else if (st.answers.length >= st.options.length) out.push('أضيفي خياراً خاطئاً واحداً على الأقل')
  } else if (st.kind === 'order') {
    if (st.items.length < 3) out.push('أضيفي ٣ خطوات على الأقل')
    if (st.items.some((o) => !filled(o))) out.push('اكتبي كل الخطوات أو احذفي الفارغ')
    else if (!unique(st.items)) out.push('لا تكرّري الخطوة نفسها')
  } else if (st.kind === 'match') {
    if (st.pairs.length < 2) out.push('أضيفي زوجين على الأقل')
    if (st.pairs.some(([a, b]) => !filled(a) || !filled(b))) out.push('اكتبي طرفي كل زوج')
    else if (!unique(st.pairs.map((p) => p[1])) || !unique(st.pairs.map((p) => p[0]))) out.push('لا تكرّري العنصر نفسه')
  } else {
    if (!st.questions.length) out.push('أضيفي عبارة واحدة على الأقل')
    if (st.questions.some((q) => !filled(q.text))) out.push('اكتبي كل العبارات')
    if (st.questions.some((q) => !filled(q.explain))) out.push('اكتبي تفسيراً لكل عبارة')
  }
  return out
}

/** trim text before previews and export */
function cleaned(doc: StationContent): StationContent {
  const d = JSON.parse(JSON.stringify(doc)) as StationContent
  const t = (s: string) => s.trim()
  if (d.riddle) {
    d.riddle.text = t(d.riddle.text)
    d.riddle.options = d.riddle.options.map(t)
  }
  d.challenge = d.challenge?.map((st) => {
    if (st.kind === 'choice' || st.kind === 'multi') return { ...st, prompt: t(st.prompt), options: st.options.map(t), success: t(st.success) }
    if (st.kind === 'order') return { ...st, prompt: t(st.prompt), items: st.items.map(t), success: t(st.success) }
    if (st.kind === 'match') return { ...st, prompt: t(st.prompt), pairs: st.pairs.map(([a, b]) => [t(a), t(b)] as [string, string]), success: t(st.success) }
    return { ...st, questions: st.questions.map((q) => ({ ...q, text: t(q.text), explain: t(q.explain) })) }
  })
  return d
}

/* ------------------------------------------------------------ small parts */

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="sf">
      <span className="sf__label">{label}</span>
      {children}
      {hint && <small className="sf__hint">{hint}</small>}
    </label>
  )
}

function Section({ n, id, title, intro, done, children }: { n: number; id: string; title: string; intro: string; done: boolean; children: ReactNode }) {
  return (
    <section className="ss" id={id}>
      <header className="ss__head">
        <span className={'ss__n' + (done ? ' is-done' : '')}>{done ? '✓' : toAr(n)}</span>
        <div>
          <h2>{title}</h2>
          <p>{intro}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

function ListRows<T>({
  items,
  onChange,
  render,
  make,
  min,
  max,
  addLabel,
  movable,
}: {
  items: T[]
  onChange: (x: T[]) => void
  render: (x: T, i: number, set: (v: T) => void) => ReactNode
  make: () => T
  min: number
  max: number
  addLabel: string
  movable?: boolean
}) {
  const set = (i: number, v: T) => onChange(Object.assign(items.slice(), { [i]: v }))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const a = items.slice()
    ;[a[i], a[j]] = [a[j], a[i]]
    onChange(a)
  }
  return (
    <div className="rows">
      {items.map((x, i) => (
        <div className="rows__row" key={i}>
          {render(x, i, (v) => set(i, v))}
          <div className="rows__tools">
            {movable && (
              <>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="إلى الأعلى">
                  ▲
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="إلى الأسفل">
                  ▼
                </button>
              </>
            )}
            <button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} disabled={items.length <= min} aria-label="حذف">
              🗑
            </button>
          </div>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="sbtn sbtn--ghost sbtn--sm" onClick={() => onChange([...items, make()])}>
          ➕ {addLabel}
        </button>
      )}
    </div>
  )
}

/** record with the microphone or upload an audio file; stored inside the design as a data: URL */
function AudioField({ value, onChange, label = 'تسجيل صوتي (اختياري)' }: { value?: string; onChange: (v: string) => void; label?: string }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null)
  const [secs, setSecs] = useState(0)
  const [err, setErr] = useState('')
  const timer = useRef(0)
  const toData = (b: Blob) =>
    new Promise<string>((res) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as string)
      fr.readAsDataURL(b)
    })
  const start = async () => {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t))
      const mr = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined)
      const chunks: Blob[] = []
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        clearInterval(timer.current)
        setRec(null)
        onChange(await toData(new Blob(chunks, { type: mr.mimeType })))
      }
      mr.start()
      setRec(mr)
      setSecs(0)
      timer.current = window.setInterval(() => {
        setSecs((s) => {
          if (s + 1 >= 90) mr.state === 'recording' && mr.stop()
          return s + 1
        })
      }, 1000)
    } catch {
      setErr('لم نتمكّن من استخدام الميكروفون. اسمحي للمتصفح باستخدامه، أو ارفعي ملفاً صوتياً.')
    }
  }
  const upload = async (f?: File) => {
    if (!f) return
    if (f.size > 4 * 1024 * 1024) return setErr('الملف كبير (أكثر من ٤ ميجابايت). سجّلي مقطعاً أقصر.')
    setErr('')
    onChange(await toData(f))
  }
  return (
    <div className="audio">
      <span className="sf__label">{label}</span>
      {value ? (
        <div className="audio__has">
          <audio controls src={value} />
          <button type="button" className="sbtn sbtn--ghost sbtn--sm" onClick={() => onChange('')}>
            🗑 حذف التسجيل
          </button>
        </div>
      ) : rec ? (
        <button type="button" className="sbtn sbtn--rec" onClick={() => rec.stop()}>
          ⏹ إيقاف التسجيل ({toAr(Math.floor(secs / 60))}:{secs % 60 < 10 ? '٠' : ''}{toAr(secs % 60)})
        </button>
      ) : (
        <div className="audio__btns">
          <button type="button" className="sbtn sbtn--ghost sbtn--sm" onClick={start}>
            🎙️ سجّلي بصوتكِ
          </button>
          <label className="sbtn sbtn--ghost sbtn--sm">
            📁 رفع ملف صوتي
            <input type="file" accept="audio/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </label>
        </div>
      )}
      {err && <small className="sf__err">{err}</small>}
    </div>
  )
}

/* ------------------------------------------------------- challenge editor */

function StepEditor({ step, onChange }: { step: ChallengeStep; onChange: (s: ChallengeStep) => void }) {
  if (step.kind === 'choice' || step.kind === 'multi') {
    const multi = step.kind === 'multi'
    const isRight = (i: number) => (multi ? step.answers.includes(i) : step.answer === i)
    const toggle = (i: number) =>
      multi
        ? onChange({ ...step, answers: isRight(i) ? step.answers.filter((x) => x !== i) : [...step.answers, i].sort() })
        : onChange({ ...step, answer: i })
    return (
      <>
        <Field label="السؤال">
          <textarea rows={2} value={step.prompt} onChange={(e) => onChange({ ...step, prompt: e.target.value })} placeholder="مثال: أين طلب العلم؟" />
        </Field>
        <span className="sf__label">{multi ? 'الخيارات — علّمي كل الإجابات الصحيحة ☑️' : 'الخيارات — اضغطي الدائرة بجانب الإجابة الصحيحة 🔘'}</span>
        <ListRows
          items={step.options}
          min={multi ? 3 : 2}
          max={6}
          addLabel="خيار"
          make={() => ''}
          onChange={(options) => {
            // keep the right answers pointing at the same rows
            const keep = (i: number) => options.indexOf(step.options[i])
            if (multi) onChange({ ...step, options, answers: step.answers.map(keep).filter((i) => i >= 0) })
            else onChange({ ...step, options, answer: step.answer >= 0 ? keep(step.answer) : -1 })
          }}
          render={(o, i, set) => (
            <div className="opt">
              <button type="button" className={'opt__mark' + (isRight(i) ? ' is-on' : '') + (multi ? ' is-box' : '')} onClick={() => toggle(i)} aria-label="الإجابة الصحيحة">
                {isRight(i) ? '✓' : ''}
              </button>
              <input value={o} onChange={(e) => set(e.target.value)} placeholder={`الخيار ${toAr(i + 1)}`} />
            </div>
          )}
        />
        <Field label="رسالة الإجابة الصحيحة 🌟">
          <input value={step.success} onChange={(e) => onChange({ ...step, success: e.target.value })} placeholder="أحسنتِ! ..." />
        </Field>
      </>
    )
  }
  if (step.kind === 'order')
    return (
      <>
        <Field label="السؤال">
          <input value={step.prompt} onChange={(e) => onChange({ ...step, prompt: e.target.value })} />
        </Field>
        <span className="sf__label">اكتبي الخطوات بالترتيب الصحيح — ستظهر للاعبة مخلوطة ↕️</span>
        <ListRows
          items={step.items}
          min={2}
          max={6}
          movable
          addLabel="خطوة"
          make={() => ''}
          onChange={(items) => onChange({ ...step, items })}
          render={(o, i, set) => (
            <div className="opt">
              <b className="opt__n">{toAr(i + 1)}</b>
              <input value={o} onChange={(e) => set(e.target.value)} placeholder={`الخطوة ${toAr(i + 1)}`} />
            </div>
          )}
        />
        <Field label="رسالة الإجابة الصحيحة 🌟">
          <input value={step.success} onChange={(e) => onChange({ ...step, success: e.target.value })} />
        </Field>
      </>
    )
  if (step.kind === 'match')
    return (
      <>
        <Field label="السؤال">
          <input value={step.prompt} onChange={(e) => onChange({ ...step, prompt: e.target.value })} />
        </Field>
        <span className="sf__label">اكتبي كل عنصر وما يناسبه — سيظهر الطرف الثاني مخلوطاً 🔗</span>
        <ListRows
          items={step.pairs}
          min={2}
          max={5}
          addLabel="زوج"
          make={() => ['', ''] as [string, string]}
          onChange={(pairs) => onChange({ ...step, pairs })}
          render={([a, b], i, set) => (
            <div className="pair">
              <input value={a} onChange={(e) => set([e.target.value, b])} placeholder={`العنصر ${toAr(i + 1)}`} />
              <span aria-hidden>⇄</span>
              <input value={b} onChange={(e) => set([a, e.target.value])} placeholder="ما يناسبه" />
            </div>
          )}
        />
        <Field label="رسالة الإجابة الصحيحة 🌟">
          <input value={step.success} onChange={(e) => onChange({ ...step, success: e.target.value })} />
        </Field>
      </>
    )
  return (
    <ListRows
      items={step.questions}
      min={1}
      max={6}
      addLabel="عبارة"
      make={() => ({ text: '', answer: true, explain: '' })}
      onChange={(questions) => onChange({ ...step, questions })}
      render={(q, i, set) => (
        <div className="tfrow">
          <input value={q.text} onChange={(e) => set({ ...q, text: e.target.value })} placeholder={`العبارة ${toAr(i + 1)}`} />
          <div className="tfrow__ans">
            <button type="button" className={q.answer ? 'is-on' : ''} onClick={() => set({ ...q, answer: true })}>
              ✓ صح
            </button>
            <button type="button" className={!q.answer ? 'is-on is-false' : ''} onClick={() => set({ ...q, answer: false })}>
              ✗ خطأ
            </button>
          </div>
          <input value={q.explain} onChange={(e) => set({ ...q, explain: e.target.value })} placeholder="التفسير (يظهر بعد الإجابة)" />
        </div>
      )}
    />
  )
}

/** try one challenge with the game's own window */
function StepPreview({ step, color, onClose }: { step: ChallengeStep; color: string; onClose: () => void }) {
  const [done, setDone] = useState(false)
  return (
    <div className="modal modal--quiz" role="dialog" aria-modal aria-label="تجربة التحدي">
      <div className="quiz challenge" style={{ ['--c' as string]: color }}>
        <div className="quiz__head">
          <span className="quiz__badge" style={{ background: color }}>
            تجربة: {kindInfo(step.kind).name}
          </span>
        </div>
        {done ? (
          <div className="quiz__result">
            <div className="quiz__verdict">✓ يعمل التحدي — هكذا ستراه اللاعبة في اللعبة</div>
            <button className="btn btn--primary btn--xl" onClick={onClose}>
              رجوع إلى التصميم
            </button>
          </div>
        ) : (
          <>
            {step.kind === 'order' && <OrderStep step={step} onDone={() => setDone(true)} />}
            {step.kind === 'match' && <MatchStep step={step} onDone={() => setDone(true)} />}
            {step.kind === 'choice' && <ChoiceStep step={step} onDone={() => setDone(true)} />}
            {step.kind === 'multi' && <MultiStep step={step} onDone={() => setDone(true)} />}
            {step.kind === 'tf' && <TFStep questions={step.questions} onDone={() => setDone(true)} />}
            <button className="quiz__later" onClick={onClose}>
              إغلاق
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ================================================================ studio */

export function Studio() {
  const [id, setId] = useState<StationId>('nav')
  const [doc, setDoc] = useState<StationContent | null>(null)
  const [saved, setSaved] = useState('')
  const [live, setLive] = useState(false)
  const [tryStep, setTryStep] = useState<number | null>(null)
  const [fullTry, setFullTry] = useState(false)
  const [msg, setMsg] = useState('')
  const [showIssues, setShowIssues] = useState(false)
  const def = STATIONS[id]
  const color = def.color

  // load the draft of the chosen station (or start from the station's current content)
  useEffect(() => {
    let alive = true
    setDoc(null)
    Promise.all([db.get('drafts', id).catch(() => undefined), db.get('live', id).catch(() => undefined)]).then(([d, l]) => {
      if (!alive) return
      setDoc(d ?? ORIGINAL[id])
      setLive(!!l)
      setSaved(d ? 'استُعيد تصميمكِ المحفوظ ✓' : '')
    })
    return () => {
      alive = false
    }
  }, [id])

  // auto-save (only after the student changes something)
  const dirty = useRef(false)
  const save = (d: StationContent) =>
    db
      .put('drafts', { ...d, updated: new Date().toISOString() })
      .then(() => setSaved('حُفظ تلقائياً ✓'))
      .catch(() => setSaved('تعذّر الحفظ على هذا الجهاز'))
  useEffect(() => {
    if (!doc || !dirty.current) return
    const t = setTimeout(() => {
      dirty.current = false
      save(doc)
    }, 600)
    return () => clearTimeout(t)
  }, [doc])
  const switchTo = (s: StationId) => {
    if (doc && dirty.current) {
      dirty.current = false
      save(doc)
    }
    setId(s)
  }

  // full preview: riddle → challenge → reward, with the game's windows
  const riddleOpen = useStore((s) => s.riddleOpen)
  const quizOpen = useStore((s) => s.stationQuiz)
  const award = useStore((s) => s.stampAward)
  const phase = useRef<'riddle' | 'challenge' | null>(null)
  useEffect(() => {
    if (!fullTry) return
    if (phase.current === 'riddle' && riddleOpen === null) {
      phase.current = 'challenge'
      useStore.setState({ stationQuiz: id })
    } else if (phase.current === 'challenge' && quizOpen === null && award === null) {
      phase.current = null
      setFullTry(false)
    }
  }, [fullTry, riddleOpen, quizOpen, award, id])

  const issues = useMemo(() => (doc ? check(doc) : []), [doc])
  const errors = issues.filter((x) => !x.tip)

  if (!doc) return <div className="studio-loading">جارٍ التحميل…</div>
  const update = (fn: (d: StationContent) => void) => {
    dirty.current = true
    setDoc((d) => {
      const n = structuredClone(d!)
      fn(n)
      return n
    })
  }
  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 3500)
  }
  const needValid = () => {
    if (!errors.length) return true
    setShowIssues(true)
    sfx.wrong()
    document.getElementById('check')?.scrollIntoView({ behavior: 'smooth' })
    return false
  }

  const startFullTry = () => {
    if (!needValid()) return
    applyContent(cleaned(doc))
    sfx.click()
    setFullTry(true)
    if (STATIONS[id].riddle) {
      phase.current = 'riddle'
      useStore.setState({ riddleOpen: id })
    } else {
      phase.current = 'challenge'
      useStore.setState({ stationQuiz: id })
    }
  }
  const endFullTry = () => {
    phase.current = null
    setFullTry(false)
    useStore.setState({ riddleOpen: null, stationQuiz: null, stampAward: null })
  }
  const tryInGame = async () => {
    if (!needValid()) return
    await db.put('live', { ...cleaned(doc), updated: new Date().toISOString() })
    setLive(true)
    window.open(`./?preview=${id}`, '_blank')
  }
  const removeFromGame = async () => {
    await db.del('live', id)
    setLive(false)
    flash('أُلغي التصميم من اللعبة على هذا الجهاز')
  }
  const exportFile = () => {
    if (!needValid()) return
    const data = { ...cleaned(doc), version: 1, id, updated: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `تحديات-${def.short.replace(/\s+/g, '-')}-${(doc.team || 'فريق').trim().replace(/[\s—]+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    flash('تم تنزيل الملف ⬇ أرسليه إلى المعلمة')
  }
  const importFile = async (f?: File) => {
    if (!f) return
    try {
      const c = JSON.parse(await f.text()) as StationContent
      if (!STATION_ORDER.includes(c.id) || !Array.isArray(c.challenge)) throw new Error()
      await db.put('drafts', c)
      if (c.id === id) setDoc(c)
      else setId(c.id)
      flash(`فُتح تصميم «${STATIONS[c.id].short}»${c.team ? ' — ' + c.team : ''} ✓`)
    } catch {
      flash('هذا الملف ليس تصميماً من استوديو التحديات')
    }
  }
  const restore = () => {
    if (!window.confirm('سيُستبدل تصميمكِ بمحتوى المحطة الأصلي. هل أنتِ متأكدة؟')) return
    dirty.current = true
    setDoc(ORIGINAL[id])
    flash('استُعيد المحتوى الأصلي')
  }

  const r = doc.riddle
  const steps = doc.challenge ?? []
  const cardsDone = (doc.items ?? []).some((it) => filled(it.text))
  return (
    <div className="studio" style={{ ['--c' as string]: color }}>
      <header className="studio__top">
        <a className="studio__back" href="./">
          ← اللعبة
        </a>
        <div>
          <h1>استوديو التحديات ✏️</h1>
          <p>صمّمي محطتكِ في «عُمان تُروى من جديد» بدون برمجة: لغز، وبطاقات، وتحديات، وصوتكِ.</p>
        </div>
      </header>

      <nav className="studio__stations" aria-label="اختاري المحطة">
        {STATION_ORDER.map((s) => (
          <button key={s} className={s === id ? 'is-on' : ''} style={{ ['--c' as string]: STATIONS[s].color }} onClick={() => switchTo(s)}>
            <svg viewBox="0 0 100 100" aria-hidden>
              <StationIcon id={s} color={s === id ? '#fff' : STATIONS[s].color} />
            </svg>
            {STATIONS[s].short}
          </button>
        ))}
      </nav>

      <div className="studio__main">
        <p className="studio__how">
          <b>كيف أصمّم؟</b> ١. اكتبي اللغز والبطاقات والتحديات بالترتيب ← ٢. جرّبي كل تحدٍّ بزر «جرّبي» ← ٣. «جرّبيها في اللعبة» ← ٤. «تنزيل الملف» وأرسليه للمعلمة.
          يُحفظ عملكِ تلقائياً على هذا الجهاز.
        </p>

        <Section n={1} id="start" title="البداية" intro="اسم فريقكِ، وجملة الترحيب التي تظهر عند دخول المحطة، ويمكنكِ تسجيل مقدمة بصوتكِ." done={filled(doc.team)}>
          <Field label="اسم الفريق / الطالبات">
            <input value={doc.team ?? ''} onChange={(e) => update((d) => void (d.team = e.target.value))} placeholder="مثال: فريق المستكشفات — الصف السابع" />
          </Field>
          <Field label="جملة الترحيب">
            <textarea rows={2} value={doc.intro ?? ''} onChange={(e) => update((d) => void (d.intro = e.target.value))} />
          </Field>
          <AudioField label="المقدمة بصوتكِ (اختياري)" value={doc.introAudio} onChange={(v) => update((d) => void (d.introAudio = v))} />
        </Section>

        <Section n={2} id="riddle" title="لغز «من أنا؟» 🔍" intro="يظهر أول ما تدخل اللاعبة المحطة: وصف قصير، ثم سؤال وثلاثة خيارات." done={!!r && !issues.some((x) => x.where === 'اللغز')}>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!r}
              onChange={(e) =>
                update(
                  (d) =>
                    void (d.riddle = e.target.checked
                      ? ORIGINAL[id].riddle ?? { kicker: KICKERS[0], text: '', question: QUESTIONS[0], options: ['', '', ''], answer: -1, reveal: { title: '', subtitle: '' } }
                      : null),
                )
              }
            />
            أريد لغزاً في بداية المحطة
          </label>
          {r && (
            <>
              <div className="grid2">
                <Field label="العنوان">
                  <select value={r.kicker} onChange={(e) => update((d) => void (d.riddle!.kicker = e.target.value))}>
                    {[...new Set([r.kicker, ...KICKERS])].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </Field>
                <Field label="السؤال">
                  <select value={r.question} onChange={(e) => update((d) => void (d.riddle!.question = e.target.value))}>
                    {[...new Set([r.question, ...QUESTIONS])].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="وصف اللغز (بصيغة المتكلم)" hint="مثال: أنا قاضٍ ومؤرخ عُماني، طلبتُ العلم في نزوى…">
                <textarea rows={3} value={r.text} onChange={(e) => update((d) => void (d.riddle!.text = e.target.value))} />
              </Field>
              <span className="sf__label">الخيارات — اضغطي الدائرة بجانب الإجابة الصحيحة 🔘</span>
              <div className="rows">
                {r.options.map((o, i) => (
                  <div className="rows__row" key={i}>
                    <div className="opt">
                      <button type="button" className={'opt__mark' + (r.answer === i ? ' is-on' : '')} onClick={() => update((d) => void (d.riddle!.answer = i))}>
                        {r.answer === i ? '✓' : ''}
                      </button>
                      <input value={o} onChange={(e) => update((d) => void (d.riddle!.options[i] = e.target.value))} placeholder={`الخيار ${toAr(i + 1)}`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid2">
                <Field label="يظهر بعد الحل: الاسم">
                  <input value={r.reveal.title} onChange={(e) => update((d) => void (d.riddle!.reveal.title = e.target.value))} />
                </Field>
                <Field label="وتحته سطر قصير">
                  <input value={r.reveal.subtitle} onChange={(e) => update((d) => void (d.riddle!.reveal.subtitle = e.target.value))} />
                </Field>
              </div>
            </>
          )}
        </Section>

        <Section n={3} id="cards" title="بطاقات المحتوى 📖" intro="كل بطاقة تظهر عند نقطة مضيئة في المشهد. اكتبي المعلومة من الموسوعة ومرجعها، وسجّليها بصوتكِ. البطاقة الفارغة تُخفي نقطتها." done={cardsDone}>
          {(doc.items ?? []).map((it, i) => (
            <div className="card-ed" key={it.key}>
              <div className="card-ed__head">
                <b>البطاقة {toAr(i + 1)}</b>
                <small>📍 {POINTS[id][it.key] ?? 'نقطة في المشهد'}</small>
              </div>
              <div className="grid-icon">
                <Field label="الرمز">
                  <select value={it.icon} onChange={(e) => update((d) => void (d.items![i].icon = e.target.value))}>
                    {[...new Set([it.icon ?? '📜', ...ICONS])].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </Field>
                <Field label="العنوان">
                  <input value={it.title} onChange={(e) => update((d) => void (d.items![i].title = e.target.value))} placeholder="مثال: النشأة" />
                </Field>
              </div>
              <Field label="المعلومة">
                <textarea rows={4} value={it.text} onChange={(e) => update((d) => void (d.items![i].text = e.target.value))} />
              </Field>
              <Field label="المرجع 📚" hint="مثال: الموسوعة العُمانية، المجلد 3، ص 1129">
                <input value={it.ref ?? ''} onChange={(e) => update((d) => void (d.items![i].ref = e.target.value))} />
              </Field>
              <AudioField value={it.audio} onChange={(v) => update((d) => void (d.items![i].audio = v))} label="المعلومة بصوتكِ (اختياري)" />
            </div>
          ))}
        </Section>

        <Section n={4} id="challenges" title="التحديات 🗝️" intro="أضيفي تحدياً أو أكثر، وتظهر للاعبة بالترتيب مع تصحيح فوري. جرّبي كل تحدٍّ بعد كتابته." done={steps.length > 0 && steps.every((s) => !checkStep(s).length)}>
          {steps.map((st, i) => {
            const k = kindInfo(st.kind)
            const probs = checkStep(st)
            return (
              <div className="ch-ed" key={i}>
                <div className="ch-ed__head">
                  <b>
                    التحدي {toAr(i + 1)}: {k.icon} {k.name}
                  </b>
                  <div className="rows__tools">
                    <button type="button" disabled={i === 0} onClick={() => update((d) => void ([d.challenge![i - 1], d.challenge![i]] = [d.challenge![i], d.challenge![i - 1]]))}>
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={i === steps.length - 1}
                      onClick={() => update((d) => void ([d.challenge![i + 1], d.challenge![i]] = [d.challenge![i], d.challenge![i + 1]]))}
                    >
                      ▼
                    </button>
                    <button type="button" onClick={() => window.confirm('حذف هذا التحدي؟') && update((d) => void d.challenge!.splice(i, 1))}>
                      🗑
                    </button>
                  </div>
                </div>
                <StepEditor step={st} onChange={(s) => update((d) => void (d.challenge![i] = s))} />
                <div className="ch-ed__foot">
                  {probs.length ? <small className="sf__err">⚠ {probs[0]}</small> : <small className="sf__ok">✓ جاهز</small>}
                  <button type="button" className="sbtn sbtn--sm" disabled={!!probs.length} onClick={() => setTryStep(i)}>
                    ▶ جرّبي التحدي
                  </button>
                </div>
              </div>
            )
          })}
          <div className="kinds">
            <span className="sf__label">➕ أضيفي تحدياً:</span>
            <div className="kinds__grid">
              {KINDS.map((k) => (
                <button type="button" key={k.kind} onClick={() => update((d) => void (d.challenge = [...(d.challenge ?? []), newStep(k.kind)]))}>
                  <span>{k.icon}</span>
                  <b>{k.name}</b>
                  <small>{k.hint}</small>
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section n={5} id="end" title="الختام 💡" intro="بطاقة «اكتشفي معلومة» تُفتح بعد التحديات، ثم المرجع، ثم كلمة الختام قبل الختم." done={!!doc.fact?.lines.some(filled) || !!doc.outro?.text}>
          <Field label="عنوان بطاقة المعلومة">
            <input
              value={doc.fact?.title ?? ''}
              onChange={(e) => update((d) => void (d.fact = { title: e.target.value, lines: d.fact?.lines ?? [''] }))}
              placeholder="اكتشفي معلومة 💡"
            />
          </Field>
          <span className="sf__label">المعلومة (ويمكن إضافة معلومة ثانية)</span>
          <ListRows
            items={doc.fact?.lines ?? ['']}
            min={1}
            max={3}
            addLabel="معلومة أخرى"
            make={() => ''}
            onChange={(lines) => update((d) => void (d.fact = { title: d.fact?.title || 'اكتشفي معلومة 💡', lines }))}
            render={(l, i, set) => <textarea rows={2} value={l} onChange={(e) => set(e.target.value)} placeholder={`المعلومة ${toAr(i + 1)}`} />}
          />
          <Field label="المرجع العام للمحطة 📚" hint="مثال: الموسوعة العُمانية، مادة «…»، المجلد 3، ص 1129–1130">
            <input value={doc.ref ?? ''} onChange={(e) => update((d) => void (d.ref = e.target.value))} />
          </Field>
          <Field label="كلمة الختام (تظهر قبل الختم)">
            <textarea
              rows={3}
              value={doc.outro?.text ?? ''}
              onChange={(e) => update((d) => void (d.outro = { text: e.target.value, audio: d.outro?.audio }))}
              placeholder="أحسنتِ أيتها المستكشفة! لقد تعرّفتِ اليوم على…"
            />
          </Field>
          <AudioField
            label="كلمة الختام بصوتكِ (اختياري)"
            value={doc.outro?.audio}
            onChange={(v) => update((d) => void (d.outro = { text: d.outro?.text ?? '', audio: v }))}
          />
        </Section>

        <section className="ss ss--check" id="check">
          <header className="ss__head">
            <span className={'ss__n' + (errors.length ? '' : ' is-done')}>{errors.length ? '!' : '✓'}</span>
            <div>
              <h2>{errors.length ? 'قبل التجربة والإرسال' : 'تصميمكِ جاهز 🎉'}</h2>
              <p>{errors.length ? `بقيت ${toAr(errors.length)} ملاحظة تحتاج إلى إكمال.` : 'جرّبيه كاملاً، ثم في اللعبة، ثم نزّلي الملف وأرسليه للمعلمة.'}</p>
            </div>
          </header>
          {(showIssues || errors.length > 0) && issues.length > 0 && (
            <ul className="issues">
              {issues.map((x, i) => (
                <li key={i} className={x.tip ? 'is-tip' : ''}>
                  <b>{x.where}:</b> {x.msg}
                </li>
              ))}
            </ul>
          )}
          <div className="studio__actions">
            <button className="sbtn" onClick={startFullTry}>
              ▶ جرّبي المحطة كاملة
            </button>
            <button className="sbtn" onClick={tryInGame}>
              🎮 جرّبيها في اللعبة
            </button>
            <button className="sbtn sbtn--main" onClick={exportFile}>
              ⬇ تنزيل الملف لإرساله
            </button>
          </div>
          <div className="studio__actions studio__actions--small">
            <label className="sbtn sbtn--ghost sbtn--sm">
              ⬆ فتح ملف تصميم
              <input type="file" accept=".json,application/json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
            </label>
            {live && (
              <button className="sbtn sbtn--ghost sbtn--sm" onClick={removeFromGame}>
                ✕ إلغاء التصميم من اللعبة على هذا الجهاز
              </button>
            )}
            <button className="sbtn sbtn--ghost sbtn--sm" onClick={restore}>
              ↺ استعادة المحتوى الأصلي
            </button>
          </div>
        </section>
      </div>

      <footer className="studio__bar">
        <span>{saved}</span>
        {msg && <b className="studio__msg">{msg}</b>}
      </footer>

      {tryStep !== null && steps[tryStep] && <StepPreview step={cleaned(doc).challenge![tryStep]} color={color} onClose={() => setTryStep(null)} />}
      {fullTry && (
        <>
          <StationRiddle />
          <StationChallenge />
          {award && (
            <div className="modal" role="dialog" aria-modal onClick={endFullTry}>
              <div className="quiz is-correct studio-award" onClick={(e) => e.stopPropagation()}>
                <div className="studio-award__stamp" style={{ borderColor: color, color }}>
                  🏅 {STATIONS[id].stampLabel}
                </div>
                <h2 className="quiz__text">خُتم الجواز!</h2>
                <p>هكذا تحصل اللاعبة على ختم المحطة بعد إكمال تحدياتكِ.</p>
                <button className="btn btn--primary btn--xl" onClick={endFullTry}>
                  رجوع إلى التصميم
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
