# Brief: a miniature for every road, and a visual pass

The 3D road miniatures in `src/components/art/diorama3d/` work for three hand-written roads (Big Sur, Beartooth, Kancamagus) and appear on their story pages through `src/features/byway/RoadMiniature.tsx`. Read `src/components/art/diorama3d/README.md` first. This pass has two goals: make every one of the 1,047 roads in `public/data/catalog.json` get a truthful miniature, and make the miniatures read clearly at card size. Work on the current branch. Do not commit, push or deploy.

## 1. Look (the owner's feedback on the prototype)

- The model is small inside a wide dark box: landmarks are specks, the road is a thread, the visitor's car is barely visible. Frame the camera so the tile fills about 85% of the view on desktop and on a 390 px phone, and make the view box roughly square rather than a wide band. Scale landmarks two to three times relative to the tile so an arch bridge, lighthouse or covered bridge is recognisable at 360 px wide. Make the road about twice as wide with a visible centre line, and the car about twice as large.
- Everything is one sage green. Vary the ground by what is there: forest canopy, open grass or prairie, bare rock, snow, sand, farmland patches, water. Keep Rambleroo's earth-toned inks from `src/components/art/looks.ts` and the vintage printed feel: a light ink outline on silhouettes and a subtle paper grain, no glossy lighting.
- Rotation: keep the slow turntable and free drag (already in place), and also allow a gentle vertical drag to tilt within about 15 degrees. Under prefers-reduced-motion the model stays still until the reader drags it.

## 2. A spec for every road, truthfully generated

- Write `scripts/dioramas/generate.ts`. For each road in the catalog it writes `public/data/dioramas/<bywayId>.json` (served as static data, fetched per page, never bundled; move the three hand-written specs there too and keep them as hand-written: the generator must never overwrite a spec that has `"authored": true`).
- Inputs, in order of trust: the road's story in `content/stories/<id>.json` (moments in driving order, their kinds, scenes, motifs and `at` coordinates); its strip map `public/data/strips/<id>.json` (towns with miles and coordinates); its route geometry in `public/data/byways.geojson`; and its catalog `scene`, `region` and `themes`.
- Only draw what the inputs say. A landmark model appears only when a story moment or motif names it: lighthouse only for a `lighthouse` motif, arch bridge for `arch-bridge`, gristmill for `gristmill`, covered bridge only when a moment title says covered bridge, and so on. Towns from the strip map become small generic building clusters labelled by name. Roads without a story get terrain, vegetation, water and towns from their scene, region and strip, and no named landmarks. Never invent a named place.
- Ground and road profile come from scene and region: `coast` cliff or low shore by region, `mountain` ridges with switchbacks when the motif says so, `river` a valley with the river beside the road, `desert` mesas and washes, `forest` wooded hills, `prairie` farmland grid with windbreaks, `town` a main street with blocks. Extend the ground types, profiles and model library as needed, written so more can be added.
- Elevation comes from a smooth illustrative profile chosen by scene, not invented heights; say so in the README as the current specs do.
- Add every model a generated spec can request (at least one per motif in `src/lib/types.ts` Motif list) and keep each scene under the existing triangle budget.

## 3. Wire it in

- `RoadMiniature` loads the spec for the current road from `/data/dioramas/<id>.json` and shows the miniature on every road page that has one (story pages under the intro, listing pages after the listing text). If the fetch fails, show nothing.
- Keep the shared single renderer and off-screen pausing. Keep `/dev/diorama`, now with a road picker over all roads.

## 4. Checks

- The generator runs over all roads without errors; every spec validates against the schema; no spec contains a landmark not supported by its inputs (write a test that checks landmark models against the story motifs and moment titles).
- `npx tsc -b`, `npx vitest run` and `npx prettier --write` on touched files pass.
- Report: files changed, how scene types and motifs map to models, how many roads got named landmarks versus terrain-only scenes, and anything simplified.
