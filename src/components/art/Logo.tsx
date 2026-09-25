import './art.css'
export function Logo({ size = 32, withWordmark = true, className }: { size?: number; withWordmark?: boolean; className?: string }) {
  return (
    <span className={`rr-logo ${className ?? ''}`} style={{ gap: size * 0.24 }} role="img" aria-label="Rambleroo">
      {/* Same mark as public/favicon.svg, without the tile: two peaks and a road winding out of them. */}
      <svg width={size * 1.2} height={size} viewBox="4 8 58 50" aria-hidden="true">
        <path d="M7 45 23 22l6 6L41 11l17 34Z" fill="currentColor" />
        <path d="M36 17l5-6 6 8-5-3-3 4Z" fill="var(--paper)" fillOpacity=".55" />
        <path d="M41 42c10 4-6 6-14 8s-7 6 5 8" fill="none" stroke="var(--rust)" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M41 42c10 4-6 6-14 8s-7 6 5 8"
          fill="none"
          stroke="var(--paper)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeDasharray="2.5 3"
        />
      </svg>
      {withWordmark && <span style={{ fontSize: size * 0.8 }}>Rambleroo</span>}
    </span>
  )
}
