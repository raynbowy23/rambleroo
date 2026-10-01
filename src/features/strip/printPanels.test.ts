import { expect, it } from 'vitest'
import { printPanels } from './printPanels'
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
  expect(panels.every((p) => p.entries.length <= 8)).toBe(true)
  expect(panels.some((p) => p.continuation > 0)).toBe(true)
  const labels = panels.flatMap((p) => p.entries.map((e) => e.label))
  expect(labels.filter((s) => s.startsWith('Town '))).toHaveLength(20)
  expect(labels.filter((s) => s.startsWith('Landmark'))).toHaveLength(1)
  expect(labels).toContain('Finish')
  expect(labels).toContain('Branch end · 1 mi off route')
  expect(labels.filter((s) => s.startsWith('Unmapped gap'))).toHaveLength(2)
})
