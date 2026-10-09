# Road diorama prototype

Open `/dev/diorama`. Twelve real catalog roads span all seven scene families. The page uses `useCatalog`, `useStory`, and `useStrip` for local content and refreshes its shared date once a minute. The comparison road is selectable; its six hour studies hold summer/clear fixed, and its weather and season studies hold 13:00 fixed. Weather includes clear plus all four overlays.

`RoadDiorama` is exported from the art index. It uses no requests, images, canvas, filters, gradients, or external assets. The fixed `400 × 320` SVG is rendered at 320 px by default. Its ground projects `(u, v)` to `(200 + u - v, 105 + (u + v) / 2)`. The road uses that same plane, and upright pieces are sorted by depth. Each scene has at most three deduplicated story landmarks and five town blocks. Names only affect town count; story town moments provide a fallback count when names are absent. An explicit empty towns array removes those blocks.

## Scene families

| Family   | Pieces                                                                                |
| -------- | ------------------------------------------------------------------------------------- |
| River    | Through-running water channel, road bridge with rails, bank vegetation                |
| Coast    | Sea along the front edge, cliff lip, surf, sparse inland trees                        |
| Mountain | Stepped peaks, a winding switchback ribbon; lower ridges in Appalachia and the Ozarks |
| Forest   | Dense conifer bands; deciduous seasonal foliage; story switchbacks can add ridges     |
| Desert   | Three mesas, sparse vegetation; story hoodoos supply spires                           |
| Prairie  | Two striped fields, grain elevator and silo, scattered round trees                    |
| Town     | Cluster of four buildings by default, scaling up to five from town counts             |

Florida and Hawaii use palms. `lookInks`, `lookSky`, `mixInk`, `warmWinter`, `mulberry32`, and `useMotionEnabled` are shared with the existing kit. The tiny car uses Vehicle's rescue orange, cream, blue glass and dark tire inks. Seeded terrain, vegetation placement, scale, road bend and print flecks vary each tile.

## Motif miniatures

| Motif                              | Piece                                          |
| ---------------------------------- | ---------------------------------------------- |
| `lighthouse`                       | Striped tower, lantern and warm night beam     |
| `arch-bridge`, `viaduct`           | Isometric arched span with railing over a pool |
| `gristmill`                        | Mill block, millpond and spoked waterwheel     |
| `steeple-town`                     | Church with tall steeple and cross             |
| `paddlewheeler`                    | Hull, deckhouse, two stacks and paddlewheel    |
| `lock-and-dam`                     | Dam wall with four spillways                   |
| `waterfall-cove`                   | Water falling from a ledge into a pool         |
| `hoodoos`                          | Three unequal capped stone spires              |
| `harbor-village`                   | Two waterfront buildings                       |
| `mining-town`                      | Two buildings and a short mine track           |
| `orchard`, `aspens`                | Three deciduous trees                          |
| `rhododendron-bald`                | Three low blossom shrubs                       |
| `lake-wide`                        | Small lake with ripples                        |
| `sandbars`                         | Lake with pale sand islands                    |
| `limestone-ledges`, `river-bluffs` | Three terraced, striated rock blocks           |
| `sea-rock`                         | Offshore peak in water                         |
| `slickrock-ridge`                  | Faceted mesa                                   |
| `rolling-ridges`                   | Low stepped ridge                              |
| `snow-peaks`                       | Snow-capped peak                               |
| `switchbacks`                      | Ridge plus switchbacks in the single main road |

Story-level motifs take priority, followed by moment motifs. Remaining slots can use moment scenes or town kinds: river → lake, coast → sea rock, mountain → low ridge, forest → aspens, desert → mesa, town → church, prairie → orchard. These are symbolic scene cues, not surveyed landmark positions.

## Light, seasons and motion

Defaults use longitude/15 as an offset from UTC for both local date and solar hour. Meteorological seasons shift by six months in the southern hemisphere. Light phases are fixed prototypes: dawn 05–08, day 08–17, golden 17–19, dusk 19–21, night 21–05. The sun and shadow direction move across the day; dusk and night light the windows, headlights and lantern. Night uses the existing deep blue inks and stars.

Season changes tint vegetation; winter lightens ground, roofs and peaks. `warmWinter` suppresses automatic winter snow in Florida, Hawaii, the Southwest and Deep South. Explicit snow weather still draws snow there so every weather can be previewed. Motion is opt-in: a 32-second car circuit, gently drifting clouds/snow, and light rain. Reduced motion removes SVG car animation and the motion class, including after a live preference change; CSS also guards against reduced motion.

## Review choices and limits

- Decide whether the three-landmark density and tiny town blocks are sufficient at 320 px before integrating anywhere.
- Decide whether moment-scene fallback symbols should remain or only explicitly authored motifs should appear.
- Confirm the approximate solar schedule and mild-winter behavior; this prototype does not calculate astronomical sunrise or obtain real weather.
- Roads and landmarks are illustrative, not geographic route geometry. Bridge/viaduct, orchard/aspens and cliff/bluff motifs share silhouettes.
- The isolated renderer and gallery have tests covering all 1,047 catalog roads, every motif, seasons, weather, determinism, labels, night lighting, node budgets and live reduced-motion changes.
- Static SVG contact sheets were visually reviewed. Interactive browser review could not run in the restricted environment: local server binding and Chromium launch were denied.
