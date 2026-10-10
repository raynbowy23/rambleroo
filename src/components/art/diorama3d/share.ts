// Turns a miniature into something to send: one full turn of the turntable as an MP4 video or a looping GIF, with the road's name on a
// paper band beneath it like a postcard caption. Frames come from the renderer's snapshot; the encoders load only when asked for.

/** One full turn of the turntable, in seconds. The car drives on at its usual pace meanwhile. */
export const TURN_SECONDS = 6
export type ClipFormat = 'mp4' | 'gif'
export const CLIP = {
  mp4: { width: 1080, fps: 30, type: 'video/mp4' },
  gif: { width: 480, fps: 15, type: 'image/gif' },
} as const

/** Draws `view` with the caption band below it; both sides come out even, as the video encoder needs. */
export function compose(view: HTMLCanvasElement, title: string, into?: HTMLCanvasElement) {
  const even = (n: number) => Math.round(n / 2) * 2
  const band = even(view.width * 0.09)
  const picture = into ?? document.createElement('canvas')
  picture.width = even(view.width)
  picture.height = even(view.height) + band
  const ctx = picture.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#f6ead3'
  ctx.fillRect(0, 0, picture.width, picture.height)
  ctx.drawImage(view, 0, 0)
  const y = picture.height - band / 2
  ctx.fillStyle = '#354738'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.globalAlpha = 1
  ctx.font = `${Math.round(band * 0.36)}px 'Fraunces Variable', Georgia, serif`
  ctx.fillText(title, band * 0.4, y, picture.width * 0.7)
  ctx.textAlign = 'right'
  ctx.globalAlpha = 0.7
  ctx.font = `${Math.round(band * 0.2)}px Georgia, serif`
  ctx.fillText('rambleroo.app', picture.width - band * 0.4, y)
  ctx.globalAlpha = 1
  return picture
}

/** Whether this browser can encode H.264 video (WebCodecs); where it cannot, only the GIF is offered. */
export async function canMakeVideo() {
  if (typeof VideoEncoder === 'undefined') return false
  try {
    const support = await VideoEncoder.isConfigSupported({ codec: 'avc1.4d0028', width: 1080, height: 1178 })
    return support.supported === true
  } catch {
    return false
  }
}

/** The frame number `i` of `count`: a still `width` wide, already captioned. */
export type FrameSource = (i: number, count: number, width: number) => HTMLCanvasElement
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0))

export async function makeClip(format: ClipFormat, frame: FrameSource, onProgress: (share: number) => void): Promise<Blob> {
  const { width, fps } = CLIP[format]
  const count = TURN_SECONDS * fps
  return format === 'mp4' ? makeVideo(frame, count, width, fps, onProgress) : makeGif(frame, count, width, fps, onProgress)
}

async function makeVideo(frame: FrameSource, count: number, width: number, fps: number, onProgress: (share: number) => void) {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
  const first = frame(0, count, width)
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: first.width, height: first.height, frameRate: fps },
    fastStart: 'in-memory',
  })
  let failure: unknown
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => (failure = error),
  })
  encoder.configure({ codec: 'avc1.4d0028', width: first.width, height: first.height, bitrate: 5_000_000, framerate: fps })
  for (let i = 0; i < count; i++) {
    if (failure) throw failure
    const canvas = i === 0 ? first : frame(i, count, width)
    const video = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) })
    encoder.encode(video, { keyFrame: i % fps === 0 })
    video.close()
    // Let the encoder drain and the page breathe, so the progress shows and memory stays flat.
    while (encoder.encodeQueueSize > 4) await new Promise((resolve) => setTimeout(resolve, 5))
    if (i % 3 === 0) {
      onProgress(i / count)
      await nextTask()
    }
  }
  await encoder.flush()
  encoder.close()
  if (failure) throw failure
  muxer.finalize()
  return new Blob([muxer.target.buffer], { type: CLIP.mp4.type })
}

async function makeGif(frame: FrameSource, count: number, width: number, fps: number, onProgress: (share: number) => void) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
  const gif = GIFEncoder()
  for (let i = 0; i < count; i++) {
    const canvas = frame(i, count, width)
    const { data } = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height)
    const palette = quantize(data, 256)
    gif.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, { palette, delay: Math.round(1000 / fps), repeat: 0 })
    if (i % 2 === 0) {
      onProgress(i / count)
      await nextTask()
    }
  }
  gif.finish()
  return new Blob([gif.bytes()], { type: CLIP.gif.type })
}

/** Offers the file to the phone's or computer's share sheet where it can take files, else saves it. Needs a fresh tap or click. */
export async function shareOrSave(file: File, title: string) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'cancelled'
    }
  }
  save(file)
  return 'saved'
}
export function save(file: File) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(file)
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
export const canShareFiles = (file: File) => Boolean(navigator.canShare?.({ files: [file] }))
