import { useEffect, useState } from 'react'
import { useCatalog, useStory } from '../../../lib/data'
import type { BywaySummary, SceneFamily } from '../../../lib/types'
import { useStrip } from '../../../features/strip/data'
import { RoadDiorama, type RoadDioramaProps } from './RoadDiorama'
import { environment, type Season, type Weather } from './environment'
import './gallery.css'

const examples = [
  'great-river-road-2279',
  'historic-columbia-river-highway-2141',
  'pacific-coast-scenic-byway-oregon-2143',
  'route-1-big-sur-coast-highway-2301',
  'blue-ridge-parkway-2280',
  'beartooth-highway-2281',
  'forest-heritage-national-scenic-byway-77229',
  'kancamagus-scenic-byway-2458',
  'scenic-byway-12-2020',
  'amish-country-byway-13793',
  'historic-national-road-2278',
  'florida-keys-scenic-highway-2555',
]
const families: SceneFamily[] = ['river', 'coast', 'mountain', 'forest', 'desert', 'prairie', 'town']
const weathers: Weather[] = ['clear', 'cloudy', 'rain', 'snow', 'fog']
const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter']

function RoadCard({ byway, now, animate }: { byway: BywaySummary; now: Date; animate: boolean }) {
  const { story } = useStory(byway.id)
  const { data } = useStrip(byway.id)
  const env = environment(byway, now)
  return (
    <figure className="rr-diorama-card">
      <RoadDiorama
        byway={byway}
        story={story}
        towns={data?.towns.map((town) => town.name)}
        now={now}
        animate={animate}
        title={`${byway.name}, ${env.time} in ${env.season}`}
      />
      <figcaption>
        <span className="rr-diorama-eyebrow">
          {byway.scene} · {byway.states.join(' / ')}
        </span>
        <h3>{byway.name}</h3>
        <p>
          {String(Math.floor(env.hour)).padStart(2, '0')}:{String(Math.floor((env.hour % 1) * 60)).padStart(2, '0')} solar time ·{' '}
          {env.season}
        </p>
      </figcaption>
    </figure>
  )
}

function Comparisons({ byway, now, animate }: { byway: BywaySummary; now: Date; animate: boolean }) {
  const { story } = useStory(byway.id)
  const { data } = useStrip(byway.id)
  const base: RoadDioramaProps = { byway, story, towns: data?.towns.map((town) => town.name), now, animate, hour: 13, season: 'summer' }
  const strip = (label: string, variants: { label: string; props: Partial<RoadDioramaProps> }[]) => (
    <section aria-label={label} className="rr-diorama-comparison">
      <h3>{label}</h3>
      <div className="rr-diorama-strip">
        {variants.map((variant) => (
          <figure key={variant.label}>
            <RoadDiorama {...base} {...variant.props} title={`${byway.name}: ${variant.label}`} />
            <figcaption>{variant.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
  return (
    <>
      {strip(
        'From first light to lights on',
        [6, 9, 13, 18, 20, 23].map((hour) => ({ label: `${hour}:00`, props: { hour } })),
      )}
      {strip(
        'A change in the weather',
        weathers.map((weather) => ({ label: weather, props: { weather } })),
      )}
      {strip(
        'The year along the road',
        seasons.map((season) => ({ label: season, props: { season } })),
      )}
    </>
  )
}

export default function DioramaGallery() {
  const catalog = useCatalog()
  const [now, setNow] = useState(() => new Date())
  const [animate, setAnimate] = useState(false)
  const [chosen, setChosen] = useState('pacific-coast-scenic-byway-oregon-2143')
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const selected = examples.flatMap((id) => {
    const byway = catalog.byId.get(id)
    return byway ? [byway] : []
  })
  for (const family of families) {
    if (!selected.some((byway) => byway.scene === family)) {
      const byway = catalog.byways.find((byway) => byway.scene === family)
      if (byway) selected.push(byway)
    }
  }
  const comparison = catalog.byId.get(chosen) ?? selected[0]
  return (
    <main className="rr-diorama-gallery">
      <header>
        <p className="rr-diorama-eyebrow">Rambleroo · The illustration workshop</p>
        <h1>
          A little world.
          <br />A long way to wander.
        </h1>
        <p>Twelve roads, folded into pocket-sized landscapes. Follow the light, watch the weather, and see the year turn.</p>
        <label className="rr-diorama-toggle">
          <input type="checkbox" checked={animate} onChange={(event) => setAnimate(event.target.checked)} /> Gentle motion
        </label>
        <p className="rr-diorama-note">
          Local solar time · refreshes each minute · weather is a preview · motion follows your device preference
        </p>
      </header>
      {catalog.status === 'loading' && <p role="status">Opening the road atlas…</p>}
      {catalog.status === 'error' && <p role="alert">{catalog.error?.message}</p>}
      <section aria-label="Twelve roads at the current time" className="rr-diorama-grid">
        {selected.map((byway) => (
          <RoadCard key={byway.id} byway={byway} now={now} animate={animate} />
        ))}
      </section>
      {comparison && (
        <section className="rr-diorama-studies">
          <p className="rr-diorama-eyebrow">One road, many moods</p>
          <h2>Stay a little longer.</h2>
          <label>
            Road to study{' '}
            <select value={comparison.id} onChange={(event) => setChosen(event.target.value)}>
              {selected.map((byway) => (
                <option key={byway.id} value={byway.id}>
                  {byway.name}
                </option>
              ))}
            </select>
          </label>
          <p className="rr-diorama-note">
            Time studies use summer and clear skies. Weather and season studies use 13:00. Snow weather is an explicit preview, including in
            mild-winter regions.
          </p>
          <Comparisons byway={comparison} now={now} animate={animate} />
        </section>
      )}
    </main>
  )
}
