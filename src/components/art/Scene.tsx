import { memo, useId } from 'react'
import type { SceneFamily } from '../../lib/types'
import { Pine } from './primitives'
import { mulberry32 } from './random'
import './art.css'

export type SceneVariant = 'postcard' | 'hero' | 'stamp' | 'cover' | 'thumb'
export interface SceneProps {
  family: SceneFamily
  seed: number
  variant?: SceneVariant
  /** Ambient motion (shimmer, mist, beam). Automatically off under reduced motion. */
  animate?: boolean
  className?: string
  /** Accessible label; when omitted the art is decorative (aria-hidden). */
  title?: string
}
const sizes: Record<SceneVariant, [number, number]> = {
  postcard: [400, 260],
  hero: [1200, 680],
  stamp: [200, 220],
  cover: [400, 520],
  thumb: [160, 160],
}
const palettes = {
  river: [
    ['#f2d9b8', '#a9b89a', '#b9ab92', '#214a3b', '#c8742f', '#91adb4'],
    ['#cfe0e0', '#a9b89a', '#d8cbb3', '#214a3b', '#d9a441', '#5e8a96'],
    ['#bfd1d3', '#91adb4', '#b9ab92', '#214a3b', '#c8742f', '#bfd1d3'],
  ],
  coast: [
    ['#cfe0e0', '#a9b89a', '#d8cbb3', '#214a3b', '#b44c2a', '#5e8a96'],
    ['#f2d9b8', '#c7b98f', '#b9ab92', '#214a3b', '#b44c2a', '#91adb4'],
    ['#bfd1d3', '#a9b89a', '#b9ab92', '#214a3b', '#b44c2a', '#91adb4'],
  ],
  mountain: [
    ['#cfe0e0', '#91adb4', '#5e8a96', '#214a3b', '#a9b89a', '#bfd1d3'],
    ['#f2d9b8', '#b9ab92', '#a9b89a', '#214a3b', '#c8742f', '#91adb4'],
    ['#bfd1d3', '#91adb4', '#5e8a96', '#214a3b', '#a9b89a', '#bfd1d3'],
  ],
  forest: [
    ['#bfd1d3', '#a9b89a', '#2f6b55', '#214a3b', '#c7b98f', '#91adb4'],
    ['#f2d9b8', '#c7b98f', '#a9b89a', '#214a3b', '#c8742f', '#91adb4'],
    ['#cfe0e0', '#91adb4', '#2f6b55', '#214a3b', '#a9b89a', '#bfd1d3'],
  ],
  desert: [
    ['#f2d9b8', '#d8cbb3', '#cf6a3e', '#b44c2a', '#e0a93b', '#b9ab92'],
    ['#cfe0e0', '#c7b98f', '#c8742f', '#b44c2a', '#d9a441', '#b9ab92'],
    ['#f3dfd3', '#d8cbb3', '#cf6a3e', '#b44c2a', '#e0a93b', '#b9ab92'],
  ],
  town: [
    ['#f2d9b8', '#a9b89a', '#b9ab92', '#214a3b', '#b44c2a', '#d8cbb3'],
    ['#cfe0e0', '#a9b89a', '#d8cbb3', '#214a3b', '#cf6a3e', '#b9ab92'],
    ['#bfd1d3', '#91adb4', '#b9ab92', '#214a3b', '#b44c2a', '#d8cbb3'],
  ],
  prairie: [
    ['#f2d9b8', '#a9b89a', '#c7b98f', '#214a3b', '#b44c2a', '#d9a441'],
    ['#cfe0e0', '#a9b89a', '#c7b98f', '#214a3b', '#b44c2a', '#d8cbb3'],
    ['#bfd1d3', '#c7b98f', '#a9b89a', '#214a3b', '#b44c2a', '#d9a441'],
  ],
} satisfies Record<SceneFamily, string[][]>

