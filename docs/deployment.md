# Deploying your own copy

To deploy your own copy you need your own Cloudflare account (a Worker, a D1 database and an R2 bucket), a Google OAuth client, a Resend sending domain and a Turnstile widget. Then:

- in `wrangler.jsonc`, set `AUTH_URL`, `GOOGLE_CLIENT_ID`, the routes, the D1 `database_id` and the R2 bucket name
- set the Turnstile site key in `src/features/account/SignInDialog.tsx` and the sign-in email sender in `worker/auth.ts`
- set the analytics ID in `src/lib/analytics.ts`, or remove it
- set `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY` and `TURNSTILE_SECRET` with `wrangler secret put`
- apply migrations with `npx wrangler d1 migrations apply rambleroo-db --remote`, then `npm run deploy`

For running the Worker and sign-in on your machine first, see [Local development](local-development.md).
