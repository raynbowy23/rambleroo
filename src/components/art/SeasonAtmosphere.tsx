import type { PostcardLook, Region } from '../../lib/types'
import { mulberry32 } from './random'
import { warmWinter } from './looks'

/**
 * A whole-scene seasonal pass drawn over the landscape and landmarks. Trees alone change too little on landmark-heavy
 * scenes, so each season also gets a colour wash, a ground treatment, and a few falling details, enough that four
 * copies of the same road read as four seasons at a glance. Regions without snow get a mild winter instead.
 */
export function SeasonAtmosphere({ look, region, height: h, seed }: { look: PostcardLook; region?: Region; height: number; seed: number }) {
  const random = mulberry32(seed ^ 0x5eaa)
  const mild = warmWinter(region)
  const drift = (count: number, draw: (x: number, y: number, i: number) => React.ReactNode) =>
    Array.from({ length: count }, (_, i) => draw(10 + random() * 380, 8 + random() * h * 0.8, i))

  switch (look.season) {
    case 'spring':
      return (
        <g data-season-atmosphere="spring" pointerEvents="none">
          {/* Pale fresh light, young green ground, and blossom drifting across. */}
          <rect width="400" height={h * 0.6} fill="#fff4f6" opacity=".22" />
          <rect y={h * 0.55} width="400" height={h * 0.45} fill="#9fd36f" opacity=".34" style={{ mixBlendMode: 'multiply' }} />
          {drift(30, (x, y, i) => (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="3.2"
              ry="2"
              fill={i % 3 ? '#f29bb2' : '#ffe1ea'}
              transform={`rotate(${(i * 37) % 180} ${x} ${y})`}
            />
          ))}
        </g>
      )
    case 'summer':
      return (
        <g data-season-atmosphere="summer" pointerEvents="none">
          {/* Deep high-summer greens; the scene's own sun and the card's daylight carry the sky. */}
          <rect y={h * 0.58} width="400" height={h * 0.42} fill="#1f6a35" opacity=".3" style={{ mixBlendMode: 'multiply' }} />
        </g>
      )
    case 'autumn':
      return (
        <g data-season-atmosphere="autumn" pointerEvents="none">
          <rect width="400" height={h} fill="#f0a24a" opacity=".22" style={{ mixBlendMode: 'multiply' }} />
          <rect y={h * 0.58} width="400" height={h * 0.42} fill="#d0622a" opacity=".18" style={{ mixBlendMode: 'multiply' }} />
          {drift(16, (x, y, i) => (
            <path
              key={i}
              d={`M${x} ${y}q3-4 6 0q-3 4-6 0Z`}
              fill={['#c9502b', '#e08a2e', '#b33a24', '#d9a32f'][i % 4]}
              transform={`rotate(${(i * 53) % 360} ${x + 3} ${y})`}
            />
          ))}
        </g>
      )
    case 'winter':
      return mild ? (
        <g data-season-atmosphere="winter-mild" pointerEvents="none">
          <rect width="400" height={h} fill="#a9b8c4" opacity=".24" style={{ mixBlendMode: 'multiply' }} />
          <rect width="400" height={h} fill="#ffffff" opacity=".08" />
        </g>
      ) : (
        <g data-season-atmosphere="winter" pointerEvents="none">
          <rect width="400" height={h} fill="#9fb6cc" opacity=".26" style={{ mixBlendMode: 'multiply' }} />
          {/* Snow settles on the lower ground and lightens everything a little. */}
          <path d={`M0 ${h * 0.8}Q110 ${h * 0.74} 210 ${h * 0.8}T400 ${h * 0.78}V${h}H0Z`} fill="#f7f9fb" opacity=".72" />
          <rect width="400" height={h} fill="#ffffff" opacity=".12" />
          {drift(34, (x, y, i) => (
            <circle key={i} cx={x} cy={y} r={i % 4 ? 1.3 : 2.1} fill="#ffffff" opacity=".9" />
          ))}
        </g>
      )
  }
}
