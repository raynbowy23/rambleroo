import { expect, it } from 'vitest'
import { layoutLabels, MAX_LABELS, printPanels } from './printPanels'
import type { StripData } from './types'
it('paginates dense places without losing endpoints, branches, stretches or gap notes', () => {
  const data = {
    main: { miles: 50, gaps: [{ atMile: 24, miles: 3 }] },
    branch: { miles: 5 },
    towns: [
      ...Array.from({ length: 20 }, (_, i) => ({ on: 'main', mile: i, name: `Town ${i}`, offRouteMiles: 0 })),
      { on: 'main', mile: 50, name: 'Finish', offRouteMiles: 0 },
      { on: 'branch', mile: 5, name: 'Branch end', offRouteMiles: 1 },
    ],
    moments: [{ on: 'main', mile: 25, title: 'Landmark', kind: 'view', offRouteMiles: 0 }],
    stretches: [{ on: 'main', fromMile: 0, toMile: 50, title: 'Whole road' }],
  } as unknown as StripData
  const panels = printPanels(data)
  // Dense miles get shorter panels so labels stay beside their own mile; nothing exceeds what a panel can hold.
  expect(panels.every((p) => p.entries.length <= MAX_LABELS)).toBe(true)
  expect(panels.filter((p) => p.on === 'main').some((p) => p.to - p.from < 25)).toBe(true)
  expect(panels.filter((p) => p.on === 'main' && p.stretches.some((s) => s.title === 'Whole road')).length).toBe(
    panels.filter((p) => p.on === 'main').length,
  )
  const labels = panels.flatMap((p) => p.entries.map((e) => e.label))
  expect(labels.filter((s) => s.startsWith('Town '))).toHaveLength(20)
  expect(labels.filter((s) => s.startsWith('Landmark'))).toHaveLength(1)
  expect(labels).toContain('Finish')
  expect(labels).toContain('Branch end · 1 mi off route')
  expect(labels.filter((s) => s.startsWith('Unmapped gap')).length).toBeGreaterThanOrEqual(1)
})

it('keeps labels at their mile when there is room and spreads them without overlap when there is not', () => {
  expect(layoutLabels([100, 300], 600, 50)).toEqual([100, 300])
  const crowded = layoutLabels([100, 101, 102, 590], 600, 50)
  crowded.slice(1).forEach((y, i) => expect(y - crowded[i]).toBeGreaterThanOrEqual(50))
  expect(Math.max(...crowded)).toBeLessThanOrEqual(575)
  expect(crowded[0]).toBe(100)
})
