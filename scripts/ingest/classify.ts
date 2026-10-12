// Name-based theme inference for listings without editorial review. Output is marked themeSource: 'inferred' and should be replaced by curated tags over time.
import type { Theme, SceneFamily, Region, MapMark } from '../../src/lib/types.ts'

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
// States with a sea or Great Lakes shore. Names like "Kenton to Keys" (Keyes, Oklahoma) or "Silver Island" (Utah salt flats) are not coasts.
const SHORE_STATES = new Set('AK AL CA CT DE FL GA HI IL IN LA MA MD ME MI MN MS NC NH NJ NY OH OR PA RI SC TX VA WA WI'.split(' '))

export function inferThemes(name: string, designations: string[], states: string[], usfs: boolean): Theme[] {
  const themes = new Set<Theme>()
  for (const [theme, re] of RULES) if (re.test(name)) themes.add(theme)
  if (themes.has('coast') && !states.some((s) => SHORE_STATES.has(s))) themes.delete('coast')
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

const REGION_BY_STATE: Record<string, Region> = {
  WA: 'pacific-northwest',
  OR: 'pacific-northwest',
  CA: 'california',
  AZ: 'southwest',
  NM: 'southwest',
  NV: 'southwest',
  UT: 'southwest',
  CO: 'rockies',
  WY: 'rockies',
  MT: 'rockies',
  ID: 'rockies',
  ND: 'great-plains',
  SD: 'great-plains',
  NE: 'great-plains',
  KS: 'great-plains',
  OK: 'great-plains',
  TX: 'great-plains',
  MN: 'upper-midwest',
  WI: 'upper-midwest',
  IA: 'upper-midwest',
  MI: 'great-lakes',
  IL: 'great-lakes',
  IN: 'great-lakes',
  OH: 'great-lakes',
  MO: 'ozarks',
  AR: 'ozarks',
  LA: 'deep-south',
  MS: 'deep-south',
  AL: 'deep-south',
  GA: 'deep-south',
  SC: 'deep-south',
  FL: 'florida',
  NC: 'appalachia',
  VA: 'appalachia',
  WV: 'appalachia',
  TN: 'appalachia',
  KY: 'appalachia',
  PA: 'mid-atlantic',
  NY: 'mid-atlantic',
  NJ: 'mid-atlantic',
  MD: 'mid-atlantic',
  DE: 'mid-atlantic',
  DC: 'mid-atlantic',
  ME: 'new-england',
  NH: 'new-england',
  VT: 'new-england',
  MA: 'new-england',
  CT: 'new-england',
  RI: 'new-england',
  AK: 'alaska',
  HI: 'hawaii',
}

/** Coarse landscape region for a state; unknown codes fall back to the plains so illustration never fails. */
export function regionFor(state: string): Region {
  return REGION_BY_STATE[state] ?? 'great-plains'
}

/** The inked picture on the national map. A story's own landmarks decide it; without a story it shows the road's kind of country, never a specific landmark it may not have. */
export function pickMark(scene: SceneFamily, motifs: string[]): MapMark {
  if (motifs.includes('lighthouse')) return 'lighthouse'
  for (const m of motifs) {
    if (['snow-peaks', 'switchbacks', 'rolling-ridges', 'rhododendron-bald'].includes(m)) return 'mountain'
    if (['hoodoos', 'slickrock-ridge', 'limestone-ledges'].includes(m)) return 'mesa'
    if (['aspens'].includes(m)) return 'pine'
    if (['steeple-town', 'harbor-village', 'gristmill', 'mining-town'].includes(m)) return 'church'
    if (['orchard'].includes(m)) return 'windmill'
    if (['river-bluffs', 'lock-and-dam', 'paddlewheeler', 'sandbars', 'lake-wide', 'waterfall-cove', 'sea-rock'].includes(m))
      return scene === 'coast' ? 'sailboat' : 'wave'
  }
  return (
    { river: 'wave', coast: 'sailboat', mountain: 'mountain', forest: 'pine', desert: 'mesa', prairie: 'windmill', town: 'church' } as const
  )[scene]
}
