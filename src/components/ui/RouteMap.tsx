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
        <div className={s.map} role="status">
          Opening the map…
        </div>
      }
    >
      <Canvas {...props} />
    </Suspense>
  )
}
