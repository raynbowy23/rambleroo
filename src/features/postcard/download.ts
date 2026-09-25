export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Resolve CSS variables before loading the standalone SVG into an image. */
async function svgImage(svg: SVGSVGElement) {
  const copy = svg.cloneNode(true) as SVGSVGElement
  const originals = [svg, ...svg.querySelectorAll('*')]
  const clones = [copy, ...copy.querySelectorAll('*')]
  originals.forEach((element, index) => {
    const style = getComputedStyle(element)
    for (const property of [
      'fill',
      'stroke',
      'color',
      'font-family',
      'font-size',
      'font-weight',
      'opacity',
      'stop-color',
      'stop-opacity',
    ]) {
      ;(clones[index] as SVGElement).style.setProperty(
        property,
        style.getPropertyValue(property).replace(/url\(["']?[^)]*#([^"')]+)["']?\)/g, 'url(#$1)'),
      )
    }
    ;(clones[index] as SVGElement).style.animation = 'none'
  })
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Break long words too, and shrink only when needed to keep a complete note on the card. */
function wrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  maxHeight = 500,
) {
  const lines = () =>
    text.split('\n').flatMap((paragraph) => {
      const result: string[] = []
      let line = ''
      for (const word of paragraph.split(/\s+/)) {
        if (line && ctx.measureText(line + ' ' + word).width > width) {
          result.push(line)
          line = ''
        }
        for (const character of (line ? ' ' : '') + word) {
          if (ctx.measureText(line + character).width > width) {
            result.push(line)
            line = ''
          }
          line += character
        }
      }
      return [...result, line]
    })
  const originalFont = ctx.font
  let rows = lines()
  let size = Number(ctx.font.match(/([\d.]+)px/)?.[1] ?? 20)
  while (rows.length * lineHeight > maxHeight && size > 8) {
    size -= 1
    ctx.font = originalFont.replace(/[\d.]+px/, size + 'px')
    lineHeight = size * 1.2
    rows = lines()
  }
  for (const line of rows) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
  ctx.font = originalFont
  return y
}

export async function downloadPostcard(input: {
  scene: SVGSVGElement
  stamp: SVGSVGElement
  id: string
  name: string
  message: string
  note: string
  postmark: string
  caption: string
}) {
  await document.fonts.ready
  const [scene, stamp] = await Promise.all([svgImage(input.scene), svgImage(input.stamp)])
  const canvas = document.createElement('canvas')
  canvas.width = 1800
  canvas.height = 700
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.fillStyle = '#f3ead7'
  ctx.fillRect(0, 0, 1800, 700)
  ctx.strokeStyle = '#89795d'
  ctx.strokeRect(14, 14, 872, 672)
  ctx.strokeRect(914, 14, 872, 672)
  ctx.drawImage(scene, 30, 30, 840, 490)
  ctx.fillStyle = '#202925'
  ctx.font = '32px "Fraunces Variable", Georgia, serif'
  wrappedText(ctx, input.name, 40, 565, 810, 38, 72)
  ctx.font = '16px "Inter Variable", sans-serif'
  wrappedText(ctx, input.caption, 40, 650, 810, 20, 40)
  ctx.font = '32px "Fraunces Variable", Georgia, serif'
  ctx.fillText('P O S T   C A R D', 1180, 65)
  ctx.beginPath()
  ctx.moveTo(1350, 105)
  ctx.lineTo(1350, 650)
  ctx.stroke()
  ctx.font = '22px "Fraunces Variable", Georgia, serif'
  const bottom = wrappedText(ctx, input.message, 940, 145, 375, 30, 170)
  ctx.font = '23px Caveat, cursive'
  wrappedText(ctx, input.note, 940, bottom + 28, 375, 27, 610 - bottom)
  ctx.drawImage(stamp, 1620, 90, 125, 150)
  ctx.beginPath()
  ctx.arc(1500, 195, 85, 0, Math.PI * 2)
  ctx.stroke()
  ctx.font = '15px "Inter Variable", sans-serif'
  wrappedText(ctx, input.postmark, 1430, 190, 140, 22)
  for (const y of [410, 480, 550]) {
    ctx.beginPath()
    ctx.moveTo(1390, y)
    ctx.lineTo(1740, y)
    ctx.stroke()
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('PNG export failed'))), 'image/png'),
  )
  downloadBlob(blob, `rambleroo-${input.id}.png`)
}
