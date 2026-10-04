# Contributing

Thanks for helping. Rambleroo is a small personal project, so issues are the best place to start: a road that is drawn wrong, a place in the wrong spot, a photo credit, a bug, or an idea. Use the templates at https://github.com/raynbowy23/rambleroo/issues/new/choose and please leave out personal details, because issues are public.

Pull requests are welcome for fixes. Before opening one:

- `npm install`, then `npm run dev` for the app (see the README for running the Worker and sign-in locally).
- `npx tsc -b`, `npx vitest run` and `npx prettier --check src worker tests` must pass; CI runs the same checks. `npm run test:e2e` runs the Playwright suite.
- Keep the data honest: road lines, places and drive times come from cited sources (USDOT, WisDOT, Wikipedia, OpenStreetMap). Don't add numbers or places that can't be traced to one.
- Never commit secrets. Local secrets go in `.dev.vars`, which is ignored.

By contributing you agree that code is licensed under MIT and written content under CC BY-NC 4.0, as described in the README.
