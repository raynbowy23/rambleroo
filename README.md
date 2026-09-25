# Rambleroo

A living atlas of America's scenic byways. Explore an illustrated national map, open a road's postcard and story, save it, record a visit, and collect a stamp in your passport.

This is the overnight MVP of the concept in `docs/plan/Byway_Atlas_Product_and_Development_Blueprint.md`. The build plan and its decisions are in `docs/plan/MVP_PLAN.md`. The mockups in `Mock/` are art direction only; none of their numbers are used.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest: domain logic, stores, components, data-quality gate
npm run test:e2e     # playwright: the full explore → story → save → visit → passport loop
npm run build        # typecheck + production build into dist/
```

Playwright needs Chromium once: `npx playwright install chromium`.

## What's in it

| Route | What it does |
|---|---|
| `/` | National atlas. Map, gallery, and list views share one selection and one filter state, all held in the URL (`byway`, `themes`, `state`, `q`, `view`). Hover previews, click selects and traces the route, and the postcard opens. Falls back to the list if WebGL is unavailable. |
| `/byway/:id` | Story page for curated roads (draft, pending review) and the same template for plain listings. Includes a companion map, signature moments marked roadside, short walk, or separate excursion, and directions to one point on the road. |
| `/state/WI` | The curated Wisconsin chapter: the five WisDOT program byways and the two USFS byways, listed separately. Other state codes get a generic, uncurated chapter. |
| `/collections`, `/collections/:slug` | Five small editorial collections with explicit member lists. |
| `/passport` | Saves, visits (repeatable, part or whole road), stamps, travel map, per-state progress, journal. Stored in this browser only. |
| `/about` | Coverage and provenance, stated plainly. |
| `/dev/art` | Review gallery for the procedural illustration kit. |

## Data

```bash
npm run ingest:fetch   # raw snapshots into data/raw/ (USDOT byway layer, Natural Earth), with manifest + sha256
npm run ingest:build   # normalise into public/data/ (catalog.json, byways.geojson, basemap/*)
```

- **Byway lines:** the USDOT-hosted `Scenic_Byways_2022_06_24` ArcGIS layer. 3,427 segments are dissolved by `BYWAY_ID` into 778 byways and simplified for display. Parts are never bridged.
- **Distances** are sums of the source `LENGTH` field (miles) over mapped segments. Divided carriageways can be counted twice, so the UI always says "mapped". Multi-state roads get per-state mileage by segment midpoint.
- **Themes** are inferred from names (`scripts/ingest/classify.ts`) except where `content/overrides.json` sets them by hand.
- **Basemap:** Natural Earth 1:50m (public domain), bundled. There is no tile provider, API key, or glyph server.
- **Editorial content** lives in `content/`: stories, collections, the Wisconsin chapter, overrides. `scripts/ingest/content.test.ts` fails the build if content references a byway that doesn't exist.

Known data gaps: Wisconsin Lake Superior Scenic Byway and Nicolet-Wolf River Scenic Byway are not in the 2022 layer, so they show as "route line pending". The Ohio River Scenic Byway's mileage can't be assigned to a state because its segment midpoints fall in the river.

## Imagery

There is no photography. Postcards, heroes, collection covers, and stamps are procedural SVG (`src/components/art/`), seeded per byway and credited as "Illustration" everywhere. Real, rights-cleared photos can slot in later through an asset field on the byway record.

## Layout

```text
content/            stories, collections, state chapters, curated overrides
data/raw/           source snapshots (gitignored except manifest.json)
public/data/        built display data served to the app
scripts/ingest/     fetch, normalise, classify, data-quality tests
src/components/art  illustration kit: Scene, Stamp, Seal, Compass, Logo, Icon
src/components/ui   Dialog, Toast, RouteMap, shared content blocks
src/features/       explore, map, byway, state, collections, passport, about
src/lib/            types, data hooks, filters, formatting, passport + motion stores
tests/e2e/          Playwright loop test
```
