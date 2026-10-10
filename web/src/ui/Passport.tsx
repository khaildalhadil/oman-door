import { useEffect, useMemo, useState } from 'react'
import { asset } from '../content'
import { sfx } from '../game/sfx'
import { JOURNEY, STATION_ORDER, STATIONS, type StationId } from '../stations'
import { useStore } from '../store'
import { toAr } from './Quiz'

/* ------------------------------------------------------------- icons */

export function StationIcon({ id, color }: { id: StationId | 'final'; color: string }) {
  switch (id) {
    case 'nav':
      return (
        <g fill={color} stroke={color}>
          <path d="M10 62 Q50 82 92 58 L86 70 Q50 88 16 72 Z" />
          <path d="M52 64 L58 12" strokeWidth="4" fill="none" />
          <path d="M28 22 L82 8 L58 58 Z" opacity="0.85" />
          <path d="M8 86 Q18 80 28 86 T48 86 T68 86 T90 86" strokeWidth="4" fill="none" />
        </g>
      )
    case 'sumhuram':
      return (
        <g fill={color}>
          <path d="M10 24 L50 6 L90 24 Z" />
          <rect x="10" y="24" width="80" height="9" />
          {[18, 44, 70].map((x) => (
            <g key={x}>
              <rect x={x} y="36" width="12" height="42" />
              <rect x={x - 3} y="76" width="18" height="5" />
            </g>
          ))}
          <rect x="6" y="84" width="88" height="8" />
        </g>
      )
    case 'turtles':
      return (
        <g fill={color} stroke={color}>
          <ellipse cx="50" cy="54" rx="24" ry="28" />
          <circle cx="50" cy="18" r="9" />
          <ellipse cx="22" cy="40" rx="15" ry="6" transform="rotate(-35 22 40)" />
          <ellipse cx="78" cy="40" rx="15" ry="6" transform="rotate(35 78 40)" />
          <ellipse cx="30" cy="80" rx="9" ry="5" transform="rotate(35 30 80)" />
          <ellipse cx="70" cy="80" rx="9" ry="5" transform="rotate(-35 70 80)" />
          <path d="M50 30 L62 42 L62 62 L50 74 L38 62 L38 42 Z M50 30 L50 74 M38 52 L62 52" fill="none" stroke="#fff8e8" strokeWidth="2.5" opacity="0.8" />
        </g>
      )
    case 'ivory':
      return (
        <g fill={color} stroke={color}>
          <ellipse cx="56" cy="50" rx="30" ry="20" />
          <circle cx="26" cy="44" r="15" />
          <ellipse cx="34" cy="44" rx="9" ry="14" opacity="0.8" />
          <path d="M14 48 Q4 66 14 80" strokeWidth="7" fill="none" strokeLinecap="round" />
          {[36, 46, 64, 74].map((x) => (
            <rect key={x} x={x} y="60" width="9" height="24" rx="2" />
          ))}
          <path d="M18 58 Q22 68 32 64" stroke="#fff8e8" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M86 46 L94 58" strokeWidth="3" fill="none" />
        </g>
      )
    case 'clothing':
      return (
        <g fill={color} stroke={color}>
          <path d="M38 10 L62 10 L76 24 L71 36 L66 31 L69 90 L31 90 L34 31 L29 36 L24 24 Z" />
          <path d="M44 10 Q50 20 56 10" fill="#fff8e8" stroke="none" />
          <path d="M50 20 L50 44" stroke="#fff8e8" strokeWidth="2.5" />
          <circle cx="50" cy="46" r="3.5" fill="#fff8e8" stroke="none" />
          <path d="M31 80 L69 80" stroke="#fff8e8" strokeWidth="3" />
        </g>
      )
    default:
      return (
        <g fill={color}>
          <path d={omanPath()} />
        </g>
      )
  }
}

