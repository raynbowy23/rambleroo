import type { SceneFamily } from '../../../lib/types'
export const models = [
  'open-spandrel-arch-bridge',
  'covered-bridge',
  'lighthouse-on-rock',
  'cove-waterfall',
  'farmhouse',
  'ski-lift',
  'overlook-pullout',
  'false-front-town',
  'conifer',
  'hardwood',
  'cypress',
  'sea-stack',
  'snowfield',
  'alpine-lake',
  'river',
  'surf',
  'fog-bank',
  'gristmill',
  'viaduct',
  'dam',
  'paddlewheeler',
  'sandbar',
  'steeple-town',
  'harbor',
  'ledge',
  'orchard',
  'ridge',
  'bald',
  'snow-peak',
  'switchback',
  'aspen',
  'hoodoo',
  'mesa',
  'field',
  'town-blocks',
] as const
export type Model = (typeof models)[number]
export interface DioramaSpec {
  authored: boolean
  bywayId: string
  title: string
  longitude: number
  ground:
    'coastal-cliff' | 'alpine-plateau' | 'forested-ridges' | 'low-shore' | 'river-valley' | 'desert-mesas' | 'prairie-grid' | 'main-street'
  palette: SceneFamily
  snowInWinter: boolean
  road: {
    shape: 'from-geometry'
    profile: 'cliff-shelf' | 'switchbacks' | 'valley-floor' | 'rolling' | 'level'
    lanes: 2
    coordinates: number[][]
    elevation: number[][]
  }
  landmarks: { name: string; model: Model; at: number; offset: 'on-road' | 'roadside' | 'seaward'; notes: string }[]
  dressing: { model: Model; at: number; side: number; distance: number; scale: number }[]
  towns: { name: string; at: number; landmark: string }[]
  sources: string[]
  geometryNotes: string
}
