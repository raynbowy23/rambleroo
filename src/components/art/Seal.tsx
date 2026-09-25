import { useId } from 'react'
import { Trees } from './primitives'
import './art.css'
export function Seal({
  text = 'Scenic roads · wandered well',
  size = 96,
  className,
}: {
  text?: string
  size?: number
  className?: string
}) {
  const id = `seal-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg
      className={`atlas-seal ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 112 112"
      aria-hidden="true"
      fill="currentColor"
    >
      <defs>
        <path id={id} d="M56 13a43 43 0 1 1-.01 0" />
      </defs>
      <circle cx="56" cy="56" r="55" fill="none" stroke="currentColor" strokeWidth=".65" />
      <circle cx="56" cy="56" r="34" fill="none" stroke="currentColor" strokeWidth=".5" />
      <text className="art-serif" fontSize="8.5" letterSpacing="2.4">
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle" textLength="253" lengthAdjust="spacing">
          {text.toUpperCase()} ·
        </textPath>
      </text>
      <Trees />
      <path d="M35 76q21-4 43 0" fill="none" stroke="currentColor" strokeWidth=".6" />
    </svg>
  )
}