// simplified outline of Oman projected into a 100x100 box (for the final medal)
let _omanPath = ''
function omanPath() {
  if (_omanPath) return _omanPath
  const pts = [
    [56.37, 24.98], [56.75, 24.35], [57.35, 23.85], [57.9, 23.68], [58.55, 23.6], [58.95, 23.22], [59.53, 22.6],
    [59.8, 22.53], [59.83, 22.3], [59.5, 21.6], [58.85, 20.75], [58.25, 20.25], [57.7, 19.65], [57.6, 18.95],
    [56.65, 18.55], [55.6, 17.9], [55.05, 17.05], [54.4, 17.02], [53.95, 16.88], [53.1, 16.65], [52.75, 17.3],
    [52.0, 19.0], [54.2, 21.2], [55.2, 22.7], [55.75, 24.0], [56.1, 24.75],
  ]
  const tx = (lon: number) => 12 + ((lon - 51.6) / 8.6) * 76 * 0.93
  const ty = (lat: number) => 92 - ((lat - 16.4) / 10) * 84
  _omanPath =
    'M' + pts.map(([x, y]) => `${tx(x).toFixed(1)} ${ty(y).toFixed(1)}`).join(' L') + ' Z ' +
    'M' + [[56.08, 26.05], [56.32, 26.38], [56.48, 26.2], [56.35, 25.75], [56.15, 25.75]].map(([x, y]) => `${tx(x).toFixed(1)} ${ty(y).toFixed(1)}`).join(' L') + ' Z'
  return _omanPath
}

/* ------------------------------------------------------------- stamp */

const ROT: Record<StationId, number> = { nav: -10, sumhuram: 7, turtles: -5, ivory: 11, clothing: -8 }

