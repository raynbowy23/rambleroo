import type { Motif } from '../../../lib/types'
import type { Inks } from '../motifs/types'

export interface PieceProps {
  inks: Inks
  snow: boolean
}

export function Block({ inks: c, snow, width: w = 12, height: h = 20 }: PieceProps & { width?: number; height?: number }) {
  return (
    <g stroke={c.dark} strokeWidth=".6" strokeLinejoin="round">
      <path d={`M${-w} ${-h} 0 ${-h + w / 2}V${w / 2}L${-w} 0Z`} fill={c.paper} />
      <path d={`M0 ${-h + w / 2} ${w} ${-h}V0L0 ${w / 2}Z`} fill={c.mid} />
      <path d={`M${-w} ${-h} 0 ${-h - w / 2} ${w} ${-h} 0 ${-h + w / 2}Z`} fill={snow ? c.paper : c.accent} />
      <path
        data-lit-window={c.window ? 'true' : undefined}
        d={`M${-w + 4} ${-h + 7}v4m5-2v4m7-4v4m5-7v4`}
        stroke={c.window ?? c.dark}
        strokeWidth="2.5"
      />
    </g>
  )
}

export function Tree({ inks: c, snow, round = false, palm = false }: PieceProps & { round?: boolean; palm?: boolean }) {
  return (
    <g strokeLinejoin="round">
      <path d="M0 2v-26" stroke={c.dark} strokeWidth="2" />
      {palm ? (
        <path d="M0-23q-13-12-18 0 12-5 18 0m0 0q9-16 19-5-12-2-19 5m0 0q-5-18 7-18-5 7-7 18" fill={c.mid} />
      ) : round ? (
        <>
          <path d="M0-31c-10-6-17 7-12 14-7 8 4 14 12 10 11 4 18-5 12-12 2-8-5-15-12-12Z" fill={c.mid} />
          <path d="M-8-25q-8 5-3 11" stroke={snow ? c.paper : c.far} strokeWidth="4" fill="none" />
        </>
      ) : (
        <>
          <path d="M0-39-11-20h5L-15-6 0 1 15-6 6-20h5Z" fill={c.mid} />
          <path d="M0-39v40l15-7-9-14h5Z" fill={c.dark} opacity=".4" />
          <path d="M-6-27 0-39 6-27 0-29Z" fill={snow ? c.paper : c.far} />
        </>
      )}
    </g>
  )
}

export function Peak({ inks: c, snow, mesa = false, gentle = false }: PieceProps & { mesa?: boolean; gentle?: boolean }) {
  const h = gentle ? 28 : 57
  return (
    <g stroke={c.dark} strokeWidth=".6" strokeLinejoin="round">
      <path
        d={mesa ? 'M-31 0-20-19-17-40 11-49 22-36 23-15 33 0 0 16Z' : `M-34 0-19-20-12-24 0 ${-h} 14-27 20-23 34 0 0 17Z`}
        fill={c.mid}
      />
      <path d={mesa ? 'M11-49 22-36 23-15 33 0 0 16 7-12Z' : `M0 ${-h} 14-27 20-23 34 0 0 17 7-14Z`} fill={c.dark} opacity=".5" />
      <path d={mesa ? 'M-17-40 11-49 22-36-5-29Z' : `M0 ${-h}-10 ${-h + 20} 0 ${-h + 16} 10 ${-h + 20}Z`} fill={snow ? c.paper : c.far} />
      <path d="M-23-9-2 0 21-10m-46 16 25 10 24-12" stroke={c.paper} opacity=".3" fill="none" />
    </g>
  )
}

function Pool({ inks: c }: PieceProps) {
  return (
    <g>
      <path d="M-32 0Q-6-22 30-2 39 5 9 17-19 22-32 0Z" fill={c.water} />
      <path d="m-19 2 12 6m4-10 17 8m-15 6 10 2" stroke={c.paper} opacity=".7" />
    </g>
  )
}

export function Bridge({ inks: c, snow }: PieceProps) {
  return (
    <g stroke={c.dark} strokeWidth=".8" strokeLinejoin="round">
      <path d="M-29-14 27 14v14l-8-4q0-21-13-7v1l-10-5q0-21-14-7v1l-11-5Z" fill={c.far} />
      <path d="M-29-14-20-19 36 9 27 14Z" fill={snow ? c.paper : c.mid} />
      <path d="m-28-18 55 28m-53-30v7m13 0v7m14 0v7m14 0v7m12-1v7" fill="none" />
    </g>
  )
}

