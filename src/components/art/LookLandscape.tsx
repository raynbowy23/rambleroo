import type { PostcardLook, Region, SceneFamily } from '../../lib/types'
import type { Inks } from './motifs/types'
import { RegionalTree, regions } from './regions'
import { mixInk, warmWinter } from './looks'

interface Props {
  family: SceneFamily
  region?: Region
  look: PostcardLook
  inks: Inks
  height: number
  hasMotifs: boolean
}

/** Coordinates describe a 400 × 260 print; the surrounding scene handles the crop. */
export function LookLandscape({ family, region, look, inks: c, height, hasMotifs }: Props) {
  const layout = look.layout % 3
  const winter = look.season === 'winter'
  const mild = warmWinter(region)
  const snow = winter && !mild
  const tropical = region === 'florida' || region === 'hawaii'
  const foliage = {
    spring: tropical ? '#76a967' : '#9eb866',
    summer: '#396e50',
    autumn: tropical || region === 'southwest' ? '#c5a45e' : '#cf763c',
    winter: mild ? '#999b79' : '#797765',
  }[look.season]
  const ground = snow ? '#e8e4d4' : mixInk(c.mid, foliage, family === 'desert' ? 0.18 : 0.38)
  const kind = region ? regions[region].vegetation : family === 'mountain' || family === 'forest' ? 'fir' : 'hardwood'
  const tree = (x: number, y: number, size: number, i = 0) => (
    <g key={`${x}-${y}`} data-season-tree={look.season}>
      {winter && !mild && kind !== 'fir' && kind !== 'spruce' ? (
        <path
          d={`M${x} ${y}v-${size}m0 ${size * 0.45}l-${size * 0.3}-${size * 0.25}m${size * 0.3} ${size * 0.4}l${size * 0.32}-${size * 0.35}`}
          fill="none"
          stroke={c.dark}
          strokeWidth="2.4"
        />
      ) : (
        <RegionalTree
          kind={kind}
          x={x}
          y={y}
          size={size}
          inks={{ ...c, dark: foliage, accent: look.season === 'autumn' && i % 2 ? '#b95039' : foliage }}
          coastal={family === 'coast'}
        />
      )}
      {look.season === 'spring' && !['fir', 'spruce', 'grass'].includes(kind) && (
        <path
          d={`M${x - size * 0.2} ${y - size * 0.68}h1m${size * 0.35} -6h1m-${size * 0.12} 13h1`}
          stroke={tropical ? '#e9b666' : '#efb3b0'}
          strokeWidth="5"
          strokeLinecap="round"
        />
      )}
      {snow && <path d={`M${x - 9} ${y + 1}h19`} stroke={c.paper} strokeWidth="3" />}
    </g>
  )
  const road = (d: string, width = 9) => <path d={d} fill="none" stroke={c.paper} strokeWidth={width} />
  const waterLines = (
    <path
      className="rr-shimmer"
      d="M18 173h80m-54 15h100m29-22h58m-203 44h76m106-11h82"
      stroke={c.paper}
      strokeWidth="1.3"
      strokeDasharray="23 9 5 8"
      opacity=".6"
    />
  )
  const house = (x: number, y: number, scale = 1, steeple = false) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${scale})`} stroke={c.dark} strokeWidth="1">
      <path d="M0 0v-30h37V0Z" fill={c.accent} />
      <path d="M-4-30 18-46 41-30Z" fill={c.dark} />
      <path d="M6-23h7v10H6Zm17 0h7v10h-7Z" fill={look.time === 'dusk' ? '#f4cf78' : c.paper} />
      <path d="M16 0v-10h7V0" fill={c.dark} />
      {steeple && (
        <>
          <path d="M13-36v-25h11v25" fill={c.paper} />
          <path d="m10-61 9-26 8 26Z" fill={c.dark} />
        </>
      )}
      {look.time === 'golden' && <path d="M0 0h37l40 16H42Z" fill={c.dark} opacity=".3" stroke="none" />}
    </g>
  )
  return (
    <g data-layout={`${family}-${layout}`} transform={`scale(1 ${height / 260})`}>
      <path d="M0 119Q85 76 168 113T400 104V260H0Z" fill={c.far} />
      {family === 'river' && (
        <>
          <path d="M0 131Q180 108 400 133V260H0Z" fill={ground} />
          <path
            d={
              [
                'M244 117Q124 143 207 168T53 260H185Q353 198 250 163T279 117Z',
                'M166 113Q287 145 175 174T94 260H247Q150 216 253 170T191 113Z',
                'M0 143Q121 132 209 165T400 184V260H0Z',
              ][layout]
            }
            fill={c.water}
          />
          {layout === 0 && (
            <>
              <path d="M0 107 58 82 123 91 150 143 105 196 0 217Z" fill={c.mid} />
              <path d="m15 129 95-14m-100 40 112-19m-111 49 80-15" stroke={c.accent} strokeWidth="7" />
              {road('M294 126Q349 177 253 219T273 260')}
            </>
          )}
          {layout === 1 && (
            <>
              <path d="M0 260V188Q57 158 135 194L202 260Z" fill={ground} />
              {road('M0 230Q64 190 156 244', 6)}
              {tree(37, 241, 72)}
              {tree(88, 218, 37)}
            </>
          )}
          {layout === 2 && (
            <>
              <path d="M222 260Q261 194 400 150V260Z" fill={ground} />
              {road('M389 169Q274 205 304 260', 12)}
              {tree(365, 242, 103)}
              {tree(25, 260, 80)}
            </>
          )}
          {waterLines}
        </>
      )}
      {family === 'coast' && (
        <>
          <path d="M0 117H400V260H0Z" fill={c.water} />
          {layout === 0 && (
            <>
              <path d="M400 99 312 103 271 138Q339 168 246 199L208 260H400Z" fill={ground} />
              <path d="M274 140Q342 177 245 204L219 260" fill="none" stroke={c.accent} strokeWidth="14" />
              {road('M365 111Q291 131 353 169T292 260', 7)}
            </>
          )}
          {layout === 1 && (
            <>
              <path d="M400 124Q209 151 131 260H400Z" fill={c.paper} />
              <path d="M400 145Q298 182 271 260H400Z" fill={ground} />
              <path d="M400 128Q190 168 119 260m241-122Q209 186 175 260" fill="none" stroke={c.paper} strokeWidth="3" />
              {tree(332, 245, 89)}
              {tree(374, 192, 51)}
            </>
          )}
          {layout === 2 && (
            <>
              <path d="M0 114Q137 99 227 118T400 134L400 155Q290 131 212 144T0 161Z" fill={c.mid} />
              <path d="M0 260V201Q99 157 165 202T400 229V260Z" fill={ground} />
              {road('M0 230Q98 176 192 233T400 251', 8)}
              {tree(36, 215, 57)}
            </>
          )}
          {waterLines}
          {layout === 0 && tree(376, 242, 70)}
        </>
      )}
      {family === 'mountain' && (
        <>
          <path
            d={
              layout === 2
                ? 'M0 169 39 89 87 133 151 65 207 122 260 77 319 117 367 61 400 111V260H0Z'
                : 'M0 164 100 104 164 54 230 134 295 69 400 157V260H0Z'
            }
            fill={c.mid}
          />
          <path
            d={
              layout === 2
                ? 'm126 91 25-26 30 37-25-11-13 6Zm214 0 27-30 26 37-24-11-10 9Z'
                : 'm127 94 37-40 42 52-35-14-13 8Zm142 11 26-36 30 40-27-14-11 9Z'
            }
            fill={snow ? '#fff5e3' : c.far}
          />
          {layout === 0 && (
            <>
              <path d="M0 260V195Q139 143 245 187T400 200V260Z" fill={ground} />
              {road('M215 153Q106 179 243 196T133 229T230 270', 9)}
            </>
          )}
          {layout === 1 && (
            <>
              <path d="M0 174Q192 155 400 179V260H0Z" fill={c.water} />
              <path d="m100 180 64 64 64-68m42 4 25 44 38-43" fill={c.mid} opacity=".55" />
              {waterLines}
              <path d="M0 260V203L91 260M400 260V201L319 260" fill={ground} />
            </>
          )}
          {layout === 2 && (
            <>
              <path d="M0 260 123 177 218 206 320 158 400 213V260Z" fill={ground} />
              {road('M116 260 199 219 246 225 321 178', 5)}
            </>
          )}
          {tree(31, 255, layout === 2 ? 33 : 74)}
          {tree(377, 247, 55)}
        </>
      )}
      {family === 'forest' && (
        <>
          <path d="M0 165Q86 105 201 150T400 126V260H0Z" fill={foliage} />
          <path d="M0 207Q164 139 291 181T400 184V260H0Z" fill={ground} />
          {layout === 0 && (
            <>
              {road('M193 142Q299 199 167 260', 18)}
              {[25, 65, 115, 301, 355, 392].map((x, i) => tree(x, 270 - (i % 3) * 15, 150 - (i % 3) * 22, i))}
            </>
          )}
          {layout === 1 && (
            <>
              <path
                d="M0 149Q114 133 226 153T400 146M0 184Q114 163 226 184T400 177"
                stroke={c.paper}
                strokeWidth="10"
                opacity=".45"
                fill="none"
                className="rr-mist"
              />
              {[23, 65, 315, 370].map((x, i) => tree(x, 257, 45 + i * 9, i))}
              {road('M149 260Q221 221 290 214', 5)}
            </>
          )}
          {layout === 2 && (
            <>
              <ellipse cx="217" cy="207" rx="157" ry="43" fill={c.water} />
              {waterLines}
              {tree(23, 244, 100)}
              {tree(363, 232, 83)}
              {tree(312, 166, 38)}
              {road('M0 257Q68 228 155 257', 7)}
            </>
          )}
        </>
      )}
      {family === 'desert' && (
        <>
          <path d="M0 146Q220 125 400 154V260H0Z" fill={ground} />
          {layout === 0 && (
            <>
              <path d="M0 153 34 97H103L124 150m122 3 24-72h68l31 78" fill={c.accent} />
              <path d="M197 142 258 260H128Z" fill={c.dark} />
              <path d="m197 151-4 109" stroke={c.paper} strokeWidth="2" strokeDasharray="9 12" />
            </>
          )}
          {layout === 1 && (
            <>
              <path d="M0 27 66 44 89 106 136 158 91 260H0ZM400 32 329 56 306 119 272 153 319 260H400Z" fill={c.accent} />
              <path
                d="m0 76 71 19m-71 38 97 16m-97 45 110-9m290-94-66 19m66 49-104 14m104 50-91-17"
                stroke={c.dark}
                opacity=".5"
                strokeWidth="9"
              />
              {road('M204 143Q146 188 225 218T200 260', 7)}
            </>
          )}
          {layout === 2 && (
            <>
              <path d="M0 175 53 152 69 89H146L163 146 221 162 258 137 269 103H345L358 147 400 172V260H0Z" fill={c.dark} />
              <path d="M0 225Q181 168 400 212V260H0Z" fill={ground} />
              {road('M0 242Q225 198 400 227', 4)}
            </>
          )}
          <path d="m32 242 4-17 7 17m275 9 5-20 9 20m-8-10 15-3" stroke={foliage} strokeWidth="3" fill="none" />
        </>
      )}
      {family === 'town' && (
        <>
          <path d="M0 145Q180 112 400 150V260H0Z" fill={ground} />
          {layout === 0 && (
            <>
              <path d="M189 136 262 260H121Z" fill={c.paper} />
              {[0, 1, 2].map((i) => (
                <g key={i}>
                  {house(109 - i * 48, 161 + i * 38, 0.65 + i * 0.4)}
                  {house(238 + i * 47, 161 + i * 38, 0.65 + i * 0.4)}
                </g>
              ))}
              {house(174, 139, 0.65, true)}
            </>
          )}
          {layout === 1 && (
            <>
              {[0, 1, 2, 3, 4].map((i) => house(83 + i * 46, 148, 0.9, i === 2))}
              <path d="M0 174Q189 150 400 191V228Q173 190 0 229Z" fill={c.water} />
              {waterLines}
              {road('M0 246Q179 213 400 255', 6)}
            </>
          )}
          {layout === 2 && (
            <>
              <path d="M0 260Q141 94 286 155T400 196V260Z" fill={ground} />
              {house(177, 153, 1.35, true)}
              {house(282, 190, 0.65)}
              {road('M188 161Q82 196 185 226T201 260', 8)}
              {tree(62, 238, 69)}
            </>
          )}
        </>
      )}
      {family === 'prairie' && (
        <>
          <path d="M0 139Q196 117 400 146V260H0Z" fill={ground} />
          {layout === 0 && (
            <>
              <path d="M0 174 183 137 65 260H0Zm400-4-183-32 111 122h72Z" fill={snow ? c.paper : c.accent} />
              <path d="m183 146-48 114m-7-102L18 260m214-104 46 104m8-90 110 90" stroke={c.far} strokeWidth="4" />
              {road('M204 140 207 260', 6)}
            </>
          )}
          {layout === 1 && (
            <>
              {house(108, 184, 1.6)}
              {[225, 251, 277, 303, 329, 355].map((x, i) => tree(x, 175, 43 + (i % 2) * 15, i))}
              {road('M140 188Q259 215 226 260', 9)}
              <path d="M0 222h130m-130 14h162m-162 13h178" stroke={c.accent} strokeWidth="3" />
            </>
          )}
          {layout === 2 && (
            <>
              <path d="M0 177Q101 124 222 179T400 165V260H0Z" fill={snow ? c.paper : c.accent} />
              <path d="M0 222Q135 158 278 220T400 206V260H0Z" fill={ground} />
              <path d="M0 222Q189 179 400 243m-400-13Q189 187 400 251" fill="none" stroke={c.dark} strokeWidth="2" />
              {[25, 76, 130, 186, 244, 305, 369].map((x, i) => (
                <path key={x} d={`M${x} ${210 + (i - 2) ** 2 * 1.6}v22`} stroke={c.dark} strokeWidth="3" />
              ))}
            </>
          )}
        </>
      )}
      {/* Keep the landmark's central footprint open; vegetation frames the print. */}
      {!hasMotifs && !['forest', 'desert', 'prairie'].includes(family) && tree(389, 260, 39)}
      {look.time === 'golden' && <path d="m0 256 93-23 51 27m156 0 89-37 11 37" fill={c.dark} opacity=".22" />}
      {look.time === 'dusk' && <path d="M0 122H400V260H0Z" fill="#403758" opacity=".12" pointerEvents="none" />}
    </g>
  )
}
