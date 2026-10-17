// محطة «البحر بداية الحكاية» — مشهد بحري تراثي تفاعلي بأربع صحائف مستقلة.
// يحل محل المشهد ثلاثي الأبعاد لمحطة nav فقط (راجع App.tsx: scene === 'nav').
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { asset } from '../content'
import { STATIONS } from '../stations'
import { useStore } from '../store'
import { Narration } from './Narration'
import { toAr } from './Quiz'

const DEF = STATIONS.nav
const HERO = asset('images/nav/hero.webp')

/** مواضع الصحائف الأربع المغلقة فوق صورة المشهد (% من صندوق الصورة) */
const CARD_POS: Record<string, { left: number; top: number; width: number; height: number }> = {
  location: { left: 6, top: 49, width: 21, height: 46 },
  sailor: { left: 28.5, top: 49, width: 21, height: 46 },
  routes: { left: 51, top: 49, width: 21, height: 46 },
  trade: { left: 73.5, top: 49, width: 21, height: 46 },
}

function VideoPlayer({ src, poster, onClose }: { src: string; poster?: string; onClose: () => void }) {
  // محمولة إلى document.body: محطة البحر تُنشئ سياق تكديس خاصًا بها (position: fixed)،
  // فبدون هذا الـ portal يُحبَس هذا المودال تحت عناصر الواجهة الثابتة (زر الجواز، الشريط العلوي).
  return createPortal(
    <div className="modal" onClick={onClose} role="dialog" aria-modal aria-label="فيديو الصحيفة">
      <div className="modal__box" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <span className="kicker">طرق عبر البحار والرياح</span>
            <h3>فيديو الصحيفة</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <video src={src} poster={poster} controls autoPlay playsInline className="modal__video" />
      </div>
    </div>,
    document.body,
  )
}

function OpenCard({ itemKey, onBack }: { itemKey: string; onBack: () => void }) {
  const it = DEF.items.find((x) => x.key === itemKey)!
  const [videoOpen, setVideoOpen] = useState(false)
  return (
    <div className="sea-card">
      <button className="btn btn--ghost btn--sm sea-card__back" onClick={onBack}>
        ↩ عودة إلى الصحائف
      </button>
      <div className="sea-card__stage">
        <img src={it.image} alt={it.title} className="sea-card__img" />
      </div>
      <div className="sea-card__panel" style={{ ['--c' as string]: DEF.color }}>
        <h3 className="sea-card__title">
          <span aria-hidden>{it.icon}</span> {it.title}
        </h3>
        <p className="sea-card__text">{it.text}</p>
        {it.video ? (
          <button className="btn btn--primary sea-card__watch" onClick={() => setVideoOpen(true)}>
            🎬 شاهدي الفيديو
          </button>
        ) : it.audio ? (
          <Narration src={it.audio} label="استمعي للتسجيل 🔊" />
        ) : (
          <p className="sea-card__pending">🎙️ التسجيل الصوتي قادم قريبًا</p>
        )}
        {it.ref && <p className="info__ref">📚 {it.ref}</p>}
      </div>
      {videoOpen && it.video && <VideoPlayer src={it.video} poster={it.poster} onClose={() => setVideoOpen(false)} />}
    </div>
  )
}

export function SeaStation() {
  const [opened, setOpened] = useState<string | null>(null)
  const pr = useStore((s) => s.progress.nav)
  const markSeen = useStore((s) => s.markSeen)
  const stamped = useStore((s) => !!s.stamps.nav)
  const setStationQuiz = useStore((s) => s.setStationQuiz)
  const goTo = useStore((s) => s.goTo)
  const seenCount = DEF.items.filter((it) => pr.seen.includes(it.key)).length
  const allSeen = seenCount === DEF.items.length

  const open = (key: string) => {
    markSeen('nav', key)
    setOpened(key)
  }

  return (
    <div className="sea-station">
      {opened ? (
        <OpenCard itemKey={opened} onBack={() => setOpened(null)} />
      ) : (
        <div className="sea-station__overview">
          <div className="sea-station__stage">
            <img src={HERO} alt={DEF.title} className="sea-station__hero" />
            {DEF.items.map((it) => {
              const p = CARD_POS[it.key]
              const seen = pr.seen.includes(it.key)
              return (
                <button
                  key={it.key}
                  className={'sea-station__hit' + (seen ? ' is-seen' : '')}
                  style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%`, height: `${p.height}%` }}
                  onClick={() => open(it.key)}
                  aria-label={it.title}
                >
                  {seen && <span className="sea-station__check">✓</span>}
                </button>
              )
            })}
          </div>
          <Narration src={DEF.introAudio} label="رسالة الترحيب 🔊" />
          <p className="muted sea-station__hint">
            {allSeen
              ? 'قرأتِ الصحائف الأربع! 🎉'
              : `فتحتِ ${toAr(seenCount)} من ${toAr(DEF.items.length)} صحائف — اضغطي على أي صحيفة لتفتحيها`}
          </p>
          <div className="mission__actions sea-station__actions">
            {stamped ? (
              <>
                <span className="stamp-ok">✓ حصلتِ على ختم المحطة</span>
                <button className="btn btn--primary btn--xl" onClick={() => goTo('plaza', 'nav')}>
                  التالي: المحطة الثانية ←
                </button>
              </>
            ) : (
              <button className="btn btn--primary btn--xl" disabled={!allSeen} onClick={() => setStationQuiz('nav')}>
                {allSeen ? 'ابدئي تحدي المستكشف 🗝️' : '🔒 تحدي المستكشف'}
              </button>
            )}
            <button className="btn btn--ghost btn--sm" onClick={() => goTo('plaza', 'nav')}>
              ↩ الساحة
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
