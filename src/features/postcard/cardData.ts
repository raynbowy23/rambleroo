import type { BywaySummary, Motif, Photo, SceneFamily } from '../../lib/types'
import { loadStrip } from '../strip/data'
import type { Coordinate, StripData } from '../strip/types'
import { coordinateAtMile, mappedIntervals } from '../strip/geometry'
import { loadBywayGeometry } from '../map/layers'
export interface Milestone {
  id: string
  kind?: 'town' | 'moment'
  name: string
  mile: number
  on: 'main' | 'branch'
  scene: SceneFamily
  motifs?: Motif[]
  photo?: Photo
}
export const milestoneId = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
export function milestones(data: StripData): Milestone[] {
  return [
    ...data.towns.map((town) => ({
      id: milestoneId(town.name),
      kind: 'town' as const,
      name: town.name,
      mile: town.mile,
      on: town.on,
      scene: 'town' as const,
      motifs: ['steeple-town'] as Motif[],
    })),
    ...data.moments.map((moment) => ({
      // Towns and story moments can share a name (Ephraim is both).
      id: `${milestoneId(moment.title)}${data.towns.some((town) => milestoneId(town.name) === milestoneId(moment.title)) ? '-moment' : ''}`,
      kind: 'moment' as const,
      name: moment.title,
      mile: moment.mile,
      on: moment.on,
      scene: moment.scene,
      motifs: moment.motifs,
      photo: moment.photo,
    })),
  ]
}
export interface CardRoute {
  lines: Coordinate[][]
  position?: Coordinate
}
export async function loadCardRoute(id: string, milestone?: Milestone): Promise<CardRoute> {
  const strip = await loadStrip(id).catch(() => undefined)
  if (strip) {
    const route = milestone?.on === 'branch' && strip.branch ? strip.branch : strip.main
    return {
      lines: [strip.main, ...(strip.branch ? [strip.branch] : [])].flatMap((part) =>
        mappedIntervals(part).map(([from, to]) => [
          coordinateAtMile(part, from),
          ...part.path.filter((_, i) => part.cumMiles[i] > from && part.cumMiles[i] < to),
          coordinateAtMile(part, to),
        ]),
      ),
      position: coordinateAtMile(route, milestone?.mile ?? 0),
    }
  }
  const data = await loadBywayGeometry()
  return { lines: (data.features.find((feature) => feature.properties.id === id)?.geometry.coordinates ?? []) as Coordinate[][] }
}
export function routeInset(route: CardRoute) {
  const points = route.lines.flat()
  if (!points.length) return undefined
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1])
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys)
  const correction = Math.cos(((minY + maxY) * Math.PI) / 360)
  const scale = Math.min(100 / ((maxX - minX) * correction || 1e-6), 75 / (maxY - minY || 1e-6))
  const project = ([x, y]: Coordinate) => [
    280 + (100 - (maxX - minX) * correction * scale) / 2 + (x - minX) * correction * scale,
    173 + (75 - (maxY - minY) * scale) / 2 + (maxY - y) * scale,
  ]
  return {
    path: route.lines.map((line) => line.map((p, i) => `${i ? 'L' : 'M'}${project(p).join(',')}`).join(' ')).join(' '),
    start: project(points[0]),
    end: project(points.at(-1)!),
    position: project(route.position ?? points[0]),
  }
}
export const cardTitle = (byway: BywaySummary, milestone?: Milestone) => milestone?.name ?? byway.name
export const milestoneMessage = (byway: BywaySummary, milestone: Milestone) =>
  `${milestone.name} · Mile ${milestone.mile.toFixed(1)} · ${byway.name}`
