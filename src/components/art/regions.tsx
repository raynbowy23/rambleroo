import type { Region, SceneFamily } from '../../lib/types'
import { mulberry32 } from './random'
import { Pine } from './primitives'
import type { Inks } from './motifs/types'

type Vegetation = 'fir' | 'oak' | 'juniper' | 'spruce' | 'grass' | 'birch' | 'moss' | 'palm' | 'hardwood'
interface RegionStyle {
  family: SceneFamily
  vegetation: Vegetation
  /** Far terrain, middle terrain, keyline, accent, water. Sky is selected separately for each seed. */
  colors: [string, string, string, string, string]
}
export const regions = {
  'pacific-northwest': { family: 'forest', vegetation: 'fir', colors: ['#a8b5a0', '#65816d', '#294e43', '#9caa78', '#739599'] },
  california: { family: 'coast', vegetation: 'oak', colors: ['#b9bc9a', '#c3aa73', '#354e42', '#b6814c', '#668e96'] },
  southwest: { family: 'desert', vegetation: 'juniper', colors: ['#dfb49c', '#cc7952', '#713d30', '#b94e32', '#759eaa'] },
  rockies: { family: 'mountain', vegetation: 'spruce', colors: ['#a8b7b5', '#87938f', '#354f4a', '#c7a354', '#668a95'] },
  'great-plains': { family: 'prairie', vegetation: 'grass', colors: ['#c5c3a0', '#b7ab77', '#5d6550', '#c4a15b', '#91aaa8'] },
  'upper-midwest': { family: 'river', vegetation: 'hardwood', colors: ['#b6bfa2', '#bbae91', '#365643', '#b48953', '#73939b'] },
  'great-lakes': { family: 'coast', vegetation: 'birch', colors: ['#c1d3dd', '#91a8af', '#2c485c', '#aa8d4e', '#477e9f'] },
  ozarks: { family: 'forest', vegetation: 'oak', colors: ['#b0b99c', '#899b78', '#405a44', '#b39963', '#7b9895'] },
  'deep-south': { family: 'river', vegetation: 'moss', colors: ['#c4c6a8', '#8eaa8a', '#3e5e4c', '#b39b68', '#87a7a2'] },
  florida: { family: 'coast', vegetation: 'palm', colors: ['#bfdbce', '#76ad92', '#285a4b', '#d1b779', '#48a9b0'] },
  appalachia: { family: 'mountain', vegetation: 'hardwood', colors: ['#bdcbdc', '#799bb7', '#304c68', '#b67d91', '#679eae'] },
  'mid-atlantic': { family: 'prairie', vegetation: 'hardwood', colors: ['#b6bea4', '#94a180', '#485e4e', '#b39570', '#899f9c'] },
  'new-england': { family: 'town', vegetation: 'birch', colors: ['#b6bdb3', '#a5a28d', '#3b5650', '#b77853', '#7897a1'] },
  alaska: { family: 'mountain', vegetation: 'spruce', colors: ['#b9ced0', '#8daab5', '#355b5d', '#8d9e98', '#5b879a'] },
  hawaii: { family: 'coast', vegetation: 'palm', colors: ['#b4bfac', '#809782', '#405754', '#b18b63', '#75a4a5'] },
} satisfies Record<Region, RegionStyle>

