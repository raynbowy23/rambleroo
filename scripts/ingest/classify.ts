// Name-based theme inference for listings without editorial review. Output is marked themeSource: 'inferred' and should be replaced by curated tags over time.
import type { Theme, SceneFamily } from '../../src/lib/types.ts'

const RULES: [Theme, RegExp][] = [
  [
    'coast',
    /\b(coast(al)?|ocean|beach|seashore|pacific|atlantic|gulf|cape|bay ?shore|seaway|shoreline|lakeshore|island|keys|harbor|sound)\b/i,
  ],
  ['water', /\b(river|rivers|lake|lakes|creek|falls|canal|water|springs?|bayou|delta|reservoir|bay|shore|valley of the rivers)\b/i],
  [
    'mountain',
    /\b(mountain|mountains|mtn|peak|pass|summit|ridge|highlands?|skyway|alpine|glacier|volcan\w*|divide|rim|range|hills|cascades?|sierra|rockies|notch|gap|top of the)\b/i,
  ],
  [
    'desert',
    /\b(desert|mesa|canyon|canyons|red rock|painted|dunes|sand|badlands|arroyo|butte|high road|turquoise|trail of the ancients|valley of fire)\b/i,
  ],
  ['forest', /\b(forest|woods|woodland|pines?|timber|redwoods?|cedar|oak|maple|aspen|birch|tree|trees|grove)\b/i],
  [
    'historic',
    /\b(historic|heritage|history|trail|pioneer|route 66|old|pike|turnpike|mission|battle\w*|civil war|colonial|lincoln|railroad|freedom|underground|national road|frontier|legacy|highway 1|byway of the|brandywine|amish|antique)\b/i,
  ],
  [
    'countryside',
    /\b(prairie|farm|farmland|country|plains|barn|orchard|vineyard|wine|valley|rural|pastoral|ranch|grassland|scenic route)\b/i,
  ],
]

const DESERT_STATES = new Set(['AZ', 'NM', 'NV', 'UT'])
const MOUNTAIN_STATES = new Set(['CO', 'MT', 'WY', 'ID'])

export function inferThemes(name: string, designations: string[], states: string[], usfs: boolean): Theme[] {
  const themes = new Set<Theme>()
  for (const [theme, re] of RULES) if (re.test(name)) themes.add(theme)
  if (usfs) themes.add('forest')
  if (designations.some((d) => /historic/i.test(d))) themes.add('historic')
  if (!themes.has('water') && !themes.has('coast') && !themes.has('forest') && states.every((s) => DESERT_STATES.has(s)))
    themes.add('desert')
  if (!themes.size && states.every((s) => MOUNTAIN_STATES.has(s))) themes.add('mountain')
  if (!themes.size) themes.add('countryside')
  return [...themes]
}

/** Priority order decides which illustration family represents the road. */
export function pickScene(themes: Theme[], name: string): SceneFamily {
  const has = (t: Theme) => themes.includes(t)
  if (has('coast')) return 'coast'
  if (has('desert')) return 'desert'
  if (has('mountain')) return 'mountain'
  if (has('water')) return 'river'
  if (has('forest')) return 'forest'
  if (has('historic') || /\b(town|village|main street)\b/i.test(name)) return 'town'
  return 'prairie'
}

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** FNV-1a, stable across runs and platforms. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
