# Private photo sync operations

Apply `npx wrangler d1 migrations apply rambleroo-db --remote` before deploying this version. Migration 0005 must run before the new Worker serves requests. The existing R2 bucket must be empty at rollout, or its existing bytes and this month's operations must be reconciled into D1 usage before enabling uploads. Never reset the counters on a redeployment.

The ceilings live in `src/lib/photo-limits.ts`, in decimal bytes. D1 reserves storage atomically before R2 writes. A trigger updates the running total in the same statement as the conditional insertion. All R2 operations reserve one monthly operation with a conditional atomic update; failed calls retain that charge. Deletes are conservatively counted as Class A as requested, even though Cloudflare currently lists deletes as free.

R2 and D1 do not share a transaction. Pending photo rows retain space after uncertain writes; a retry deletes the uncertain object before releasing and reserving space again. Each account has a D1 lock during mutations. A terminated Worker can leave a lock: this deliberately fails closed. Investigate the account's pending rows and R2 objects, confirm no request is still running, and reconcile them before removing a stale lock. Do not expire locks automatically.

Account cleanup enumerates the private prefix, counts each list and delete, and releases space only after confirmed deletion. On failure the account still disappears, the prefix is logged, and the running storage total retains leftover reservations even after rows cascade away. Operators must clean logged prefixes when operations are available, using the same metered path or charging every administrative call to the ledger, and only then reconcile retained bytes. Do not lower counters based solely on `SUM(photos.bytes)`: account deletion leftovers may still consume space.

Cloudflare's R2 free allowance is shared at account level. This Worker can cap only calls it makes and objects it reserves. For a no-overage deployment, verify:

- R2 uses Standard storage, with no Infrequent Access lifecycle transitions, public r2.dev access, public custom domains, or other writers/readers bypassing this Worker.
- Other buckets/services and administrative operations in this Cloudflare account do not consume the reserved allowance; if they do, reserve their usage too or lower these ceilings accordingly.
- Workers and D1 remain on the free plan. Cloudflare does not provide an R2 hard billing cap through this code.

Manual verification after migration and deployment:

1. Signed out, add a postcard photo and car picture. Verify there are no `/api/photos` requests and both survive reload offline.
2. Sign in and accept importing browser data. Verify JPEG uploads at most 1600 pixels on the long edge and 1.5 MB, then open the same account in a fresh browser. Both photos should appear without a reload after downloading into IndexedDB.
3. Sign out and sign into a second account. The first account's photo URL must return 404 for the second account; signed-out access must return 401. Check that guest data is restored.
4. In an isolated test database/bucket, seed each ceiling near its limit. Confirm 507/429 responses, the calm paused message (with next month's date for operations), retained local photos, no further photo requests after a limit until app restart, and no R2 put on a refused upload. Do not change production usage to simulate a limit.
5. Remove/replace a photo and clear photos while offline, then reconnect/restart. Confirm removed remote objects disappear after sync, and unsynced original bytes remain local on upload failure.
6. Export an account and verify photo metadata without image bytes. Delete a test account and check its R2 prefix is empty; simulate R2 failure and verify account deletion succeeds with a leftover-prefix log and retained storage reservation.
7. Run `npx playwright test tests/e2e/photo-processing.spec.ts --project=desktop` (also mobile/iphone when those browsers are installed). This real-browser test inserts an APP1 Exif segment, runs the production canvas processor, and verifies the output contains no Exif and is resized. It cannot run in environments that prohibit binding the local test server.