export function StampMark({ id, x, y, r = 92, date, animate }: { id: StationId; x: number; y: number; r?: number; date?: number; animate?: boolean }) {
  const st = STATIONS[id]
  const k = r / 92
  return (
    <g transform={`translate(${x} ${y}) rotate(${ROT[id]}) scale(${k})`}>
      <g className={animate ? 'stamp-in' : undefined} filter="url(#ink)">
        <circle r="90" fill={st.color} opacity="0.06" />
        <circle r="88" fill="none" stroke={st.color} strokeWidth="7" />
        <circle r="74" fill="none" stroke={st.color} strokeWidth="2.5" />
        <g transform="translate(-34 -62) scale(0.68)">
          <StationIcon id={id} color={st.color} />
        </g>
        <text y="38" textAnchor="middle" fill={st.color} fontSize="20" fontWeight="800" fontFamily="Tajawal, sans-serif">
          {st.stampLabel}
        </text>
        <text y="60" textAnchor="middle" fill={st.color} fontSize="13" fontWeight="700" fontFamily="Tajawal, sans-serif">
          {date ? new Date(date).toLocaleDateString('ar-OM', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '★ ★ ★'}
        </text>
      </g>
    </g>
  )
}

function Defs() {
  return (
    <defs>
      <filter id="ink" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="d" />
        <feComponentTransfer in="n" result="mask">
          <feFuncA type="table" tableValues="0 0 1 1" />
        </feComponentTransfer>
        <feComposite in="d" in2="mask" operator="in" />
      </filter>
      <linearGradient id="page" x1="0" x2="1">
        <stop offset="0" stopColor="#fbf2dc" />
        <stop offset="1" stopColor="#f1e1bd" />
      </linearGradient>
      <linearGradient id="pageR" x1="1" x2="0">
        <stop offset="0" stopColor="#fbf2dc" />
        <stop offset="1" stopColor="#f1e1bd" />
      </linearGradient>
      <radialGradient id="gold" cx="0.4" cy="0.35">
        <stop offset="0" stopColor="#fff1b8" />
        <stop offset="0.55" stopColor="#e3b44a" />
        <stop offset="1" stopColor="#a8741c" />
      </radialGradient>
      <clipPath id="archClip">
        <path d="M230 520 L230 300 Q230 200 360 200 Q490 200 490 300 L490 520 Z" />
      </clipPath>
    </defs>
  )
}

/* ------------------------------------------------------------ spread */

const SLOTS: Record<StationId, [number, number]> = {
  nav: [1240, 300],
  sumhuram: [1040, 300],
  turtles: [840, 300],
  ivory: [1140, 545],
  clothing: [940, 545],
}

export function PassportSpread({ portrait, animateId }: { portrait: string; animateId?: StationId | null }) {
  const name = useStore((s) => s.playerName)
  const school = useStore((s) => s.school)
  const stamps = useStore((s) => s.stamps)
  const count = STATION_ORDER.filter((id) => stamps[id]).length
  const done = count === STATION_ORDER.length
  const date = new Date().toLocaleDateString('ar-OM', { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <svg className="passport__svg" viewBox="0 0 1400 900" xmlns="http://www.w3.org/2000/svg" direction="rtl">
      <Defs />
      <rect x="0" y="0" width="1400" height="900" rx="34" fill="#6b1d1d" />
      <rect x="24" y="24" width="676" height="852" rx="16" fill="url(#page)" />
      <rect x="700" y="24" width="676" height="852" rx="16" fill="url(#pageR)" />
      <rect x="670" y="24" width="60" height="852" fill="#000" opacity="0.07" />
      {/* subtle guilloche lines */}
      {Array.from({ length: 18 }, (_, i) => (
        <path key={i} d={`M40 ${120 + i * 42} Q360 ${100 + i * 42} 680 ${120 + i * 42}`} stroke="#c9a14a" strokeWidth="0.8" opacity="0.18" fill="none" />
      ))}
      {/* ---------------- left page: identity */}
      <text x="360" y="100" textAnchor="middle" fontSize="44" fontWeight="800" fill="#7a1f1f" fontFamily="'Reem Kufi', Tajawal, sans-serif">
        {JOURNEY.passportTitle}
      </text>
      <text x="360" y="148" textAnchor="middle" fontSize="22" fill="#5a4630" fontFamily="Tajawal, sans-serif">
        رحلة «{JOURNEY.title}»
      </text>
      <path d="M230 520 L230 300 Q230 200 360 200 Q490 200 490 300 L490 520 Z" fill="#e6d2a8" stroke="#c9a14a" strokeWidth="6" />
      <image href={portrait} x="215" y="205" width="290" height="330" clipPath="url(#archClip)" preserveAspectRatio="xMidYMid slice" />
      {[
        ['الاسم', name || '..................'],
        ['المدرسة', school || '..................'],
        ['تاريخ الرحلة', date],
      ].map(([k, v], i) => (
        <g key={k}>
          <text x="640" y={600 + i * 62} fontSize="26" fontWeight="700" fill="#7a1f1f" fontFamily="Tajawal, sans-serif" textAnchor="start">
            {k}:
          </text>
          <text x="500" y={600 + i * 62} fontSize="26" fill="#2a1a10" fontFamily="Tajawal, sans-serif" textAnchor="start">
            {v}
          </text>
          <line x1="80" y1={610 + i * 62} x2="495" y2={610 + i * 62} stroke="#c9b38a" strokeDasharray="4 6" />
        </g>
      ))}
      <g transform="translate(80 760)" stroke="#a8843c" fill="none" strokeWidth="2.2" opacity="0.6">
        <path d="M0 80 L0 30 L20 30 L20 15 L35 15 L35 30 L60 30 L60 5 L80 5 L80 30 L110 30 L110 80" />
        <path d="M140 80 Q150 40 145 10 M145 10 Q125 15 118 30 M145 10 Q165 12 172 28 M145 10 Q130 0 120 4" />
        <path d="M200 70 Q260 90 320 66 L312 80 Q260 98 206 82 Z M262 70 L268 20 L244 28 L262 62" />
      </g>
      <g transform="translate(560 760)" stroke="#a8843c" fill="none" strokeWidth="2" opacity="0.6">
        <circle cx="40" cy="40" r="36" />
        <path d="M40 4 L46 40 L40 76 L34 40 Z M4 40 L40 34 L76 40 L40 46 Z" fill="#a8843c" opacity="0.5" />
      </g>
      {/* ---------------- right page: stamps */}
      <text x="1040" y="100" textAnchor="middle" fontSize="40" fontWeight="800" fill="#7a1f1f" fontFamily="'Reem Kufi', Tajawal, sans-serif">
        أختام رحلتي في عُمان
      </text>
      <text x="1040" y="146" textAnchor="middle" fontSize="22" fill="#5a4630" fontFamily="Tajawal, sans-serif">
        {toAr(count)} من {toAr(STATION_ORDER.length)} أختام
      </text>
      {STATION_ORDER.map((id) => {
        const [x, y] = SLOTS[id]
        const st = STATIONS[id]
        const got = stamps[id]
        return (
          <g key={id}>
            <circle cx={x} cy={y} r="92" fill="none" stroke="#c9b38a" strokeWidth="3" strokeDasharray="10 9" />
            {!got && (
              <g transform={`translate(${x - 30} ${y - 40}) scale(0.6)`} opacity="0.22">
                <StationIcon id={id} color="#7a5a30" />
              </g>
            )}
            {got && <StampMark id={id} x={x} y={y} date={got} animate={animateId === id} />}
            <text x={x} y={y + 125} textAnchor="middle" fontSize="22" fontWeight="700" fill={got ? st.color : '#9a8664'} fontFamily="Tajawal, sans-serif">
              {st.title}
            </text>
          </g>
        )
      })}
      {done ? (
        <g transform="translate(1040 785)">
          <g className="medal-in">
            <path d="M-70 -10 L-95 70 L-62 58 L-50 92 L-30 20 Z M70 -10 L95 70 L62 58 L50 92 L30 20 Z" fill="#7a1f1f" />
            <circle r="78" fill="url(#gold)" stroke="#8a5d14" strokeWidth="5" />
            <circle r="64" fill="none" stroke="#8a5d14" strokeWidth="2" strokeDasharray="3 5" />
            <g transform="translate(-30 -52) scale(0.6)">
              <StationIcon id="final" color="#7a4a0c" />
            </g>
            <text y="40" textAnchor="middle" fontSize="20" fontWeight="800" fill="#5a3208" fontFamily="'Reem Kufi', Tajawal, sans-serif">
              {JOURNEY.finalTitle}
            </text>
          </g>
        </g>
      ) : (
        <text x="1040" y="790" textAnchor="middle" fontSize="21" fill="#8a7458" fontFamily="Tajawal, sans-serif">
          اجمع الأختام الخمسة لتحصل على وسام «{JOURNEY.finalTitle}» 🏅
        </text>
      )}
    </svg>
  )
}

function PassportCover() {
  return (
    <svg className="passport__cover" viewBox="0 0 700 900" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="leather" cx="0.4" cy="0.3">
          <stop offset="0" stopColor="#9b2c2c" />
          <stop offset="1" stopColor="#5a1414" />
        </radialGradient>
      </defs>
      <rect width="700" height="900" rx="30" fill="url(#leather)" />
      <rect x="28" y="28" width="644" height="844" rx="20" fill="none" stroke="#e3c27a" strokeWidth="3" strokeDasharray="10 8" />
      <rect x="48" y="48" width="604" height="804" rx="14" fill="none" stroke="#c9a14a" strokeWidth="1.5" />
      <g transform="translate(350 210)" stroke="#e3c27a" fill="none" strokeWidth="6" strokeLinecap="round">
        <path d="M-60 -60 Q0 -10 60 60 M60 -60 Q0 -10 -60 60" />
        <path d="M-8 -58 L8 -58 L8 6 Q20 34 40 40 Q8 44 -8 12 Z" fill="#e3c27a" stroke="none" />
        <path d="M-46 -6 L46 -6" strokeWidth="9" />
      </g>
      <text x="350" y="400" textAnchor="middle" fontSize="70" fontWeight="800" fill="#f3d78f" fontFamily="'Reem Kufi', Tajawal, sans-serif">
        جواز
      </text>
      <text x="350" y="480" textAnchor="middle" fontSize="58" fontWeight="800" fill="#f3d78f" fontFamily="'Reem Kufi', Tajawal, sans-serif">
        مستكشف عُمان
      </text>
      <g transform="translate(150 560)" stroke="#d9b465" fill="none" strokeWidth="3" opacity="0.9">
        <path d="M0 160 L0 70 L40 70 L40 40 L70 40 L70 70 L120 70 L120 20 L160 20 L160 70 L220 70 L220 160" />
        <path d="M260 160 Q280 90 270 30 M270 30 Q240 40 225 66 M270 30 Q300 34 314 60 M270 30 Q250 10 232 18" />
        <path d="M330 150 Q360 160 400 140 M-20 170 L420 170" />
      </g>
      <text x="350" y="780" textAnchor="middle" fontSize="26" fill="#e3c27a" fontFamily="Tajawal, sans-serif">
        سلطنة عُمان
      </text>
    </svg>
  )
}

/* ------------------------------------------------------- export PNG */

async function toDataURL(url: string) {
  const blob = await (await fetch(url)).blob()
  return await new Promise<string>((res) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.readAsDataURL(blob)
  })
}

async function downloadPassport(svg: SVGSVGElement | null, name: string) {
  if (!svg) return
  const clone = svg.cloneNode(true) as SVGSVGElement
  const img = clone.querySelector('image')
  if (img) img.setAttribute('href', await toDataURL(img.getAttribute('href')!))
  clone.querySelectorAll('.stamp-in, .medal-in').forEach((e) => e.removeAttribute('class'))
  const data = new XMLSerializer().serializeToString(clone)
  const im = new Image()
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data)
  await im.decode()
  const c = document.createElement('canvas')
  c.width = 2100
  c.height = 1350
  c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
  const a = document.createElement('a')
  a.href = c.toDataURL('image/png')
  a.download = `جواز-مستكشف-عمان-${name || 'طالبة'}.png`
  a.click()
}

