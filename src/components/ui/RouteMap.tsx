import { lazy, Suspense } from 'react'
import type { ComponentProps } from 'react'
import type { RouteMap as MapComponent } from './RouteMapCanvas'
import s from './Content.module.css'
const Canvas = lazy(() => import('./RouteMapCanvas').then((module) => ({ default: module.RouteMap })))
export function RouteMap(props: ComponentProps<typeof MapComponent>) {
  if (!props.byways.length) return null
  return (
    <Suspense
      fallback={
        <div className={`${s.map} ${s.mapPlaceholder}`} role="status">
          <span className="visually-hidden">Opening the map…</span>
        </div>
      }
    >
      <Canvas {...props} />
    </Suspense>
  )
}
