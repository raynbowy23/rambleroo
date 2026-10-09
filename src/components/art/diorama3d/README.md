# A miniature for every road

All 1,047 catalog roads have static specs in `public/data/dioramas/<bywayId>.json`.
146 have named editorial landmarks; 901 have terrain and optional strip towns, without
named landmarks. Big Sur, Beartooth and Kancamagus remain hand-written, with
`"authored": true`. Generation checks that flag before writing and never overwrites
an authored file. The former `content/dioramas` specs have moved; the schema stays there.

Run `node --import tsx scripts/dioramas/generate.ts` (or `npx tsx scripts/dioramas/generate.ts`
where local IPC is permitted). Generation is deterministic, offline, and validates every
spec against `content/dioramas/schema.json` before writing it.

## Evidence and placement

`scripts/dioramas/rules.ts` is the exhaustive, typed motif-to-model registry. Named
models require moment motifs or explicit moment titles. Covered bridges require
“covered bridge” in the title; lighthouses, arch bridges and gristmills require their
respective motifs. Catalog names, marks and historic themes do not authorize them.
Story-wide motifs without a moment location become unlabelled scenery, never a
new named place. The three authored scenes retain their prose-supported house,
outlook and town models; tests check their evidence too.

Inputs are used in this order:

1. Story moments supply driving order, scenes, motifs, kinds and optional coordinates.
   Their first scene selects the overall landscape. Coordinates project onto the route;
   missing coordinates get illustrative positions in moment order. Projected positions
   are kept nondecreasing to preserve editorial driving order. Excursions remain
   schematic roadside models, not newly invented access roads.
2. Strip maps supply the ordered main route and all named towns. Town miles locate
   main-route clusters; other town coordinates project onto the illustrated route.
   Every town gets a generic three-building cluster and an HTML name label. An
   existing named town model is reused where possible.
3. Without a strip, matching endpoints of catalog geometry are joined. The longest
   connected chain is illustrated; disconnected branches are omitted, never connected
   by a fictitious road. The line is reduced to at most 56 vertices, retaining the
   largest bends and geographic aspect ratio. It reverses when anchored story
   moments establish the opposite driving direction.
4. Catalog scene, region and themes supply fallback landscape and vegetation.
   Roads without stories have no named landmarks.

**Elevation is a smooth illustrative scene profile, not surveyed heights or a DEM.**
Terrain, water side, vegetation placement, town offsets and landmark proportions are
schematic. Strip geometry retains the strip's own repair decisions and source limits.
Existing stories and strips are not necessarily reviewed.

## Scene families

| Scene    | Ground, profile and dressing                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Coast    | Cliff shelf in California, Pacific Northwest, Alaska and Hawaii; low sandy shore elsewhere; water plane and sand patches |
| Mountain | Rocky ridges and plateau, smooth rise and descent, regional trees; snow peaks only when their motif supplies them        |
| River    | Valley floor, continuous river ribbon beside the route, wooded slopes when forest is a theme                             |
| Desert   | Ochre mesas and pale sandy washes; sparse bare rock                                                                      |
| Forest   | Wooded hills; conifers in Rockies, Alaska and Pacific Northwest, generic broadleaf canopy elsewhere                      |
| Prairie  | Low profile, alternating farmland patches, crop rows and tree windbreaks                                                 |
| Town     | Level main street and small generic building blocks                                                                      |

Switchbacks select the switchback profile only when that motif is present. The main
road always follows input geometry; a motif model is a schematic hairpin on a slope.
No extra hairpins are inserted into the geographic line. Winter snow follows a
conservative cold-region rule, or the reader's explicit snow weather selection.

## Motif models

| Story motif                    | Procedural model                                |
| ------------------------------ | ----------------------------------------------- |
| river-bluffs, limestone-ledges | Faceted ledge                                   |
| lake-wide                      | Flat lake patch                                 |
| lock-and-dam                   | Water, dam wall and spillways                   |
| paddlewheeler                  | Hull, decks, stacks and paddle wheel            |
| sandbars                       | Sand patch                                      |
| steeple-town                   | Gabled building and steeple                     |
| harbor-village                 | Water, dock and waterfront blocks               |
| lighthouse                     | Tower, lantern and cap on rock; night beam      |
| orchard                        | Row of low crowns                               |
| rolling-ridges                 | Faceted ridge                                   |
| gristmill                      | Gabled mill with side waterwheel                |
| viaduct                        | Deck on tall piers                              |
| rhododendron-bald              | Grass patch and flowering shrubs                |
| snow-peaks                     | Rocky cone with pale summit                     |
| switchbacks                    | Schematic hairpin on a rock slope               |
| mining-town                    | Three false-front buildings                     |
| aspens                         | Pale trunks and elongated crowns                |
| hoodoos                        | Slender rock columns with caps                  |
| slickrock-ridge                | Bare mesa                                       |
| arch-bridge                    | Deck, twin open-spandrel arch ribs and parapets |
| sea-rock                       | Faceted sea stack                               |
| waterfall-cove                 | Sand cove, cliff and narrow fall                |

Explicit moment titles also support covered bridges, houses/homesteads, ski areas
and viewpoints. A `town` moment supports generic town blocks. To add a motif, extend
`Motif`, the registry, `models.ts` and the schema model enums; tests require every
model to produce geometry and every spec to remain within budget.

## Rendering and interaction

`RoadMiniature` fetches one spec on demand, under the story intro or after listing
text. Failed requests show nothing; changing roads aborts stale requests. No specs
are imported into production JavaScript. `fixtures.test-data.ts` imports only the
three authored fixtures for tests. `/dev/diorama` has a picker for the entire catalog
and retains the local time, season and weather controls.

Views are square, at most 560px wide. Orthographic framing tracks the projected
square's width through rotation, targeting about 85% of the view, with a vertical
margin for elevated terrain. Landmarks are 2.25× their prototype scale, the road and
cream centre line are 2× wider, and the garage car is 2× larger. Terrain uses the
scene inks from `looks.ts`, with forest, grass, cultivated patches, exposed rock,
snow, sand and water differentiated. Matte materials, soft ink edges and CSS paper
grain preserve the printed treatment without glossy lighting or postprocessing.

A turn takes 40 seconds. Free horizontal drag turns the world; vertical drag tilts
the camera within ±15°. Arrow keys support both axes. Reduced motion freezes the
turntable, car, weather and beacon until an explicit view interaction redraws.

`renderer.ts` retains one scissored WebGL canvas, a 1.5× DPR cap, off-screen scene
release, and no animation while all views are off screen or the document is hidden.
Static meshes batch by pigment. Town labels are DOM text, avoiding GPU textures.
All scenes stay under 2,000 triangles excluding the visitor's vehicle.

## Checks and limits

`generate.test.ts` validates all 1,047 files, checks editorial landmark support,
builds every night scene and enforces the triangle budget. Renderer tests cover the
shared context, off-screen sleeping, tilt limits and reduced-motion dragging. Fetch
tests cover missing specs, road changes and cancellation. The existing scene tests
cover seasons, weather, vehicles, route direction and model construction.

The catalog's schematic scene classifications are not site surveys. Simplifications
include longest-chain routes without strips, approximate moment placement, generic
vegetation and town buildings, exaggerated landmarks, coarse terrain, flat water,
and a solar clock rather than astronomical sunrise prediction. Dense town labels
can overlap. Desktop/390px screenshots and sustained GPU performance have not been
verified: Chromium launch is prohibited by this execution sandbox.
