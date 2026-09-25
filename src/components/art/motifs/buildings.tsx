import type { MotifProps } from './types'

function Cottage({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M0 0v-29h34V0Z" fill={c.paper} />
      <path d="m-4-29 21-18 21 18Z" fill={c.accent} />
      <path d="M7-20v9m10-9v9m9 11v-17" stroke={c.dark} strokeWidth="5" />
    </g>
  )
}
export function SteepleTown({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-10 135q105-36 220 0v17H-10Z" fill={c.mid} />
      {[5, 48, 138, 179].map((x, i) => (
        <g key={x} transform={`translate(${x} ${129 + (i % 2) * 8}) scale(.85)`}>
          <Cottage inks={c} />
        </g>
      ))}
      <path d="M84 131V79h46v52M93 79V48h23v31" fill={c.paper} />
      <path d="m90 48 14-41 15 41Zm-12 32 28-21 30 21Z" fill={c.dark} />
      <path d="M101 129v-18h10v18m-7-69v12" stroke={c.dark} strokeWidth="4" />
    </g>
  )
}
export function HarborVillage({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-10 101V81q99-19 220 7v14Z" fill={c.mid} />
      {[10, 54, 102, 154].map((x, i) => (
        <g key={x} transform={`translate(${x} ${86 + (i % 2) * 6}) scale(.8)`}>
          <Cottage inks={c} />
        </g>
      ))}
      <path d="M14 103h95v26m-62-27v43m-9-18h90m-10-25v14" fill="none" stroke={c.dark} strokeWidth="4" />
      {[133, 177].map((x, i) => (
        <g key={x} transform={`translate(${x} ${135 + i * 9})`}>
          <path d="M-15 0h32l-6 7H-9Z" fill={c.dark} />
          <path d="M0-43v43" stroke={c.dark} />
          <path d="M-3-39-3-5h-19Zm6 8L19-6H3Z" fill={c.paper} />
        </g>
      ))}
    </g>
  )
}
export function Gristmill({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-10 137q40-28 130-17t85 25q-80 22-175 4Z" fill={c.water} stroke="none" />
      <path d="M30 124V54h103v70Z" fill={c.accent} />
      <path d="M20 55 81 15l63 40Z" fill={c.dark} />
      <path d="M38 68h86m-86 14h86m-86 14h86m-86 14h86" stroke={c.paper} strokeOpacity=".4" />
      <path d="M54 70v14m42-14v14m-21 40V99" stroke={c.dark} strokeWidth="12" />
      <circle cx="142" cy="112" r="28" fill={c.dark} />
      <circle cx="142" cy="112" r="21" fill="none" stroke={c.paper} strokeWidth="3" />
      <path d="M142 85v54m-27-27h54m-46-19 38 38m0-38-38 38" stroke={c.mid} strokeWidth="4" />
      <path d="M164 89h43" stroke={c.paper} strokeWidth="5" />
    </g>
  )
}
export function Viaduct({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-10 140 45 38 110 15 209 81v69H-10Z" fill={c.mid} />
      {[
        [28, 78, 63],
        [64, 91, 56],
        [104, 97, 52],
        [144, 97, 52],
        [184, 91, 46],
      ].map(([x, y, h]) => (
        <path key={x} d={`M${x} ${y}v${h}h8v-${h}`} fill={c.paper} />
      ))}
      <path d="M-5 43Q73 123 211 78" fill="none" stroke={c.dark} strokeWidth="14" />
      <path d="M-5 40Q73 120 211 75" fill="none" stroke={c.paper} strokeWidth="9" />
      <path d="M-5 39Q73 119 211 74" fill="none" stroke={c.mid} strokeWidth="2" />
    </g>
  )
}
export function ArchBridge({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-10 53 29 70 46 148H-10m220-95-39 17-17 78h56" fill={c.mid} />
      <path d="M22 134Q100 14 178 134" fill="none" stroke={c.dark} strokeWidth="12" />
      <path d="M22 133Q100 13 178 133" fill="none" stroke={c.paper} strokeWidth="8" />
      <path d="M-10 61H210M-10 52H210m-177 9v54m25-54v24m26-24v9m33-9v9m26-9v24m25-24v54" stroke={c.paper} strokeWidth="4" fill="none" />
      <path d="M60 144h77m-56-10h31" stroke={c.paper} />
    </g>
  )
}
export function MiningTown({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-10 150 4 47 51 109 108 146 179 67 210 32v118Z" fill={c.mid} />
      {[14, 53, 92].map((x, i) => (
        <g key={x} transform={`translate(${x} ${139 - i * 3})`}>
          <path d="M0 0v-44h32V0Z" fill={i % 2 ? c.accent : c.paper} />
          <path d="M-3-44h38v-7H-3Z" fill={c.dark} />
          <path d="M5-34h22m-21 10v10m15-10V0" stroke={c.dark} strokeWidth="5" />
        </g>
      ))}
      <path d="M146 129 155 30h23l16 99m-42-75 35 41m-38 0 32-41m-29 48h37M152 30h31v-9h-31Z" stroke={c.dark} strokeWidth="4" fill="none" />
      <circle cx="167" cy="20" r="12" fill={c.mid} stroke={c.dark} strokeWidth="3" />
      <path d="m167 9 2 72 34 31" stroke={c.dark} fill="none" />
    </g>
  )
}
