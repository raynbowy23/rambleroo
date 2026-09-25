import type { MotifProps } from './types'

export function RollingRidges({ inks: c }: MotifProps) {
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M-35 ${60 + i * 19}Q${20 + i * 12} ${-15 + i * 28} ${90 + i * 8} ${47 + i * 18}T235 ${40 + i * 22}V155H-35Z`}
          fill={i < 2 ? c.far : i < 4 ? c.water : c.dark}
          stroke={c.paper}
          strokeOpacity=".25"
        />
      ))}
    </g>
  )
}
export function SnowPeaks({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-15 145 40 41 63 68 102 4 138 53 157 31 215 145Z" fill={c.mid} />
      <path d="m102 4-8 89 26 52h55l-37-92Zm-62 37 3 104h37L63 68Z" fill={c.dark} />
      <path d="m40 41-19 37 21-10 11 10 10-10Zm62-37L73 53l23-10 10 16 12-14 20 8Zm55 27-19 22 19-7 17 20Z" fill={c.paper} />
    </g>
  )
}
export function Switchbacks({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-10 150 97 12l37 30 24 44 51 64Z" fill={c.mid} />
      <path d="M103 24 69 63q-10 8 12 8h39q23 1 7 12l-60 31q-15 9 7 11h63q24 1 9 13l-25 17" stroke={c.dark} strokeWidth="10" fill="none" />
      <path d="M103 24 69 63q-10 8 12 8h39q23 1 7 12l-60 31q-15 9 7 11h63q24 1 9 13l-25 17" stroke={c.paper} strokeWidth="5" fill="none" />
    </g>
  )
}
export function Hoodoos({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-10 148 14 86 32 105 59 63 81 117 126 81 157 105 180 54 213 150Z" fill={c.mid} />
      {[
        [25, 40, 1],
        [72, 9, 1.3],
        [127, 48, 0.85],
        [164, 25, 1.1],
      ].map(([x, y, s]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M-14 96-9 51-5 35-11 24-8 8 0 0 10 7 13 22 6 36 11 54 17 96Z" fill={c.accent} />
          <path d="m0 34 2 62h15L11 54 6 36 13 22 4 24Z" fill={c.dark} />
          <path d="M-10 23H11m-20 35H10m-22 20H13" stroke={c.paper} strokeOpacity=".6" strokeWidth="3" />
        </g>
      ))}
    </g>
  )
}
export function SlickrockRidge({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-15 155 38 92 77 62 94 15 123 69 171 97 215 155Z" fill={c.accent} />
      <path d="m94 15-4 59-38 81h89l-20-70Z" fill={c.paper} />
      <path d="m96 23 8 37-7 21 14 24-10 20 17 30" fill="none" stroke={c.dark} strokeWidth="5" />
      <path d="m96 24 8 36-7 21 14 24-10 20 17 30" fill="none" stroke={c.mid} strokeWidth="2" />
      <path d="m77 75-30 47-25 12m109-45 29 33 36 17m-121-37-14 43" stroke={c.dark} fill="none" strokeWidth="3" />
    </g>
  )
}
export function Aspens({ inks: c }: MotifProps) {
  return (
    <g>
      {[20, 52, 83, 117, 149, 182].map((x, i) => (
        <g key={x} transform={`translate(${x} ${(i % 2) * 13})`}>
          <path d="M0 136V45m0 35-14-20m14 6 12-23" stroke={c.paper} strokeWidth="5" fill="none" />
          <path d="M-2 105h5m-5 12h5m-5-30h5" stroke={c.dark} strokeWidth="2" />
          <path d="M0 13q-21 0-18 23-18 19 0 34 20 16 33-4 17-17 0-31Q15 13 0 13Z" fill={c.accent} />
          <path d="M0 75V36m0 18 10-11" stroke={c.paper} strokeWidth="2" fill="none" />
        </g>
      ))}
    </g>
  )
}
export function Orchard({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-10 139Q85 70 210 99v56H-10Z" fill={c.far} />
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <g
            key={`${row}-${col}`}
            transform={`translate(${15 + col * 38 - row * 8} ${73 + row * 31 - col * 5}) scale(${0.65 + row * 0.16})`}
          >
            <path d="M0 22V-5" stroke={c.dark} strokeWidth="4" />
            <circle r="17" fill={c.mid} />
            <path d="M-8-4h2m10-3h2m-9 16h2" stroke={c.accent} strokeWidth="5" strokeLinecap="round" />
          </g>
        )),
      )}
    </g>
  )
}
export function RhododendronBald({ inks: c }: MotifProps) {
  return (
    <g>
      <path d="M-20 150Q61 29 142 74l78 76Z" fill={c.far} />
      <path d="M15 151Q72 91 161 109" stroke={c.paper} strokeWidth="5" fill="none" />
      {[
        [12, 123],
        [47, 100],
        [124, 94],
        [156, 122],
        [184, 134],
      ].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <path d="M-15 8q-11-21 6-24 9-16 18 0 21 4 9 24Z" fill={c.dark} />
          <path d="M-10-5h2m8-7h2m7 11h2m-12 4h2" stroke={c.accent} strokeWidth="8" strokeLinecap="round" />
        </g>
      ))}
    </g>
  )
}
