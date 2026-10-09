import { memo, type ReactNode } from 'react'
import type { BywaySummary, BywayStory } from '../../../lib/types'
import { useMotionEnabled } from '../../../lib/motion'
import { mulberry32 } from '../random'
import { Block, Landmark, Peak, Tree } from './pieces'
import { environment, selectMotifs, type Season, type Weather } from './environment'
import './diorama.css'

export interface RoadDioramaProps {
  byway: BywaySummary
  story?: BywayStory
  towns?: string[]
  hour?: number
  now?: Date
  weather?: Weather
  season?: Season
  animate?: boolean
  size?: number
  title?: string
}

const plane = 'matrix(1 .5 -1 .5 200 105)'
const tile = 'M200 105 360 185 200 265 40 185Z'

export const RoadDiorama = memo(function RoadDiorama({
  byway,
  story,
  towns,
  hour,
  now = new Date(),
  weather = 'clear',
  season,
  animate = false,
  size = 320,
  title,
}: RoadDioramaProps) {
  const motion = useMotionEnabled() && animate
  const env = environment(byway, now, hour, season, weather)
  const { inks: c, snow, night } = env
  const props = { inks: c, snow }
  const random = mulberry32(byway.seed)
  const family = byway.scene
  const motifs = selectMotifs(story)
  const mountain = family === 'mountain' || motifs.includes('switchbacks')
  const river = family === 'river'
  const coast = family === 'coast'
  const bend = Math.round(random() * 12)
  const road = river
    ? 'M0 120C30 120 30 80 60 80L100 80C130 80 125 40 160 40'
    : mountain
      ? `M0 120C35 120 55 140 72 122S32 91 55 78 126 98 132 79 103 40 160 40`
      : `M0 ${coast ? 100 : 120}C40 115 26 65 65 ${70 + bend}S96 127 119 99 110 40 160 40`
  const objects: { u: number; v: number; key: string; draw: ReactNode }[] = []
  const add = (key: string, u: number, v: number, draw: ReactNode) => objects.push({ key, u, v, draw })
  if (mountain || family === 'desert') {
    for (let i = 0; i < 3; i++)
      add(
        `peak-${i}`,
        26 + i * 48,
        24 + random() * 10,
        <g transform={`scale(${0.8 + random() * 0.35})`}>
          <Peak {...props} mesa={family === 'desert'} gentle={byway.region === 'appalachia' || byway.region === 'ozarks'} />
        </g>,
      )
  }
  // Keep vegetation in roadside bands so it cannot hide the ribbon.
  const treeCount = family === 'forest' ? 22 : family === 'desert' ? 3 : coast ? 6 : 10
  for (let i = 0; i < treeCount; i++) {
    const back = i < treeCount * 0.6
    const u = back ? 12 + random() * 134 : 35 + random() * 100
    const v = back ? 8 + random() * 30 : 139 + random() * 13
    if ((coast && !back) || (river && Math.abs(u - 80) < 16)) continue
    const palm = ['florida', 'hawaii'].includes(byway.region)
    add(
      `tree-${i}`,
      u,
      v,
      <g transform={`scale(${0.48 + random() * 0.3})`}>
        <Tree
          {...props}
          palm={palm}
          round={!palm && (family === 'prairie' || family === 'town' || env.season === 'spring' || env.season === 'autumn')}
        />
      </g>,
    )
  }
  const townCount = Math.min(
    5,
    towns ? towns.length : Math.max(family === 'town' ? 4 : 1, story?.moments.filter((m) => m.kind === 'town').length ?? 0),
  )
  for (let i = 0; i < townCount; i++)
    add(
      `town-${i}`,
      109 + (i % 2) * 22,
      49 + Math.floor(i / 2) * 18,
      <g data-town-block="true" transform={`scale(${0.6 + townCount * 0.045})`}>
        <Block {...props} height={18 + (i % 3) * 5} />
      </g>,
    )
  if (family === 'prairie')
    add(
      'elevator',
      36,
      29,
      <g data-piece="grain-elevator">
        <Block {...props} width={12} height={42} />
        <g transform="translate(18 8)">
          <Block {...props} width={8} height={27} />
        </g>
        <path d="M-12-42 0-55 12-42" fill={c.accent} stroke={c.dark} />
      </g>,
    )
  const anchors = coast
    ? [
        [45, 46],
        [87, 113],
        [131, 19],
      ]
    : [
        [29, 51],
        [67, 130],
        [132, 22],
      ]
  motifs.forEach((motif, i) =>
    add(
      `motif-${motif}`,
      anchors[i][0],
      anchors[i][1],
      <g data-motif={motif} transform="scale(.72)">
        <Landmark motif={motif} {...props} />
      </g>,
    ),
  )
  objects.sort((a, b) => a.u + a.v - b.u - b.v)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`rr-diorama${motion ? ' rr-diorama-motion' : ''}`}
      viewBox="0 0 400 320"
      width={size}
      height={size * 0.8}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-family={family}
      data-time={env.time}
      data-season={env.season}
      data-weather={weather}
    >
      {title && <title>{title}</title>}
      <rect width="400" height="320" rx="12" fill={env.paper} />
      <path d="M38 186V73Q38 34 79 34H321Q362 34 362 73V186Z" fill={env.sky} opacity={night ? 1 : 0.35} />
      <path d="M48 93H352M48 99H352" stroke={env.paper} strokeWidth="1" opacity=".25" />
      {night ? (
        <g fill={c.window}>
          {[
            [75, 64],
            [113, 89],
            [172, 48],
            [248, 67],
            [304, 88],
            [329, 51],
          ].map(([x, y]) => (
            <path key={x} d={`M${x - 2} ${y}h4m-2-2v4`} stroke={c.paper} strokeWidth="1" />
          ))}
          <path d="M281 49a13 13 0 1 0 13 19 14 14 0 0 1-13-19Z" fill={c.paper} />
        </g>
      ) : (
        <circle
          cx={70 + (env.hour / 24) * 260}
          cy={env.time === 'day' ? 58 : 91}
          r={env.time === 'day' ? 15 : 20}
          fill={env.time === 'day' ? env.paper : '#f4cf78'}
        />
      )}
      <ellipse cx={env.hour < 12 ? 211 : 189} cy="272" rx="133" ry="20" fill={c.dark} opacity=".1" />
      <path d="M40 185 200 265V288L40 208Z" fill={c.mid} />
      <path d="M200 265 360 185V208L200 288Z" fill={c.dark} />
      <path
        d="M46 197 198 273m9 0 145-73M58 209l130 65m26 2 131-66"
        stroke={c.paper}
        opacity=".25"
        strokeDasharray="18 3 5 2"
        fill="none"
      />
      <path d={tile} fill={snow ? c.paper : c.far} stroke={c.dark} strokeWidth=".7" />
      <g transform={plane}>
        {family === 'prairie' && (
          <g stroke={c.paper} strokeWidth="1">
            <path d="M8 8H70V54H8ZM93 115H151V154H93Z" fill={c.accent} opacity=".65" />
            {Array.from({ length: 7 }, (_, i) => (
              <path key={i} d={`M${14 + i * 8} 10v42m${87 - i * 2} 66v34`} opacity=".5" />
            ))}
          </g>
        )}
        {coast && (
          <>
            <path d="M0 125Q70 103 160 121V160H0Z" fill={c.water} />
            <path d="M0 118Q70 96 160 114v9Q70 105 0 127Z" fill={c.dark} />
            <path d="M0 130Q70 108 160 126" fill="none" stroke={c.paper} strokeWidth="2" />
            <path d="M12 139h22m17-11h20m23 17h35m-115 6h41m71-13h21" stroke={c.paper} strokeWidth="1" opacity=".65" />
          </>
        )}
        {river && (
          <>
            <path d="M67 0Q57 40 68 73T67 160H91Q96 110 87 77T93 0Z" fill={c.water} />
            <path d="M75 6v18m7 13v17m-6 52v17m7 8v20" stroke={c.paper} opacity=".7" />
            <path d="M58 72H102V89H58Z" fill={c.dark} />
          </>
        )}
        {Array.from({ length: 34 }, (_, i) => {
          const x = 5 + random() * 150
          const y = 5 + random() * (coast ? 100 : 150)
          return <path key={i} d={`M${x} ${y}h${1 + random() * 3}`} stroke={c.dark} opacity=".13" strokeWidth=".8" />
        })}
        <path d={road} fill="none" stroke={c.paper} strokeWidth="15" />
        <path d={road} fill="none" stroke={c.dark} strokeWidth="11" />
        <path d={road} fill="none" stroke={c.paper} strokeWidth=".9" strokeDasharray="5 5" />
        {river && <path d="M59 71h43M59 90h43" stroke={c.accent} strokeWidth="2" />}
        <g
          transform={motion ? undefined : `translate(${river ? 80 : mountain ? 72 : 65} ${river ? 80 : mountain ? 122 : 70 + bend})`}
          data-car="true"
        >
          {motion && <animateMotion path={road} dur="32s" repeatCount="indefinite" rotate="auto" />}
          <g transform="translate(0 -3)">
            {night && <path data-headlights="true" d="M5-3 29-10V0ZM5 3 29 0v10Z" fill={c.window} opacity=".4" />}
            <path d="M-6-5h11v10H-6Z" fill="#252b22" />
            <rect x="-8" y="-4" width="16" height="8" rx="2" fill="#ee7430" />
            <path d="M-4-3H2V3H-4Z" fill="#f5e6c8" />
            <path d="M3-3v6" stroke="#86b9d4" strokeWidth="2" />
          </g>
        </g>
      </g>
      <g strokeLinecap="round">
        {objects.map((obj) => (
          <g key={obj.key} transform={`translate(${200 + obj.u - obj.v} ${105 + (obj.u + obj.v) / 2})`}>
            <ellipse cx={env.hour < 12 ? 6 : -6} cy="4" rx="12" ry="4" fill={c.dark} opacity={night ? 0.08 : 0.15} />
            {obj.draw}
          </g>
        ))}
      </g>
      {(weather === 'cloudy' || weather === 'rain' || weather === 'snow') && (
        <g className="rr-diorama-cloud" fill={c.paper} stroke={c.dark} strokeWidth=".5" opacity=".85">
          <path d="M65 74q-9-13 8-17 3-15 19-9 12-7 20 6 19-1 21 14l-8 6Z" />
          <path d="M242 94q-12-12 5-19 1-13 16-11 12-12 23 2 18-3 22 15l-9 13Z" />
        </g>
      )}
      {weather === 'rain' && (
        <g className="rr-diorama-rain" stroke={c.water} strokeWidth="1" opacity=".65">
          {Array.from({ length: 42 }, (_, i) => {
            const x = 52 + random() * 292
            const y = 84 + random() * 165
            return <path key={i} d={`M${x} ${y}l-3 8`} />
          })}
        </g>
      )}
      {weather === 'snow' && (
        <g className="rr-diorama-snow" fill={env.paper}>
          {Array.from({ length: 38 }, (_, i) => (
            <circle key={i} cx={52 + random() * 292} cy={79 + random() * 177} r={i % 3 ? 1.4 : 2} />
          ))}
        </g>
      )}
      {weather === 'fog' && (
        <g fill={c.paper} className="rr-diorama-cloud">
          {[137, 170, 213].map((y) => (
            <path key={y} d={`M45 ${y}q68-15 154-3t153-4v12q-76 12-156 2T45 ${y + 9}Z`} opacity=".55" />
          ))}
        </g>
      )}
    </svg>
  )
})
