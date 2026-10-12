import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import catalog from '../../../../public/data/catalog.json'
import type { BywaySummary } from '../../../lib/types'
import DioramaGallery from './DioramaGallery'

vi.mock('../../../lib/data', () => ({
  useCatalog: () => ({ status: 'ready', byways: catalog.byways, byId: new Map(catalog.byways.map((byway) => [byway.id, byway])) }),
  useStory: () => ({ story: undefined }),
}))
vi.mock('../../../features/strip/data', () => ({ useStrip: () => ({ data: { towns: [{ name: 'One' }, { name: 'Two' }] } }) }))
afterEach(cleanup)

it('shows twelve real roads covering every scene family and the full comparison strips', () => {
  const { container } = render(<DioramaGallery />)
  const grid = screen.getByRole('region', { name: 'Twelve roads at the current time' })
  const roads = [...grid.querySelectorAll('svg')]
  expect(roads).toHaveLength(12)
  expect(new Set(roads.map((svg) => svg.getAttribute('data-family'))).size).toBe(7)
  expect(screen.getByRole('region', { name: 'From first light to lights on' }).querySelectorAll('svg')).toHaveLength(6)
  expect(screen.getByRole('region', { name: 'A change in the weather' }).querySelectorAll('svg')).toHaveLength(5)
  expect(screen.getByRole('region', { name: 'The year along the road' }).querySelectorAll('svg')).toHaveLength(4)
  const road = (catalog.byways as BywaySummary[]).find((byway) => byway.id === 'scenic-byway-12-2020')!
  fireEvent.change(screen.getByRole('combobox'), { target: { value: road.id } })
  expect(screen.getByRole('region', { name: 'From first light to lights on' }).querySelector('svg')?.getAttribute('aria-label')).toBe(
    `${road.name}: 6:00`,
  )
  expect(container.querySelector('animateMotion')).toBeNull()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Gentle motion' }))
  expect(container.querySelectorAll('animateMotion')).toHaveLength(27)
})
