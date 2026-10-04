import { useEffect, useState } from 'react'
import { userPhotos, usePhotoRevision } from './userPhotos'

export async function loadCarPicture(id: string) {
  const blob = await userPhotos.get(id)
  if (!blob) return undefined
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
export function useCarPicture(id?: string) {
  const revision = usePhotoRevision()
  const [picture, setPicture] = useState<{ id: string; url: string }>()
  useEffect(() => {
    let active = true
    if (id)
      void loadCarPicture(id)
        .then((url) => {
          if (active && url) setPicture({ id, url })
        })
        .catch(() => {})
    return () => {
      active = false
    }
  }, [id, revision])
  return picture?.id === id ? picture?.url : undefined
}
export async function prepareCarPicture(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image no larger than 8 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const edge = Math.min(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context || !edge) throw new Error('Could not process this picture.')
    context.drawImage(image, (image.naturalWidth - edge) / 2, (image.naturalHeight - edge) / 2, edge, edge, 0, 0, 256, 256)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process this picture.'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
