import { firstPhoto } from '../../lib/data'
import { PhotoLettering } from './PhotoPostcard'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Scene, Stamp } from '../../components/art'
import type { BywaySummary, BywayStory, Photo } from '../../lib/types'
import { illustrationCaption, listingDescription } from '../../lib/format'
import { renderPostcard } from './download'

export async function renderBywayPostcard(byway: BywaySummary, story?: BywayStory | null, note = '', photo?: Photo) {
  photo ??= firstPhoto([byway.id])
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:840px;pointer-events:none'
  host.inert = true
  host.setAttribute('aria-hidden', 'true')
  document.body.append(host)
  const root = createRoot(host)
  try {
    flushSync(() =>
      root.render(
        <>
          <div data-postcard-scene>
            <Scene
              family={byway.scene}
              seed={byway.seed}
              region={byway.region}
              motifs={story?.motifs}
              look={byway.look}
              lettering={{ title: byway.name, subtitle: byway.states.join(' · ') }}
              framed
              variant="postcard"
            />
          </div>
          {photo && (
            <div data-photo-lettering>
              <PhotoLettering name={byway.name} states={byway.states.join(' · ')} family={byway.scene} look={byway.look} />
            </div>
          )}
          <div data-postcard-stamp>
            <Stamp
              family={byway.scene}
              seed={byway.seed}
              region={byway.region}
              motifs={story?.motifs}
              look={byway.look}
              title={byway.name}
            />
          </div>
        </>,
      ),
    )
    const scene = host.querySelector<SVGSVGElement>('[data-postcard-scene] svg')!
    const stamp = host.querySelector<SVGSVGElement>('[data-postcard-stamp] svg')!
    return await renderPostcard({
      scene,
      lettering: host.querySelector<SVGSVGElement>('[data-photo-lettering] svg') ?? undefined,
      stamp,
      id: byway.id,
      name: byway.name,
      message: story?.tagline ?? listingDescription(byway),
      note,
      photo,
      postmark: `${byway.states[0] ?? 'USA'} · ${new Date().toLocaleDateString('en-US')}`,
      caption: illustrationCaption(byway.name, byway.region, story?.motifs),
    })
  } finally {
    root.unmount()
    host.remove()
  }
}
