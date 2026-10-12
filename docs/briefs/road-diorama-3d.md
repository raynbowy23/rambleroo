# Brief: a 3D miniature diorama for each road (second prototype)

The first prototype (flat SVG isometric tiles in `src/components/art/diorama/`) read as generic: the same kit of peaks, trees and boxes on every road, no depth, and a toy car drawn in 2D. This pass makes each diorama a real 3D model of *that* road, in the spirit of the Japanese app DayCity, where each city's miniature is recognisably that city.

## 1. A scene spec per road, written before any rendering

Every diorama is built from a per-road spec file, `content/dioramas/<bywayId>.json`. The renderer never invents what a road looks like; it only draws what the spec says. Spec shape:

```jsonc
{
  "bywayId": "route-1-big-sur-coast-highway-2301",
  "ground": "coastal-cliff",            // the tile's base landform
  "palette": "coast",                   // one of the existing look palettes
  "road": {
    "shape": "from-geometry",           // trace the real route line, simplified and fitted to the tile
    "profile": "cliff-shelf",           // how the road sits on the land: valley-floor, cliff-shelf, switchbacks, ridge-top, causeway
    "lanes": 2
  },
  "landmarks": [                        // 2 to 4, each a specific, named thing, placed along the road in driving order
    {
      "name": "Bixby Creek Bridge",
      "model": "open-spandrel-arch-bridge",   // from the model library below
      "at": 0.18,                             // 0..1 along the traced road
      "notes": "single tall concrete arch spanning a narrow canyon that opens to the sea; road crosses on top"
    },
    {
      "name": "Point Sur Light",
      "model": "lighthouse-on-rock",
      "at": 0.35,
      "offset": "seaward",
      "notes": "stone lighthouse on a high volcanic rock just offshore"
    },
    {
      "name": "McWay Falls",
      "model": "cove-waterfall",
      "at": 0.8,
      "offset": "seaward",
      "notes": "thin fall dropping from a cliff onto a small sandy cove"
    }
  ],
  "dressing": ["cypress-clumps", "sea-stacks", "surf-line", "fog-bank"],
  "towns": []                           // small named clusters only where the road really passes one
}
```

Specs are written per road from its story moments, strip towns and sources, so they stay true to the place. For this prototype, write the three specs below by hand; later, roads with stories get specs from their moments and other roads get a spec generated from their scene family, towns and route shape.

**Route 1, Big Sur** (above). Cliff-shelf road along the sea; Bixby Creek Bridge, Point Sur Light, McWay Falls.

**Beartooth Highway** (`beartooth-highway-2281`): ground `alpine-plateau`; road profile `switchbacks` climbing from a forested canyon (Rock Creek, Red Lodge end) up stacked hairpins onto a high treeless plateau with snowfields and small lakes; landmarks: `Vista Point` (a pull-out overlook at the top of the switchbacks, looking down the canyon), `Beartooth Basin Ski Area` (a T-bar lift on a summer snowfield near the summit), `Cooke City` (a few log-and-false-front buildings in a valley at the far end).

**Kancamagus Scenic Byway** (`kancamagus-scenic-byway-2458`): ground `forested-ridges`; road follows the Swift River valley floor, then climbs hairpins to Kancamagus Pass; landmarks: `Kancamagus Pass` (hairpins and an outlook at the crest), `Russell-Colbath House` (a white 19th-century farmhouse in a clearing at Passaconaway), `Albany Covered Bridge` (a red 120-foot covered bridge over the river beside the road). Dense mixed hardwood forest that turns red and gold in autumn.

## 2. Real 3D

- Render with three.js (already a dependency, v0.186), not SVG. One component, `RoadDiorama3D`, in `src/components/art/diorama3d/`.
- Orthographic camera at a classic diorama angle (about 30 degrees down, 45 degrees around). The tile is a thick block of land with visible soil and rock strata on its sides, floating on the page with a soft shadow.
- Low-poly, flat-shaded models with Rambleroo's vintage look: earth-toned inks from `src/components/art/looks.ts`, soft warm lighting, a subtle paper-grain and slight ink-outline pass so it reads as a printed miniature, not a glossy game render. No photoreal textures and no external model files; every model is built in code from simple geometry.
- Model library (start with what these three roads need, written so more can be added): `open-spandrel-arch-bridge`, `covered-bridge`, `lighthouse-on-rock`, `cove-waterfall`, `farmhouse`, `ski-lift`, `overlook-pullout`, `false-front-town`, `conifer`, `hardwood`, `cypress`, `sea-stack`, `snowfield`, `alpine-lake`, `river`, `surf`.
- The road is extruded along the traced route line, banked into the terrain, with a centre line. Terrain is a height field shaped by the spec (cliff edge, canyon, plateau, valley), so switchbacks really climb.

## 3. Hover rotates it a little

- On hover (or focus), the diorama turns smoothly by about 20 to 25 degrees around its vertical axis and eases back on leave. On touch, a gentle drag turns it within the same range. Under `prefers-reduced-motion`, no turning.

## 4. A 3D vehicle

- Reuse `buildVehicle(garage)` from `src/components/art/vehicle3d.ts` so it is the visitor's own car from the garage, scaled to the diorama. It drives the traced road slowly, following the road's slope and turns, with headlights at night.

## 5. Time, weather, season (keep from the first prototype)

- Local solar time from the road's longitude: sun position and colour move through dawn, day, golden hour, dusk, night (deep ink-blue sky, stars, lit windows, the lighthouse beam turning).
- Weather presets (no network yet): clear, cloudy, rain, snow, fog. Season tints foliage and adds snow cover where the region gets snow.

## 6. Prototype scope and checks

- Only these three roads, shown on `/dev/diorama` (replace the current page content; keep the old SVG prototype files untouched for now), each in a card about 360 px wide, with time, weather and season controls.
- WebGL contexts are limited (browsers allow about 16). Share one renderer across the cards, or render into one canvas.
- Performance: each diorama under about 2,000 triangles plus the car, steady 60 fps on a laptop, and no work when it is off screen.
- Tests: spec files validate against a schema; the renderer builds each scene without throwing in a test environment (mock WebGL or test the scene-graph builder separately from rendering); hover rotation stays within its range.
- Do not wire into the byway page, cards or map. Do not commit, push or deploy.
- Run `npx tsc -b`, `npx vitest run` and `npx prettier --write` on touched files before finishing.

## Report back

Files added, how each landmark model is built, anything simplified, and screenshots are not possible in your sandbox, so describe what each of the three should look like at 13:00 and at 21:00.
