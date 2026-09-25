import './art.css'
export function Logo({ size = 32, withWordmark = true, className }: { size?: number; withWordmark?: boolean; className?: string }) {
  return (
    <span className={`atlas-logo ${className ?? ''}`} style={{ gap: size * 0.24 }} role="img" aria-label="Rambleroo">
      <svg width={size * 1.45} height={size} viewBox="0 0 58 40" aria-hidden="true" fill="currentColor">
        <path d="M1 32 15 13 20 17 32 1 57 32H39L31 27 22 31Z" />
        <path d="m16 16-9 12 12-9 3 4 10-17 11 17-10-9-3 5-2-4-5 12Z" fill="#f5f1e8" />
        <path d="M33 24c17 7-19 5-16 10 1 2 9 3 18 4H19c-18-4-8-8 2-9 9-1 18-2 12-5" />
        <path d="M30 25c11 5-25 6-16 11" fill="none" stroke="#f5f1e8" strokeWidth="1" />
      </svg>
      {withWordmark && <span style={{ fontSize: size * 0.8 }}>Rambleroo</span>}
    </span>
  )
}
