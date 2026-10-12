# Brief: fixes after looking at the generated miniatures

The generated miniatures (`scripts/dioramas/generate.ts`, `public/data/dioramas/`, `src/components/art/diorama3d/`) were rendered in a real browser for Big Sur, Talimena, Kenton to Keys, Mount Greylock and the Outer Banks at midday and at night. Fix these on the current branch, regenerate all specs, and keep every existing rule (no invented landmarks, authored specs untouched, triangle budget, one shared renderer). Do not commit, push or deploy.

1. **Ground type comes from the wrong place.** Mount Greylock (`mount-greylock-scenic-byway-2569`), whose story is about the highest peak in Massachusetts, renders as flat farmland because the catalog's name-inferred `scene` says prairie. When a road has a story, decide the ground from the story: the scenes of its moments (majority, with mountain winning ties over town or prairie) and its motifs (snow-peaks, switchbacks, rolling-ridges imply hills; lake-wide, river-bluffs imply water). Use the catalog scene only for roads without a story. Add a test that Mount Greylock gets mountain ground.
2. **Fields look like a chessboard.** Farmland is a regular grid of alternating squares that also spills onto Big Sur's sea cliff. Make fields irregular strips and patches of a few related earth tones that follow the land, only on fairly flat ground, never on cliffs, steep slopes or water.
3. **The road is broken.** It renders as separate tilted blocks with gaps, especially on curves. Make it one continuous ribbon that follows the terrain, with a continuous centre line.
4. **Trees look like floating gems.** The octahedron crowns read as diamonds hovering above the ground. Use rounded or cone crowns that sit on short trunks touching the ground, in clusters, a little smaller.
5. **Landmark scale and the beam.** On the Outer Banks two lighthouses are taller than the tile is deep and their night beams sweep across the whole tile. Cap any single landmark at about a third of the tile depth, keep two of the same kind visibly separated along the road, and make a lighthouse beam a short soft cone that reaches only a little past the shore.
6. **The fog bank** on Big Sur is a solid grey block floating above the cliff. Make fog a few low translucent soft bands near the water, or omit it.
7. **The car is lost** on some roads (Talimena). Keep it on top of the road, never hidden by terrain or trees, and slightly larger again if needed.
8. **Night is very dark.** Lift night ground and model colours a little so the land and road stay readable against the ink-blue sky.

Run `npx tsx scripts/dioramas/generate.ts`, `npx tsc -b`, `npx vitest run` and `npx prettier --write` on touched files. Report what changed for each point.
