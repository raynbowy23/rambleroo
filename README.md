# Rambleroo

Drive into the heart of the American story. Rambleroo is a guide to nearly 800 scenic roads in the United States. Find a road on the national map, read its postcard, then scroll down the road mile by mile on a strip map. Save it, add it to a trip, record a visit and collect a stamp in your passport.

Open it at **https://rambleroo.app**. No account is needed. Rambleroo is a personal, noncommercial, open-source project, and [contributions are welcome](#contributing).

![The national map with scenic byways](docs/screenshots/explore-map.jpg)                 

<!--
|                                                                                                                                                  |                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| ![The national map, every scenic byway drawn in faded screen-print inks](docs/screenshots/explore-map.jpg)                                       | ![Door County Coastal Byway selected on the map, with its photo postcard and route inset](docs/screenshots/road-selected.jpg) |
| **Explore.** Every road on one pictorial map, filtered by theme or state.                                                                        | **Pick a road.** It traces itself on the map and its postcard opens, photo credit included.                                   |
| ![Road page for Door County Coastal Byway with a photo hero, mapped distance, designation and a Drive it button](docs/screenshots/road-page.jpg) | ![Strip map header with the road shown in spring, summer, autumn and winter](docs/screenshots/strip-header.jpg)               |
| **Road page.** The facts, where they come from, and a Drive it button.                                                                           | **Strip map.** The same road in four seasons, then the drive.                                                                 |
| ![Scrolling the strip map: the car on the ribbon at mile 18.8, a park card at mile 15.9 and the inset map](docs/screenshots/strip-drive.jpg)     | ![3D view following the car along a snowy Lake Michigan shore](docs/screenshots/strip-3d.jpg)                                 |
| **Scroll to drive.** Towns and stops appear at their mile.                                                                                       | **3D view.** The camera follows your car over raised relief.                                                                  |


<p align="center"><img src="docs/screenshots/phone-strip.jpg" alt="The strip map on a phone, driving the Big Sur coast at mile 8.6" width="300"></p>
-->

## What's on the map

Rambleroo catalogs **792 scenic drives across the United States**, combining federal layers, state DOT registries, and iconic routes:

* **778 National & State Scenic Byways** from the USDOT National Scenic Byways layer (June 2022).
* **6 State Additions** sourced directly from Wisconsin DOT and Florida DOT route GIS layers to patch federal gaps.
* **8 Unofficial Classics** (e.g., *Going-to-the-Sun Road*, *Road to Hana*) labeled explicitly as un-designated classic routes.

### Features

* **Linear Strip Maps (721 routes):** Each corridor unrolls into a continuous linear ribbon as you scroll. Towns, natural landmarks, and scenic overlooks are pinned to their true relative milepost. Drive times are dynamically routed via OpenStreetMap, while data discontinuities render as dashed connector lines.
* **Four-Season Visuals & Custom Postcards:** Every route features a procedural postcard and seasonal strip illustrations. For 113 roads, 159 human-verified, freely licensed photographs provide authentic field references.
* **Granular Designations:** Instantly differentiate between *All-American Roads*, *National Scenic Byways*, *State Scenic Byways*, and *National Forest Byways*, with direct links to respective state agency programs.

### Cartographic & Data Integrity

Rambleroo prioritizes ground truth and transparency over smoothed assumptions:

* **Mapped Miles vs. Driving Distance:** Mileage is calculated directly along mapped geometry rather than odometer estimates. Divided segments are summed as drawn.
* **Explicit Discontinuities:** Gaps in source GIS layers remain visible as breaks—no synthetic route interpolation without indication.
* **Clear Provenance:** Generated artwork, verified photographs, and work-in-progress routes carry clear state labels (`Illustration · no photo yet`, `Draft · pending review`).
* **Open Source & Agency Attribution:** Sourced with attribution from USDOT, WisDOT, FDOT, Natural Earth, OpenStreetMap, Wikipedia, and Wikimedia Commons. See [docs/licensing.md](docs/licensing.md) for full attribution schemas.

## What you can do

