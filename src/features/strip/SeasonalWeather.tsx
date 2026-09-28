import { useEffect, useRef, useState } from 'react'
import s from './Strip.module.css'

export function SeasonalWeather({ kind }: { kind: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    if (host.current) observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={host} className={s.weather} data-testid="season-weather" data-weather={kind} data-paused={!visible} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${9 + (i % 5)}s` }} />
      ))}
    </div>
  )
}
