import type { PostcardLook } from '../../lib/types'
import type { Inks } from './motifs/types'

export interface PostcardLettering {
  title: string
  subtitle?: string
}

function titleLines(title: string) {
  const words = title.trim().split(/\s+/)
  if (title.length <= 22 || words.length === 1) return [title]
  let split = 1
  let distance = Infinity
  for (let i = 1; i < words.length; i++) {
    const difference = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length)
    if (difference < distance) {
      split = i
      distance = difference
    }
  }
  return [words.slice(0, split).join(' '), words.slice(split).join(' ')]
}

export function PostcardType({
  lettering,
  look,
  height,
  inks: c,
  id,
}: {
  lettering: PostcardLettering
  look: PostcardLook
  height: number
  inks: Inks
  id: string
}) {
  const style = look.lettering
  // Drop generic route suffixes, keeping the distinctive place or road name intact.
  const shortTitle =
    style === 'greetings'
      ? lettering.title
          .replace(/\b(?:Scenic\s*&\s*Historic|National Scenic|Scenic|Historic)\s+/gi, '')
          .replace(/\s+(?:Byway|Highway|Road|Parkway)$/i, '') || lettering.title
      : lettering.title
  const lines = titleLines(shortTitle)
  const script = style === 'script'
  const top = script || style === 'greetings'
  const y = top
    ? script
      ? 45
      : 66
    : style === 'ribbon'
      ? height * 0.72
      : height - (style === 'banner' ? (lines.length === 2 ? 76 : 49) : lines.length === 2 ? 61 : 43)
  const maxWidth = style === 'banner' ? 302 : 336
  const fontSize = style === 'greetings' ? (lines.length === 1 ? 46 : 33) : script ? 31 : 26
  const lineHeight = fontSize * 1.06
  const labelHeight = lines.length * lineHeight + (lettering.subtitle ? 19 : 5)
  const text = (shadow = false) =>
    lines.map((line, i) => (
      <text
        key={i}
        x={script ? 27 : 200}
        y={y + i * lineHeight}
        textAnchor={script ? 'start' : 'middle'}
        fontFamily={script ? 'var(--font-hand), cursive' : 'var(--font-serif), Georgia, serif'}
        fontStyle={script ? 'italic' : undefined}
        fontWeight={script ? 400 : 900}
        fontSize={fontSize}
        letterSpacing={script ? 0 : '-.8'}
        textLength={Math.min(maxWidth, line.length * fontSize * (script ? 0.53 : 0.65))}
        lengthAdjust="spacingAndGlyphs"
        fill={shadow ? c.dark : style === 'banner' || style === 'block' ? c.paper : c.accent}
        stroke={shadow ? c.dark : style === 'block' || style === 'banner' ? 'none' : c.paper}
        strokeWidth={style === 'greetings' ? 2.8 : 2.2}
        paintOrder="stroke fill"
        strokeLinejoin="round"
      >
        {script ? line : line.toUpperCase()}
      </text>
    ))
  return (
    <g data-lettering={style}>
      {style === 'greetings' && (
        <text
          x="28"
          y="30"
          fontFamily="var(--font-hand), cursive"
          fontSize="21"
          fontStyle="italic"
          fill={c.dark}
          stroke={c.paper}
          strokeWidth="2"
          paintOrder="stroke fill"
        >
          Greetings from
        </text>
      )}
      {style === 'ribbon' && (
        <>
          <path
            d={`M16 ${y - 29} 48 ${y - 24}V${y + labelHeight - 13}L16 ${y + labelHeight - 7}l12-28Z M384 ${y - 29} 352 ${y - 24}V${y + labelHeight - 13}l32 6-12-28Z`}
            fill={c.accent}
            stroke={c.dark}
          />
          <path
            d={`M36 ${y - 29}Q200 ${y - 46} 364 ${y - 29}V${y + labelHeight - 15}Q200 ${y + labelHeight - 28} 36 ${y + labelHeight - 15}Z`}
            fill={c.paper}
            stroke={c.dark}
            strokeWidth="1.4"
          />
        </>
      )}
      {style === 'block' && (
        <>
          <path d={`M16 ${y - 29}H384V${height - 16}H16Z`} fill={c.dark} />
          <path d={`M28 ${y - 23}H372`} stroke={c.paper} strokeWidth=".8" />
        </>
      )}
      {style === 'banner' && (
        <>
          <path
            d={`M37 ${y - 31}H363V${y + labelHeight - 25}L200 ${y + labelHeight - 17} 37 ${y + labelHeight - 25}Z`}
            fill={c.dark}
            stroke={c.paper}
            strokeWidth="2"
          />
          <path d={`M44 ${y - 24}H356`} stroke={c.accent} strokeWidth="2" />
        </>
      )}
      {style === 'greetings' && <g transform="translate(2.5 3)">{text(true)}</g>}
      {text()}
      {style === 'greetings' && <path d={`M30 ${y + 4}H370`} stroke={`url(#${id}-grain)`} strokeWidth="3" />}
      {lettering.subtitle && (
        <text
          x={script ? 29 : 200}
          y={y + (lines.length - 1) * lineHeight + 17}
          textAnchor={script ? 'start' : 'middle'}
          fontFamily="var(--font-serif), Georgia, serif"
          fontSize="10"
          letterSpacing="1.3"
          textLength={Math.min(maxWidth, lettering.subtitle.length * 7)}
          lengthAdjust="spacingAndGlyphs"
          fill={style === 'block' || style === 'banner' ? c.paper : c.dark}
          stroke={style === 'block' || style === 'banner' ? 'none' : c.paper}
          strokeWidth="2.5"
          paintOrder="stroke fill"
        >
          {lettering.subtitle.toUpperCase()}
        </text>
      )}
    </g>
  )
}

