import type { MotifProps } from './types'

export function RiverBluffs({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M38 20 79 8 130 16 171 5 240 21V145L167 140 122 148 71 129 50 91Z" fill="#b9a58c" />
      <path d="m52 37 22 89 48 22-23-53-8-77m78-13-17 63 15 72 30 5-16-74 19-54" fill="#877966" />
      <path
        d="m43 34 55 5 71-9 71 7M48 52l54 7 70-10 68 9M54 74l54 8 65-10 67 5M61 97l55 8 62-8 62 8M70 120l49 8 66-9 55 9"
        fill="none"
        stroke="#e0cdb0"
        strokeWidth="3"
      />
      <path d="M35 24 74 9 126 17 172 6 240 20v12l-65-12-51 9-47-7-39 12Z" fill={c.dark} />
      {[49, 77, 108, 139, 172, 205, 232].map((x, i) => (
        <g key={x} transform={`translate(${x} ${13 + (i % 3) * 3})`}>
          <path d="M0 8V-12" stroke={c.dark} strokeWidth="3" />
          <path d="M-13 0q-9-12 0-19 5-13 15-6 14-2 15 12 6 12-9 16Z" fill={i % 3 === 0 ? c.accent : c.dark} />
        </g>
      ))}
      <path d="M25 143q55-9 97 8m-131-20h46m114 20h77" stroke={c.paper} strokeWidth="2" fill="none" />
    </g>
  )
}
export function LakeWide({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-150 63Q12 48 74 61T350 58L350 170H-150Z" fill={c.water} stroke="none" />
      <path d="M-150 63Q-35 42 29 53T140 49 350 48V64Z" fill={c.far} stroke="none" />
      <path d="M-150 66Q-20 72 16 100L-26 170H-150m500-104q-75 15-83 37l54 67h29" fill={c.mid} />
      <path d="M50 79h110m-125 15h145m-110 22h61m-95 20h110" fill="none" stroke={c.paper} strokeWidth="1.5" />
    </g>
  )
}
export function LockAndDam({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="m0 70 200 16v29L0 99Z" fill={c.paper} />
      {[12, 49, 86, 123, 160].map((x) => (
        <g key={x}>
          <path d={`M${x} ${78 + x * 0.08}v24h24v-22Z`} fill={c.dark} />
          <path d={`M${x + 4} ${101 + x * 0.08}l-5 25m12-24-2 24m10-23 2 24`} stroke={c.paper} strokeWidth="3" />
        </g>
      ))}
      <path d="m0 66 200 16m-200-23 200 16M6 59v12m40-9v12m40-9v12m40-9v12m40-9v12" stroke={c.dark} fill="none" strokeWidth="2" />
      <path d="M158 74V48h27v29m-30-29 16-12 17 12" fill={c.mid} />
      <path d="m-7 112 65 9v13l-65-10Z" fill={c.mid} />
    </g>
  )
}
export function Paddlewheeler({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M0 111H197l-19 23H23Z" fill={c.dark} />
      <path d="M24 110V88h144v22M40 86V65h108v21M64 64V51h49v13" fill={c.paper} />
      <path d="M18 89h159M34 65h121M28 102h135" stroke={c.accent} strokeWidth="4" />
      {[45, 65, 85, 105, 125, 145].map((x) => (
        <path key={x} d={`M${x} 94v10m-1-34v10`} stroke={c.dark} strokeWidth="5" />
      ))}
      <path d="M72 51V24h9v27m16 0V24h9v27" fill={c.dark} />
      <circle cx="172" cy="117" r="20" fill={c.accent} />
      <circle cx="172" cy="117" r="13" fill="none" stroke={c.paper} strokeWidth="2" />
      <path d="M172 98v38m-19-19h38m-32-13 26 26m0-26-26 26" stroke={c.dark} strokeWidth="2" />
      <path d="M12 145h170" stroke={c.paper} />
    </g>
  )
}
export function Sandbars({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M0 89q55-37 86-10-31 22-86 10m108 15q47-29 91-9-45 24-91 9M25 134q55-33 118-8-59 24-118 8" fill={c.paper} />
      <path d="M23 81q27-12 42-2m66 16q21-8 43-2m-122 30q28-9 54-1" fill="none" stroke={c.far} strokeWidth="7" />
    </g>
  )
}
export function LimestoneLedges({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M93 70 225 53v32L86 103 58 91Z" fill="#bdc0ba" />
      <path d="m58 91 28 12 139-18v12L89 115 58 102Z" fill="#525e62" />
      <path d="m61 105 164-16v26L57 133 27 120Z" fill="#cbd0ca" />
      <path d="m27 120 30 13 168-18v12L59 146 27 134Z" fill="#677176" />
      <path d="m55 137 170-15v20L65 157 7 145Z" fill="#aeb9b8" />
      <path d="m102 75 26 10-14 14m67-32-11 16 13 5m-98 23 26 8-13 10m60-19 17 9-7 8" stroke="#4b5e65" strokeWidth="2" fill="none" />
      <path d="M9 142q-14-7-2-13m14 19q-20 11 8 14m25-8q35 7 75-2m-99-39-8-8m-4 17-12-2" stroke={c.paper} strokeWidth="2.5" fill="none" />
    </g>
  )
}
export function Lighthouse({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M0 145 43 119 105 120 141 131 200 145Z" fill={c.mid} />
      <path d="M68 122 77 35h23l9 87Z" fill={c.paper} />
      <path d="M73 74h31l2 20H71Z" fill={c.accent} />
      <path d="M73 35V20h31v15Zm-5-15L88 7l21 13Z" fill={c.dark} />
      <path d="M82 23v9m10-9v9" stroke={c.paper} strokeWidth="4" />
      <path d="M85 120v-16h8v16" fill={c.dark} />
      <path d="M120 124V96h55v28Z" fill={c.paper} />
      <path d="m114 96 34-23 34 23Z" fill={c.accent} />
      <path d="M131 103v10m16-10v10m16-10v20" stroke={c.dark} strokeWidth="6" />
    </g>
  )
}
export function SeaRock({ inks: c, lighthouse }: MotifProps) {
  return (
    <g>
      <path d="m25 130 23-26 9-35 26-15 8-21 37 6 11 35 19 13 25 45Z" fill={c.dark} />
      <path d="m91 33-8 63-23 33h54l-8-45 22-45Z" fill={c.mid} />
      <path d="M14 139q35-6 64 0t76 0 42 0" stroke={c.paper} strokeWidth="2" fill="none" />
      {lighthouse && (
        <g transform="translate(74 -8) scale(.36)">
          <Lighthouse inks={c} />
        </g>
      )}
    </g>
  )
}
export function WaterfallCove({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-10 19 44 10 89 21 131 6 210 24v117H-10Z" fill="#b47f59" />
      <path d="m18 27 15 63-10 47 32-9 7-77m69-45-9 66 27 55 26 7-20-63 18-50" fill="#815d46" />
      <path d="m0 41 75 9m40-15 82 10M5 66l73 7m44-12 83 12M5 92l64 4m70-10 66 14" stroke="#d4aa7b" strokeWidth="3" fill="none" />
      <path d="M-10 23Q38 1 89 23L132 8l78 17v12l-79-17-42 15Q35 16-10 35Z" fill={c.dark} />
      {[8, 34, 62, 127, 158, 191].map((x, i) => (
        <path key={x} d={`M${x - 10} ${17 + (i % 3) * 3}q-10-14 1-20 7-10 15-1 14 6 5 20Z`} fill={c.dark} />
      ))}
      <path d="M-10 143Q87 83 210 133v33H-10Z" fill="#e6c598" />
      <path d="M-10 158Q78 108 210 141v25H-10Z" fill="#48a7ad" stroke="none" />
      <path d="M89 25q-3 43 5 76l-2 28" stroke="#fff4dc" strokeWidth="5" fill="none" />
      <path d="m92 33 1 43 5 28" stroke="#d6e8df" strokeWidth="1.5" fill="none" />
      <path d="M80 131q13-8 27 0m-25 4q13 5 29 0m-56 12q62-17 111-2" stroke={c.paper} strokeWidth="2" fill="none" />
    </g>
  )
}
