# Checking Rambleroo road stories

You fact-check stories another agent wrote. Do not modify anything in the repository. Work in the directory your prompt names as S. The writer's brief is scripts/stories/STORY.md in the repository.

For each id in your batch, read $S/out/<id>.json and its material $S/material/<id>.json, then:
1. Fetch every URL in the story's "sources" (and the material's fact sources as needed).
2. Check every sentence and every moment: each factual claim must be supported by one of those pages. Check each moment's "at" coordinates against the place's page (within about 2 km); delete "at" if unsupported.
3. Fix what is wrong. Prefer cutting or softening an unsupported claim over rewriting the voice; keep the warm, wry, unhurried tone (see STORY.md). Also enforce the style rules in STORY.md (no superlatives, em-dashes, exclamation marks, etc.) and the JSON format.
4. Write the checked story to $S/checked/<id>.json and append one line per story to $S/checked/log.txt (append only; never rewrite the file, other checkers share it): "<id> | ok" or "<id> | fixed: <what changed>" or "<id> | dropped: <why>" (drop only if too little true remains).

Never send personal information anywhere. Use User-Agent "Rambleroo/0.1 (story check; https://rambleroo.app; https://github.com/raynbowy23/rambleroo/issues)". End with a short summary.

## Source URLs
Every source URL must start with https:// (use https://web.archive.org/... for Wayback snapshots). The installer rejects http links.