/* ------------------------------------------------------------ modal */

export function PassportButton() {
  const stamps = useStore((s) => s.stamps)
  const setOpen = useStore((s) => s.setPassportOpen)
  const started = useStore((s) => s.started)
  const count = STATION_ORDER.filter((id) => stamps[id]).length
  if (!started) return null
  return (
    <button className="passport-btn" onClick={() => setOpen(true)} aria-label="جواز مستكشف عُمان">
      <svg viewBox="0 0 40 50" className="passport-btn__icon">
        <rect x="2" y="2" width="36" height="46" rx="4" fill="#7a1f1f" stroke="#e3c27a" strokeWidth="2" />
        <path d="M12 16 Q20 22 28 30 M28 16 Q20 22 12 30" stroke="#e3c27a" strokeWidth="2.4" fill="none" />
        <path d="M18.5 14 L21.5 14 L21.5 24 Q24 29 27 30 Q21 31 18.5 25 Z" fill="#e3c27a" />
        <path d="M8 40 L32 40" stroke="#e3c27a" strokeWidth="2" />
      </svg>
      <span className="passport-btn__label">جواز مستكشف عُمان</span>
      <b className="passport-btn__badge">
        {toAr(count)}/{toAr(STATION_ORDER.length)}
      </b>
    </button>
  )
}

