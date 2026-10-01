// Normalises the raw snapshots in data/raw/ into the display data the app loads from public/data/.
// Run with `npm run ingest:build` after `npm run ingest:fetch`. Deterministic for a given snapshot.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection, LineString, MultiLineString, Polygon, MultiPolygon, Position } from 'geojson'
import type { BywaySummary, Theme, SceneFamily, EditorialStatus } from '../../src/lib/types.ts'
import { inferThemes, pickScene, slugify, hashSeed, regionFor } from './classify.ts'
import { assignLooks } from './looks.ts'

const ROOT = new URL('../../', import.meta.url)
const RAW = new URL('data/raw/', ROOT)
const OUT = new URL('public/data/', ROOT)
const BASE_OUT = new URL('public/data/basemap/', ROOT)
const STORIES = new URL('content/stories/', ROOT)
const OVERRIDES = new URL('content/overrides.json', ROOT)

// Display simplification in degrees. ~0.001 deg ≈ 100 m, invisible at state zoom.
const LINE_TOLERANCE = 0.0008
const NORTH_AMERICA: [number, number, number, number] = [-180, 14, -50, 72]

const readJson = async <T>(url: URL): Promise<T> => JSON.parse(await readFile(url, 'utf8'))
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d
const roundCoords = (line: Position[]) => line.map(([x, y]) => [round(x), round(y)])

interface RawProps {
  FID: number
  BYWAY_ID: number
  NAME: string
  STATE: string
  LENGTH: number
  NSB_DESIG: string
  USFS_DESIG: string
  DESIGNATS: string
}

