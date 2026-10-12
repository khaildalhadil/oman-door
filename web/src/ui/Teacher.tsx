import { useRef, useState } from 'react'
import { DEFAULT_QUESTIONS, loadBank, resetBank, saveBank, type Question } from '../game/quiz'
import { useStore } from '../store'
import { toAr } from './Quiz'

// رمز الدخول إلى لوحة المعلم (يمكن تغييره هنا).
export const TEACHER_PIN = '1234'

export function TeacherPanel() {
  const open = useStore((s) => s.teacherOpen)
  const setOpen = useStore((s) => s.setTeacherOpen)
  const newRound = useStore((s) => s.newRound)
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [items, setItems] = useState<Question[]>(() => loadBank())
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)
  if (!open) return null

  const update = (i: number, patch: Partial<Question>) => setItems((q) => q.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 2500)
  }
  const valid = items.filter((q) => q.text.trim())

  const save = () => {
    if (valid.length < 1) return flash('أضف سؤالاً واحداً على الأقل')
    saveBank(valid)
    newRound()
    flash(`تم الحفظ ✓ — ${toAr(valid.length)} سؤالاً في البنك`)
  }
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(valid, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'اسئلة-قلعة-نزوى.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importJson = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as Question[]
      if (!Array.isArray(data) || !data.every((q) => typeof q.text === 'string' && typeof q.answer === 'boolean'))
        throw new Error()
      setItems(data.map((q, i) => ({ id: q.id || `imp${i}`, text: q.text, answer: q.answer, explain: q.explain || '' })))
      flash('تم الاستيراد — اضغط «حفظ» لاعتماد الأسئلة')
    } catch {
      flash('الملف غير صالح')
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal aria-label="لوحة المعلم">
      <div className="modal__box teacher">
        <div className="modal__head">
          <div>
            <span className="kicker">للمعلم فقط</span>
            <h3>لوحة المعلم — بنك الأسئلة</h3>
          </div>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <a className="studio-link" href="./studio.html" target="_blank" rel="noopener">
          ✏️ استوديو التحديات: تصمّم فيه الطالبات لغز المحطة وبطاقاتها وتحدياتها بأصواتهن، بدون برمجة
        </a>
        {!unlocked ? (
          <form
            className="teacher__lock"
            onSubmit={(e) => {
              e.preventDefault()
              if (pin === TEACHER_PIN) setUnlocked(true)
              else flash('الرمز غير صحيح')
            }}
          >
            <p>أدخل رمز المعلم لعرض الأسئلة وتعديلها.</p>
            <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="الرمز" autoFocus />
            <button className="btn btn--primary">دخول</button>
            {msg && <p className="teacher__msg">{msg}</p>}
          </form>
        ) : (
          <>
            <p className="muted">
              يُختار في كل جولة ١٠ أسئلة عشوائياً من البنك. تُحفظ التعديلات في هذا المتصفح، واستخدم «تصدير» لنقلها إلى أجهزة
              أخرى أو للاحتفاظ بها للأعوام القادمة.
            </p>
            <div className="teacher__list">
              {items.map((q, i) => (
                <div className="tq" key={q.id + i}>
                  <span className="tq__n">{toAr(i + 1)}</span>
                  <div className="tq__body">
                    <textarea value={q.text} rows={2} placeholder="نص العبارة" onChange={(e) => update(i, { text: e.target.value })} />
                    <input value={q.explain} placeholder="معلومة تظهر بعد الإجابة" onChange={(e) => update(i, { explain: e.target.value })} />
                  </div>
                  <div className="tq__side">
                    <div className="seg">
                      <button className={q.answer ? 'on ok' : ''} onClick={() => update(i, { answer: true })}>
                        صح
                      </button>
                      <button className={!q.answer ? 'on bad' : ''} onClick={() => update(i, { answer: false })}>
                        خطأ
                      </button>
                    </div>
                    <button className="tq__del" onClick={() => setItems((x) => x.filter((_, k) => k !== i))} aria-label="حذف">
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="teacher__bar">
              <button
                className="btn btn--ghost"
                onClick={() => setItems((x) => [...x, { id: `t${Date.now()}`, text: '', answer: true, explain: '' }])}
              >
                + سؤال جديد
              </button>
              <button className="btn btn--primary" onClick={save}>
                حفظ واعتماد
              </button>
              <button className="btn btn--ghost" onClick={exportJson}>
                ⬇ تصدير
              </button>
              <button className="btn btn--ghost" onClick={() => file.current?.click()}>
                ⬆ استيراد
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => {
                  resetBank()
                  setItems(DEFAULT_QUESTIONS)
                  newRound()
                  flash('تمت استعادة الأسئلة الافتراضية')
                }}
              >
                ↺ الافتراضي
              </button>
              <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
              {msg && <span className="teacher__msg">{msg}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
