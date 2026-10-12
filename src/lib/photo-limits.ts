// The account's free R2 allowance (10 GB stored, 1 million Class A and 10 million Class B operations a month) is shared with the public
// photo library bucket (infra/README.md), which holds about 2 GB and is read only on Cloudflare cache misses. These ceilings leave it
// 3 GB and 4 million reads.
export const PHOTO_LIMITS = {
  storedBytes: 7_000_000_000,
  classA: 800_000,
  classB: 6_000_000,
  userCount: 60,
  userBytes: 60_000_000,
  photoBytes: 1_500_000,
} as const
export const PHOTO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function photoMonth(now = new Date()) {
  return {
    month: now.toISOString().slice(0, 7),
    resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
  }
}
export const fits = (used: number, added: number, limit: number) => Number.isSafeInteger(added) && added >= 0 && used <= limit - added
