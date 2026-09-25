import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Motif, Region } from '../../lib/types'
import { Scene } from './Scene'
import { Stamp } from './Stamp'
import { landmarks } from './motifs'
import { regions } from './regions'

function documentFor(markup: string) {
  return new DOMParser().parseFromString(markup, 'text/html')
}

describe('location illustrations', () => {
  it('renders every landmark in every format with finite geometry and local references', () => {
    for (const motif of Object.keys(landmarks) as Motif[]) {
      for (const variant of ['hero', 'postcard', 'cover', 'stamp', 'thumb'] as const) {
        const markup = renderToStaticMarkup(<Scene family={landmarks[motif].family} motifs={[motif]} seed={42} variant={variant} />)
        expect(markup).not.toMatch(/NaN|Infinity/)
        const doc = documentFor(markup)
        expect(doc.querySelector(`[data-motif="${motif}"]`)).not.toBeNull()
        for (const match of markup.matchAll(/url\(#([^)]+)\)/g)) {
          expect(doc.getElementById(match[1])).not.toBeNull()
        }
      }
    }
  })

  it('keeps regions distinct and repeated inputs deterministic', () => {
    const samples = (Object.keys(regions) as Region[]).map((region) => {
      const scene = <Scene family="coast" region={region} seed={7} />
      const markup = renderToStaticMarkup(scene)
      expect(renderToStaticMarkup(scene)).toBe(markup)
      return markup
    })
    expect(new Set(samples).size).toBe(15)
    expect(renderToStaticMarkup(<Scene family="river" seed={7} motifs={[]} />)).toBe(
      renderToStaticMarkup(<Scene family="river" seed={7} />),
    )
  })

  it('limits distinct landmarks to three and paints the hero last', () => {
    const markup = renderToStaticMarkup(
      <Scene family="river" seed={1} motifs={['paddlewheeler', 'sandbars', 'sandbars', 'lock-and-dam', 'lighthouse']} />,
    )
    const motifs = [...documentFor(markup).querySelectorAll('[data-motif]')].map((el) => el.getAttribute('data-motif'))
    expect(motifs).toEqual(['lock-and-dam', 'sandbars', 'paddlewheeler'])
  })

  it('combines offshore rock and lighthouse in either priority order', () => {
    for (const motifs of [
      ['lighthouse', 'sea-rock'],
      ['sea-rock', 'lighthouse'],
    ] as Motif[][]) {
      const doc = documentFor(renderToStaticMarkup(<Scene family="coast" seed={7} motifs={motifs} />))
      expect(doc.querySelectorAll('[data-motif]')).toHaveLength(1)
      expect(doc.querySelector('[data-motif]')?.getAttribute('data-motif')).toBe(motifs[0])
    }
  })

  it('keeps SVG references unique when many stamps share a scene', () => {
    const markup = renderToStaticMarkup(
      <div>
        {Array.from({ length: 60 }, (_, i) => (
          <Stamp key={i} family="coast" region="california" motifs={['arch-bridge']} seed={7} visited />
        ))}
      </div>,
    )
    const doc = documentFor(markup)
    const ids = [...doc.querySelectorAll('[id]')].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(doc.querySelectorAll('[data-motif="arch-bridge"]')).toHaveLength(60)
    expect(doc.querySelectorAll('.rr-cancel')).toHaveLength(60)
    expect(doc.querySelectorAll('filter')).toHaveLength(0)
  })

  it('preserves labels, decorative behavior and the opt-in motion class', () => {
    const labeled = documentFor(renderToStaticMarkup(<Scene family="river" seed={1} title="River country" animate />))
    const svg = labeled.querySelector('svg')!
    expect(labeled.getElementById(svg.getAttribute('aria-labelledby')!)?.textContent).toBe('River country')
    expect(svg.classList.contains('rr-animate')).toBe(true)
    const decorative = documentFor(renderToStaticMarkup(<Scene family="river" seed={1} />)).querySelector('svg')!
    expect(decorative.getAttribute('aria-hidden')).toBe('true')
    expect(decorative.classList.contains('rr-animate')).toBe(false)
  })
})
