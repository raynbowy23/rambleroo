# Road stories

Stories follow the owner's style guide, `STYLE.md` (historically grounded travel journalism). Each overview opens with the drive itself (what the road looks like, how it drives, why it is a scenic byway), then the road's history, then comes back to the drive from end to end. Every claim must trace to a saved source.

Pipeline, from the repo root (W is a work dir outside the repo, one per batch of about five roads):

1. `python3 scripts/stories/material.py W <id> ...` writes W/material; put the ids in W/batch.txt and copy the current stories to W/current.
2. `python3 scripts/stories/prefetch.py W W/batch.txt` saves the source pages to W/cache (Codex has no network). Add a story's own listed sources and, for national byways, the archived America's Byways page. Check new domains by eye: some old byway sites now serve spam.
3. Copy `STYLE.md`, `CODEX_BRIEF.md` (as the prompt) and `verify.py` into W and run Codex there as a background task with W as its working directory. Codex writes W/out/<id>.json with an evidence quote for every claim.
4. `python3 scripts/stories/verify.py W` checks every quote against its cache file, lengths, banned words and punctuation, and lists every hedge so a person can confirm the source hedges too. Read the stories before installing.
5. `python3 scripts/stories/install_v2.py W ...` writes content/stories (reader-facing fields only) and content/story-notes (evidence and editorial flags, never loaded by the app). Rerun `npx tsx scripts/photos/split.ts` if it says photos changed, and `npx tsx scripts/dioramas/generate.ts` for the miniatures.

Stories not yet rewritten carry `"draft": true`, which shows a "Draft story" label on the byway page and postcard. install_v2.py writes the story afresh, so a rewritten story loses the flag.
