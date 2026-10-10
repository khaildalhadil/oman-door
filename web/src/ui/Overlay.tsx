import { useProgress } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { asset, FORT_HOTSPOTS, INTERIOR, INTRO, STEPS, VIDEO } from '../content'
import { installKeyboard } from '../game/input'
import { nav } from '../game/nav'
import { unlockAudio } from '../game/sfx'
import { useStore, type Device, type SceneId } from '../store'
import { player } from '../three/Player'
import { ActionButtons, Joystick, KeyHints, PROMPTS } from './Controls'
import { input } from '../game/input'
import { STATIONS } from '../stations'
import { isStation } from './Station'
import { ArrowIcon, Crenels, ExpandIcon } from './icons'
import { toAr } from './Quiz'
import { CollapseToggle, useCollapsible } from './collapse'

/* ------------------------------------------------------------------ intro */

export function Intro() {
  const started = useStore((s) => s.started)
  const start = useStore((s) => s.start)
  const device = useStore((s) => s.device)
  const setDevice = useStore((s) => s.setDevice)
  const name = useStore((s) => s.playerName)
  const setName = useStore((s) => s.setPlayerName)
  const { progress, active } = useProgress()
  const [gone, setGone] = useState(false)
  const done = progress >= 100 && !active
  useEffect(() => {
    if (started) {
      const t = setTimeout(() => setGone(true), 1100)
      return () => clearTimeout(t)
    }
  }, [started])
  if (gone) return null
  const go = () => {
    unlockAudio()
    installKeyboard()
    if (device === 'mobile') document.documentElement.requestFullscreen?.().catch(() => {})
    start()
  }
  const choice = (d: Device, icon: string, title: string, text: string) => (
    <button className={'device' + (device === d ? ' is-active' : '')} onClick={() => setDevice(d)} aria-pressed={device === d}>
      <span className="device__icon">{icon}</span>
      <b>{title}</b>
      <small>{text}</small>
    </button>
  )
  return (
    <div className={'intro' + (started ? ' is-leaving' : '')}>
      <div className="intro__bg" style={{ backgroundImage: `url(${asset('images/hero-gate.jpg')})` }} />
      <div className="intro__shade" />
      <div className="intro__content">
        <img className="intro__girl" src={asset('images/maryam.png')} alt="" />
        <span className="kicker">{INTRO.kicker}</span>
        <h1 className="intro__title">{INTRO.title}</h1>
        <Crenels />
        <p className="intro__text">{INTRO.text}</p>
        <div className="devices" role="group" aria-label="اختر جهازك">
          {choice('desktop', '💻', 'كمبيوتر', 'الأسهم أو WASD + الفأرة')}
          {choice('mobile', '📱', 'موبايل / تابلت', 'عصا تحكّم على الشاشة')}
        </div>
        <label className="field field--intro">
          <span>اسمك (يظهر على الشهادة)</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="اكتب اسمك هنا" />
        </label>
        <div className="progress" aria-label="تحميل">
          <div className="progress__bar" style={{ width: `${Math.max(4, progress)}%` }} />
        </div>
        <button className="btn btn--primary btn--xl" disabled={!done} onClick={go}>
          {done ? INTRO.cta : `جارٍ التحميل… ${toAr(Math.round(progress))}٪`}
          {done && <ArrowIcon />}
        </button>
        <p className="intro__note">صُمّمت النماذج في Blender وتُعرض بتقنية React Three Fiber</p>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- top bar */

export function TopBar() {
  const scene = useStore((s) => s.scene)
  const started = useStore((s) => s.started)
  const busy = useStore((s) => s.busy)
  const quality = useStore((s) => s.quality)
  const setQuality = useStore((s) => s.setQuality)
  const muted = useStore((s) => s.muted)
  const toggleMuted = useStore((s) => s.toggleMuted)
  const goTo = useStore((s) => s.goTo)
  const setTeacherOpen = useStore((s) => s.setTeacherOpen)
  const setHelpOpen = useStore((s) => s.setHelpOpen)
  if (!started) return null
  const place =
    scene === 'plaza'
      ? 'ساحة الرحلة'
      : isStation(scene)
        ? `محطة ${STATIONS[scene].title}`
        : scene === 'gate'
          ? 'بوابة عُمان'
          : scene === 'fort'
            ? 'قلعة نزوى'
            : 'داخل قلعة نزوى'
  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark" />
        <span className="brand__name">رحلة عُمان</span>
      </div>
      <nav className="steps" aria-label="مكانك في الرحلة">
        <button className="step" disabled={busy || scene === 'plaza' || scene === 'gate'} onClick={() => goTo('plaza' as SceneId)}>
          <b>🏠</b>
          <span>الساحة</span>
        </button>
        <span className="step is-current">
          <b>📍</b>
          <span>{place}</span>
        </span>
      </nav>
      <div className="tools">
        <button className="icon-btn" title="المساعدة" onClick={() => setHelpOpen(true)}>
          ؟
        </button>
        <button className="icon-btn" title={muted ? 'تشغيل الصوت' : 'كتم الصوت'} onClick={toggleMuted}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="icon-btn" title="لوحة المعلم" onClick={() => setTeacherOpen(true)}>
          👩‍🏫<span>المعلم</span>
        </button>
        <button className="icon-btn" title="الجودة" onClick={() => setQuality(quality === 'high' ? 'low' : 'high')}>
          ⚙<span>{quality === 'high' ? 'عالية' : 'سريعة'}</span>
        </button>
        <button className="icon-btn" title="ملء الشاشة" onClick={fullscreen}>
          <ExpandIcon />
        </button>
      </div>
    </header>
  )
}

/* ---------------------------------------------------------- mission card */

export function Mission() {
  const scene = useStore((s) => s.scene)
  const busy = useStore((s) => s.busy)
  const answers = useStore((s) => s.answers)
  const round = useStore((s) => s.round)
  const boardsRead = useStore((s) => s.boardsRead)
  const videoWatched = useStore((s) => s.videoWatched)
  const requestEnter = useStore((s) => s.requestEnter)
  const setCertificateOpen = useStore((s) => s.setCertificateOpen)
  const setTab = useStore((s) => s.setTab)
  const setVideoOpen = useStore((s) => s.setVideoOpen)
  const goTo = useStore((s) => s.goTo)
  const stars = answers.filter((a) => a?.correct).length
  const answered = answers.filter(Boolean).length
  const quizDone = answered === round.length && round.length > 0
  const { collapsed, toggle } = useCollapsible()

  let title = ''
  let body: React.ReactNode = null
  let actions: React.ReactNode = null
  if (scene === 'gate') {
    title = 'المهمة ١: بوابة عُمان'
    body = <p>تحرّك مع مريم نحو البوابة الكبيرة؛ ستنفتح أبوابها عند الاقتراب، ومن خلفها ساحة الرحلة. 🚪</p>
    actions = (
      <button className="btn btn--ghost btn--sm" onClick={requestEnter}>
        تخطَّ ⏭
      </button>
    )
  } else if (scene === 'fort') {
    title = quizDone ? 'المهمة ٣: ادخل القلعة' : 'المهمة ٢: ساحة التحدي'
    body = (
      <>
        <p>{quizDone ? 'أحسنت! اتبع السهم إلى البوابة الرئيسية لدخول القلعة.' : 'اتبع السهم الذهبي إلى المنصّات وأجب عن الأسئلة: صح أم خطأ؟'}</p>
        <div className="stars" aria-label={`النجوم ${stars} من ${round.length}`}>
          {round.map((_, i) => (
            <span key={i} className={answers[i] ? (answers[i]!.correct ? 'ok' : 'bad') : ''}>
              ★
            </span>
          ))}
          <b>
            {toAr(stars)}/{toAr(round.length)}
          </b>
        </div>
      </>
    )
    actions = (
      <>
        {quizDone && (
          <button className="btn btn--ghost btn--sm" onClick={() => setCertificateOpen(true)}>
            🏅 الشهادة
          </button>
        )}
        <button className="btn btn--ghost btn--sm" onClick={requestEnter}>
          ادخل القلعة ⏭
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => goTo('plaza', 'bonus')}>
          ↩ الساحة
        </button>
      </>
    )
  } else {
    title = 'المهمة ٤: مجلس القلعة'
    body = (
      <ul className="checks">
        <li className={boardsRead.length >= INTERIOR.boards.length ? 'done' : ''}>
          اقرأ اللوحات ({toAr(boardsRead.length)}/{toAr(INTERIOR.boards.length)})
        </li>
        <li className={videoWatched ? 'done' : ''}>شاهد الفيديو أمام الشاشة</li>
      </ul>
    )
    actions = (
      <>
        <button className="btn btn--ghost btn--sm" onClick={() => setTab('about')}>
          📖 معلومات
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => setVideoOpen(true)}>
          🎬 الفيديو
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => goTo('fort', 'back')}>
          ↩ القلعة
        </button>
      </>
    )
  }
  return (
    <section className={'mission' + (busy ? ' is-hidden' : '') + (collapsed ? ' is-collapsed' : '')}>
      <div className="mission__bar" role="button" tabIndex={0} aria-expanded={!collapsed} onClick={toggle} onKeyDown={(e) => e.key === 'Enter' && toggle()}>
        <span className="kicker">{title}</span>
        <CollapseToggle collapsed={collapsed} />
      </div>
      {body}
      <div className="mission__actions">{actions}</div>
    </section>
  )
}

