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

Research on 2026-10-04 (every link fetched and checked; the full registry with byway names and notes is in [content/state-programs.json](../content/state-programs.json)). "Possible gaps" counts official byway names with no close name match in the catalog for that state. It overcounts (spelling and naming differences), so each one needs a human check before it counts as missing. "—" means the official page doesn't list names.

| State | Program page | GIS route lines | Byways listed | Possible gaps | Chapter |
| --- | --- | --- | --- | --- | --- |
| Alabama | [Alabama Scenic Byways Advisory Council (created by the Alabama the Beautiful Act, 2000), with an ALDOT state scenic byway coordinator; site run c/o Alabama Association of Regional Councils](https://alabamabyways.com/) | no | 11 | 2 without a line | done |
| Alaska | [Alaska Department of Transportation & Public Facilities (Data, Modernization, and Innovation Office)](https://dot.alaska.gov/dmio/scenic/) | yes | 15 | 1 without a line | done |
| Arizona | [Arizona Department of Transportation (ADOT), Parkways, Historic and Scenic Roads Advisory Committee](https://azdot.gov/about/historic-and-scenic-roads/list-scenic-roads) | yes | 28 | 0 (4 filled, Walker from OpenStreetMap) | done |
| Arkansas | [Arkansas Department of Transportation (ARDOT), Right of Way Division, Beautification Section](https://ardot.gov/divisions/right-of-way/row_sections/beautification-section/scenic-byways/) | yes | 12 | 0 (4 filled) | done |
| California | [California Department of Transportation (Caltrans)](https://dot.ca.gov/programs/design/lap-landscape-architecture-and-community-livability/lap-liv-i-scenic-highways) | yes | 55 | 0 (18 filled) | done |
| Colorado | [Colorado Department of Transportation (CDOT), with the Colorado Scenic and Historic Byways Commission](https://www.codot.gov/travel/coloradobyways) | yes | 26 | 0 (1 filled) | done |
| Connecticut | [Connecticut Department of Transportation (CTDOT), Scenic Roads Advisory Committee](https://portal.ct.gov/dot/programs/connecticut-scenic-roads) | yes | 43 | 0 (40 filled) | done |
| Delaware | [Delaware Department of Transportation (DelDOT)](https://deldot.gov/Programs/byways/index.shtml) | yes | 6 | 0 (3 filled) | done |
| Florida | [Florida Department of Transportation (FDOT)](https://www.fdot.gov/roadway/landscape-architecture/florida-scenic-highways-program) | yes | 27 | 0 (4 filled, Halifax listed without a line) | done |
| Georgia | [Georgia Department of Transportation (GDOT); designations approved by the State Transportation Board](https://www.dot.ga.gov/GDOT/pages/ScenicByways.aspx) | no | 17 | 3 without a line | done |
| Hawaii | not verified | no | 8 | 4 without a line (2 filled) | done |
| Idaho | [Idaho Transportation Department (ITD), with the Idaho Byways Advisory Committee; promoted by Visit Idaho (Idaho Department of Commerce)](https://visitidaho.org/things-to-do/scenic-byways/) | yes | 32 | 0 (1 filled) | done |
| Illinois | [Illinois Department of Transportation (IDOT) administers the national byways in the state; promoted by Enjoy Illinois (Illinois Office of Tourism)](https://www.enjoyillinois.com/things-to-do/illinois-scenic-byways/) | yes | 7 | 0 | done |
| Indiana | [Indiana Department of Transportation (INDOT)](https://secure.in.gov/indot/public-involvement/planning-efforts-at-indot/indiana-scenic-byways/) | no | 9 | 2 without a line | done |
| Iowa | [Iowa Department of Transportation](https://iowadot.gov/modes-travel/roads-highways/iowas-byways/program-information) | yes | 14 | 0 (4 filled) | done |
| Kansas | [Kansas Tourism with the Kansas Department of Transportation (KDOT); designations by KDOT resolution](https://www.travelks.com/things-to-do/byways-and-highways/byways/) | yes | 13 | 0 (2 filled) | done |
| Kentucky | [Kentucky Transportation Cabinet (KYTC), Office of Local Programs](https://transportation.ky.gov/LocalPrograms/Pages/Scenic-Byways.aspx) | yes | 38 | 0 (17 filled, 3 mis-drawn national lines replaced) | done |
| Louisiana | [Louisiana Department of Culture, Recreation & Tourism, Office of Tourism (Office of the Lt. Governor)](https://byways.explorelouisiana.com/) | no | 19 | 0 (8 filled) | done |
| Maine | [Maine Department of Transportation (MaineDOT), Bureau of Planning; promoted by Visit Maine (Maine Office of Tourism)](https://visitmaine.com/things-to-do/scenic-byways-trails/) | yes | 13 | 0 (1 filled) | done |
| Maryland | [Maryland Department of Transportation State Highway Administration (MDOT SHA), Office of Planning and Preliminary Engineering](https://roads.maryland.gov/mdotsha/pages/Index.aspx?PageId=97) | yes | 18 | 0 (1 filled) | done |
| Massachusetts | not verified | yes | 14 | 0 (5 filled) | done |
| Michigan | [Michigan Department of Transportation (MDOT)](https://www.michigan.gov/mdot/travel/tourists/byways/program-information) | no | 22 | 0 (15 filled) | done |
| Minnesota | [Minnesota Department of Transportation (MnDOT), with Explore Minnesota Tourism and partner agencies](https://www.dot.state.mn.us/scenicbyways/) | yes | 22 | 0 (1 filled, 3 renamed) | done |
| Mississippi | not verified | no | 15 | 7 without a line | done |
| Missouri | [Missouri Department of Transportation (MoDOT)](https://www.modot.org/scenic-byways-contacts) | yes | 11 | 2 without a line | done |
| Montana | [Montana Department of Transportation (MDT), Scenic Historic Byways Advisory Council and Montana Transportation Commission](https://www.mdt.mt.gov/travinfo/scenic.aspx) | no | 2 | 0 (1 filled) | done |
| Nebraska | [Nebraska Department of Transportation (NDOT)](https://dot.nebraska.gov/travel/scenic-byways/) | no | 9 | 0 | done |
| Nevada | not verified | no | 15 | 1 without a line (3 filled) | done |
| New Hampshire | not verified | yes | 21 | 0 (6 filled) | done |
| New Jersey | [New Jersey Department of Transportation (NJDOT), Community Programs](https://dot.nj.gov/transportation/community/scenic/byways.shtm) | no | 8 | 1 without a line | done |
| New Mexico | [New Mexico Department of Transportation (NMDOT); traveler pages hosted by New Mexico Tourism Department](https://www.newmexico.org/places-to-visit/scenic-byways/) | yes | 25 | 0 | done |
| New York | [New York State Department of Transportation (NYSDOT)](https://www.dot.ny.gov/display/programs/scenic-byways/lists) | no | 30 | 0 (9 filled) | done |
| North Carolina | [North Carolina Department of Transportation (NCDOT)](https://www.ncdot.gov/travel-maps/traffic-travel/scenic-byways/Pages/default.aspx) | yes | 63 | 0 (11 filled, 4 renamed) | done |
| North Dakota | [North Dakota Department of Transportation (NDDOT) with North Dakota Tourism (Department of Commerce)](https://www.ndtourism.com/bywaysbackways) | yes | 10 | 0 | done |
| Ohio | not verified | no | 27 | 0 (5 filled) | done |
| Oklahoma | [Oklahoma Department of Transportation (ODOT), with University of Oklahoma Outreach; promoted by TravelOK (Oklahoma Tourism)](https://www.travelok.com/articles/oklahomasscenicbyways) | yes | 8 | 0 (1 filled) | done |
| Oregon | [Oregon Department of Transportation (ODOT); designations by the Oregon Transportation Commission with the Oregon Tourism Commission](https://tripcheck.com/Pages/Scenic-Byways) | yes | 29 | 0 (5 filled) | done |
| Pennsylvania | [Pennsylvania Department of Transportation (PennDOT)](https://www.pa.gov/agencies/penndot/research-planning-and-innovation/byways-program) | no | 23 | 1 without a line (5 filled) | done |
| Rhode Island | [Rhode Island Department of Transportation (RIDOT), Rhode Island Scenic Roadways Board](https://www.dot.ri.gov/projects/ScenicRoads/index.php) | no | 9 | 0 (2 filled) | done |
| South Carolina | [South Carolina Department of Transportation (SCDOT), with the South Carolina Scenic Highways Committee](https://www.scdot.org/projects/scenicByways.html) | yes | 22 | 1 without a line (4 filled) | done |
| South Dakota | [South Dakota Department of Transportation (SDDOT); designations by the South Dakota Transportation Commission](https://dot.sd.gov/programs-services/programs/scenic-byways/) | no | 5 | 0 | done |
| Tennessee | [Tennessee Department of Transportation (TDOT), Highway Beautification Office](https://tnscenicbyways.com/) | yes | 13 | 1 without a line (6 filled) | done |
| Texas | [Texas Department of Transportation (TxDOT)](https://www.txdot.gov/business/grants-and-funding/scenic-byways.html) | no | — | 0 | done |
| Utah | not verified | yes | 32 | 0 (2 filled) | done |
| Vermont | [Vermont Agency of Transportation (VTrans); designations by the Vermont Transportation Board](https://vermontvacation.com/things-to-do/trip-ideas-itineraries/scenic-drives/vermont-byways/) | yes | 10 | 0 (3 filled) | done |
| Virginia | [Virginia Department of Transportation (VDOT), with the Department of Conservation and Recreation; designations by the Commonwealth Transportation Board](https://www.vdot.virginia.gov/travel-traffic/travelers/virginia-byways/) | yes | 70 | 4 without a line (57 filled) | done |
| Washington | not verified | yes | 29 | 0 (2 filled) | done |
| West Virginia | not verified | yes | 19 | 0 (4 filled) | done |
| Wisconsin | [Wisconsin Department of Transportation (WisDOT)](https://wisconsindot.gov/Pages/travel/road/scenic-ways/byways.aspx) | yes | 5 | 0 (2 filled) | done |
| Wyoming | [Wyoming Department of Transportation (WYDOT)](https://www.dot.state.wy.us/home/travel/scenic_byways/wyomings-scenic-byways--backways.html) | no | 21 | 1 without a line (2 filled) | done |

Want to help with a state? Open an issue with the [State chapter](https://github.com/raynbowy23/rambleroo/issues/new?template=state-chapter.yml) template.