async function main() {
  await mkdir(BASE_OUT, { recursive: true })
  const manifest = await readJson<any>(new URL('manifest.json', RAW))
  const raw = await readJson<FeatureCollection<LineString | MultiLineString, RawProps>>(new URL('scenic_byways.geojson', RAW))
  // Supplements (scripts/ingest/build-supplements.ts): WisDOT byways missing federally, and classic drives. Same schema.
  for (const name of ['supplement-wisdot.geojson', 'supplement-classics.geojson']) {
    const extra = await readJson<FeatureCollection<LineString | MultiLineString, RawProps>>(new URL(name, RAW)).catch(() => undefined)
    if (extra) raw.features.push(...extra.features)
  }
  const statesFc = await readJson<FeatureCollection<Polygon | MultiPolygon, any>>(
    new URL('ne_50m_admin_1_states_provinces_lakes.geojson', RAW),
  )
  const usStates = new Map(statesFc.features.filter((f) => f.properties.iso_a2 === 'US').map((f) => [String(f.properties.postal), f]))

  const storyIds = new Map<string, EditorialStatus>()
  for (const file of await readdir(STORIES).catch(() => [] as string[])) {
    if (!file.endsWith('.json')) continue
    const story = await readJson<{ id: string; reviewed: boolean }>(new URL(file, STORIES))
    storyIds.set(story.id, story.reviewed ? 'curated-story' : 'draft-story')
  }

  const overrides = await readJson<Record<string, { themes: Theme[]; scene: SceneFamily }>>(OVERRIDES)

  const groups = new Map<number, Feature<LineString | MultiLineString, RawProps>[]>()
  for (const f of raw.features) {
    const list = groups.get(f.properties.BYWAY_ID) ?? []
    list.push(f)
    groups.set(f.properties.BYWAY_ID, list)
  }

  const catalog: BywaySummary[] = []
  const lineFeatures: Feature<MultiLineString>[] = []
  const warnings: string[] = []

  for (const [sourceId, feats] of groups) {
    const p0 = feats[0].properties
    const name = p0.NAME.trim()
    const id = `${slugify(name)}-${sourceId}`
    const states = p0.STATE.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const designations = [
      ...new Set(
        feats.flatMap((f) =>
          f.properties.DESIGNATS.split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ),
    ]

    // Keep every source part as its own line; never bridge gaps between parts.
    const parts: Position[][] = feats.flatMap((f) => (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates))
    const simplified = parts
      .map((line) =>
        line.length > 2
          ? turf.simplify(turf.lineString(line), { tolerance: LINE_TOLERANCE, highQuality: false }).geometry.coordinates
          : line,
      )
      .map(roundCoords)
      .filter((line) => line.length >= 2 && !(line.length === 2 && line[0][0] === line[1][0] && line[0][1] === line[1][1]))
    if (!simplified.length) {
      warnings.push(`${id}: no drawable geometry after simplification`)
      continue
    }
    const geom: MultiLineString = { type: 'MultiLineString', coordinates: simplified }
    const bbox = turf.bbox(geom).map((n) => round(n)) as [number, number, number, number]
    const mappedMiles = round(
      feats.reduce((s, f) => s + (f.properties.LENGTH || 0), 0),
      1,
    )

    let stateMiles: Record<string, number> | undefined
    if (states.length > 1) {
      stateMiles = {}
      for (const f of feats) {
        const mid = midpointOf(f.geometry)
        const st = states.find((s) => usStates.get(s) && turf.booleanPointInPolygon(mid, usStates.get(s)!))
        const key = st ?? 'unassigned'
        stateMiles[key] = round((stateMiles[key] ?? 0) + (f.properties.LENGTH || 0), 1)
      }
      if (stateMiles.unassigned) warnings.push(`${id}: ${stateMiles.unassigned} mi not assigned to a listed state`)
    }

    const usfs = feats.some((f) => f.properties.USFS_DESIG === 'T')
    const override = overrides[id]
    const themes = override?.themes ?? inferThemes(name, designations, states, usfs)
    const scene = override?.scene ?? pickScene(themes, name)
    // Region comes from the state that contains the label point, so multi-state roads get the landscape of their middle.
    const center = labelPoint(simplified)
    const centerState = states.find((s) => usStates.get(s) && turf.booleanPointInPolygon(turf.point(center), usStates.get(s)!)) ?? states[0]
    const summary: BywaySummary = {
      id,
      sourceId,
      name,
      states,
      designations,
      nationalScenicByway: feats.some((f) => f.properties.NSB_DESIG === 'T'),
      allAmericanRoad: designations.some((d) => /all-american road/i.test(d)),
      mappedMiles,
      ...(stateMiles ? { stateMiles } : {}),
      bbox,
      center,
      themes,
      themeSource: override ? 'curated' : 'inferred',
      scene,
      status: storyIds.get(id) ?? 'listing',
      region: regionFor(centerState),
      look: undefined as unknown as BywaySummary['look'],
      seed: hashSeed(id),
    }
    catalog.push(summary)
    lineFeatures.push({
      type: 'Feature',
      id: catalog.length - 1,
      properties: { id, name, scene, nsb: summary.nationalScenicByway, story: summary.status !== 'listing', themes: themes.join(' ') },
      geometry: geom,
    })
  }

  for (const oid of Object.keys(overrides))
    if (!oid.startsWith('_') && !catalog.some((b) => b.id === oid)) warnings.push(`override ${oid} has no matching catalog byway`)
  for (const sid of storyIds.keys()) if (!catalog.some((b) => b.id === sid)) warnings.push(`story ${sid} has no matching catalog byway`)

  // Looks are assigned over the whole catalog at once so they can be kept unique.
  const previous = await readJson<{ byways: { id: string; look?: BywaySummary['look'] }[] }>(new URL('catalog.json', OUT)).catch(() => ({
    byways: [],
  }))
  const looks = assignLooks(catalog, new Map(previous.byways.filter((b) => b.look).map((b) => [b.id, b.look!])))
  for (const b of catalog) b.look = looks.get(b.id)!

  catalog.sort((a, b) => a.name.localeCompare(b.name))
  const snapshot = manifest.sources.find((s: any) => s.name === 'scenic_byways')
  const meta = {
    builtAt: new Date().toISOString(),
    retrievedAt: manifest.retrievedAt,
    source: { name: 'USDOT Scenic_Byways_2022_06_24', url: snapshot.url, sha256: snapshot.sha256, featureCount: snapshot.featureCount },
    bywayCount: catalog.length,
    storyCount: catalog.filter((b) => b.status !== 'listing').length,
  }
  await writeFile(new URL('catalog.json', OUT), JSON.stringify({ meta, byways: catalog }))
  await writeFile(new URL('byways.geojson', OUT), JSON.stringify({ type: 'FeatureCollection', features: lineFeatures }))
  await buildBasemap()

  console.log(`catalog: ${catalog.length} byways, ${meta.storyCount} with stories`)
  const themeCounts: Record<string, number> = {}
  for (const b of catalog) for (const t of b.themes) themeCounts[t] = (themeCounts[t] ?? 0) + 1
  console.log('themes:', themeCounts)
  if (warnings.length) console.warn(`warnings (${warnings.length}):\n  ${warnings.join('\n  ')}`)
}

function midpointOf(g: LineString | MultiLineString) {
  const line = g.type === 'LineString' ? g.coordinates : g.coordinates.reduce((a, b) => (b.length > a.length ? b : a))
  return turf.point(line[Math.floor(line.length / 2)])
}

/** A vertex near the middle of the longest part, so labels and markers sit on the road itself. */
function labelPoint(parts: Position[][]): [number, number] {
  let best = parts[0]
  let bestLen = 0
  for (const part of parts) {
    const len = turf.length(turf.lineString(part))
    if (len > bestLen) [best, bestLen] = [part, len]
  }
  const mid = turf.along(turf.lineString(best), bestLen / 2).geometry.coordinates
  return [round(mid[0]), round(mid[1])]
}

async function buildBasemap() {
  const clip = (
    fc: FeatureCollection,
    keep: (f: Feature) => boolean,
    tolerance: number,
    props: (f: Feature) => Record<string, unknown>,
  ) => ({
    type: 'FeatureCollection',
    features: fc.features.filter(keep).flatMap((f) => {
      const [w, s, e, n] = turf.bbox(f)
      if (e < NORTH_AMERICA[0] || w > NORTH_AMERICA[2] || n < NORTH_AMERICA[1] || s > NORTH_AMERICA[3]) return []
      const simple = turf.simplify(f as any, { tolerance, highQuality: false })
      turf.coordEach(simple, (c) => {
        c[0] = round(c[0], 3)
        c[1] = round(c[1], 3)
      })
      return [{ type: 'Feature', properties: props(f), geometry: simple.geometry }]
    }),
  })

  const countries = await readJson<FeatureCollection>(new URL('ne_50m_admin_0_countries.geojson', RAW))
  const states = await readJson<FeatureCollection>(new URL('ne_50m_admin_1_states_provinces_lakes.geojson', RAW))
  const lakes = await readJson<FeatureCollection>(new URL('ne_50m_lakes.geojson', RAW))
  const rivers = await readJson<FeatureCollection>(new URL('ne_50m_rivers_lake_centerlines.geojson', RAW))

  const na = new Set(['US', 'CA', 'MX', 'GT', 'BZ', 'CU', 'BS', 'HN', 'SV', 'NI', 'RU', 'GL'])
  const out = {
    land: clip(
      countries,
      (f) => na.has(String(f.properties?.ISO_A2)) || String(f.properties?.ADM0_A3) === 'USA',
      0.01,
      (f) => ({ iso: f.properties?.ISO_A2, name: f.properties?.NAME, us: f.properties?.ISO_A2 === 'US' }),
    ),
    states: clip(
      states,
      (f) => f.properties?.iso_a2 === 'US',
      0.005,
      (f) => ({ postal: f.properties?.postal, name: f.properties?.name }),
    ),
    lakes: clip(
      lakes,
      () => true,
      0.005,
      (f) => ({ name: f.properties?.name, rank: f.properties?.scalerank }),
    ),
    rivers: clip(
      rivers,
      (f) => (f.properties?.scalerank ?? 9) <= 6,
      0.005,
      (f) => ({ name: f.properties?.name, rank: f.properties?.scalerank }),
    ),
  }
  for (const [name, fc] of Object.entries(out)) await writeFile(new URL(`${name}.geojson`, BASE_OUT), JSON.stringify(fc))
  // State label points, used for the national overview and chapter pages.
  const labels = out.states.features.map((f: any) => ({
    type: 'Feature',
    properties: f.properties,
    geometry: turf.centerOfMass(f).geometry,
  }))
  await writeFile(new URL('state-labels.geojson', BASE_OUT), JSON.stringify({ type: 'FeatureCollection', features: labels }))
}

await main()
