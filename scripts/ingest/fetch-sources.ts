// Retrieves raw source snapshots into data/raw/. Run with `npm run ingest:fetch`.
// Byways: USDOT-hosted Scenic_Byways_2022_06_24 ArcGIS layer (paged, since maxRecordCount is 2000).
// Basemap: Natural Earth 1:50m (public domain) countries, states/provinces, lakes, rivers.
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const RAW = new URL('../../data/raw/', import.meta.url)
const BYWAY_LAYER = 'https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/Scenic_Byways_2022_06_24/FeatureServer/0'
const NE_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
const NE_LAYERS = ['ne_50m_admin_0_countries', 'ne_50m_admin_1_states_provinces_lakes', 'ne_50m_lakes', 'ne_50m_rivers_lake_centerlines']
const PAGE = 500

async function fetchJson(url: string, attempts = 5): Promise<any> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (i >= attempts) throw err
      const wait = 1000 * 2 ** i
      console.warn(`  retry ${i} after ${wait} ms (${(err as Error).message})`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

async function fetchByways() {
  const count = (await fetchJson(`${BYWAY_LAYER}/query?where=1%3D1&returnCountOnly=true&f=json`)).count as number
  const meta = await fetchJson(`${BYWAY_LAYER}?f=json`)
  console.log(`byways: ${count} features advertised`)
  const features: any[] = []
  for (let offset = 0; offset < count; offset += PAGE) {
    const q = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      outSR: '4326',
      f: 'geojson',
      orderByFields: 'FID',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
    })
    const page = await fetchJson(`${BYWAY_LAYER}/query?${q}`)
    features.push(...page.features)
    console.log(`  ${features.length}/${count}`)
  }
  if (features.length !== count) throw new Error(`retrieved ${features.length} features but layer reports ${count}`)
  const fids = new Set(features.map((f) => f.properties.FID))
  if (fids.size !== count) throw new Error(`duplicate FIDs across pages: ${fids.size} unique of ${count}`)
  const body = JSON.stringify({ type: 'FeatureCollection', features })
  await writeFile(new URL('scenic_byways.geojson', RAW), body)
  return { name: 'scenic_byways', url: BYWAY_LAYER, featureCount: count, editingInfo: meta.editingInfo ?? null, sha256: sha(body) }
}

async function fetchNaturalEarth(layer: string) {
  const url = `${NE_BASE}${layer}.geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${layer}: HTTP ${res.status}`)
  const body = await res.text()
  await writeFile(new URL(`${layer}.geojson`, RAW), body)
  console.log(`${layer}: ${(body.length / 1e6).toFixed(1)} MB`)
  return { name: layer, url, sha256: sha(body) }
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

await mkdir(RAW, { recursive: true })
const sources = [await fetchByways(), ...(await Promise.all(NE_LAYERS.map(fetchNaturalEarth)))]
await writeFile(new URL('manifest.json', RAW), JSON.stringify({ retrievedAt: new Date().toISOString(), sources }, null, 2))
console.log('wrote data/raw/manifest.json')
