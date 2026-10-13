import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Mounts `children` only once this spot comes within `margin` of the screen, showing `placeholder` until then. Heavy sections lower on
 * a page (the map library, three.js) then stop competing with the photo at the top for the first seconds of a slow connection.
 * Where IntersectionObserver is missing, the children mount at once.
 */
export function WhenNear({
  children,
  placeholder = null,
  margin = '100px',
}: {
  children: ReactNode
  placeholder?: ReactNode
  margin?: string
}) {
  const spot = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (near || !spot.current) return
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: margin })
    observer.observe(spot.current)
    return () => observer.disconnect()
  }, [near, margin])
  return near ? children : <div ref={spot}>{placeholder}</div>
}
