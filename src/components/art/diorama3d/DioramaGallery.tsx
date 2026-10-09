import { useEffect, useState } from 'react'
import { specs, type DioramaSpec } from './spec'
import { RoadDiorama3D } from './RoadDiorama3D'
import { solarHour } from './scene'
import type { Season, Weather } from '../diorama/environment'
import './diorama3d.css'

function Card({ spec, now }: { spec: DioramaSpec; now: Date }) {
  const [hour, setHour] = useState<number | undefined>(),
    [weather, setWeather] = useState<Weather>('clear'),
    [season, setSeason] = useState<Season>('summer')
  const resolved = hour ?? solarHour(spec.longitude, now)
  return (
    <article className="rr-mini-card">
      <RoadDiorama3D spec={spec} conditions={{ hour: resolved, weather, season }} />
      <div className="rr-mini-copy">
        <p className="rr-mini-kicker">{spec.ground.replaceAll('-', ' ')}</p>
        <h2>{spec.title}</h2>
        <p className="rr-mini-time">
          {String(Math.floor(resolved)).padStart(2, '0')}:{String(Math.floor((resolved % 1) * 60)).padStart(2, '0')} · local solar time
        </p>
        <label>
          Time{' '}
          <select value={hour ?? 'live'} onChange={(e) => setHour(e.target.value === 'live' ? undefined : Number(e.target.value))}>
            <option value="live">Live at this road</option>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
        <label>
          Weather{' '}
          <select value={weather} onChange={(e) => setWeather(e.target.value as Weather)}>
            {['clear', 'cloudy', 'rain', 'snow', 'fog'].map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
        <label>
          Season{' '}
          <select value={season} onChange={(e) => setSeason(e.target.value as Season)}>
            {['spring', 'summer', 'autumn', 'winter'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <ol>
          {spec.landmarks.map((l) => (
            <li key={l.name}>{l.name}</li>
          ))}
        </ol>
      </div>
    </article>
  )
}
export default function DioramaGallery() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) setNow(new Date())
    }, 60_000)
    return () => clearInterval(id)
  }, [])
  return (
    <main className="rr-mini-gallery">
      <header>
        <p className="rr-mini-kicker">Rambleroo · The miniature workshop</p>
        <h1>
          Three roads.
          <br />A world in each.
        </h1>
        <p>Hover, focus or gently drag a landscape to turn it. Your garage car follows the road.</p>
      </header>
      <section className="rr-mini-grid" aria-label="Three road miniatures">
        {specs.map((spec) => (
          <Card key={spec.bywayId} spec={spec} now={now} />
        ))}
      </section>
    </main>
  )
}
