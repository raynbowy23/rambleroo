# State chapters: plan

Wisconsin is the model. Its chapter (`content/states/WI.json`, shown at `/state/WI`) follows the state's own byway program, links to WisDOT's official page, maps every program byway to a road in the catalog, and fills the two byways missing from the 2022 national layer with WisDOT's own route lines. The goal is the same depth for every state, so a traveller can always follow a link to the agency that designates the road.

## What a finished chapter has

1. **The official program page.** The state DOT's scenic byway page (or the agency the DOT delegates to, such as a tourism office), linked from the chapter and from each road.
2. **Every designated byway in the program**, matched to a catalog road, each with a link to its own official page when the state has one.
3. **Separate programs listed separately.** State, National Scenic Byway / All-American Road, USFS and BLM back country byways each say who designated them.
4. **No missing lines.** Byways that are absent from the 2022 USDOT layer get route lines from the state's official GIS layer (as WisDOT did), labelled with their source. If no official line exists, the road is listed with "route line not mapped" rather than drawn from guesswork.
5. **Strip maps** for the new lines, built and repaired with the existing pipeline.

## Data changes

- `content/states/<CODE>.json` for each state, same shape as Wisconsin. Members gain an optional `url` (the byway's official page) alongside `bywayId` and `note`.
- `content/state-sources.json`: one entry per state with an official GIS layer (ArcGIS REST or open-data URL, the name field, any filter). `scripts/ingest/build-supplements.ts` reads it instead of the hard-coded WisDOT entry, so a new state's missing lines are one config entry.
- Supplemental byway IDs: `99SSNN`, where `SS` is the state FIPS code and `NN` counts up (Wisconsin's 990001–990002 stay as they are).
- The app loads every chapter file (`import.meta.glob`) instead of importing Wisconsin alone, and "Browse by state" lists the chapters that exist.
- `scripts/ingest/content.test.ts` checks each chapter: members resolve to catalog roads, URLs are https, no road appears in two programs of the same state, and supplemental IDs follow the pattern.
- A link checker (`scripts/states/check-links.ts`, run by hand or monthly in CI) reports official pages that moved, because DOT sites reorganise often.

## Workflow for one state

1. Find the official program page and confirm it lists the designated byways.
2. List the program's byways, and note which other programs (USFS, BLM, national) also cover roads in the state.
3. Match them to the catalog. A helper script suggests matches by name and state; a person confirms each one.
4. For byways with no catalog line, look for the state's GIS layer. If found, add it to `state-sources.json`, run `build-supplements` and `build-catalog`, then discover places and build strips.
5. Add each byway's own page link where one exists.
6. Write the short intro and tagline (plain, factual, no superlatives).
7. Open a pull request; CI runs the chapter checks.

## Order

1. **Research all 50 states first**: program page, whether there is a GIS layer, and how many byways are missing from the national layer. That sizes the work and shows which states are quick.
2. **Generalise the code** (chapter loading, `state-sources.json`, member `url`, checks) with Wisconsin as the only chapter, so nothing changes for users.
3. **Pilot states** with good official data, then the rest in batches. Florida is a natural second chapter (Florida Scenic Highways program, strong state GIS), then states with many byways or All-American Roads.

## Status

| State | Program page | GIS layer | Missing from national layer | Chapter |
| --- | --- | --- | --- | --- |
| Wisconsin | [WisDOT scenic byways](https://wisconsindot.gov/Pages/travel/road/scenic-ways/byways.aspx) | WisDOT SCENIC_BYWAYS MapServer | 2 (filled) | done |
| Other states | research pending | | | |

Want to help with a state? Open an issue with the [State chapter](https://github.com/raynbowy23/rambleroo/issues/new?template=state-chapter.yml) template.
