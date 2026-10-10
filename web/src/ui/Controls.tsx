import { useEffect, useRef, useState } from 'react'
import { input } from '../game/input'
import { useStore } from '../store'

/** On-screen joystick (mobile). Pushing it all the way makes her run. */
export function Joystick() {
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const pid = useRef<number | null>(null)
  const R = 52

  const move = (e: React.PointerEvent) => {
    const b = base.current!.getBoundingClientRect()
    let dx = e.clientX - (b.left + b.width / 2)
    let dy = e.clientY - (b.top + b.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > R) {
      dx = (dx / d) * R
      dy = (dy / d) * R
    }
    knob.current!.style.transform = `translate(${dx}px, ${dy}px)`
    input.joyX = dx / R
    input.joyY = -dy / R
  }
  const end = () => {
    pid.current = null
    input.joyX = 0
    input.joyY = 0
    if (knob.current) knob.current.style.transform = 'translate(0px, 0px)'
  }
  useEffect(() => end, [])
  return (
    <div
      ref={base}
      className="joy"
      onPointerDown={(e) => {
        pid.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e)
      }}
      onPointerMove={(e) => pid.current === e.pointerId && move(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="joy__ring" />
      <div ref={knob} className="joy__knob" />
    </div>
  )
}

export const PROMPTS: Record<string, { icon: string; label: string; verb: string }> = {
  screen: { icon: '📺', label: 'مشاهدة', verb: 'لمشاهدة الفيديو' },
  dig: { icon: '⛏', label: 'احفري', verb: 'للحفر والكشف عن القطعة' },
  lamp: { icon: '💡', label: 'أطفئي', verb: 'لإطفاء المصباح' },
  map: { icon: '🗺', label: 'الخريطة', verb: 'لفتح خريطة التجارة' },
  mirror: { icon: '🪞', label: 'المرآة', verb: 'لفتح خزانة مريم' },
  stars: { icon: '✨', label: 'السماء', verb: 'للنظر إلى النجوم' },
  piece: { icon: '👘', label: 'ما اسمها؟', verb: 'لمعرفة اسم القطعة' },
}

export function ActionButtons() {
  const prompt = useStore((s) => s.prompt)
  const p = prompt ? PROMPTS[prompt] : null
  return (
    <div className="actions">
      {p && (
        <button className="act act--use" onPointerDown={() => (input.interact = true)}>
          {p.icon}
          <span>{p.label}</span>
        </button>
      )}
      <button className="act act--jump" onPointerDown={() => (input.jump = true)}>
        ⤒<span>قفز</span>
      </button>
    </div>
  )
}

export function KeyHints() {
  const [open, setOpen] = useState(true)
  if (!open)
    return (
      <button className="keys keys--mini" onClick={() => setOpen(true)}>
        ⌨ التحكم
      </button>
    )
  return (
    <div className="keys">
      <button className="keys__close" onClick={() => setOpen(false)} aria-label="إخفاء">
        ×
      </button>
      <div className="keys__row">
        <span className="kbd-group">
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd>
        </span>
        <span>أو الأسهم: الحركة</span>
      </div>
      <div className="keys__row">
        <kbd className="wide">Shift</kbd>
        <span>الجري</span>
        <kbd className="wide">مسافة</kbd>
        <span>القفز</span>
      </div>
      <div className="keys__row">
        <kbd>E</kbd>
        <span>تفاعل</span>
        <span className="mouse">🖱</span>
        <span>اسحبي لتدوير الكاميرا</span>
      </div>
    </div>
  )
}
