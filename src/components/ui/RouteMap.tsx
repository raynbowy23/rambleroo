import { lazy, Suspense } from 'react'
import type { ComponentProps } from 'react'
import type { RouteMap as MapComponent } from './RouteMapCanvas'
import s from './Content.module.css'
import { WhenNear } from './WhenNear'
const Canvas = lazy(() => import('./RouteMapCanvas').then((module) => ({ default: module.RouteMap })))
export function RouteMap(props: ComponentProps<typeof MapComponent>) {
  if (!props.byways.length) return null
  // The map library loads when the map comes near the screen, not with the page. Until then the box only holds the space; it says
  // "Opening the map" once the map is actually loading.
  return (
    <WhenNear placeholder={<div className={`${s.map} ${s.mapPlaceholder}`} aria-hidden="true" />}>
      <Suspense
        fallback={
          <div className={`${s.map} ${s.mapPlaceholder}`} role="status">
            <span className="visually-hidden">Opening the map…</span>
          </div>
        }
      >
        <Canvas {...props} />
      </Suspense>
    </WhenNear>
  )
}