| Route                                | What it does                                                                                                                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                  | The national map. Map, gallery and list views share one selection and one set of filters (theme, state, search), all kept in the URL so a view can be linked. Hover to preview, click to trace the route and open the postcard. Without WebGL it falls back to the list. |
| `/byway/:id`                         | A road's page: mapped distance, states, designation and a companion map. Roads with a story add signature moments marked roadside, short walk or separate excursion, and directions to a point on the road.                                                              |
| `/byway/:id/strip`                   | The strip map. A ribbon of the road you scroll down mile by mile, with towns and stops at their mile, four seasons of illustration, a 3D terrain view, a car you can repaint, and postcards from places along the way.                                                   |
| `/byway/:id/strip/print`             | The strip map laid out for paper, with its sources and photo credits.                                                                                                                                                                                                    |
| `/trip`                              | Roads you have added, in the order you want to drive them, with mapped miles and drive times for the main stretches.                                                                                                                                                     |
| `/state/:code`                       | State chapters. Wisconsin and Florida are curated from their state byway programs, with forest service byways listed separately. Other states get a plain list until their chapter is written.                                                                           |
| `/collections`, `/collections/:slug` | Six small editorial collections, such as Follow the Water and Desert Light.                                                                                                                                                                                              |
| `/passport`                          | Saved roads, visits (repeatable, part or whole road), stamps, a travel map, progress by state, a journal and your postcards.                                                                                                                                             |
| `/s/:slug`                           | A read-only snapshot of a trip or passport that a signed-in person chose to share.                                                                                                                                                                                       |
| `/about`                             | Where the data comes from and what it can and cannot tell you.                                                                                                                                                                                                           |
| `/privacy`, `/terms`                 | Privacy policy and terms.                                                                                                                                                                                                                                                |
| `/dev/art`                           | Review gallery for the procedural illustration kit.                                                                                                                                                                                                                      |



## Run it locally

You need Node 22.13 or later.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest: domain logic, stores, components, the Worker, and the data-quality checks
npm run test:e2e     # playwright: explore, story, save, visit, passport, strip maps, trips and sharing
npm run build        # typecheck and production build into dist/
```

Playwright needs its browsers once: `npx playwright install chromium webkit`. The e2e suite runs as desktop Chrome, a Pixel 7 and an iPhone 13 (WebKit), and on phones it fails any page that scrolls sideways, has a tap target under 40px or text under 12px.

The offline app only runs in a production build, so try it with `npm run build && npm run preview`. To open the dev server from a phone on the same network, use `npm run dev:phone`.


### Tech Stack

* **Frontend:** React 19, React Router, Vite, Zustand
* **Cartography & Rendering:** MapLibre GL, three.js
* **Backend & Edge:** Cloudflare Workers, Cloudflare D1 (SQL), Cloudflare R2 (Object Storage)
* **Auth:** Better Auth


## Data

The display data in `public/data/` is built from source snapshots by scripts you can rerun.

```bash
npm run ingest:fetch                          # snapshots into data/raw/ (USDOT byway layer, Natural Earth), with a manifest and sha256
npx tsx scripts/ingest/build-supplements.ts  # roads missing from the national layer (content/state-sources.json) and classic drives (content/classics.json)
npm run ingest:build                          # normalise into public/data/ (catalog.json, byways.geojson, basemap/)
npm run strips:build -- <bywayId>             # build one road's strip map
```

- **Byway lines:** the USDOT-hosted `Scenic_Byways_2022_06_24` ArcGIS layer. Its 3,427 segments are dissolved by `BYWAY_ID` into 778 byways and simplified for display. Parts are never bridged.
- **Distances** sum the source `LENGTH` field (miles) over mapped segments. Multi-state roads get per-state mileage by segment midpoint.
- **Roads beyond the national layer** come from state GIS layers listed in `content/state-sources.json` (Wisconsin and Florida so far). Classic drives are routed through Wikipedia and Wikidata waypoints with OSRM on OpenStreetMap data, and the build fails if a route doesn't use the road the drive is named for.
- **Strip maps** (`scripts/strips/`) order towns and stops by their true mile along the road and route drive times with OSRM once, at build time.
- **Themes** are inferred from road names (`scripts/ingest/classify.ts`) unless `content/overrides.json` sets them by hand.
- **Basemap:** Natural Earth 1:50m (public domain) is bundled for the national view. Closer in, detail comes from OpenFreeMap vector tiles. Neither needs an API key.
- **Photos** are proposed by `scripts/photos/discover.ts` from Wikipedia lead images and the U.S. DOT America's Byways collection on Commons, or picked by hand from a wider Commons search for a state chapter. Every one is reviewed by a person and published with `scripts/photos/fetch.ts` into `public/photos/` and `content/photos.json`.
- **Editorial content** lives in `content/`: stories, strip text, collections, state chapters and overrides. `scripts/ingest/content.test.ts` fails the tests if content points at a road that doesn't exist.

Known gaps: the Ohio River Scenic Byway's mileage can't all be assigned to a state, because many of its segment midpoints fall in the river. State chapter links are checked by hand with `npx tsx scripts/states/check-links.ts`, which reports failed URLs and redirects to another host.

## Layout

```text
content/            stories, strip text, collections, state chapters, photo credits, overrides
data/raw/           source snapshots (gitignored except manifest.json)
public/data/        built display data served to the app
public/photos/      published, credited photographs
scripts/ingest/     fetch, normalise, classify, data-quality tests
scripts/strips/     strip map discovery, building and repair
scripts/photos/     photo discovery and publishing
scripts/states/     state sources and the chapter link checker
src/components/art  illustration kit: Scene, Stamp, Seal, Compass, Logo, Vehicle
src/components/ui   Dialog, Toast, RouteMap, shared content blocks
src/features/       one folder per area: explore, map, byway, strip, trip, state, collections, passport, postcard, garage, share, account, about, legal
src/lib/            types, data hooks, filters, formatting, stores, account and photo sync
worker/             the Cloudflare Worker: auth, account data, photos, shares
migrations/         D1 schema
tests/e2e/          Playwright suites
```

## Accounts and local development

Accounts are optional and use Better Auth's built-in Kysely support for D1 ([Better Auth's database docs](https://better-auth.com/docs/concepts/database)). People sign in with Google, a single-use email link (sent through Resend and guarded by Turnstile), or a passkey. There are no passwords. Migrations are checked in and never run on a request, so apply them before serving account requests.

An account stores four JSON documents (passport, trip, garage, postcards), each limited to 256 KiB. Their `updated_at` values act as optimistic concurrency tokens. The garage and postcards merge by picking the newer whole document by its `updatedAt`, so device clocks can decide those conflicts. Photos you add yourself sync to a private R2 bucket within the ceilings in `src/lib/photo-limits.ts`; [docs/photo-sync.md](docs/photo-sync.md) covers operating that safely.

To run the Worker and sign-in locally, use Node 22.13 or later (Node 23 works with the `--experimental-sqlite` flag that `vitest.config.ts` already sets for the Worker tests), run `npm install`, and create `.dev.vars` in the repository root. It is gitignored. Never commit real values.

```dotenv
AUTH_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your-development-google-client-id
GOOGLE_CLIENT_SECRET=your-development-google-client-secret
BETTER_AUTH_SECRET=use-a-random-secret-of-at-least-32-characters
```

Email-link sign-in also reads `RESEND_API_KEY` and `TURNSTILE_SECRET`. Register `http://localhost:5173/api/auth/callback/google` as an authorized redirect URI on your development Google OAuth client. Use **localhost**, not a LAN hostname, because session cookies are always Secure and browsers make an exception only for localhost. `AUTH_URL` must be the origin the browser sees, not port 8787.

