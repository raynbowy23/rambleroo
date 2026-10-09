import { useEffect, useState } from 'react'
import { RoadDiorama3D } from '../../components/art/diorama3d/RoadDiorama3D'
import { solarHour } from '../../components/art/diorama3d/scene'
import type { DioramaSpec } from '../../components/art/diorama3d/spec'
import type { Season } from '../../components/art/diorama/environment'
import s from '../../components/ui/Content.module.css'

// The road's own sky: local solar time and this month's season, rechecked each minute. Weather stays clear until there is a live feed.
function seasonAt(latitude: number, now: Date): Season {
  const month = (now.getUTCMonth() + (latitude < 0 ? 6 : 0)) % 12
  return (['winter', 'spring', 'summer', 'autumn'] as const)[Math.floor(((month + 1) % 12) / 3)]
}

export default function RoadMiniature({ spec, latitude }: { spec: DioramaSpec; latitude: number }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => !document.hidden && setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return (
    <section className={s.section}>
      <h2>In miniature</h2>
      <p className={s.muted}>The road as it looks now, by its own sun. Drag to turn it.</p>
      <RoadDiorama3D spec={spec} conditions={{ hour: solarHour(spec.longitude, now), season: seasonAt(latitude, now), weather: 'clear' }} />
    </section>
  )
}
