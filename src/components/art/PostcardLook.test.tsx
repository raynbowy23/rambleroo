import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PostcardLook, Region, SceneFamily } from '../../lib/types'
import { Scene } from './Scene'
import { Stamp } from './Stamp'
import ArtGallery from './ArtGallery'

const look: PostcardLook = { layout: 0, palette: 0, season: 'summer', time: 'day', lettering: 'greetings', border: 'white', mirror: false }
const families: SceneFamily[] = ['river', 'coast', 'mountain', 'forest', 'desert', 'town', 'prairie']
function render(overrides: Partial<PostcardLook> = {}, family: SceneFamily = 'coast', region?: Region) {
  return new DOMParser().parseFromString(
    renderToStaticMarkup(<Scene family={family} region={region} seed={42} look={{ ...look, ...overrides }} />),
    'text/html',
  )
}

describe('postcard art direction', () => {
  it('changes actual terrain geometry for all three layouts in every family, including regional cards', () => {
    for (const family of families) {
      const geometry = [0, 1, 2].map((layout) =>
        [...render({ layout }, family, 'florida').querySelectorAll('[data-layout] path')].map((path) => path.getAttribute('d')).join('|'),
      )
      expect(new Set(geometry).size).toBe(3)
    }
  })

  it('changes terrain inks for all four palettes and all four seasons in every family', () => {
    for (const family of families) {
      for (const dimension of ['palette', 'season'] as const) {
        const options = dimension === 'palette' ? [0, 1, 2, 3] : ['spring', 'summer', 'autumn', 'winter']
        const inks = options.map((value) =>
          [...render({ [dimension]: value }, family).querySelectorAll('[data-layout] [fill]')]
            .map((el) => el.getAttribute('fill'))
            .join('|'),
        )
        expect(new Set(inks).size).toBe(4)
      }
    }
  })

  it('uses regional winter equivalents and reserves snow for colder regions', () => {
    for (const region of ['florida', 'hawaii', 'southwest', 'deep-south'] as Region[]) {
      expect(render({ season: 'winter' }, 'coast', region).querySelector('[fill="#e8e4d4"]')).toBeNull()
    }
    expect(render({ season: 'winter' }, 'prairie', 'great-plains').querySelector('[fill="#e8e4d4"]')).not.toBeNull()
    expect(
      render({ season: 'winter' }, 'town', 'new-england').querySelectorAll('[data-season-tree] path[fill="none"]').length,
    ).toBeGreaterThan(0)
  })

  it('changes the sky and sun for time of day and lights town windows at dusk', () => {
    const skies = ['dawn', 'day', 'golden', 'dusk'].map(
      (time) => render({ time: time as PostcardLook['time'] }).querySelector('linearGradient')!.innerHTML,
    )
    expect(new Set(skies).size).toBe(4)
    expect(render({ time: 'dusk' }, 'town').querySelector('[fill="#f4cf78"]')).not.toBeNull()
    expect(render({ time: 'dusk' }).querySelector('circle.rr-sun')).toBeNull()
    expect(render({ time: 'dawn' }).querySelector('circle.rr-sun')?.getAttribute('cy')).not.toBe(
      render().querySelector('circle.rr-sun')?.getAttribute('cy'),
    )
  })

  it('mirrors geometry without mirroring lettering, and gates printed finishes by format', () => {
    for (const variant of ['postcard', 'cover', 'hero', 'stamp', 'thumb'] as const) {
      const doc = new DOMParser().parseFromString(
        renderToStaticMarkup(
          <Scene
            family="coast"
            seed={7}
            variant={variant}
            look={{ ...look, mirror: true }}
            lettering={{ title: 'Florida A1A Scenic Coastal Highway', subtitle: 'Florida' }}
            framed
          />,
        ),
        'text/html',
      )
      const mirrored = doc.querySelector('[transform="translate(400 0) scale(-1 1)"]')
      // Heroes never mirror: their left side is reserved for the page title.
      if (variant === 'hero') expect(mirrored).toBeNull()
      else {
        expect(mirrored).not.toBeNull()
        expect(mirrored!.querySelector('text')).toBeNull()
      }
      const printed = variant === 'postcard' || variant === 'cover'
      expect(Boolean(doc.querySelector('[data-lettering]'))).toBe(printed)
      expect(Boolean(doc.querySelector('[data-border]'))).toBe(printed)
    }
    expect(renderToStaticMarkup(<Scene family="river" seed={1} lettering={{ title: 'No look supplied' }} />)).not.toContain(
      'data-lettering',
    )
    expect(renderToStaticMarkup(<Scene family="river" seed={1} look={look} />)).not.toContain('data-border')
    expect(renderToStaticMarkup(<Stamp family="forest" look={{ ...look, layout: 2 }} />)).toContain('data-layout="forest-2"')
  })

  it('keeps local references unique and geometry finite across a full shelf of finished cards', () => {
    const markup = renderToStaticMarkup(
      <div>
        {Array.from({ length: 40 }, (_, i) => (
          <Scene
            key={i}
            family={families[i % 7]}
            seed={i}
            look={{
              ...look,
              layout: i % 3,
              palette: i % 4,
              border: (['white', 'deckle', 'linen', 'scallop'] as const)[i % 4],
              lettering: (['greetings', 'ribbon', 'block', 'script', 'banner'] as const)[i % 5],
            }}
            lettering={{ title: 'A Very Long Scenic Coastal Road Name', subtitle: 'A road worth remembering' }}
            framed
            motifs={['steeple-town']}
          />
        ))}
      </div>,
    )
    const doc = new DOMParser().parseFromString(markup, 'text/html')
    const ids = [...doc.querySelectorAll('[id]')].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const match of markup.matchAll(/url\(#([^)]+)\)/g)) expect(doc.getElementById(match[1])).not.toBeNull()
    expect(markup).not.toMatch(/NaN|Infinity/)
    expect(doc.querySelectorAll('filter')).toHaveLength(0)
    expect(doc.querySelectorAll('[data-lettering]')).toHaveLength(40)
    for (const text of doc.querySelectorAll('[data-lettering] text[textLength]'))
      expect(Number(text.getAttribute('textLength'))).toBeLessThanOrEqual(336)
    expect(doc.querySelectorAll('[data-motif="steeple-town"]')).toHaveLength(40)
  })

  it('shows 24 lettered examples, starting with three different Florida coast layouts', () => {
    const doc = new DOMParser().parseFromString(renderToStaticMarkup(<ArtGallery />), 'text/html')
    const cards = doc.querySelectorAll('.rr-gallery-variety figure')
    expect(cards).toHaveLength(24)
    expect(doc.querySelectorAll('.rr-gallery-variety [data-lettering]')).toHaveLength(24)
    expect([...cards].slice(0, 3).map((card) => card.querySelector('[data-layout]')?.getAttribute('data-layout'))).toEqual([
      'coast-0',
      'coast-1',
      'coast-2',
    ])
  })
})