```sh
npx wrangler d1 migrations apply rambleroo-db --local
npm run build
npx wrangler dev --port 8787
```

In another terminal run `npm run dev` and open `http://localhost:5173`. Vite proxies `/api` to Wrangler on port 8787 and keeps the browser origin. If Vite picks a different port, update `AUTH_URL` and the Google redirect URI to match and restart Wrangler. Local D1 is separate from production.

How sync behaves: on the first sign-in in a browser, existing browser data can be imported or left local. Signed-in edits are saved after 1.5 seconds. Pending writes and their base versions are kept per account in localStorage and retried after reconnecting, on the next sign-in, or with "Retry sync". A 409 merges and retries once, and a second conflict waits for an explicit retry. Signed-out browser data is backed up separately and restored on sign-out. Account export waits for pending changes, then downloads the server's copy, which lists photos and shares.

Automated tests never call Google. When you change account code, check by hand with real development credentials:

- the Google callback succeeds, and the session cookie is Secure, HttpOnly and SameSite=Lax with a 60-day lifetime
- the first-sign-in import can be accepted or declined
- a second browser loads all four documents, and simultaneous edits merge as described above
- offline changes survive a reload and sync on reconnect
- sign-out restores browser-only data
- export contains the expected records and no tokens
- typed deletion removes the user, session, account and user_data rows and signs the other browser out

## Running your own copy

To deploy your own copy you need your own Cloudflare account (a Worker, a D1 database and an R2 bucket), a Google OAuth client, a Resend sending domain and a Turnstile widget. Then:

- in `wrangler.jsonc`, set `AUTH_URL`, `GOOGLE_CLIENT_ID`, the routes, the D1 `database_id` and the R2 bucket name
- set the Turnstile site key in `src/features/account/SignInDialog.tsx` and the sign-in email sender in `worker/auth.ts`
- set the analytics ID in `src/lib/analytics.ts`, or remove it
- set `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY` and `TURNSTILE_SECRET` with `wrangler secret put`
- apply migrations with `npx wrangler d1 migrations apply rambleroo-db --remote`, then `npm run deploy`

## Contributing

The most useful help is often a correction: a road drawn wrong, a place in the wrong spot, a photo credit. [Open an issue](https://github.com/raynbowy23/rambleroo/issues/new/choose) for those, for bugs, and for ideas. Pull requests for fixes are welcome; [CONTRIBUTING.md](CONTRIBUTING.md) lists the checks CI runs.

The next big piece of work is [state chapters](docs/state-coverage.md): every state's byway program, linked to the agency that designates its roads and mapped as fully as Wisconsin and Florida are. The plan has a status table for all 50 states, and each one is a self-contained project for a contributor. Pick a state with the [State chapter](https://github.com/raynbowy23/rambleroo/issues/new?template=state-chapter.yml) issue template.

Please report security problems privately, as described in [SECURITY.md](SECURITY.md).

## Licence

Code is [MIT](LICENSE). Written content is CC BY-NC 4.0, and third-party data and media keep their own terms; [docs/licensing.md](docs/licensing.md) sets out which is which.