/** A single compound path defines the paper margin without costly SVG filters. */
export function PostcardBorder({
  border,
  height: h,
  id,
  inks: c,
}: {
  border: PostcardLook['border']
  height: number
  id: string
  inks: Inks
}) {
  const inset = 13
  const edge =
    border === 'deckle'
      ? `M13 13 ${Array.from({ length: 38 }, (_, i) => `L${13 + i * 10} ${12 + ((i * 7) % 5)}`).join(' ')} L387 13 ${Array.from({ length: Math.floor((h - 26) / 10) }, (_, i) => `L${386 + ((i * 3) % 5)} ${13 + i * 10}`).join(' ')} L387 ${h - 13} ${Array.from({ length: 38 }, (_, i) => `L${387 - i * 10} ${h - 12 - ((i * 7) % 5)}`).join(' ')} L13 ${h - 13} ${Array.from({ length: Math.floor((h - 26) / 10) }, (_, i) => `L${12 + ((i * 3) % 5)} ${h - 13 - i * 10}`).join(' ')} Z`
      : `M${inset} ${inset}H${400 - inset}V${h - inset}H${inset}Z`
  const margin = `M0 0H400V${h}H0Z ${edge}`
  return (
    <g data-border={border}>
      <defs>
        <pattern id={`${id}-linen`} width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M0 1h4M1 0v4" stroke={c.dark} strokeWidth=".45" opacity=".25" />
          <path d="M0 3h4M3 0v4" stroke={c.paper} strokeWidth=".7" />
        </pattern>
      </defs>
      <path d={margin} fill={border === 'linen' ? '#e0d2b3' : '#fff9eb'} fillRule="evenodd" />
      {border === 'linen' && <path d={margin} fill={`url(#${id}-linen)`} fillRule="evenodd" />}
      {border === 'scallop' && (
        <path d={`M13 13H387V${h - 13}H13Z`} stroke="#fff9eb" strokeWidth="8" strokeDasharray=".1 11" strokeLinecap="round" fill="none" />
      )}
      {border === 'white' && <rect x="13" y="13" width="374" height={h - 26} fill="none" stroke={c.dark} strokeWidth=".6" />}
    </g>
  )
}

export function DeckleClip({ id, height }: { id: string; height: number }) {
  const top = Array.from({ length: 51 }, (_, i) => `${i * 8},${1 + ((i * 7) % 4)}`).join(' ')
  const right = Array.from({ length: Math.ceil(height / 8) }, (_, i) => `${399 - ((i * 3) % 4)},${Math.min(height - 2, i * 8)}`).join(' ')
  const bottom = Array.from({ length: 51 }, (_, i) => `${400 - i * 8},${height - 1 - ((i * 7) % 4)}`).join(' ')
  const left = Array.from({ length: Math.ceil(height / 8) }, (_, i) => `${1 + ((i * 3) % 4)},${Math.max(2, height - i * 8)}`).join(' ')
  return (
    <clipPath id={`${id}-paper-edge`}>
      <polygon points={`${top} ${right} ${bottom} ${left}`} />
    </clipPath>
  )
}