export const Scene = memo(function Scene({ family, seed, variant = 'postcard', animate = false, className, title }: SceneProps) {
  const id = `scene-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const random = mulberry32(seed)
  const [sky, far, mid, dark, accent, water] = palettes[family][Math.floor(random() * 3)]
  const paper = '#f5f1e8'
  const [width, height] = sizes[variant]
  const h = (height / width) * 400
  const hero = variant === 'hero'
  const focal = (hero ? 295 : 240) + random() * 45
  const horizon = h * (hero ? 0.56 : 0.43)
  const bend = 125 + random() * 80
  const ridge = (y: number, amplitude: number) =>
    `M-20 ${y} ` + Array.from({ length: 9 }, (_, i) => `L${i * 55} ${y - random() * amplitude}`).join(' ') + ` L420 ${h + 5}H-20Z`
  const ridges = [ridge(horizon + 18, 40), ridge(horizon + 50, 38), ridge(h * 0.78, 35)]
  const treeCount = 14 + Math.floor(random() * 9)
  const trees = Array.from({ length: treeCount }, (_, i) => ({
    x: hero ? 205 + random() * 215 : random() * 420 - 10,
    y: h * 0.79 + random() * h * 0.22,
    size: 20 + random() * 44,
    i,
  }))
  const cloudY = h * (0.14 + random() * 0.1)
  const mirror = !hero && random() < 0.4
  const sunX = focal - 65 + random() * 85
  const sunY = horizon * (0.32 + random() * 0.28)
  const sunSize = (family === 'desert' ? 25 : 14) + random() * 12
  const cloudCount = 1 + Math.floor(random() * 3)
  const cliff = `M400 ${horizon - 39}L${focal + 25} ${horizon - 31} ${focal - 4} ${horizon - 13} ${focal - 19} ${horizon + 42}Q${focal - 4} ${h * 0.71} ${bend - 5} ${h * 0.82}L${bend - 52} ${h}H400Z`
  const road = `M${focal} ${horizon + 36} C${focal - 70} ${h * 0.65} ${bend + 120} ${h * 0.7} ${bend + 65} ${h * 0.76} S${bend - 60} ${h * 0.9} ${bend - 32} ${h + 10}`
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`atlas-scene ${animate ? 'art-animate' : ''} ${className ?? ''}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? `${id}-title` : undefined}
    >
      {title && <title id={`${id}-title`}>{title}</title>}
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1">
          <stop stopColor={sky} />
          <stop offset="1" stopColor={paper} />
        </linearGradient>
        <pattern id={`${id}-grain`} width="7" height="9" patternUnits="userSpaceOnUse">
          <path d="M1 2h.7M5 7h.5M3 5h.3" stroke={dark} strokeWidth=".5" opacity=".11" />
          <path d="M0 8h1M4 1h1" stroke={paper} opacity=".22" strokeWidth=".6" />
        </pattern>
        <clipPath id={`${id}-cliff`}>
          <path d={cliff} />
        </clipPath>
        <clipPath id={`${id}-crop`}>
          <rect width="400" height={h} />
        </clipPath>
      </defs>
      <svg width={width} height={height} viewBox={`0 0 400 ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g clipPath={`url(#${id}-crop)`} transform={mirror ? 'translate(400 0) scale(-1 1)' : undefined}>
          <rect width="400" height={h} fill={`url(#${id}-sky)`} />
          <circle className="art-sun" cx={sunX} cy={sunY} r={sunSize} fill={family === 'desert' ? accent : paper} opacity=".85" />
          {Array.from({ length: cloudCount }, (_, i) => (
            <path
              key={i}
              className="art-cloud"
              d={`M${35 + i * 125} ${cloudY + (i % 2) * 13}q18-7 35-2t43 0`}
              fill="none"
              stroke={paper}
              strokeWidth="5"
              opacity=".55"
              strokeLinecap="round"
            />
          ))}
          <path d={ridges[0]} fill={far} />
          {(family === 'river' || family === 'coast') && (
            <>
              <path d={`M0 ${horizon + 15}Q200 ${horizon + 4} 400 ${horizon + 18}V${h}H0Z`} fill={water} />
              <path
                d={
                  family === 'river'
                    ? `M0 ${horizon + 13}L65 ${horizon + 8}Q190 ${horizon + 32} ${bend} ${h * 0.65}T42 ${h * 0.83}L0 ${h}Z`
                    : `M0 ${horizon + 14}L40 ${horizon - 6} 82 ${horizon + 9} 118 ${horizon + 14}Z`
                }
                fill={far}
              />
              <path d={cliff} fill={mid} />
              <path
                d={`M400 ${horizon - 44}L${focal + 27} ${horizon - 38} ${focal - 5} ${horizon - 18} ${focal - 11} ${horizon - 7}Q${focal + 55} ${horizon - 25} 400 ${horizon - 23}Z`}
                fill={dark}
              />
              <path
                clipPath={`url(#${id}-cliff)`}
                d={`M${focal + 23} ${horizon - 22}l-8 68 16-14 5-58 9-5-1 82 19-9 6-82 18-2 8 63 15-3-6-67 35-1 14 80-11 8-17-47-14 39-56 32-43 48 11-38 21-40Z`}
                fill={far}
                opacity=".55"
              />
              <path
                d={`M${focal + 16} ${horizon - 7}l-10 49m31-59-5 76m25-74 6 55`}
                stroke={paper}
                strokeWidth="1.1"
                fill="none"
                opacity=".22"
                clipPath={`url(#${id}-cliff)`}
              />
              <path d={`M400 ${h * 0.66}Q${focal + 18} ${h * 0.64} ${focal - 5} ${h * 0.79}T${bend - 40} ${h + 10}H400Z`} fill={dark} />
              <path
                className="art-shimmer"
                d={`M20 ${h * 0.64}h60m-42 12h92m-111 18h65m-53 22h69m-75 26h39m24-14h35`}
                stroke={paper}
                strokeWidth="1.4"
                strokeDasharray="17 8 4 10"
                fill="none"
                opacity=".62"
              />
              {family === 'coast' && (
                <>
                  <path
                    className="art-shimmer"
                    d={`M-10 ${horizon + 25}q42-4 90 1m-70 13q34-4 89 0m-114 70q20-6 55-3m-40 22q20-4 35-2`}
                    fill="none"
                    stroke={paper}
                    strokeWidth=".8"
                    strokeDasharray="24 8 6 4"
                    opacity=".65"
                  />
                  <path
                    d={`M${focal - 24} ${horizon + 62}Q${focal - 14} ${h * 0.72} ${bend - 20} ${h * 0.83}L${bend - 71} ${h}`}
                    fill="none"
                    stroke={paper}
                    strokeWidth="2"
                    opacity=".7"
                  />
                  <path
                    d={`M385 ${horizon + 2}C${focal + 30} ${horizon + 22} ${focal + 52} ${h * 0.66} ${focal + 15} ${h * 0.78}S${bend + 20} ${h * 0.92} ${bend + 10} ${h + 10}`}
                    fill="none"
                    stroke={paper}
                    strokeWidth="5"
                  />
                  <g transform={`translate(${focal + 34} ${horizon - 33})`}>
                    <path className="art-beam" d="M0-42 125-74V-15Z" fill={paper} opacity=".2" />
                    <path d="M-9 0-5-40H5L9 0Z" fill={paper} />
                    <path d="M-7-25H7L8-15H-8Z" fill={accent} />
                    <path d="M-7-40V-49H7V-40ZM-10-49 0-57 10-49Z" fill={dark} />
                    <path d="M0-46v5M-2-9v6" stroke={water} strokeWidth="3" />
                  </g>
                </>
              )}
              {family === 'river' && (
                <g fill={accent}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <path
                      key={i}
                      d={`M${focal + 4 + i * 13} ${horizon - 13 - Math.min(i, 3) * 6}q-8-9-3-16q5-9 9-2q10 1 8 10l-3 6Z`}
                      opacity={i % 3 === 0 ? 0.6 : 0.9}
                    />
                  ))}
                </g>
              )}
              {family === 'river' &&
                trees
                  .filter((t) => t.x > (hero ? 230 : 210))
                  .map((t) => (
                    <g key={t.i} transform={`translate(${t.x} ${t.y})`}>
                      <path d={`M0 0v-${t.size * 0.7}`} stroke={mid} strokeWidth="2" />
                      <path
                        d={`M0 ${-t.size}q${-t.size * 0.28} -3 ${-t.size * 0.3} ${t.size * 0.2}q${-t.size * 0.28} 0 ${-t.size * 0.19} ${t.size * 0.28}q${-t.size * 0.22} ${t.size * 0.33} ${t.size * 0.16} ${t.size * 0.38}q${t.size * 0.28} ${t.size * 0.17} ${t.size * 0.48} 0q${t.size * 0.4} ${t.size * 0.03} ${t.size * 0.35}-${t.size * 0.28}q${t.size * 0.12}-${t.size * 0.24}-${t.size * 0.17}-${t.size * 0.34}Q${t.size * 0.26} ${-t.size} 0 ${-t.size}Z`}
                        fill={t.i % 3 ? accent : far}
                      />
                      <path
                        d={`M0-12v-${t.size * 0.56}m0 ${t.size * 0.29}l-${t.size * 0.2}-${t.size * 0.13}`}
                        stroke={dark}
                        strokeWidth=".8"
                        opacity=".45"
                      />
                    </g>
                  ))}
            </>
          )}
          {(family === 'mountain' || family === 'forest') && (
            <>
              {family === 'mountain' && (
                <>
                  <path
                    d={`M100 ${horizon + 46}L${focal - 45} ${horizon - 49} ${focal} ${horizon - 20} ${focal + 35} ${horizon - 68} 420 ${horizon + 53}Z`}
                    fill={mid}
                  />
                  <path
                    d={`M${focal - 45} ${horizon - 49}l-27 34 23-12 12 9 9-9 28 17-45-39M${focal + 35} ${horizon - 68}l-24 40 20-12 9 10 9-8 27 13Z`}
                    fill={paper}
                  />
                  <path d={`M${focal - 43} ${horizon - 38}l-2 57 21 31m62-101-5 75 29 25`} fill="none" stroke={far} strokeWidth="2" />
                </>
              )}
              <path d={ridges[1]} fill={family === 'forest' ? mid : far} />
              <path
                className="art-mist"
                d={`M-30 ${horizon + 38}Q110 ${horizon + 11} 235 ${horizon + 43}T450 ${horizon + 30}L450 ${horizon + 48}Q245 ${horizon + 62} -30 ${horizon + 46}Z`}
                fill={paper}
                opacity=".35"
              />
              <path d={`M-10 ${h * 0.75}Q70 ${h * 0.57} 158 ${h * 0.72}T420 ${h * 0.65}V${h}H-10Z`} fill={mid} />
              <path d={ridges[2]} fill={dark} />
              <path d={road} fill="none" stroke={mid} strokeWidth="12" />
              <path d={road} fill="none" stroke={paper} strokeWidth="6" />
              {trees.map((t) => (
                <Pine key={t.i} {...t} color={t.i % 3 ? dark : mid} />
              ))}
              {family === 'forest' && (
                <g fill={dark}>
                  {Array.from({ length: 22 }, (_, i) => (
                    <Pine key={i} x={i * 20} y={horizon + 41 + Math.sin(i) * 8} size={12 + (i % 4) * 5} color={mid} />
                  ))}
                </g>
              )}
            </>
          )}
          {family === 'desert' && (
            <>
              <path
                d={`M0 ${horizon + 52}L35 ${horizon + 12} 49 ${horizon - 10} 105 ${horizon - 10} 113 ${horizon + 22} 145 ${horizon + 52}Z`}
                fill={mid}
              />
              <path
                d={`M180 ${horizon + 61}L${focal - 27} ${horizon + 6} ${focal - 20} ${horizon - 31} ${focal + 34} ${horizon - 31} ${focal + 45} ${horizon + 10} 402 ${horizon + 48}V${h}H0V${horizon + 65}Z`}
                fill={dark}
              />
              <path d={`M${focal - 20} ${horizon - 26}h48l-5 30 16 34-47-9Z`} fill={mid} />
              <path
                d={`M45 ${horizon + 8}h59m-69 13h77m${focal - 124} -24h58m-69 14h74m-84 20h97`}
                stroke={paper}
                opacity=".35"
                strokeWidth="3"
                fill="none"
              />
              <path d={`M0 ${h * 0.74}Q190 ${h * 0.65} 400 ${h * 0.78}V${h}H0Z`} fill={mid} />
              <path d={`M0 ${h * 0.87}Q240 ${h * 0.73} 400 ${h * 0.88}V${h}H0Z`} fill={dark} />
              <path d={`M${focal - 43} ${horizon + 55}L${focal + 20} ${h}H${focal - 95}Z`} fill={far} />
              <path
                d={`M${focal - 43} ${horizon + 62}L${focal - 40} ${h}`}
                fill="none"
                stroke={paper}
                strokeWidth="1.5"
                strokeDasharray="4 10 9 15"
              />
              <path d={`M40 ${h * 0.9}l3-12 3 12m-10-4 15-2m280 6 4-15 4 15m-13-6h18`} stroke={far} strokeWidth="2" fill="none" />
            </>
          )}
          {(family === 'prairie' || family === 'town') && (
            <>
              <path d={`M0 ${horizon + 27}Q115 ${horizon - 5} 400 ${horizon + 43}V${h}H0Z`} fill={mid} />
              <path d={`M0 ${h * 0.69}Q235 ${h * 0.5} 400 ${h * 0.75}V${h}H0Z`} fill={family === 'prairie' ? water : far} />
              <path d={`M0 ${h * 0.84}Q260 ${h * 0.7} 400 ${h * 0.83}V${h}H0Z`} fill={far} />
              <path d={road} fill="none" stroke={paper} strokeWidth="14" />
              {family === 'prairie' ? (
                <>
                  <path
                    d={`M-10 ${h * 0.73}Q90 ${h * 0.64} 174 ${h * 0.69}M-10 ${h * 0.75}Q90 ${h * 0.66} 158 ${h * 0.71}M-10 ${h * 0.78}Q80 ${h * 0.69} 133 ${h * 0.73}M287 ${h * 0.86}Q355 ${h * 0.83} 420 ${h * 0.88}M269 ${h * 0.9}Q350 ${h * 0.86} 420 ${h * 0.92}M250 ${h * 0.94}Q350 ${h * 0.9} 420 ${h * 0.96}`}
                    stroke={paper}
                    strokeWidth="1"
                    fill="none"
                    opacity=".45"
                  />
                  <g transform={`translate(${focal} ${horizon + 27})`}>
                    <path d="M-35 0V-29L-9-47 19-29V0Z" fill={accent} />
                    <path d="M-40-28-9-51 24-29 19-24-9-43-34-24Z" fill={dark} />
                    <path d="M-19 0V-23H3V0M-19-23 3 0M3-23-19 0" fill="none" stroke={paper} strokeWidth="2" />
                    <path d="M19 0h23v-29H19" fill={mid} />
                    <path d="M19-29h25L15-47H-9Z" fill={dark} />
                  </g>
                  <path
                    d={`M-10 ${h * 0.87}Q80 ${h * 0.82} 132 ${h * 0.85}M-10 ${h * 0.9}Q80 ${h * 0.85} 132 ${h * 0.88}`}
                    stroke={dark}
                    fill="none"
                    strokeWidth="1.5"
                  />
                  {Array.from({ length: 9 }, (_, i) => (
                    <path key={i} d={`M${i * 16} ${h * 0.86 - Math.sin(i / 3) * 8}v20`} stroke={dark} strokeWidth="2" />
                  ))}
                </>
              ) : (
                <>
                  {Array.from({ length: 5 }, (_, i) => {
                    const x = (hero ? 205 : 113) + i * 37
                    const y = horizon + 38
                    const roof = 28 + random() * 20
                    return (
                      <g key={i}>
                        <path d={`M${x} ${y}v-${roof}h34v${roof}Z`} fill={i % 2 ? accent : mid} />
                        <path d={`M${x - 2} ${y - roof}h38v-4h-38Z`} fill={dark} />
                        <path d={`M${x + 5} ${y - 20}h8v11h-8Zm17 0h8v20h-8Z`} fill={dark} />
                        <path d={`M${x + 3} ${y - 25}h29`} stroke={paper} strokeWidth="3" />
                      </g>
                    )
                  })}
                  <g transform={`translate(${focal - 9} ${horizon + 3})`} fill={paper}>
                    <path d="M-8 0V-40H8V0Z" />
                    <path d="M-11-40 0-68 11-40Z" fill={dark} />
                    <path d="M0-33v10" stroke={dark} strokeWidth="4" />
                  </g>
                  <g transform={`translate(${hero ? 373 : 355} ${horizon - 5})`} stroke={dark} strokeWidth="1.5">
                    <path d="M-13 44-8-8M13 44 8-8M-10 12 12 37M10 12-12 37" fill="none" />
                    <path d="M-15-25Q0-34 15-25V-7Q0 0-15-7Z" fill={water} />
                  </g>
                </>
              )}
              {trees.slice(0, 5).map((t) => (
                <Pine key={t.i} x={t.x} y={h * 0.87 + t.i * 5} size={t.size * 0.7} color={dark} />
              ))}
            </>
          )}
          <path
            d={`M-10 ${h - 9}Q60 ${h - 26} 110 ${h + 3}M295 ${h + 2}Q363 ${h - 24} 414 ${h - 13}`}
            fill="none"
            stroke={dark}
            strokeWidth="13"
            opacity=".85"
          />
          <rect width="400" height={h} fill={`url(#${id}-grain)`} pointerEvents="none" />
        </g>
      </svg>
    </svg>
  )
})
