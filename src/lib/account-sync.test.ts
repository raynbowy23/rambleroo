import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountSync, emptyMap, type Journal } from './account-sync'
import type { Documents } from './account-data'
const empty = (): Documents => ({
  passport: { version: 1, saved: {}, visits: [], savedStretches: [], postcards: [] },
  trip: { version: 1, roads: [] },
  garage: {
    version: 1,
    updatedAt: 0,
    car: { model: 'coupe', body: '#ee7430', accent: 'none', accentColor: '#f5e6c8', roof: 'none', plate: 'RAMBLE' },
  },
  postcards: { version: 1, updatedAt: 0, cards: {} },
})
const road = (bywayId: string) => ({ bywayId, addedAt: '2026-10-04T00:00:00.000Z' })
function setup(responses: (() => Promise<Response>)[] = []) {
  let docs = empty()
  let journal: Journal | undefined
  const status = vi.fn()
  const fetcher = vi.fn(async () => responses.shift()?.() ?? Response.json(emptyMap()))
  const engine = new AccountSync(
    'one',
    {
      read: () => docs,
      apply: (kind, document) => {
        docs = { ...docs, [kind]: document }
      },
      save: (value) => {
        journal = structuredClone(value)
      },
      status,
      fetch: fetcher,
    },
    empty(),
  )
  return {
    engine,
    fetcher,
    status,
    read: () => docs,
    journal: () => journal,
    edit: (ids: string[]) => {
      docs = { ...docs, trip: { version: 1, roads: ids.map(road) } }
      engine.changed()
    },
  }
}
afterEach(() => vi.useRealTimers())
describe('account sync', () => {
  it('declining an import loads empty server data without uploading local data', async () => {
    const test = setup()
    test.edit(['local'])
    await test.engine.load(async () => false)
    expect(test.read().trip.roads).toEqual([])
    expect(test.journal()?.dirty).toEqual([])
    test.engine.stop()
  })
  it('debounces changes, sends the base and persists pending work', async () => {
    vi.useFakeTimers()
    const test = setup([
      async () => Response.json(emptyMap()),
      async () => Response.json({ json: { version: 1, roads: [road('b')] }, updatedAt: 5 }),
    ])
    await test.engine.load(async () => false)
    test.edit(['a'])
    test.edit(['b'])
    expect(test.journal()?.dirty).toEqual(['trip'])
    await vi.advanceTimersByTimeAsync(1499)
    expect(test.fetcher).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(test.fetcher).toHaveBeenCalledTimes(2)
    expect(test.journal()?.dirty).toEqual([])
    test.engine.stop()
  })
  it('merges a conflict and retries only once', async () => {
    const remote = { json: { version: 1, roads: [road('server')] }, updatedAt: 10 }
    const test = setup([
      async () => Response.json(emptyMap()),
      async () => Response.json({ server: remote }, { status: 409 }),
      async () => Response.json({ server: remote }, { status: 409 }),
    ])
    await test.engine.load(async () => false)
    test.edit(['local'])
    await test.engine.flush()
    expect(test.fetcher).toHaveBeenCalledTimes(3)
    expect(test.read().trip.roads.map((r) => r.bywayId)).toEqual(['local', 'server'])
    expect(test.journal()?.dirty).toEqual(['trip'])
    expect(test.status).toHaveBeenLastCalledWith(expect.stringContaining('Another device'))
    test.engine.stop()
  })
  it('replays offline deletions against their unchanged base after reload', async () => {
    const base = { ...emptyMap(), trip: { json: { version: 1 as const, roads: [road('deleted')] }, updatedAt: 10 } }
    const test = setup([async () => Response.json(base)])
    await test.engine.load(async () => false, { documents: empty(), base, dirty: ['trip'] })
    expect(test.read().trip.roads).toEqual([])
    expect(test.journal()?.dirty).toEqual(['trip'])
    test.engine.stop()
  })
  it('ignores an in-flight response after the account is disconnected', async () => {
    let finish!: (response: Response) => void
    const test = setup([
      async () => Response.json(emptyMap()),
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    ])
    await test.engine.load(async () => false)
    test.edit(['local'])
    const flushing = test.engine.flush()
    test.engine.stop()
    finish(Response.json({ server: { json: { version: 1, roads: [road('other')] }, updatedAt: 10 } }, { status: 409 }))
    await flushing
    expect(test.read().trip.roads.map((r) => r.bywayId)).toEqual(['local'])
    expect(test.journal()?.dirty).toEqual(['trip'])
  })
})
