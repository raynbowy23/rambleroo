/**
 * Where the photo library is served: the public R2 bucket behind photos.rambleroo.app (infra/README.md). `VITE_PHOTO_ORIGIN=`
 * (empty) serves the local public/photos/ copy instead, for working on photos before they are uploaded.
 */
export const PHOTO_ORIGIN: string = import.meta.env.VITE_PHOTO_ORIGIN ?? 'https://photos.rambleroo.app'
