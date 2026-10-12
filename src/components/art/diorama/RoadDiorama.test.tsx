import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import catalog from '../../../../public/data/catalog.json'
import type { BywayStory, BywaySummary, Motif, SceneFamily } from '../../../lib/types'
import { landmarks } from '../motifs'
import { RoadDiorama } from './RoadDiorama'
import { environment, selectMotifs } from './environment'

const byways = catalog.byways as BywaySummary[]
const byway = byways.find((road) => road.scene === 'coast')!
const now = new Date('2026-06-21T18:00:00Z')
const story = (motifs: Motif[]): BywayStory => ({ id: byway.id, motifs, tagline: '', intro: [], moments: [], sources: [], reviewed: true })
const documentFor = (markup: string) => new DOMParser().parseFromString(markup, 'text/html')
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('RoadDiorama', () => {
  it('renders every catalog road with finite attributes and fewer than 600 SVG nodes', () => {
    for (const road of byways) {
      const markup = renderToStaticMarkup(<RoadDiorama byway={road} now={now} />)
      expect(markup, road.id).not.toMatch(/NaN|Infinity|undefined/)
      expect((markup.match(/<[a-zA-Z]/g) ?? []).length, road.id).toBeLessThan(600)
      expect(markup).toContain(`data-family="${road.scene}"`)
    }
  }, 20_000)

  it('is deterministic for identical inputs, including weather and story', () => {
    const props = { byway, now, weather: 'snow' as const, story: story(['lighthouse', 'sea-rock', 'arch-bridge']), towns: ['A', 'B'] }
    expect(renderToStaticMarkup(<RoadDiorama {...props} />)).toBe(renderToStaticMarkup(<RoadDiorama {...props} />))
    expect(renderToStaticMarkup(<RoadDiorama {...props} byway={{ ...byway, seed: byway.seed + 1 }} />)).not.toBe(
      renderToStaticMarkup(<RoadDiorama {...props} />),
    )
  })

  it('renders every motif, weather, season and light phase with finite geometry', () => {
    for (const motif of Object.keys(landmarks) as Motif[]) {
      for (const weather of ['clear', 'cloudy', 'rain', 'snow', 'fog'] as const) {
        const markup = renderToStaticMarkup(
          <RoadDiorama byway={byway} now={now} hour={23} weather={weather} story={story([motif])} towns={Array(20).fill('Town')} />,
        )
        expect(markup).not.toMatch(/NaN|Infinity/)
        expect(markup).toContain(`data-motif="${motif}"`)
        expect((markup.match(/<[a-zA-Z]/g) ?? []).length).toBeLessThan(600)
      }
    }
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      const samples = [6, 9, 13, 18, 20, 23].map((hour) =>
        renderToStaticMarkup(<RoadDiorama byway={byway} now={now} season={season} hour={hour} />),
      )
      expect(new Set(samples).size).toBe(6)
      for (const sample of samples) expect(sample).not.toMatch(/NaN|Infinity/)
    }
  })

  it('adds lit windows, a lighthouse beam and headlights at night', () => {
    const props = { byway, now, story: story(['lighthouse']) }
    const day = documentFor(renderToStaticMarkup(<RoadDiorama {...props} hour={13} />))
    const night = documentFor(renderToStaticMarkup(<RoadDiorama {...props} hour={23} />))
    for (const selector of ['[data-lit-window]', '[data-lighthouse-beam]', '[data-headlights]']) {
      expect(day.querySelector(selector)).toBeNull()
      expect(night.querySelector(selector)).not.toBeNull()
    }
  })

  it('removes animation under reduced motion and responds when the preference changes', () => {
    let onChange = () => {}
    const query = {
      matches: false,
      addEventListener: vi.fn((_event, callback) => {
        onChange = callback
      }),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => query),
    )
    const { container, unmount } = render(<RoadDiorama byway={byway} now={now} animate weather="rain" />)
    expect(container.querySelector('animateMotion')).not.toBeNull()
    act(() => {
      query.matches = true
      onChange()
    })
    expect(container.querySelector('animateMotion')).toBeNull()
    expect(container.querySelector('.rr-diorama-motion')).toBeNull()
    unmount()
    expect(query.removeEventListener).toHaveBeenCalled()
    const reduced = render(<RoadDiorama byway={byway} now={now} animate />)
    expect(reduced.container.querySelector('animateMotion')).toBeNull()
  })

  it('defaults to still art and exposes a label only when supplied', () => {
    const decorative = documentFor(renderToStaticMarkup(<RoadDiorama byway={byway} now={now} />))
    expect(decorative.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(decorative.querySelector('animateMotion')).toBeNull()
    const labeled = documentFor(renderToStaticMarkup(<RoadDiorama byway={byway} now={now} title="A little coastal road" />))
    expect(labeled.querySelector('svg')?.getAttribute('aria-label')).toBe('A little coastal road')
    expect(labeled.querySelector('svg')?.getAttribute('role')).toBe('img')
  })

  it('caps town blocks and deduplicates landmarks in editorial priority order', () => {
    for (const count of [0, 1, 3, 20]) {
      const doc = documentFor(renderToStaticMarkup(<RoadDiorama byway={byway} now={now} towns={Array(count).fill('Town')} />))
      expect(doc.querySelectorAll('[data-town-block]')).toHaveLength(Math.min(5, count))
    }
    const enriched = {
      ...story(['lighthouse', 'lighthouse']),
      moments: [
        {
          title: 'Mill',
          text: '',
          kind: 'short walk' as const,
          scene: 'forest' as const,
          motifs: ['gristmill', 'arch-bridge', 'hoodoos'] as Motif[],
        },
      ],
    }
    expect(selectMotifs(enriched)).toEqual(['lighthouse', 'gristmill', 'arch-bridge'])
    expect(selectMotifs({ ...story([]), moments: [{ title: 'Town', text: '', kind: 'town', scene: 'prairie' }] })).toEqual(['steeple-town'])
  })

  it('keeps a heavily dressed forest within the node budget', () => {
    const forest = { ...byway, scene: 'forest' as SceneFamily }
    const markup = renderToStaticMarkup(
      <RoadDiorama
        byway={forest}
        now={now}
        towns={Array(50).fill('Town')}
        story={story(['harbor-village', 'limestone-ledges', 'aspens'])}
        weather="snow"
        animate
      />,
    )
    expect(documentFor(markup).querySelectorAll('svg *').length).toBeLessThan(600)
  })
})

describe('diorama environment', () => {
  it('uses longitude for solar time, wraps 24h, and shifts southern seasons', () => {
    const northern = { ...byway, center: [-90, 40] as [number, number] }
    expect(environment(northern, now).hour).toBe(12)
    expect(environment(northern, now, 24).hour).toBe(0)
    expect(environment(northern, now).season).toBe('summer')
    expect(environment({ ...northern, center: [-90, -40] }, now).season).toBe('winter')
    expect(environment({ ...northern, center: [150, 40] }, new Date('2026-02-28T20:00:00Z')).season).toBe('spring')
  })

  it('softens winter in warm regions but respects explicit snow weather', () => {
    const warm = { ...byway, region: 'florida' as const }
    expect(environment(warm, now, 13, 'winter').snow).toBe(false)
    expect(environment(warm, now, 13, 'winter', 'snow').snow).toBe(true)
    expect(environment({ ...warm, region: 'alaska' }, now, 13, 'winter').snow).toBe(true)
  })
})
