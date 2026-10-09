# Writing Rambleroo road stories

Rambleroo (rambleroo.app) is a vintage-styled guide to US scenic byways. Each road page has a short "story". You write stories for the roads listed in your batch. Do not modify anything in the repository (read-only for you). Work in the directory your prompt names as S.

For each road id in your batch:
1. Read its material: $S/material/<id>.json (name, states, the state chapter blurb(s), sourced facts with URLs, and the towns and landmarks along it from the strip map, with Wikipedia titles).
2. Research a little more where the material is thin: fetch the official page (chapters[].url), the road's Wikipedia article, and the Wikipedia articles of 3 to 6 places along it. Only use pages you actually fetched.
3. Write $S/out/<id>.json in the format below. Write each file as soon as it is done.

## Format (JSON)

{
  "id": "<id>",
  "tagline": "under 12 words",
  "motifs": ["1 or 2 from the list below, most characteristic first"],
  "intro": ["paragraph 1", "paragraph 2"],      // 50 to 120 words together
  "season": "optional, ONLY if a source states the best time to go",
  "moments": [                                  // 2 or 3 (3 when the material allows), in driving order
    { "title": "Place name", "kind": "roadside" | "short walk" | "separate excursion" | "town",
      "scene": "river" | "coast" | "mountain" | "forest" | "desert" | "town" | "prairie",
      "text": "one sentence, under 35 words",
      "at": [lon, lat],                         // ONLY from the place's Wikipedia/official coordinates; omit "at" if you have none
      "motifs": ["optional, from the list"] }
  ],
  "practical": ["optional one note: closures, unpaved stretches, vehicle limits, seasonal gates, if sourced"],
  "sources": [ { "label": "Agency or Wikipedia, page title", "url": "https://..." } ],   // every page you used
  "reviewed": false
}

For state and local roads the material is often thinner than for national byways. A shorter story is fine: intro 50 to 120 words, 2 or 3 moments. Skip a road (and say why) rather than pad it.

Motifs allowed: river-bluffs lake-wide lock-and-dam paddlewheeler sandbars steeple-town harbor-village lighthouse limestone-ledges orchard rolling-ridges gristmill viaduct rhododendron-bald snow-peaks switchbacks mining-town aspens hoodoos slickrock-ridge arch-bridge sea-rock waterfall-cove

## The voice (this matters most; the owner approved it)

A well-made 1940s-50s American state guide, or the margin notes of an old road atlas: concrete, unhurried, warm, quietly wry. Read the three approved stories first and match them:
- content/stories/ in the repository: apache-trail-historic-road-2058.json
- content/stories/ in the repository: historic-bluff-country-scenic-byway-2240.json
- content/stories/ in the repository: cherohala-skyway-2282.json

Principles:
- Get the reader moving before the history. Start out of a town, up a valley, along a shore.
- Give a physical change its own short sentence: "There the pavement quits."
- Keep only numbers that help feel the drive (an elevation, a length). Drop costs, acreage counts and designation dates unless they carry the story.
- Let one odd, sourced fact carry the wit, with understatement: "The boar stayed." "A stagecoach stop that outlived the stagecoaches." "A cave that never changes its weather" (it holds 48 degrees).
- Moments describe something happening at the place, not a catalogue line.
- Multi-state roads: tell the road as one drive and pick moments that show its range.

## Hard rules

- Every factual claim must come from a page you fetched or the material file. Atmosphere comes from sourced facts and word choice, never from invented sights, sounds, smells, weather, wildlife, crowds or seasons. If a source does not say it, leave it out.
- No superlatives (breathtaking, stunning, must-see, hidden gem, spectacular, iconic), no "nestled", "boasts", "offers visitors", "rich history", "honestly", no exclamation marks, no rhetorical questions, no em-dashes, no lists of three for rhythm (a list of three things the source names is fine).
- Do not repeat the state chapter blurb word for word; the story goes deeper.
- Coordinates only from a source; never estimate. Moments without "at" are fine.
- Never send personal information anywhere (no email or name in User-Agent headers or URLs). Use User-Agent "Rambleroo/0.1 (story research; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues)".
- Wikipedia rate-limits; space requests. If WebSearch is unavailable, fetch pages directly.

## Before you finish

For each story, reread every sentence against your sources and cut anything you cannot point to. Then end with a short summary: ids written, and any road where material was too thin (write the story anyway if you can say something true and specific; otherwise skip it and say why).

## Blocked pages
If a page returns 403 or will not load, do not rely on a WebFetch summary of it: that is a model's paraphrase, not the page. Base each claim on page text you actually fetched (Wikipedia API, FHWA, NPS, USFS, state DOT pages that load). Never list a source you did not fetch yourself. Report any blocked pages in your final notes.

## Order and practical notes
Never order moments or state anything from your own knowledge. If no source gives the driving order, follow the strip-map mile order in the material. Practical notes must be lasting facts (seasonal gates, unpaved stretches, vehicle limits), never a temporary closure with dates that will expire.