export function Landmark({ motif, ...props }: PieceProps & { motif: Motif }) {
  const { inks: c, snow } = props
  switch (motif) {
    case 'lighthouse':
      return (
        <g stroke={c.dark} strokeWidth=".7" strokeLinejoin="round">
          {c.window && <path data-lighthouse-beam="true" d="M0-51 70-76 70-38Z" fill={c.window} opacity=".19" stroke="none" />}
          <path d="M-10 2-6-44 5-49 11-3 0 7Z" fill={c.paper} />
          <path d="M0-46 5-49 11-3 0 7Z" fill={c.mid} />
          <path d="m-8-22 9 4 7-4 1 9-9 5-9-5Z" fill={c.accent} />
          <Block {...props} width={8} height={8} />
          <path d="M-8-46v-11l8-4 9 4v11l-9 4Z" fill={c.window ?? c.water} />
          <path d="m-11-57 11-10 12 10-12 5Z" fill={snow ? c.paper : c.accent} />
        </g>
      )
    case 'arch-bridge':
    case 'viaduct':
      return (
        <>
          <Pool {...props} />
          <Bridge {...props} />
        </>
      )
    case 'gristmill':
      return (
        <>
          <Pool {...props} />
          <Block {...props} width={17} height={30} />
          <g transform="translate(17 -1) skewY(-26)">
            <circle r="10" fill={c.dark} stroke={c.accent} strokeWidth="3" />
            <path d="M-9 0H9M0-9V9m-6-15L6 6m0-12L-6 6" stroke={c.paper} />
          </g>
        </>
      )
    case 'steeple-town':
      return (
        <>
          <Block {...props} width={16} height={21} />
          <g transform="translate(-4 -20)">
            <Block {...props} width={6} height={20} />
            <path d="M-8-20 0-44 8-20 0-16Z" fill={snow ? c.paper : c.dark} />
            <path d="M0-48v9m-3-6h6" stroke={c.dark} />
          </g>
        </>
      )
    case 'paddlewheeler':
      return (
        <>
          <Pool {...props} />
          <path d="M-29-7 7-21 32-8 11 10-22 0Z" fill={c.dark} />
          <g transform="translate(0 -6)">
            <Block {...props} width={18} height={11} />
          </g>
          <path d="M-7-17v-16m10 17v-14" stroke={c.dark} strokeWidth="4" />
          <circle cx="17" cy="0" r="7" fill={c.accent} stroke={c.paper} />
          <path d="M10 0h14m-7-7V7" stroke={c.paper} />
        </>
      )
    case 'lock-and-dam':
      return (
        <>
          <Pool {...props} />
          <path d="m-28-16 57 28v12l-57-28Z" fill={c.far} />
          <path d="m-18-6-4 14m15-8-4 14m15-8-4 14m15-8-4 14" stroke={c.paper} strokeWidth="5" />
          <path d="m-28-20 57 28" stroke={c.dark} strokeWidth="3" />
        </>
      )
    case 'waterfall-cove':
      return (
        <>
          <Pool {...props} />
          <g transform="translate(-8 -8)">
            <Peak {...props} mesa gentle />
          </g>
          <path d="M-4-39 7-34 8 6-3 1Z" fill={c.water} />
          <path d="M0-34 1 1m4-27L5 4" stroke={c.paper} strokeWidth="2" />
        </>
      )
    case 'hoodoos':
      return (
        <>
          {[-16, 0, 17].map((x, i) => (
            <g key={x} transform={`translate(${x} ${(i % 2) * 9})`}>
              <path d="M-7 0-4-23-7-30-3-38 6-35 8-27 3-20 8 0 0 4Z" fill={c.accent} />
              <path d="M1-24 3-20 8 0 0 4Z" fill={c.dark} opacity=".5" />
              <path d="M-6-29 7-26" stroke={snow ? c.paper : c.far} strokeWidth="3" />
            </g>
          ))}
        </>
      )
    case 'harbor-village':
    case 'mining-town':
      return (
        <>
          {motif === 'harbor-village' && <Pool {...props} />}
          <g transform="translate(-15 -9)">
            <Block {...props} width={10} height={19} />
          </g>
          <g transform="translate(10 7)">
            <Block {...props} width={12} height={25} />
          </g>
          {motif === 'mining-town' && <path d="M-27 8-10 16m-17-13 17 8m-13-5-3 6m9-4-3 6" stroke={c.dark} />}
        </>
      )
    case 'orchard':
    case 'aspens':
    case 'rhododendron-bald':
      return (
        <>
          {[-17, 0, 17].map((x, i) => (
            <g key={x} transform={`translate(${x} ${(i % 2) * 12}) scale(${motif === 'rhododendron-bald' ? 0.6 : 0.85})`}>
              <Tree {...props} round inks={motif === 'rhododendron-bald' ? { ...c, mid: '#b48691' } : c} />
            </g>
          ))}
        </>
      )
    case 'lake-wide':
    case 'sandbars':
      return (
        <>
          <Pool {...props} />
          {motif === 'sandbars' && <path d="m-17 0 13-3 12 7-13 2Zm20 7 11-2 7 4-12 3Z" fill={c.far} />}
        </>
      )
    case 'limestone-ledges':
    case 'river-bluffs':
      return (
        <>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${i * 13 - 13} ${i * 5})`}>
              <Block {...props} width={14} height={30 - i * 5} />
              <path d="m-13-9 13 6 13-6m-26-7 13 6 13-6" stroke={c.paper} opacity=".5" />
            </g>
          ))}
        </>
      )
    case 'sea-rock':
      return (
        <>
          <Pool {...props} />
          <g transform="scale(.65)">
            <Peak {...props} />
          </g>
        </>
      )
    case 'slickrock-ridge':
      return <Peak {...props} mesa />
    case 'rolling-ridges':
      return <Peak {...props} gentle />
    case 'snow-peaks':
      return <Peak {...props} snow />
    case 'switchbacks':
      // The single road carries the switchbacks; this piece supplies its adjacent ridge.
      return <Peak {...props} />
  }
}
