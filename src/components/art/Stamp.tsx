import { useId } from 'react'
import type { Motif, PostcardLook, Region, SceneFamily } from '../../lib/types'
import { Scene } from './Scene'
import { Trees } from './primitives'
import { PrintDefs } from './PrintDefs'
import './art.css'

export interface StampProps {
  family?: SceneFamily
  seed?: number
  region?: Region
  motifs?: Motif[]
  look?: PostcardLook
  /** Road name, printed in caps along the bottom. */
  title?: string
  /** Secondary line, usually the state(s). */
  subtitle?: string
  /** Visit date shown under the stamp, e.g. "Oct 2024". */
  date?: string
  /** Overprint a rust "VISITED" cancellation mark. */
  visited?: boolean
  /** Empty slot ("more roads ahead"). */
  empty?: boolean
  /** Plays the press-in animation once on mount. */
  press?: boolean
  size?: number
  className?: string
}
const perforations = Array.from({ length: 19 }, (_, i) => 8 + i * 10)
export function Stamp({
  family = 'river',
  seed = 1,
  region,
  motifs,
  look,
  title = 'Scenic roads',
  subtitle,
  date,
  visited = false,
  empty = false,
  press = false,
  size = 140,
  className,
}: StampProps) {
  const id = `stamp-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const label = empty ? 'More roads ahead' : [title, subtitle, visited && 'Visited', date].filter(Boolean).join(' · ')
  const words = title.toUpperCase().split(/\s+/)
  const lines: string[] = ['']
  for (const word of words) {
    const last = lines.length - 1
    if (lines[last] && `${lines[last]} ${word}`.length > 24 && lines.length < 2) lines.push(word)
    else lines[last] += `${lines[last] ? ' ' : ''}${word}`
  }
  return (
    <figure className={`rr-stamp ${press ? 'rr-press' : ''} ${className ?? ''}`} style={{ width: size }}>
      <svg width={size} height={size * 1.2} viewBox="0 0 200 240" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>{label}</title>
        <defs>
          <PrintDefs id={id} ink="#704f3c" paper="#f1e8d5" />
          <mask id={`${id}-edge`} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="240">
            <rect x="3" y="3" width="194" height="234" fill="white" />
            {perforations.map((n) => (
              <path key={n} d={`M${n} 3a3 3 0 1 0 6 0a3 3 0 1 0-6 0M${n} 237a3 3 0 1 0 6 0a3 3 0 1 0-6 0`} fill="black" />
            ))}
            {Array.from({ length: 23 }, (_, i) => (
              <path key={i} d={`M3 ${8 + i * 10}a3 3 0 1 0 0 6a3 3 0 1 0 0-6M197 ${8 + i * 10}a3 3 0 1 0 0 6a3 3 0 1 0 0-6`} fill="black" />
            ))}
          </mask>
        </defs>
        <g mask={`url(#${id}-edge)`}>
          <rect x="3" y="3" width="194" height="234" fill="#ece4d3" stroke="#c9bca2" />
          <rect x="8" y="8" width="184" height="224" fill="#f3f4ea" />
          <rect
            x="14"
            y="14"
            width="172"
            height="212"
            fill="none"
            stroke={empty ? '#b9ab92' : '#3f4b30'}
            strokeWidth=".8"
            strokeDasharray={empty ? '3 4' : undefined}
          />
          {empty ? (
            <g fill="#6b716b" opacity=".65">
              <g transform="translate(14 30) scale(1.5)">
                <Trees />
              </g>
              <text x="100" y="174" textAnchor="middle" className="rr-serif" fontSize="10" letterSpacing="1.8">
                MORE ROADS
              </text>
              <text x="100" y="190" textAnchor="middle" className="rr-serif" fontSize="10" letterSpacing="1.8">
                AHEAD
              </text>
            </g>
          ) : (
            <>
              <svg x="20" y="20" width="160" height="164" viewBox="0 0 200 220" preserveAspectRatio="xMidYMid slice">
                <Scene family={family} seed={seed} region={region} motifs={motifs} look={look} variant="stamp" />
              </svg>
              <path d="M20 187h160" stroke="#3f4b30" strokeWidth=".65" />
              {lines.map((line, i) => (
                <text
                  key={i}
                  x="100"
                  y={lines.length === 1 ? 202 : 198 + i * 10}
                  textAnchor="middle"
                  fill="#202925"
                  className="rr-serif"
                  fontSize={line.length > 30 ? 6.5 : 8.5}
                  letterSpacing=".65"
                  textLength={line.length > 32 ? 156 : undefined}
                  lengthAdjust="spacingAndGlyphs"
                >
                  {line}
                </text>
              ))}
              {subtitle && (
                <text
                  x="100"
                  y="219"
                  textAnchor="middle"
                  fill="#4a524d"
                  fontSize="6.8"
                  letterSpacing="1"
                  textLength={subtitle.length > 32 ? 155 : undefined}
                  lengthAdjust="spacingAndGlyphs"
                >
                  {subtitle.toUpperCase()}
                </text>
              )}
            </>
          )}
        </g>
        {visited && !empty && (
          <g className="rr-cancel" transform="rotate(-14 135 154)" fill="none" stroke="#c4561b" opacity=".58">
            <path d="M4 140q16-7 32 0t32 0m-64 9q16-7 32 0t32 0m-64 9q16-7 32 0t32 0" strokeWidth="1.4" />
            <circle cx="132" cy="148" r="43" strokeWidth="1.5" opacity=".65" />
            <circle cx="133.2" cy="148.5" r="43" strokeWidth=".65" strokeDasharray="17 2 6 1" opacity=".4" />
            <circle cx="132" cy="148" r="38" strokeWidth=".7" strokeDasharray="2 1" />
            <path d="M99 151h66" />
            <text x="132" y="144" textAnchor="middle" fill="#c4561b" stroke="none" fontSize="13" letterSpacing="1.4" className="rr-serif">
              VISITED
            </text>
            {date && (
              <text
                x="132"
                y="163"
                textAnchor="middle"
                fill="#c4561b"
                stroke="none"
                fontSize="7"
                textLength={date.length > 14 ? 63 : undefined}
                lengthAdjust="spacingAndGlyphs"
              >
                {date.toUpperCase()}
              </text>
            )}
            <path d="m128 121 4-3 4 3m-8 54 4 3 4-3" strokeWidth="1" />
            <circle cx="132" cy="148" r="43" fill={`url(#${id}-grain)`} stroke="none" />
          </g>
        )}
      </svg>
      {date && !empty && <figcaption>{date}</figcaption>}
    </figure>
  )
}
