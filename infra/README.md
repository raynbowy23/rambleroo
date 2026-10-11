# Cloudflare setup outside wrangler.jsonc

`rambleroo-library` is the public R2 bucket for the photo library (road, town and story-place photos credited in content/photos.json), served at https://photos.rambleroo.app. The Worker does not bind it: pages load photos straight from that domain, so views cost no Worker requests and cached views cost no R2 reads. Photos are uploaded with `npm run photos:upload` after a photo script has downloaded them into `public/photos/` (which is gitignored).

Its CORS rule (library-cors.json, applied with `npx wrangler r2 bucket cors set rambleroo-library --file infra/library-cors.json`) allows GET and HEAD from any origin with no credentials. The photos are public and read-only, so a wildcard exposes nothing a plain `<img>` could not already load; it lets the app read pixels (postcard export, offline cache) from rambleroo.app, local development on any port and phone testing on a LAN address alike.

`rambleroo-photos` is the separate private bucket for people's own synced photos, bound to the Worker as PHOTOS; see docs/photo-sync.md. Both share the account's free R2 allowance, which is why PHOTO_LIMITS.storedBytes leaves room for the library.
