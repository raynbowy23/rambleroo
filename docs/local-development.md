# Local development: accounts and sign-in

Accounts are optional and use Better Auth's built-in Kysely support for D1 ([Better Auth's database docs](https://better-auth.com/docs/concepts/database)). People sign in with Google, a single-use email link (sent through Resend and guarded by Turnstile), or a passkey. There are no passwords. Migrations are checked in and never run on a request, so apply them before serving account requests.

An account stores four JSON documents (passport, trip, garage, postcards), each limited to 256 KiB. Their `updated_at` values act as optimistic concurrency tokens. The garage and postcards merge by picking the newer whole document by its `updatedAt`, so device clocks can decide those conflicts. Photos you add yourself sync to a private R2 bucket within the ceilings in `src/lib/photo-limits.ts`; [docs/photo-sync.md](photo-sync.md) covers operating that safely.

To run the Worker and sign-in locally, use Node 22.13 or later (Node 23 works with the `--experimental-sqlite` flag that `vitest.config.ts` already sets for the Worker tests), run `npm install`, and create `.dev.vars` in the repository root. It is gitignored. Never commit real values.

```dotenv
AUTH_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your-development-google-client-id
GOOGLE_CLIENT_SECRET=your-development-google-client-secret
BETTER_AUTH_SECRET=use-a-random-secret-of-at-least-32-characters
```

Email-link sign-in also reads `RESEND_API_KEY` and `TURNSTILE_SECRET`. Register `http://localhost:5173/api/auth/callback/google` as an authorized redirect URI on your development Google OAuth client. Use **localhost**, not a LAN hostname, because session cookies are always Secure and browsers make an exception only for localhost. `AUTH_URL` must be the origin the browser sees, not port 8787.

```sh
npx wrangler d1 migrations apply rambleroo-db --local
npm run build
npx wrangler dev --port 8787
```

In another terminal run `npm run dev` and open `http://localhost:5173`. Vite proxies `/api` to Wrangler on port 8787 and keeps the browser origin. If Vite picks a different port, update `AUTH_URL` and the Google redirect URI to match and restart Wrangler. Local D1 is separate from production.

How sync behaves: on the first sign-in in a browser, existing browser data can be imported or left local. Signed-in edits are saved after 1.5 seconds. Pending writes and their base versions are kept per account in localStorage and retried after reconnecting, on the next sign-in, or with "Retry sync". A 409 merges and retries once, and a second conflict waits for an explicit retry. Signed-out browser data is backed up separately and restored on sign-out. Account export waits for pending changes, then downloads the server's copy, which lists photos and shares.

Automated tests never call Google. When you change account code, check by hand with real development credentials:

- the Google callback succeeds, and the session cookie is Secure, HttpOnly and SameSite=Lax with a 60-day lifetime
- the first-sign-in import can be accepted or declined
- a second browser loads all four documents, and simultaneous edits merge as described above
- offline changes survive a reload and sync on reconnect
- sign-out restores browser-only data
- export contains the expected records and no tokens
- typed deletion removes the user, session, account and user_data rows and signs the other browser out

See also [Deploying your own copy](deployment.md).
