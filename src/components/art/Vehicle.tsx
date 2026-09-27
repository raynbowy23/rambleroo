import { defaultGarage, type Garage } from '../../lib/garage'

export type VehicleProps = Partial<Garage> & { view: 'top' | 'side'; size?: number }
/** Flat inks and a shared silhouette keep the map icon and printed car identical. */
export function Vehicle({ view, size = 120, ...choices }: VehicleProps) {
  const { model, body, accent, accentColor, roof, plate } = { ...defaultGarage, ...choices }
  const top = view === 'top'
  const bike = model === 'motorcycle'
  const bus = model === 'camper'
  const pickup = model === 'pickup'
  const open = model === 'convertible'
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={top ? '0 0 60 100' : '0 0 160 90'}
      width={size}
      height={top ? (size * 100) / 60 : (size * 90) / 160}
      role="img"
      aria-label={`${body} ${model}, ${view} view`}
      data-vehicle={model}
      data-body={body}
    >
      <g stroke="#252b22" strokeWidth="2.5" strokeLinejoin="round">
        {top ? (
          <>
            {bike ? (
              <>
                <rect x="25" y="3" width="10" height="94" rx="5" fill="#252b22" />
                <path d="M15 25H45M20 78H40" />
                <ellipse cx="30" cy="48" rx="12" ry="25" fill={body} />
                <rect x="24" y="53" width="12" height="23" rx="4" fill="#493e30" />
              </>
            ) : (
              <>
                {[13, 65].flatMap((y) =>
                  [3, 48].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="9" height="20" rx="3" fill="#252b22" />),
                )}
                <rect x="9" y="3" width="42" height="93" rx={bus ? 8 : pickup ? 6 : 17} fill={body} />
                {accent !== 'none' && (
                  <rect
                    x={accent === 'stripe' ? 26 : 11}
                    y="8"
                    width={accent === 'stripe' ? 8 : 38}
                    height={accent === 'stripe' ? 81 : 36}
                    rx="4"
                    fill={accentColor}
                    stroke="none"
                  />
                )}
                <path d="M15 28Q30 22 45 28L42 43H18Z" fill="#f5e6c8" />
                {bus && <path d="M30 25V43" />}
                <path d="M18 66H42L45 80H15Z" fill={pickup ? '#786347' : '#f5e6c8'} />
                {pickup && <path d="M17 53H43V85H17ZM23 55V83M36 55V83" fill="#987953" />}
                {open && <rect x="17" y="44" width="26" height="23" rx="4" fill="#493e30" />}
                {model === 'wagon' && <path d="M12 44V77M48 44V77" stroke="#aa794b" strokeWidth="5" />}
                <path d="M17 9H43M17 90H43" stroke="#f5e6c8" strokeWidth="4" />
              </>
            )}
          </>
        ) : (
          <>
            {bike ? (
              <>
                <circle cx="34" cy="64" r="18" fill="#252b22" />
                <circle cx="128" cy="64" r="18" fill="#252b22" />
                <path d="M34 64L66 35L93 64H34M93 64L116 27H132M116 27L128 64" fill="none" />
                <path d="M62 32Q88 20 104 41L88 53H56Z" fill={body} />
                <path d="M53 30H76" strokeWidth="7" />
              </>
            ) : (
              <>
                <path
                  d={
                    bus
                      ? 'M14 65V24Q14 15 26 15H128Q145 15 147 32V65Z'
                      : pickup
                        ? 'M12 65V39H68V20H107L125 40H148V65Z'
                        : open
                          ? 'M12 65V43H44L52 29H62V43H110V36L137 43L148 65Z'
                          : 'M12 65V43L37 36L53 18H108L129 39L147 45V65Z'
                  }
                  fill={body}
                />
                {accent !== 'none' && (
                  <path d={accent === 'stripe' ? 'M16 50H143V56H16Z' : 'M16 48H143V63H16Z'} fill={accentColor} stroke="none" />
                )}
                {!open && (
                  <path
                    d={
                      bus
                        ? 'M22 23H53V39H22ZM61 23H93V39H61ZM101 23H132L139 39H101Z'
                        : pickup
                          ? 'M76 26H103L115 40H76Z'
                          : 'M57 25H77V39H44ZM85 25H104L117 39H85Z'
                    }
                    fill="#f5e6c8"
                  />
                )}
                {model === 'wagon' && <path d="M20 46H137V59H20ZM58 46V59M101 46V59" fill="#b18655" />}
                {[40, 121].map((x) => (
                  <g key={x}>
                    <circle cx={x} cy="65" r="14" fill="#252b22" />
                    <circle cx={x} cy="65" r="7" fill="#f5e6c8" />
                  </g>
                ))}
                <path d="M9 62H22M139 62H151" stroke="#f5e6c8" strokeWidth="5" />
              </>
            )}
          </>
        )}
        {roof !== 'none' && (
          <g transform={top ? 'translate(15 35)' : 'translate(57 0)'}>
            {roof === 'surfboard' && <ellipse cx={top ? 15 : 25} cy={top ? 12 : 9} rx={top ? 6 : 36} ry={top ? 36 : 6} fill="#f5e6c8" />}
            {roof === 'canoe' && <path d={top ? 'M15 -25Q-7 10 15 53Q37 10 15 -25Z' : 'M-15 4Q25 27 66 4Z'} fill="#b18655" />}
            {roof === 'luggage' && (
              <>
                <rect x="0" y="0" width="30" height="18" rx="3" fill="#b18655" />
                <path d="M8 0V18M23 0V18" />
              </>
            )}
            {roof === 'bikes' && (
              <>
                <circle cx="0" cy="10" r="8" fill="#f5e6c8" />
                <circle cx="34" cy="10" r="8" fill="#f5e6c8" />
                <path d="M0 10L15 0L24 10H0M24 10L32 -3L34 10" fill="none" />
              </>
            )}
          </g>
        )}
      </g>
      <text x={top ? 30 : 79} y={top ? 88 : 61} textAnchor="middle" fontFamily="monospace" fontSize={top ? 5 : 7} fill="#252b22">
        {plate}
      </text>
    </svg>
  )
}
