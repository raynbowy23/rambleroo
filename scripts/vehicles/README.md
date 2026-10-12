Vehicle review previews
=======================

From the repository root:

```sh
node scripts/vehicles/preview.mjs before
node scripts/vehicles/preview.mjs after
```

Outputs default to `../vehicle-previews/{before,after}/`. An optional third argument overrides the destination. `before` bundles the vehicle, miniature scene and renderer from git HEAD without changing the checkout. Keep HEAD unchanged until the comparison is captured.

Each folder contains 42 labelled vehicle/ferry views (two garage choices, three angles), `contact-sheet.png`, `miniature.png` (Big Sur at a fixed route position), and `metrics.json`. The garage model order and camera framing match between both sets.

The script bundles locally with esbuild and launches Playwright Chromium without a web server. When Chromium cannot launch, it uses `software.mjs` and `raster.py` (Python, NumPy, Pillow). Set `VEHICLE_SOFTWARE=1` to select this fallback explicitly for consistent comparisons. The fallback projects the actual three.js geometry with the same orthographic cameras and renders flat pigments with a depth buffer and 2× antialiasing. It also writes `triangle-budgets.json`; the ferry entry uses the most expensive carried car, the wagon. These are geometry review previews: fallback lighting approximates WebGL and omits miniature edge lines and weather particles. It does not prove GPU rendering correctness.