export function RegionalTree({
  kind,
  x,
  y,
  size,
  inks: c,
  coastal = false,
}: {
  kind: Vegetation
  x: number
  y: number
  size: number
  inks: Inks
  coastal?: boolean
}) {
  if (kind === 'fir' || kind === 'spruce') return <Pine x={x} y={y} size={size * (kind === 'fir' ? 1.5 : 1)} color={c.dark} />
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 50})`}>
      {kind === 'grass' ? (
        <path d="M-9 0-14-15M0 0l2-23M9 0l9-16" stroke={c.accent} strokeWidth="2" />
      ) : kind === 'palm' ? (
        <>
          <path d="M0 0q9-27 1-48" stroke={c.dark} strokeWidth="4" fill="none" />
          <path d="M1-47q-23-24-33 1 19-12 30 3-28-2-23 17 7-13 24-16 14 5 22 20 5-24-19-24 26-12 33 3-6-25-34-4Z" fill={c.dark} />
          <path d="M-9 2 0-7 10 3m-4-8 12 8" stroke={c.dark} fill="none" />
        </>
      ) : (
        <>
          <path
            d="M0 0V-37m0 20-16-14m16 6 17-16"
            stroke={kind === 'birch' ? c.paper : c.dark}
            strokeWidth={kind === 'birch' ? 4 : 3}
            fill="none"
          />
          <path
            d={
              kind === 'juniper'
                ? 'M-22-14q-9-14 5-20 3-16 16-9 13-13 21 3 20 5 9 23Z'
                : coastal && kind === 'oak'
                  ? 'M-32-32q-8-11 9-14 14-17 28-8 31-9 37 9 11 11-12 12Z'
                  : 'M-23-24q-13-18 3-25 3-20 21-13 17-8 23 11 19 9 8 24-14 16-32 5-13 9-23-2Z'
            }
            fill={kind === 'birch' ? c.accent : c.dark}
          />
          {kind === 'birch' && <path d="M-2-10h5m-5-10h5m-5-10h5" stroke={c.dark} strokeWidth="1.5" />}
          {kind === 'moss' && (
            <path d="M-24-24q-2 18 3 22m8-23q-3 13 3 19m23-22q-2 15 3 20m10-26v17" stroke={c.far} strokeWidth="2" fill="none" />
          )}
        </>
      )}
    </g>
  )
}

export function RegionalLandscape({
  family,
  region,
  inks: c,
  height: h,
  horizon,
  seed,
  openWater = false,
}: {
  family: SceneFamily
  region?: Region
  inks: Inks
  height: number
  horizon: number
  seed: number
  openWater?: boolean
}) {
  const style = region ? regions[region] : undefined
  const wet = family === 'coast' || family === 'river'
  const mountain = family === 'mountain' || region === 'alaska' || region === 'hawaii'
  const rounded = region === 'appalachia' || region === 'ozarks'
  const kind = style?.vegetation ?? (family === 'desert' ? 'juniper' : family === 'prairie' ? 'grass' : 'oak')
  const random = mulberry32(seed + 419)
  const shift = (random() - 0.5) * 100
  const treeCount = 8 + Math.floor(random() * 7)
  const middleCount = 5 + Math.floor(random() * 7)
  const lowland = region === 'great-plains' || region === 'florida'
  const rise = lowland ? 12 : region === 'hawaii' ? 38 : 65
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={
            mountain && !rounded
              ? `M-20 ${horizon + 45 + i * 18} 90 ${horizon - 20 + i * 25} 147 ${horizon + 10 + i * 18} ${260 + shift} ${horizon - rise + i * 35} 420 ${horizon + 50 + i * 20}V${h}H-20Z`
              : `M-20 ${horizon + i * 23}Q${90 + shift} ${horizon - (lowland ? 8 : 40) + i * 24} 210 ${horizon + i * 22}T420 ${horizon - 10 + i * 30}V${h}H-20Z`
          }
          fill={i === 0 ? c.far : c.mid}
          opacity={i === 1 ? 0.55 : 1}
        />
      ))}
      {family === 'desert' && (
        <path
          d={`M0 ${horizon + 50} 38 ${horizon + 10} 46 ${horizon - 16} 109 ${horizon - 16} 121 ${horizon + 30} 175 ${horizon + 60}Z`}
          fill={c.accent}
        />
      )}
      {region === 'alaska' && <path d={`m${260 + shift} ${horizon - 65}-51 76-28 30 53-11-8-28 47-6Z`} fill={c.paper} />}
      {wet && <path d={`M-10 ${horizon + 26}Q160 ${horizon + 17} 410 ${horizon + 30}V${h}H-10Z`} fill={c.water} />}
      <path
        d={
          wet
            ? openWater
              ? `M400 ${horizon + 26}Q370 ${h * 0.65} 365 ${h}H400Z`
              : `M400 ${horizon + 26}Q265 ${horizon + 24} 285 ${h * 0.69}T167 ${h}H400Z`
            : `M-10 ${h * 0.86}Q130 ${h * 0.69} 410 ${h * 0.82}V${h}H-10Z`
        }
        fill={c.mid}
        transform="translate(1.25 .5)"
      />
      {region === 'florida' && wet && (
        <path d={`M270 ${horizon + 35}q-38 51 21 67t-63 53`} stroke={c.far} strokeWidth="14" fill="none" opacity=".6" />
      )}
      {(family === 'town' || region === 'new-england') && (
        <g transform={`translate(190 ${horizon + 40})`}>
          {[0, 38, 77].map((x, i) => (
            <g key={x} transform={`translate(${x} ${(i % 2) * 8})`}>
              <path d="M0 0v-27h31V0Z" fill={c.paper} />
              <path d="m-3-27 18-16 19 16Z" fill={c.accent} />
              <path d="M4-20h23m-23 7h23m-23 7h23" stroke={c.mid} strokeWidth=".6" />
              <path d="M8-19v8m14-8V0" stroke={c.dark} strokeWidth="5" />
            </g>
          ))}
        </g>
      )}
      {region === 'southwest' && (
        <path d={`M0 ${h * 0.8}h140m-135 9h122m182-42h105m-83 9h83`} fill="none" stroke={c.accent} strokeWidth="5" />
      )}
      {(region === 'great-plains' || region === 'mid-atlantic') && (
        <path
          d={`M0 ${h * 0.7}q190-20 400 8M0 ${h * 0.8}q190-20 400 8M0 ${h * 0.91}q190-20 400 8`}
          fill="none"
          stroke={c.accent}
          strokeWidth="7"
        />
      )}
      {region === 'mid-atlantic' && (
        <path d={`M-10 ${h * 0.88}q70-20 153-12`} fill="none" stroke={c.paper} strokeWidth="5" strokeDasharray="8 2" />
      )}
      {wet && (
        <path
          className="rr-shimmer"
          d={`M12 ${h * 0.69}h99m-75 16h100m-124 26h118m-75 24h89`}
          fill="none"
          stroke={c.paper}
          strokeWidth="1.5"
          strokeDasharray="21 8 5 7"
        />
      )}
      {(region === 'appalachia' || region === 'deep-south') && (
        <path
          className="rr-mist"
          d={`M0 ${horizon + 20}Q150 ${horizon + 5} 400 ${horizon + 27}`}
          fill="none"
          stroke={c.paper}
          opacity=".4"
          strokeWidth="8"
        />
      )}
      {Array.from({ length: middleCount }, (_, i) => (
        <RegionalTree
          key={`middle-${i}`}
          kind={kind}
          x={wet ? 310 + random() * 100 : random() * 400}
          y={wet ? h * 0.69 : horizon + 52 + random() * 22}
          size={10 + random() * 15}
          inks={{ ...c, dark: c.mid, accent: c.mid }}
          coastal={wet}
        />
      ))}
      <path
        d={
          wet
            ? `M300 ${h}Q354 ${h * 0.82} 420 ${h * 0.8}V${h}Z`
            : `M-10 ${h}V${h * 0.88}Q45 ${h * 0.8} 100 ${h}M285 ${h}Q360 ${h * 0.81} 420 ${h * 0.9}V${h}Z`
        }
        fill={c.dark}
      />
      {Array.from({ length: treeCount }, (_, i) => {
        const x = wet ? (openWater ? 380 : 320) + (i % 3) * 33 : i < 3 ? i * 31 : 303 + (i - 3) * 31
        return (
          <RegionalTree
            key={i}
            kind={region === 'rockies' && i % 3 === 0 ? 'birch' : region === 'deep-south' && i % 3 === 0 ? 'spruce' : kind}
            x={x + (random() - 0.5) * 30}
            y={h * (0.83 + random() * 0.2)}
            size={24 + random() * 38}
            inks={c}
            coastal={family === 'coast'}
          />
        )
      })}
      {Array.from({ length: 4 }, (_, i) => {
        const x = wet ? 345 + random() * 55 : i % 2 ? random() * 75 : 330 + random() * 70
        const y = h * (0.92 + random() * 0.08)
        return kind === 'grass' || kind === 'palm' ? (
          <path key={`frame-${i}`} d={`M${x} ${y}l-9-16m9 16 3-22m-3 22 12-11`} stroke={c.accent} strokeWidth="2" fill="none" />
        ) : (
          <path key={`frame-${i}`} d={`M${x - 12} ${y}l5-9 13-3 10 11Z`} fill={c.mid} stroke={c.dark} strokeWidth="1" />
        )
      })}
    </g>
  )
}
