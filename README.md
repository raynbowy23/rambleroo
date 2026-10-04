# Rambleroo

America's scenic byways, honestly mapped. Explore an illustrated national map, open a road's postcard and story, save it, record a visit, and collect a stamp in your passport.

Live at **https://rambleroo.app**. Rambleroo is a personal, noncommercial, open-source project: a React single-page app served by a Cloudflare Worker, with optional accounts (Google, email link or passkey) stored in Cloudflare D1.

Questions, ideas and road corrections: [open an issue](https://github.com/raynbowy23/rambleroo/issues/new/choose). Security problems: please report privately (see [SECURITY.md](SECURITY.md)).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest: domain logic, stores, components, data-quality gate
npm run test:e2e     # playwright: the full explore → story → save → visit → passport loop
npm run build        # typecheck + production build into dist/
```

Playwright needs its browsers once: `npx playwright install chromium webkit`. The e2e suite runs on three projects: desktop Chrome, Pixel 7, and iPhone 13 (WebKit), and checks every page on phones for sideways scrolling, tap targets under 40px, and text under 12px.

### On phones

Rambleroo is mobile-first below 760px: the explorer map fills the screen with a draggable bottom sheet (peek, half, full), gallery and list views get a compact top filter bar, dialogs become bottom sheets, and embedded maps use two-finger panning so they never trap page scrolling. It is an installable web app (vite-plugin-pwa): add it to the home screen, and the app shell, catalog, basemap, route lines, and any photos or pages you have opened keep working offline. New versions show a "Reload" prompt rather than updating under you. Service workers only run in production builds, so try this with `npm run build && npm run preview`.

## What's in it

| Route                                | What it does                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                  | National map. Map, gallery, and list views share one selection and one filter state, all held in the URL (`byway`, `themes`, `state`, `q`, `view`). Hover previews, click selects and traces the route, and the postcard opens. Falls back to the list if WebGL is unavailable. |
| `/byway/:id`                         | Story page for curated roads (draft, pending review) and the same template for plain listings. Includes a companion map, signature moments marked roadside, short walk, or separate excursion, and directions to one point on the road.                                         |
| `/state/WI`                          | The curated Wisconsin chapter: the five WisDOT program byways and the two USFS byways, listed separately. Other state codes get a generic, uncurated chapter.                                                                                                                   |
| `/collections`, `/collections/:slug` | Five small editorial collections with explicit member lists.                                                                                                                                                                                                                    |
| `/passport`                          | Saves, visits (repeatable, part or whole road), stamps, travel map, per-state progress, journal. Stored in this browser only.                                                                                                                                                   |
| `/about`                             | Coverage and provenance, stated plainly.                                                                                                                                                                                                                                        |
| `/dev/art`                           | Review gallery for the procedural illustration kit.                                                                                                                                                                                                                             |

## Data

```bash
npm run ingest:fetch   # raw snapshots into data/raw/ (USDOT byway layer, Natural Earth), with manifest + sha256
npx tsx scripts/ingest/build-supplements.ts  # WisDOT byways missing federally + classic drives (content/classics.json)
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
src/lib/            types, data hooks, filters, formatting, passport store and system motion preference
tests/e2e/          Playwright loop test
```

## Accounts and local development

Accounts use Google only, through Better Auth's built-in Kysely/D1 support. [Better Auth documents its D1 storage and core schema](https://better-auth.com/docs/concepts/database). There is no password sign-in or runtime migration. Apply the checked-in migrations before serving account requests. The four JSON documents each have a 256 KiB limit; their `updated_at` values are optimistic concurrency tokens. Garage/postcard `updatedAt` timestamps select the newer whole document when merging. Device clocks therefore affect those conflict choices.

Use Node 22.13+ (or Node 23 with the configured experimental SQLite flag) for the SQLite-backed Worker tests. Install dependencies with `npm install`. Create `.dev.vars` in the repository root (already gitignored; never commit real values):

```dotenv
AUTH_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your-development-google-client-id
GOOGLE_CLIENT_SECRET=your-development-google-client-secret
BETTER_AUTH_SECRET=use-a-random-secret-of-at-least-32-characters
```

Register `http://localhost:5173/api/auth/callback/google` as an authorized redirect URI in the development Google OAuth client. Use **localhost**, not a LAN hostname, for local sign-in: session cookies always have Secure set, and browsers special-case localhost. The production redirect is `https://rambleroo.app/api/auth/callback/google`. The public `AUTH_URL` must be the browser-facing origin, not port 8787.

```sh
npx wrangler d1 migrations apply rambleroo-db --local
npm run build
npx wrangler dev --port 8787
```

In another terminal run `npm run dev` and open `http://localhost:5173`. Vite proxies `/api` to Wrangler on port 8787, preserving the browser origin. If Vite selects a different port, update `AUTH_URL` and the Google redirect URI to match and restart Wrangler. Local D1 is separate from production. For production, apply migrations with `npx wrangler d1 migrations apply rambleroo-db --remote`, set `GOOGLE_CLIENT_SECRET` and `BETTER_AUTH_SECRET` using `wrangler secret put`, and deploy. Email links, Resend and Turnstile are not enabled in this phase.

On first sign-in per account/browser, existing browser data can be imported or left local. Signed-in edits debounce for 1.5 seconds. Pending writes and their base versions are saved per account in localStorage and retried after reconnecting, on the next sign-in, or with “Retry sync”. A 409 merges and retries once; a second conflict stays pending for an explicit retry. Signed-out browser data is backed up separately and restored on sign-out. Account export waits for pending changes to sync before downloading the server’s saved copy. Photos in IndexedDB never sync or appear in account exports.

Before launch, verify with real development Google credentials: the callback succeeds; the session cookie is Secure/HttpOnly/SameSite=Lax with a 60-day lifetime; first-import accept/decline works; a second browser loads all four kinds; simultaneous edits produce the documented merge; offline changes survive reload and sync on reconnect; sign-out restores browser-only data; export contains the expected saved records and no tokens/photos; typed deletion removes user/session/account/user_data rows and invalidates the other browser's session. Google is not called by automated tests.

## Licence

- **Code** (everything under `src/`, `scripts/`, `worker/`, `tests/`, including the code that draws the illustrations): [MIT](LICENSE).
- **Written content** (`content/stories/`, `content/collections.json`, the story and stretch text in `content/strips/`): [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Credit Rambleroo; noncommercial use.
- **Third-party data and media** keep their own terms:
  - USDOT Scenic Byways layer and Natural Earth: public domain.
  - OpenStreetMap data (map tiles, OSRM drive times and gap connectors, OSM place nodes, classic-drive alignments, OSM-derived parts of `public/data/strips/`): © OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/).
  - WisDOT Scenic Byways layer: WisDOT open data.
  - Photographs in `public/photos/`: each under the licence and credit recorded in `content/photos.json` (Wikimedia Commons).
  - 3D terrain: Mapzen Terrain Tiles on AWS Open Data (USGS, NOAA and others), loaded at runtime.

## Running your own copy

Nothing secret is in this repository. To deploy your own copy you need your own Cloudflare account (Worker, D1), a Google OAuth client, a Resend domain and a Turnstile widget; set `AUTH_URL`, `GOOGLE_CLIENT_ID` and the D1 `database_id` in `wrangler.jsonc`, the Turnstile site key in `src/features/account/SignInDialog.tsx`, the analytics ID (or remove it) in `src/lib/analytics.ts`, and the secrets with `wrangler secret put` (see "Accounts and local development" above).
