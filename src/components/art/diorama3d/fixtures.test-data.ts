import coast from '../../../../public/data/dioramas/route-1-big-sur-coast-highway-2301.json'
import alpine from '../../../../public/data/dioramas/beartooth-highway-2281.json'
import forest from '../../../../public/data/dioramas/kancamagus-scenic-byway-2458.json'
import type { DioramaSpec } from './spec'
export { default as specSchema } from '../../../../content/dioramas/schema.json'
export const specs = [coast, alpine, forest] as DioramaSpec[]
