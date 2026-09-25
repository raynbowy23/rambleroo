import { useEffect, useRef } from 'react'
import type { Map } from './maplibre'
import s from './Map.module.css'

const labels: { name: string; at: [number, number] }[] = [
  { name: 'PACIFIC OCEAN', at: [-130, 37] },
  { name: 'ATLANTIC OCEAN', at: [-65, 34] },
  { name: 'GULF OF MEXICO', at: [-90, 25] },
  { name: 'LAKE SUPERIOR', at: [-88, 47.6] },
  { name: 'LAKE MICHIGAN', at: [-87.1, 43.8] },
]
export function WaterLabels({ map }: { map: Map }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const update = () => {
      const host = root.current
      if (!host) return
      const bounds = map.getContainer().getBoundingClientRect()
      const panels = [...(host.parentElement?.querySelectorAll('[data-map-panel], [data-map-decoration]') ?? [])].map((panel) =>
        panel.getBoundingClientRect(),
      )
      const placed: DOMRect[] = []
      labels.forEach((label, index) => {
        const node = host.children[index] as HTMLElement
        const point = map.project(label.at)
        node.style.left = `${point.x}px`
        node.style.top = `${point.y}px`
        const rect = node.getBoundingClientRect()
        const overlaps = (other: DOMRect) =>
          rect.left < other.right + 8 && rect.right > other.left - 8 && rect.top < other.bottom + 8 && rect.bottom > other.top - 8
        const hidden =
          rect.left < bounds.left ||
          rect.right > bounds.right ||
          rect.top < bounds.top ||
          rect.bottom > bounds.bottom ||
          [...panels, ...placed].some(overlaps) ||
          (label.name.startsWith('LAKE') && map.getZoom() < 4.8)
        node.style.visibility = hidden ? 'hidden' : 'visible'
        if (!hidden) placed.push(rect)
      })
    }
    map.on('move', update)
    map.on('resize', update)
    const observer = new ResizeObserver(update)
    if (root.current?.parentElement) {
      observer.observe(root.current.parentElement)
      root.current.parentElement.querySelectorAll('[data-map-panel], [data-map-decoration]').forEach((panel) => observer.observe(panel))
    }
    update()
    return () => {
      map.off('move', update)
      map.off('resize', update)
      observer.disconnect()
    }
  }, [map])
  return (
    <div ref={root} className={s.waterLabels} aria-hidden="true">
      {labels.map((label) => (
        <span key={label.name}>{label.name}</span>
      ))}
    </div>
  )
}
