import type { BywayStory, Motif, StoryMoment } from '../../src/lib/types'
import type { Model } from '../../src/components/art/diorama3d/spec'

/** Editorial evidence only. Catalog names and themes never authorize a landmark. */
export const motifModels = {
  'river-bluffs': 'ledge',
  'lake-wide': 'alpine-lake',
  'lock-and-dam': 'dam',
  paddlewheeler: 'paddlewheeler',
  sandbars: 'sandbar',
  'steeple-town': 'steeple-town',
  'harbor-village': 'harbor',
  lighthouse: 'lighthouse-on-rock',
  'limestone-ledges': 'ledge',
  orchard: 'orchard',
  'rolling-ridges': 'ridge',
  gristmill: 'gristmill',
  viaduct: 'viaduct',
  'rhododendron-bald': 'bald',
  'snow-peaks': 'snow-peak',
  switchbacks: 'switchback',
  'mining-town': 'false-front-town',
  aspens: 'aspen',
  hoodoos: 'hoodoo',
  'slickrock-ridge': 'mesa',
  'arch-bridge': 'open-spandrel-arch-bridge',
  'sea-rock': 'sea-stack',
  'waterfall-cove': 'cove-waterfall',
} as const satisfies Record<Motif, Model>

export function momentModels(moment: StoryMoment): Model[] {
  const result: Model[] = (moment.motifs ?? []).map((m) => motifModels[m])
  if (/covered bridge/i.test(moment.title)) result.unshift('covered-bridge')
  if (/\b(house|homestead)\b/i.test(moment.title)) result.push('farmhouse')
  if (/\b(ski area|ski lift)\b/i.test(moment.title)) result.push('ski-lift')
  if (/\b(vista point|overlook|outlook)\b/i.test(moment.title)) result.push('overlook-pullout')
  if (moment.kind === 'town') result.push('town-blocks')
  return [...new Set(result)]
}
export function supportedModels(story?: BywayStory): Set<Model> {
  return new Set(story ? [...(story.motifs ?? []).map((m) => motifModels[m]), ...story.moments.flatMap(momentModels)] : [])
}
