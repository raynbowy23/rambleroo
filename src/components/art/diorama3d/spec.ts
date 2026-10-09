import coast from '../../../../content/dioramas/route-1-big-sur-coast-highway-2301.json'
import alpine from '../../../../content/dioramas/beartooth-highway-2281.json'
import forest from '../../../../content/dioramas/kancamagus-scenic-byway-2458.json'

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
] as const
export type Model = (typeof models)[number]
export interface DioramaSpec {
  bywayId: string
  title: string
  longitude: number
  ground: 'coastal-cliff' | 'alpine-plateau' | 'forested-ridges'
  palette: 'coast' | 'mountain' | 'forest'
  snowInWinter: boolean
  road: {
    shape: 'from-geometry'
    profile: 'cliff-shelf' | 'switchbacks' | 'valley-floor'
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

// Also used by the build tests: the authoring schema is checked against every scene in tests.
export { default as specSchema } from '../../../../content/dioramas/schema.json'
export const specs = [coast, alpine, forest] as DioramaSpec[]
