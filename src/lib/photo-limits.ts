export const PHOTO_LIMITS = {
  storedBytes: 9_000_000_000,
  classA: 800_000,
  classB: 8_000_000,
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