export function PassportModal() {
  const open = useStore((s) => s.passportOpen)
  const setOpen = useStore((s) => s.setPassportOpen)
  const name = useStore((s) => s.playerName)
  const setName = useStore((s) => s.setPlayerName)
  const school = useStore((s) => s.school)
  const setSchool = useStore((s) => s.setSchool)
  const resetJourney = useStore((s) => s.resetJourney)
  const [cover, setCover] = useState(true)
  const [confirm, setConfirm] = useState(false)
  const portrait = asset('images/maryam.png')
  useEffect(() => {
    if (open) {
      setCover(true)
      setConfirm(false)
      sfx.click()
    }
  }, [open])
  if (!open) return null
  return (
    <div className="modal" onClick={() => setOpen(false)} role="dialog" aria-modal aria-label="جواز مستكشف عُمان">
      <div className={'passport' + (cover ? ' is-cover' : ' is-open')} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn passport__close" onClick={() => setOpen(false)} aria-label="إغلاق">
          ✕
        </button>
        {cover ? (
          <button className="passport__coverbtn" onClick={() => (setCover(false), sfx.whoosh())}>
            <PassportCover />
            <span className="passport__hint">اضغط لفتح الجواز</span>
          </button>
        ) : (
          <>
            <div className="passport__book">
              <PassportSpread portrait={portrait} />
            </div>
            <div className="passport__bar">
              <label className="field">
                <span>الاسم</span>
                <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="اكتب اسمك" />
              </label>
              <label className="field">
                <span>المدرسة</span>
                <input value={school} maxLength={50} onChange={(e) => setSchool(e.target.value)} placeholder="اسم المدرسة" />
              </label>
              <button className="btn btn--primary" onClick={() => downloadPassport(document.querySelector('.passport__svg'), name)}>
                ⬇ تحميل الجواز
              </button>
              {!confirm ? (
                <button className="btn btn--ghost" onClick={() => setConfirm(true)}>
                  ↺ رحلة جديدة
                </button>
              ) : (
                <button
                  className="btn btn--ghost"
                  onClick={() => {
                    resetJourney()
                    setConfirm(false)
                  }}
                >
                  تأكيد مسح الأختام؟
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------ stamp award */

export function StampAward() {
  const award = useStore((s) => s.stampAward)
  const close = useStore((s) => s.closeStampAward)
  const name = useStore((s) => s.playerName)
  const portrait = useMemo(() => asset('images/maryam.png'), [])
  useEffect(() => {
    if (!award) return
    if (award === 'final') sfx.win()
    else {
      setTimeout(() => sfx.stamp(), 650)
      setTimeout(() => sfx.correct(), 900)
    }
  }, [award])
  if (!award) return null
  if (award === 'final')
    return (
      <div className="modal modal--award" role="dialog" aria-modal aria-label="وسام مستكشف عُمان">
        <div className="award award--final">
          <div className="award__rays" />
          <svg viewBox="-110 -110 220 240" className="award__medal">
            <defs>
              <radialGradient id="gold2" cx="0.4" cy="0.35">
                <stop offset="0" stopColor="#fff1b8" />
                <stop offset="0.55" stopColor="#e3b44a" />
                <stop offset="1" stopColor="#a8741c" />
              </radialGradient>
            </defs>
            <path d="M-70 -10 L-95 100 L-62 86 L-50 122 L-30 20 Z M70 -10 L95 100 L62 86 L50 122 L30 20 Z" fill="#7a1f1f" />
            <circle r="92" fill="url(#gold2)" stroke="#8a5d14" strokeWidth="6" />
            <circle r="76" fill="none" stroke="#8a5d14" strokeWidth="2" strokeDasharray="3 5" />
            <g transform="translate(-36 -64) scale(0.72)">
              <StationIcon id="final" color="#7a4a0c" />
            </g>
            <text y="48" textAnchor="middle" fontSize="22" fontWeight="800" fill="#5a3208" fontFamily="'Reem Kufi', Tajawal, sans-serif">
              {JOURNEY.finalTitle}
            </text>
          </svg>
          <h2>{JOURNEY.finalTitle}</h2>
          <p>
            {name ? `${name}، ` : ''}
            {JOURNEY.finalText}
          </p>
          <div className="award__actions">
            <button
              className="btn btn--primary btn--xl"
              onClick={() => {
                close()
                useStore.getState().setPassportOpen(true)
              }}
            >
              افتح جوازي 📘
            </button>
          </div>
        </div>
      </div>
    )
  const st = STATIONS[award]
  return (
    <div className="modal modal--award" role="dialog" aria-modal aria-label="ختم جديد">
      <div className="award">
        <span className="kicker">ختم جديد في جوازك!</span>
        <h2>محطة {st.title}</h2>
        <div className="award__page">
          <PassportSpread portrait={portrait} animateId={award} />
        </div>
        <button className="btn btn--primary btn--xl" onClick={close} autoFocus>
          رائع! متابعة
        </button>
      </div>
    </div>
  )
}
