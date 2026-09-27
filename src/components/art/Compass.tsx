import './art.css'
export function Compass({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={`rr-compass ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth=".65"
    >
      <circle cx="50" cy="50" r="31" />
      <circle cx="50" cy="50" r="28" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <g key={angle} transform={`rotate(${angle} 50 50)`}>
          <path d={`M50 ${i % 2 ? 26 : 13}L55 50 50 56 45 50Z`} fill="#f3f4ea" />
          <path d={`M50 ${i % 2 ? 26 : 13}V56L45 50Z`} fill={i === 0 ? '#d95f1e' : 'currentColor'} />
        </g>
      ))}
      <circle cx="50" cy="50" r="3" fill="#f3f4ea" />
      {[
        ['N', 50, 9],
        ['E', 94, 53],
        ['S', 50, 98],
        ['W', 6, 53],
      ].map(([text, x, y]) => (
        <text key={text} x={x} y={y} textAnchor="middle" stroke="none" fill="currentColor" fontSize="9" className="rr-serif">
          {text}
        </text>
      ))}
    </svg>
  )
}
