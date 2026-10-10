import { useEffect, useState } from 'react'

/** Phones (portrait) and short landscape screens: the mission card starts collapsed so it doesn't cover the scene. */
const COMPACT = '(max-width: 820px), (max-height: 520px)'

export function useCollapsible(openWhen = false) {
  const [collapsed, setCollapsed] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(COMPACT).matches)
  // e.g. the station challenge just became available: show the card so its button can be seen
  useEffect(() => {
    if (openWhen) setCollapsed(false)
  }, [openWhen])
  return { collapsed, toggle: () => setCollapsed((c) => !c) }
}

export function CollapseToggle({ collapsed }: { collapsed: boolean }) {
  return (
    <span className="mission__toggle" aria-hidden>
      {collapsed ? '▾' : '▴'}
    </span>
  )
}
