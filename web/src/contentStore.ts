// Station content designed by students in «استوديو التحديات» (studio.html).
//
// Three layers, later ones win:
//   1. built-in content in stations.ts
//   2. published content: web/public/content/<id>.json listed in content/manifest.json (everyone sees it)
//   3. "live" content applied on this device from the studio (IndexedDB) — for trying a design in the game
import { asset } from './content'
import { STATION_ORDER, STATIONS, type ChallengeStep, type InfoItem, type Riddle, type StationId } from './stations'

export interface StationContent {
  version: 1
  id: StationId
  team?: string
  updated?: string
  intro?: string
  introAudio?: string
  riddle?: Riddle | null
  items?: Pick<InfoItem, 'key' | 'title' | 'text' | 'icon' | 'ref' | 'audio'>[]
  challenge?: ChallengeStep[]
  fact?: { title: string; lines: string[] } | null
  ref?: string
  outro?: { text: string; audio?: string } | null
}

/** snapshot of the built-in content (before anything is applied) */
const BUILTIN = JSON.parse(JSON.stringify(STATIONS)) as typeof STATIONS

/** the station's content as an editable document */
export function contentOf(id: StationId): StationContent {
  const d = STATIONS[id]
  return JSON.parse(
    JSON.stringify({
      version: 1,
      id,
      intro: d.intro,
      introAudio: d.introAudio ?? '',
      riddle: d.riddle ?? null,
      // every 3D point of the scene, even if a design left it empty
      items: BUILTIN[id].items.map((orig) => {
        const it = d.items.find((x) => x.key === orig.key)
        return { key: orig.key, title: it?.title ?? '', text: it?.text ?? '', icon: it?.icon ?? orig.icon, ref: it?.ref ?? '', audio: it?.audio ?? '' }
      }),
      challenge: d.challenge,
      fact: d.fact ?? null,
      ref: d.ref ?? '',
      outro: d.outro ?? null,
    } satisfies StationContent),
  )
}

/** apply a content document on top of the built-in station (keys of the 3D points are fixed by the scene) */
export function applyContent(c: StationContent) {
  if (!c || !STATION_ORDER.includes(c.id)) return
  const d = STATIONS[c.id]
  const base = BUILTIN[c.id]
  if (c.intro !== undefined) d.intro = c.intro || base.intro
  if (c.introAudio !== undefined) d.introAudio = c.introAudio || undefined
  if (c.riddle !== undefined) {
    if (c.riddle) d.riddle = c.riddle
    else delete d.riddle
  }
  if (c.items) {
    d.items = base.items
      .map((orig) => {
        const o = c.items!.find((x) => x.key === orig.key)
        if (!o) return orig
        if (!o.text?.trim()) return null // an empty card hides that point
        return { ...orig, title: o.title || orig.title, text: o.text, icon: o.icon || orig.icon, ref: o.ref || undefined, audio: o.audio || undefined, note: undefined }
      })
      .filter(Boolean) as InfoItem[]
  }
  if (c.challenge?.length) d.challenge = c.challenge
  if (c.fact !== undefined) d.fact = c.fact && c.fact.lines.some((l) => l.trim()) ? { ...c.fact, lines: c.fact.lines.filter((l) => l.trim()) } : undefined
  if (c.ref !== undefined) d.ref = c.ref || undefined
  if (c.outro !== undefined) d.outro = c.outro && (c.outro.text.trim() || c.outro.audio) ? c.outro : undefined
}

/* -------------------------------------------------------------- IndexedDB */

const DB = 'oman3d-studio'
type StoreName = 'drafts' | 'live'

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => {
      r.result.createObjectStore('drafts')
      r.result.createObjectStore('live')
    }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

async function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode)
    const r = fn(t.objectStore(store))
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

export const db = {
  get: (store: StoreName, id: StationId) => tx<StationContent | undefined>(store, 'readonly', (s) => s.get(id)),
  put: (store: StoreName, c: StationContent) => tx(store, 'readwrite', (s) => s.put(c, c.id)),
  del: (store: StoreName, id: StationId) => tx(store, 'readwrite', (s) => s.delete(id)),
  all: (store: StoreName) => tx<StationContent[]>(store, 'readonly', (s) => s.getAll()),
}

/* ------------------------------------------------------------ at start-up */

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T) =>
  Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))])

/** published designs (for everyone) */
export async function loadPublished() {
  try {
    const list = (await (await fetch(asset('content/manifest.json'), { cache: 'no-cache' })).json()) as StationId[]
    const docs = await Promise.all(
      list.map((id) =>
        fetch(asset(`content/${id}.json`), { cache: 'no-cache' })
          .then((r) => (r.ok ? (r.json() as Promise<StationContent>) : null))
          .catch(() => null),
      ),
    )
    docs.forEach((c) => c && applyContent(c))
  } catch {
    /* no published content */
  }
}

/** designs applied on this device from the studio; returns their station ids */
export async function loadLive(): Promise<StationId[]> {
  try {
    const docs = await withTimeout(db.all('live'), 1500, [] as StationContent[])
    docs.forEach(applyContent)
    return docs.map((c) => c.id)
  } catch {
    return []
  }
}

export async function loadAllContent() {
  await withTimeout(loadPublished(), 2500, undefined)
  return loadLive()
}
