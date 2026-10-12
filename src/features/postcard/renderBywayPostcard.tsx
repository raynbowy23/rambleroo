import { loadCarPicture } from '../../lib/carPicture'
import { loadFirstPhoto } from '../../lib/data'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Stamp } from '../../components/art'
import type { BywaySummary, BywayStory, Photo } from '../../lib/types'
import { listingDescription } from '../../lib/format'
import { renderPostcard } from './download'
import { CardFront } from './CardFront'
import { cardKey, creditedPhoto, postcardDefaults, usePostcards } from '../../lib/postcards'
import { useGarage } from '../../lib/garage'
import { userPhotos } from '../../lib/userPhotos'
import { cardTitle, loadCardRoute, milestoneMessage, type Milestone } from './cardData'

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
export async function renderBywayPostcard(byway: BywaySummary, story?: BywayStory | null, note = '', photo?: Photo, milestone?: Milestone) {
  photo = milestone ? milestone.photo : (photo ?? (await loadFirstPhoto([byway.id])))
  const choices = usePostcards.getState().cards[cardKey(byway.id, milestone?.id)] ?? {
    ...postcardDefaults(photo, milestone ? 'greetings' : byway.look.lettering),
    note,
  }
  const credit = creditedPhoto(choices, photo)
  const route = choices.route ? await loadCardRoute(byway.id, milestone) : undefined
  let ownUrl: string | undefined
  if (choices.front === 'own') {
    const blob = choices.userPhotoId ? await userPhotos.get(choices.userPhotoId) : undefined
    if (!blob) throw new Error('Choose your photo before exporting this card.')
    ownUrl = await dataUrl(blob)
  }
  const garage = useGarage.getState()
  const pictureUrl = garage.usePicture && garage.picture ? await loadCarPicture(garage.picture) : undefined
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
            <CardFront
              byway={byway}
              story={story}
              photo={photo}
              choices={choices}
              garage={garage}
              pictureUrl={pictureUrl}
              milestone={milestone}
              route={route}
              ownUrl={ownUrl}
            />
          </div>
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
    // SVG images must be embedded before canvas decoding; no external resources survive SVG rasterization.
    for (const image of scene.querySelectorAll('image')) {
      const href = image.getAttribute('href')!
      if (href.startsWith('data:')) continue
      const response = await fetch(href)
      if (!response.ok) throw new Error('Photo unavailable')
      image.setAttribute('href', await dataUrl(await response.blob()))
    }
    return await renderPostcard({
      scene,
      stamp: host.querySelector<SVGSVGElement>('[data-postcard-stamp] svg')!,
      composedFront: true,
      id: cardKey(byway.id, milestone?.id),
      name: cardTitle(byway, milestone),
      message: milestone ? milestoneMessage(byway, milestone) : (story?.tagline ?? listingDescription(byway)),
      note: choices.note,
      photo: credit,
      postmark: `${byway.states[0] ?? 'USA'} · ${new Date().toLocaleDateString('en-US')}`,
      caption: '',
    })
  } finally {
    root.unmount()
    host.remove()
  }
}
