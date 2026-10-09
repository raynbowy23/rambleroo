# Road miniatures, prototype two

Only `/dev/diorama` uses this gallery. The first SVG prototype remains untouched.

## Files and authoring

- `content/dioramas/{bywayId}.json`: three hand-authored scenes, written before rendering, with named landmarks in driving order, source pointers, elevation knots, exact dressing placements and catalog-derived route coordinates.
- `content/dioramas/schema.json`: JSON Schema, validated by Ajv in tests. Ajv is now an explicit development dependency (its existing locked version is reused).
- `spec.ts`: types and the three JSON imports.
- `route.ts`: aspect-preserving geographic fit, distance-based sampling, terrain profiles and bounded rotation.
- `models.ts`: extensible procedural model library.
- `scene.ts`: WebGL-independent scene builder, terrain, pigment batching, vehicle, light and atmosphere.
- `renderer.ts`: shared scissored canvas, visibility and resource lifecycle.
- `RoadDiorama3D.tsx`, `DioramaGallery.tsx`, `diorama3d.css`: interaction, three cards, individual controls, paper grain and soft page shadows.
- `diorama3d.test.ts`, `renderer.test.ts`: schema, scene graph, triangle budget, car direction/slope, all weather/season/vehicle variants, rotation, shared context and off-screen scheduling checks.

`src/App.tsx` changes the workshop import only. The package manifest and lockfile declare the test validator. No production byway, card or map integration.

The geometry is Douglas–Peucker simplified to at most 64 coordinates, preserving the geographic aspect ratio. Beartooth's three catalog segments are joined at their shared endpoints, running from Red Lodge toward Cooke City. Big Sur runs north to south. Kancamagus runs west to east, following the story's Pass → Passaconaway → Albany order; the Swift River portion is therefore a descent. `at` values and elevation profiles are authored illustrative proportions, not surveyed positions/heights. Sources are existing repository stories and strips; those sources themselves are marked unreviewed.

Dressing extends the brief's string shorthand to explicit model, route fraction, side, distance and scale records. This makes density and placement an authoring decision. Towns reference named landmark clusters so Cooke City is drawn once. No buildings or tree species are selected by the renderer.

## Landmark construction

| Landmark                      | Code geometry                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Bixby Creek Bridge            | Concrete box deck and parapets, two eight-segment arch ribs and open vertical spandrels; spans a depression in the coastal height field.       |
| Point Sur Light               | Five-sided volcanic cone, tapering six-sided stone tower, lantern box and cap; translucent rotating beam at night.                             |
| McWay Falls                   | Small polygonal sand cove, cliff slab, narrow vertical cream waterfall and splash patch.                                                       |
| Vista Point / Kancamagus Pass | Flat pull-out pad, posts, guardrail and small viewing stand, placed beside the climbing road.                                                  |
| Beartooth Basin Ski Area      | Polygonal snowfield, three poles, sloping cable and hanging T-bar silhouettes.                                                                 |
| Cooke City                    | Three timber-coloured blocks with raised false fronts, signboards and emissive windows.                                                        |
| Russell-Colbath House         | White box walls, extruded triangular gable roof, chimney, door and paired windows.                                                             |
| Albany Covered Bridge         | Red side walls with dark slit details, open portals, long extruded gable roof, deck and abutments; turned across the river beside the highway. |

Conifers are low-sided cones, hardwood crowns are octahedra with line trunks, and cypress crowns are flattened octahedra. Sea stacks are faceted cones. Snowfields, lakes, surf and cove sand are low-sided flat patches. The river uses an offset ribbon along the eastern route. The coast's authored fog bank is a translucent flattened octahedron. Terrain is a 12 × 12 triangular height field, closed with side faces and three coloured strata. Road vertices sit on that field except at the bridge canyon; a banked ribbon supplies top and side faces plus a cream centre line.

## Light, motion and resource budget

The default clock uses UTC plus longitude / 15; controls override the local solar hour. Seasonal controls are independent. This is a mean solar clock with stylised dawn/day/golden/dusk/night thresholds, not astronomical sunrise prediction. Summer is the initial season. Coastal winter stays snow-free unless snow weather is explicitly selected. Night adds blue illumination, stars, emissive building windows, two vehicle spotlights and the turning lighthouse beam. Weather is local, with no network requests: cloudy dims light, fog adds distance haze, rain uses line streaks, snow uses point flakes and snow cover.

The camera is orthographic, about 31° down and 45° around. Hover/focus turn to 23°, touch drag clamps to ±23°, and leaving/releasing eases back. Reduced motion stops turning, driving, particles and the beacon. The existing garage vehicle is reused and aligned with both route tangent and slope. The 100-second drive restarts at the route beginning; conditions/garage changes rebuild a scene and restart it.

Only one WebGL context is allocated. Visible cards use scissored viewports, capped at 1.5 device pixel ratio. Static meshes are merged by pigment. Off-screen cards release scene resources; no frame loop runs when all cards are off-screen or the document is hidden. Reduced motion redraws only on invalidation. Full-screen GPU postprocessing is avoided: sparse edge lines supply ink outlines, CSS supplies paper grain and a soft page shadow.

Triangle tests enforce 2,000 per scene excluding the visitor's vehicle. Scene graphs and renderer scheduling are verified in the sandbox; screenshots and sustained laptop 60-fps measurements have not been captured. Other deliberate simplifications: exaggerated landmark scales, coarse terrain rather than a DEM, approximate landmark fractions, low-sided flat water/snow patches, schematic T-bars (the repository story describes platter lifts), and no photoreal textures, external models or physical shadow maps.

## Expected appearance, clear summer

| Road       | 13:00 solar time                                                                                                                                                                                                                                                              | 21:00 solar time                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Big Sur    | Sage cliff shelf above turquoise sea, exposed cream arch across the canyon, offshore dark rock and small lighthouse, sandy waterfall cove, cypress silhouettes, surf and a low fog bank. Warm layered earth sides float above a soft shadow.                                  | Ink-blue backdrop and stars; the cliff and sea darken, the lighthouse lantern glows and its cream beam revolves. The garage car's headlights follow the coastal ribbon. |
| Beartooth  | Forested low canyon climbs along the actual switchback trace to a pale rocky plateau. Vista Point overlooks the climb; white snow patches, blue lake patches and the spindly lift occupy the high country. Cooke City's three fronts sit in the descending far valley.        | Cool moonlit plateau with pale snow still legible, a dark lift silhouette, stars, warm Cooke City windows and moving headlights.                                        |
| Kancamagus | A dense mixed green forest surrounds the western crest and eastern river valley. A small lookout marks the pass; the white farmhouse sits in a clearing, and the red gabled covered bridge crosses the blue river beside the road. Autumn switches hardwoods to red and gold. | Blue wooded ridges under stars; the farmhouse windows glow, the red covered bridge becomes a muted silhouette and the car's headlights trace the river valley.          |