/* --------------------------------------------------------------- compass */

export function Compass() {
  const busy = useStore((s) => s.busy)
  const arrow = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const t = nav.target
      if (!wrap.current) return
      if (!t) {
        wrap.current.style.opacity = '0'
        return
      }
      const dx = t.x - player.pos.x
      const dz = t.z - player.pos.z
      const dist = Math.hypot(dx, dz)
      wrap.current.style.opacity = dist < 2 ? '0' : '1'
      const tYaw = Math.atan2(dx, dz)
      const camYaw = nav.camAz + Math.PI
      const rel = Math.atan2(Math.sin(tYaw - camYaw), Math.cos(tYaw - camYaw))
      arrow.current!.style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`
      // (no "•" separator: next to Arabic-Indic digits it reads as a zero "٠")
      label.current!.textContent = `${nav.label} — ${toAr(Math.round(dist))} م`
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div ref={wrap} className={'compass' + (busy ? ' is-hidden' : '')}>
      <div ref={arrow} className="compass__arrow">
        ➤
      </div>
      <span ref={label} className="compass__label" />
    </div>
  )
}

/* ---------------------------------------------------------------- prompt */

export function Prompt() {
  const prompt = useStore((s) => s.prompt)
  const device = useStore((s) => s.device)
  const setVideoOpen = useStore((s) => s.setVideoOpen)
  if (!prompt) return null
  if (prompt === 'screen')
    return (
      <button className="prompt" onClick={() => setVideoOpen(true)}>
        🎬 {device === 'desktop' ? 'اضغط E أو انقر هنا لمشاهدة الفيديو' : 'اضغط هنا لمشاهدة الفيديو'}
      </button>
    )
  const p = PROMPTS[prompt]
  if (p)
    return (
      <button className="prompt" onClick={() => (input.interact = true)}>
        {p.icon} {device === 'desktop' ? `اضغط E أو انقر هنا ${p.verb}` : `اضغط زر «${p.label}» ${p.verb}`}
      </button>
    )
  return <div className="prompt">{prompt}</div>
}

/* -------------------------------------------------------- hotspot info */

export function HotspotInfo() {
  const hotspot = useStore((s) => s.hotspot)
  const busy = useStore((s) => s.busy)
  const setHotspot = useStore((s) => s.setHotspot)
  const current = FORT_HOTSPOTS.find((h) => h.id === hotspot)
  if (!current || busy) return null
  return (
    <aside className="info" key={current.id}>
      <button className="info__close" onClick={() => setHotspot(null)} aria-label="إغلاق">
        ✕
      </button>
      <span className="kicker">✨ اكتشفت معلماً</span>
      <h3 className="info__title">{current.title}</h3>
      <p className="info__text">{current.text}</p>
    </aside>
  )
}

/* -------------------------------------------------------- interior panel */

export function InteriorPanel() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const panelOpen = useStore((s) => s.panelOpen)
  const setPanelOpen = useStore((s) => s.setPanelOpen)
  if (!panelOpen) return null
  const t = INTERIOR.tabs.find((x) => x.id === tab) ?? INTERIOR.tabs[0]
  return (
    <section className="panel">
      <button className="info__close" onClick={() => setPanelOpen(false)} aria-label="إغلاق">
        ✕
      </button>
      <span className="kicker">{INTERIOR.kicker}</span>
      <h2 className="card__title">{INTERIOR.title}</h2>
      <Crenels />
      <div className="tabs" role="tablist">
        {INTERIOR.tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === tab} className={'tab' + (x.id === tab ? ' is-active' : '')} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="panel__body" key={t.id}>
        {'body' in t && t.body?.map((p, i) => <p key={i}>{p}</p>)}
        {'facts' in t && t.facts && (
          <dl className="facts">
            {t.facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {'links' in t && t.links && (
          <>
            <ul className="sources">
              {t.links.map(([label, href]) => (
                <li key={href}>
                  <a href={href} target="_blank" rel="noreferrer" dir="ltr">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="muted">{t.note}</p>
          </>
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- controls */

export function ControlsLayer() {
  const device = useStore((s) => s.device)
  const started = useStore((s) => s.started)
  const busy = useStore((s) => s.busy)
  if (!started) return null
  return (
    <div className={'controls-layer' + (busy ? ' is-hidden' : '')}>
      {device === 'mobile' ? (
        <>
          <Joystick />
          <ActionButtons />
        </>
      ) : (
        <KeyHints />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ help */

export function Help() {
  const open = useStore((s) => s.helpOpen)
  const setOpen = useStore((s) => s.setHelpOpen)
  const device = useStore((s) => s.device)
  const setDevice = useStore((s) => s.setDevice)
  if (!open) return null
  return (
    <div className="modal" onClick={() => setOpen(false)} role="dialog" aria-modal aria-label="المساعدة">
      <div className="modal__box help" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <span className="kicker">كيف تلعب؟</span>
            <h3>ساعد مريم في رحلتها</h3>
          </div>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <ol className="help__steps">
          <li>ادخل من بوابة عُمان.</li>
          <li>اذهب إلى «ساحة التحدي» بجوار قلعة نزوى، واقترب من كل منصّة لتجيب: صح أم خطأ؟ ⭐</li>
          <li>اقترب من معالم القلعة (البرج، البوابة، الجامع، السوق، الفلج) لتظهر معلوماتها.</li>
          <li>ادخل القلعة واقرأ اللوحات وشاهد الفيديو، ثم احصل على شهادتك 🏅</li>
        </ol>
        <div className="help__devices">
          <button className={'device' + (device === 'desktop' ? ' is-active' : '')} onClick={() => setDevice('desktop')}>
            <span className="device__icon">💻</span>
            <b>كمبيوتر</b>
            <small>الأسهم/WASD للحركة • Shift للجري • مسافة للقفز • E للتفاعل • اسحب بالفأرة لتدوير الكاميرا</small>
          </button>
          <button className={'device' + (device === 'mobile' ? ' is-active' : '')} onClick={() => setDevice('mobile')}>
            <span className="device__icon">📱</span>
            <b>موبايل</b>
            <small>عصا التحكّم للحركة (ادفعها للآخر للجري) • زر القفز • اسحب بإصبعك لتدوير الكاميرا</small>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- video modal */

export function VideoModal() {
  const open = useStore((s) => s.videoOpen)
  const setOpen = useStore((s) => s.setVideoOpen)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])
  if (!open) return null
  return (
    <div className="modal" onClick={() => setOpen(false)} role="dialog" aria-modal aria-label="مشغل الفيديو">
      <div className="modal__box" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <span className="kicker">{VIDEO.title}</span>
            <h3>عرض مرئي</h3>
          </div>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <video src={VIDEO.src} poster={VIDEO.poster} controls autoPlay playsInline className="modal__video" />
        <p className="muted">{VIDEO.note}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ fade */

export function Fade() {
  const fading = useStore((s) => s.fading)
  return <div className={'fade' + (fading ? ' is-on' : '')} aria-hidden />
}
