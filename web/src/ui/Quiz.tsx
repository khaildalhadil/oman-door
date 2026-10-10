import { useEffect, useMemo, useState } from 'react'
import { sfx } from '../game/sfx'
import { useStore } from '../store'

export const toAr = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])

const PRAISE = ['أحسنت! 🌟', 'رائع! 👏', 'إجابة ممتازة! ✨', 'صحيح، أنت بطل! 🏆']

/* ------------------------------------------------------------ question */

export function QuizModal() {
  const active = useStore((s) => s.activeStation)
  const round = useStore((s) => s.round)
  const answers = useStore((s) => s.answers)
  const answer = useStore((s) => s.answer)
  const close = useStore((s) => s.closeStation)
  const praise = PRAISE[(active ?? 0) % PRAISE.length]
  const q = active !== null ? round[active] : null
  const a = active !== null ? answers[active] : null

  useEffect(() => {
    if (!a) return
    if (a.correct) sfx.correct()
    else sfx.wrong()
  }, [a])

  useEffect(() => {
    if (active === null) return
    const onKey = (e: KeyboardEvent) => {
      if (a && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape')) {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, a, close])

  if (active === null || !q) return null
  const done = answers.filter(Boolean).length
  return (
    <div className="modal modal--quiz" role="dialog" aria-modal aria-label="سؤال">
      <div className={'quiz' + (a ? (a.correct ? ' is-correct' : ' is-wrong') : '')}>
        <div className="quiz__head">
          <span className="quiz__badge">سؤال {toAr(active + 1)}</span>
          <span className="quiz__progress">
            {round.map((_, i) => (
              <i key={i} className={answers[i] ? (answers[i]!.correct ? 'ok' : 'bad') : i === active ? 'cur' : ''} />
            ))}
          </span>
        </div>
        <p className="quiz__kicker">صح أم خطأ؟</p>
        <h2 className="quiz__text">{q.text}</h2>
        {!a ? (
          <div className="quiz__choices">
            <button className="choice choice--true" onClick={() => answer(active, true)}>
              <span className="choice__icon">✓</span>
              صح
            </button>
            <button className="choice choice--false" onClick={() => answer(active, false)}>
              <span className="choice__icon">✗</span>
              خطأ
            </button>
          </div>
        ) : (
          <div className="quiz__result">
            <div className="quiz__verdict">
              {a.correct ? praise : `الإجابة الصحيحة: «${q.answer ? 'صح' : 'خطأ'}»`}
            </div>
            <p className="quiz__explain">
              <b>هل تعلم؟ </b>
              {q.explain}
            </p>
            <button className="btn btn--primary btn--xl" onClick={close} autoFocus>
              {done === round.length ? 'عرض النتيجة 🏅' : 'متابعة'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* --------------------------------------------------------- certificate */

function grade(score: number, total: number) {
  const p = total ? score / total : 0
  if (p >= 0.9) return 'ممتاز'
  if (p >= 0.75) return 'جيد جداً'
  if (p >= 0.5) return 'جيد'
  return 'مشارك'
}

function drawCertificate(name: string, score: number, total: number) {
  const W = 1600
  const H = 1130
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const bg = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7)
  bg.addColorStop(0, '#fffaf0')
  bg.addColorStop(1, '#ecd9b2')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  // frames
  g.strokeStyle = '#7a1f1f'
  g.lineWidth = 26
  g.strokeRect(30, 30, W - 60, H - 60)
  g.strokeStyle = '#c9a14a'
  g.lineWidth = 6
  g.strokeRect(70, 70, W - 140, H - 140)
  // crenellation band at the top
  g.fillStyle = '#c9a14a'
  for (let x = 110; x < W - 110; x += 60) {
    g.beginPath()
    g.moveTo(x, 150)
    g.lineTo(x, 120)
    g.lineTo(x + 18, 120)
    g.lineTo(x + 30, 100)
    g.lineTo(x + 42, 120)
    g.lineTo(x + 60, 120)
    g.lineTo(x + 60, 150)
    g.closePath()
    g.fill()
  }
  // corner diamonds
  for (const [x, y] of [
    [70, 70],
    [W - 70, 70],
    [70, H - 70],
    [W - 70, H - 70],
  ]) {
    g.save()
    g.translate(x, y)
    g.rotate(Math.PI / 4)
    g.fillStyle = '#7a1f1f'
    g.fillRect(-26, -26, 52, 52)
    g.fillStyle = '#e7c97f'
    g.fillRect(-12, -12, 24, 24)
    g.restore()
  }
  g.direction = 'rtl'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#7a1f1f'
  g.font = '700 118px "Reem Kufi", "Tajawal", sans-serif'
  g.fillText('شهادة إنجاز', W / 2, 270)
  g.fillStyle = '#3a2616'
  g.font = '500 44px "Tajawal", sans-serif'
  g.fillText('تُمنح هذه الشهادة إلى', W / 2, 400)
  g.fillStyle = '#1f5c45'
  g.font = '700 96px "Reem Kufi", "Tajawal", sans-serif'
  g.fillText(name || 'المستكشف الصغير', W / 2, 510)
  g.strokeStyle = '#c9a14a'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(W / 2 - 380, 580)
  g.lineTo(W / 2 + 380, 580)
  g.stroke()
  g.fillStyle = '#3a2616'
  g.font = '500 42px "Tajawal", sans-serif'
  g.fillText('تقديراً لإنجاز «تحدي قلعة نزوى» في رحلة عُمان ثلاثية الأبعاد', W / 2, 650)
  // stars
  const size = 60
  const x0 = W / 2 + ((total - 1) * size * 1.25) / 2
  for (let i = 0; i < total; i++) {
    const x = x0 - i * size * 1.25
    star(g, x, 760, size / 2, i < score ? '#e8b931' : '#d9cbb0', i < score ? '#8a6510' : '#b8a888')
  }
  g.fillStyle = '#7a1f1f'
  g.font = '700 56px "Reem Kufi", "Tajawal", sans-serif'
  g.fillText(`النتيجة: ${toAr(score)} من ${toAr(total)} — التقدير: ${grade(score, total)}`, W / 2, 860)
  g.fillStyle = '#5a4630'
  g.font = '400 34px "Tajawal", sans-serif'
  const date = new Date().toLocaleDateString('ar-OM', { year: 'numeric', month: 'long', day: 'numeric' })
  g.fillText(`التاريخ: ${date}`, W / 2, 950)
  g.textAlign = 'right'
  g.fillText('المعلم/ة: ....................', W - 170, 1020)
  g.textAlign = 'left'
  g.fillText('المدرسة: ....................', 170, 1020)
  return c
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke: string) {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  g.closePath()
  g.fillStyle = fill
  g.fill()
  g.lineWidth = 4
  g.strokeStyle = stroke
  g.stroke()
}

export function Certificate() {
  const open = useStore((s) => s.certificateOpen)
  const setOpen = useStore((s) => s.setCertificateOpen)
  const name = useStore((s) => s.playerName)
  const setName = useStore((s) => s.setPlayerName)
  const round = useStore((s) => s.round)
  const answers = useStore((s) => s.answers)
  const newRound = useStore((s) => s.newRound)
  const score = answers.filter((a) => a?.correct).length
  const total = round.length
  const [draft, setDraft] = useState(name)
  const url = useMemo(() => (open ? drawCertificate(name, score, total).toDataURL('image/png') : ''), [open, name, score, total])

  useEffect(() => {
    if (open) sfx.win()
  }, [open])
  useEffect(() => setDraft(name), [name])
  if (!open) return null
  return (
    <div className="modal" role="dialog" aria-modal aria-label="الشهادة">
      <div className="modal__box cert">
        <div className="modal__head">
          <div>
            <span className="kicker">انتهى التحدي 🎉</span>
            <h3>
              حصلت على {toAr(score)} من {toAr(total)} نجوم
            </h3>
          </div>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <div className="cert__grid">
          <img className="cert__img" src={url} alt="شهادة إنجاز" />
          <div className="cert__side">
            <label className="field">
              <span>الاسم على الشهادة</span>
              <input value={draft} maxLength={40} onChange={(e) => setDraft(e.target.value)} onBlur={() => setName(draft.trim())} placeholder="اكتب اسمك" />
            </label>
            <ol className="cert__list">
              {round.map((q, i) => (
                <li key={q.id} className={answers[i]?.correct ? 'ok' : 'bad'}>
                  <span>{answers[i]?.correct ? '✓' : '✗'}</span>
                  {q.text}
                </li>
              ))}
            </ol>
            <div className="cert__actions">
              <a className="btn btn--primary" href={url} download={`شهادة-قلعة-نزوى-${name || 'طالب'}.png`}>
                ⬇ تحميل الشهادة
              </a>
              <button
                className="btn btn--ghost"
                onClick={() => {
                  newRound()
                  setOpen(false)
                }}
              >
                ↻ جولة جديدة بأسئلة أخرى
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
