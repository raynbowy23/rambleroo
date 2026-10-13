// The src, srcset and sizes for a library photo, shared by the app's <img> (src/features/photos/Photos.tsx) and the image preload that
// the build writes into each road page's copy of index.html (scripts/build/pages.ts). They must match exactly, or the browser
// downloads the photo twice.
import type { Photo } from './types.ts'

export type PhotoUse = 'card' | 'hero' | 'full'

/** A library path (/photos/<road>/<file>) on the photo host, or on this site when `origin` is empty. */
export function photoPathAt(file: string, bywayId: string, origin: string) {
  const path = file.startsWith('/') ? file : `/photos/${bywayId}/${file}`
  return origin ? origin + path.replace(/^\/photos/, '') : path
}

export function photoSources(photo: Photo, origin: string, use: PhotoUse) {
  const at = (file: string) => photoPathAt(file, photo.bywayId, origin)
  if (use === 'full') return { src: at(photo.file) }
  const widths = [
    ...(photo.thumb ? [[at(photo.thumb), Math.min(480, photo.width)] as const] : []),
    ...(photo.medium ? [[at(photo.medium), Math.min(960, photo.width)] as const] : []),
    [at(photo.file), photo.width] as const,
  ]
  return {
    // Cards start from the thumbnail; a page hero from the middle size when there is one.
    src: use === 'card' ? at(photo.thumb ?? photo.file) : at(photo.medium ?? photo.file),
    srcSet: widths.length > 1 ? widths.map(([url, w]) => `${url} ${w}w`).join(', ') : undefined,
    // Heroes fill the width of the screen behind the title; cards are up to 480px wide, full width on phones.
    sizes: widths.length > 1 ? (use === 'hero' ? '100vw' : 'auto, (max-width: 759px) 100vw, 480px') : undefined,
  }
}
