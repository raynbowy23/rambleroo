import type { ReactNode } from 'react'

export type IconName =
  | 'search'
  | 'bookmark'
  | 'bookmark-filled'
  | 'arrow-right'
  | 'arrow-left'
  | 'close'
  | 'map'
  | 'grid'
  | 'list'
  | 'pin'
  | 'clock'
  | 'leaf'
  | 'share'
  | 'plus'
  | 'minus'
  | 'locate'
  | 'layers'
  | 'dice'
  | 'check'
  | 'pause'
  | 'play'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'chevron-down'
  | 'user'
  | 'stamp'
  | 'route'
  | 'external'
  | 'trash'
  | 'edit'
  | 'calendar'
  | 'info'
  | 'theme-water'
  | 'theme-coast'
  | 'theme-mountain'
  | 'theme-forest'
  | 'theme-desert'
  | 'theme-historic'
  | 'theme-countryside'

const drawings: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4Z" />,
  'bookmark-filled': <path d="M6 3h12v18l-6-4-6 4Z" fill="currentColor" />,
  'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
  'arrow-left': <path d="M20 12H4m6-6-6 6 6 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  map: <path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2Zm6-2v15m6-12v15" />,
  grid: <path d="M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z" />,
  list: <path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1" />,
  pin: (
    <>
      <path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 0 1 14 0Z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3C7 2 1 10 6 17s16-2 14-14ZM4 21 16 8M8 17v-6m0 6h6" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="5" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8 10 7-4M8 14l7 4" />
    </>
  ),
  plus: <path d="M12 4v16M4 12h16" />,
  minus: <path d="M4 12h16" />,
  locate: (
    <>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
    </>
  ),
  layers: <path d="m2 8 10-5 10 5-10 5ZM2 12l10 5 10-5M2 16l10 5 10-5" />,
  dice: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  pause: <path d="M6 4h3v16H6Zm9 0h3v16h-3Z" />,
  play: <path d="m7 3 14 9-14 9Z" />,
  'chevron-left': <path d="m15 5-7 7 7 7" />,
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  'chevron-up': <path d="m5 15 7-7 7 7" />,
  'chevron-down': <path d="m5 9 7 7 7-7" />,
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 7 0 0 1 16 0v2" />
    </>
  ),
  stamp: (
    <>
      <path d="M3 3h3a2 2 0 0 0 4 0h4a2 2 0 0 0 4 0h3v3a2 2 0 0 0 0 4v4a2 2 0 0 0 0 4v3h-3a2 2 0 0 0-4 0h-4a2 2 0 0 0-4 0H3v-3a2 2 0 0 0 0-4v-4a2 2 0 0 0 0-4Z" />
      <path d="m7 16 5-8 5 8Z" />
    </>
  ),
  route: (
    <>
      <circle cx="5" cy="18" r="3" />
      <circle cx="19" cy="6" r="3" />
      <path d="M8 18h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8" />
    </>
  ),
  external: <path d="M13 3h8v8m0-8L10 14m-1-9H4v15h15v-5" />,
  trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
  edit: <path d="m15 4 5 5M4 20l1-6L16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L10 19ZM4 20h16" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 10h18M7 14h2m6 0h2M7 18h2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  'theme-water': <path d="M2 6q3-3 6 0t6 0 6 0M2 12q3-3 6 0t6 0 6 0M2 18q3-3 6 0t6 0 6 0" />,
  'theme-coast': <path d="M2 19q3-3 6 0t6 0 6 0M9 15l1-8h5l1 8M9 7h7l-3.5-4ZM11 11h4M3 10h3m13 0h2" />,
  'theme-mountain': <path d="m2 20 8-16 5 10 3-6 5 12ZM7 10l3 2 3-2" />,
  'theme-forest': <path d="m7 3-5 9h3l-4 6h12l-4-6h3ZM7 18v4M16 2l-4 7h2l-2 4m1 4h10l-4-6h3L16 2Zm2 15v5" />,
  'theme-desert': (
    <path d="M10 21V5a2 2 0 0 1 4 0v16M10 15H6a3 3 0 0 1-3-3V8a1.5 1.5 0 0 1 3 0v4h4m4-2h3V6a1.5 1.5 0 0 1 3 0v4a3 3 0 0 1-3 3h-3M7 21h10" />
  ),
  'theme-historic': <path d="m2 8 10-6 10 6ZM4 11v7m5-7v7m6-7v7m5-7v7M3 21h18M2 18h20" />,
  'theme-countryside': <path d="M3 21V9l9-6 9 6v12ZM1 9l11-8 11 8M8 21V11h8v10m-8-10 8 10m0-10-8 10" />,
}
export function Icon({ name, size = 20, className, label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {drawings[name]}
    </svg>
  )
}
