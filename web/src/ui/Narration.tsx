import { useEffect, useState } from 'react'
import { useStore } from '../store'

/** One shared narrator: a new recording stops the previous one. */
let current: HTMLAudioElement | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((f) => f())

export function stopNarration() {
  if (current) {
    current.pause()
    current = null
    notify()
  }
}

export function narrate(src: string | undefined) {
  stopNarration()
  if (!src || useStore.getState().muted) return
  const a = new Audio(src)
  current = a
  a.onended = () => {
    if (current === a) current = null
    notify()
  }
  a.play().catch(() => {
    if (current === a) current = null
    notify()
  })
  notify()
}

function usePlaying(src: string) {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((n) => n + 1)
    listeners.add(f)
    return () => {
      listeners.delete(f)
    }
  }, [])
  return !!current && current.src === new URL(src, location.href).href
}

/** Play/pause button for a recorded narration; `auto` starts it when it appears. */
export function Narration({ src, auto = true, label = 'استمعي' }: { src?: string; auto?: boolean; label?: string }) {
  useEffect(() => {
    if (!src) return
    if (auto) narrate(src)
    return () => stopNarration()
  }, [src, auto])
  const playing = usePlaying(src ?? '')
  if (!src) return null
  return (
    <button className={'narration' + (playing ? ' is-playing' : '')} onClick={() => (playing ? stopNarration() : narrate(src))}>
      <span aria-hidden>{playing ? '⏸' : '🔊'}</span>
      {playing ? 'إيقاف الصوت' : label}
    </button>
  )
}
