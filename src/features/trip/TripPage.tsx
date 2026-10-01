import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useCatalog } from '../../lib/data'
import { useTrip } from '../../lib/store'
import { loadStrip } from '../strip/data'
import { googleMapsUrl } from '../strip/geometry'
import type { StripData } from '../strip/types'
import { tripTotals } from './totals'
import s from './Trip.module.css'
export default function TripPage() {
  const { roads, move, remove } = useTrip()
  const catalog = useCatalog()
  const [strips, setStrips] = useState<Record<string, StripData[] | undefined>>({})
  const [errors, setErrors] = useState<string[]>([])
  useEffect(() => {
    let active = true
    for (const { bywayId } of roads) {
      void loadStrip(bywayId)
        .then(async (first) => {
          const parts = first?.parts?.length
            ? await Promise.all(first.parts.map((p) => (p.key === first.part?.key ? first : loadStrip(bywayId, p.key))))
            : [first]
          if (active) setStrips((s) => ({ ...s, [bywayId]: parts.filter((p): p is StripData => !!p) }))
        })
        .catch(() => {
          if (active) {
            setErrors((e) => [...new Set([...e, bywayId])])
            setStrips((s) => ({ ...s, [bywayId]: [] }))
          }
        })
    }
    return () => {
      active = false
    }
  }, [roads])
  const totals = tripTotals(roads, catalog.byId, strips)
  const loading = roads.some((r) => !Object.hasOwn(strips, r.bywayId))
  return (
    <main className={s.page}>
      <span className="kicker">One road after another</span>
      <h1>Your trip</h1>
      <p>Saved in this browser. Arrange the roads in the order you want to travel.</p>
      {catalog.status === 'error' && <p role="alert">{catalog.error?.message}</p>}
      <div role="status">
        <p>
          {roads.length} {roads.length === 1 ? 'road' : 'roads'} · {Math.round(totals.miles).toLocaleString()} mapped miles
        </p>
        {loading ? (
          <p>Loading drive times…</p>
        ) : (
          <p>
            {totals.timedRoads > 0 ? `${hoursAndMinutes(totals.minutes)} of known drive time` : 'Drive time unavailable'}
            {totals.missingTimes > 0 &&
              ` · ${totals.missingTimes} ${totals.missingTimes === 1 ? 'road lacks' : 'roads lack'} complete drive times.`}
          </p>
        )}
      </div>
      <p>Times sum verified main-road stretches only; exclude stops, traffic, optional branches and travel between roads.</p>
      {!roads.length && (
        <Link className="btn btn-primary" to="/?view=gallery">
          Find roads for your trip
        </Link>
      )}
      <ol className={s.roads}>
        {roads.map((r, i) => (
          <li key={r.bywayId}>
            <h2>
              <Link to={`/byway/${r.bywayId}`}>{catalog.byId.get(r.bywayId)?.name ?? r.bywayId}</Link>
            </h2>
            <p>{catalog.byId.get(r.bywayId)?.mappedMiles.toFixed(1) ?? 'Unknown'} mapped miles</p>
            <div className={s.actions}>
              <button className="btn" disabled={i === 0} aria-label={`Move road ${i + 1} up`} onClick={() => move(r.bywayId, -1)}>
                ↑ Up
              </button>
              <button
                className="btn"
                disabled={i === roads.length - 1}
                aria-label={`Move road ${i + 1} down`}
                onClick={() => move(r.bywayId, 1)}
              >
                ↓ Down
              </button>
              <button className="btn btn-ghost" onClick={() => remove(r.bywayId)}>
                Remove
              </button>
              {(strips[r.bywayId]?.length ?? 0) <= 1 &&
                strips[r.bywayId]?.map((data, index) =>
                  data.mode === 'ferry' ? (
                    <a key={index} className="btn" href="https://dot.alaska.gov/amhs/">
                      Ferry schedules
                    </a>
                  ) : (
                    <a
                      key={index}
                      className="btn btn-primary"
                      target="_blank"
                      rel="noreferrer"
                      href={googleMapsUrl(data.main, { fromMile: 0, toMile: data.main.miles })}
                    >
                      Open in Google Maps
                    </a>
                  ),
                )}
            </div>
            {(strips[r.bywayId]?.length ?? 0) > 1 && (
              // Multi-part roads (Great River Road, Route 66) get one directions link per part, folded so ten parts don't become ten big buttons.
              <details className={s.parts}>
                <summary>Directions by part ({strips[r.bywayId]!.length})</summary>
                <ul>
                  {strips[r.bywayId]!.map((data, index) => (
                    <li key={index}>
                      {data.mode === 'ferry' ? (
                        <a href="https://dot.alaska.gov/amhs/">Ferry schedules</a>
                      ) : (
                        <a target="_blank" rel="noreferrer" href={googleMapsUrl(data.main, { fromMile: 0, toMile: data.main.miles })}>
                          {data.part?.label ?? `Part ${index + 1}`} · {Math.round(data.main.miles)} mi ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {errors.includes(r.bywayId) ? (
              <p>Strip unavailable; directions and times could not load.</p>
            ) : (
              strips[r.bywayId]?.length === 0 && <p>No strip map yet; directions and drive time unavailable.</p>
            )}
          </li>
        ))}
      </ol>
    </main>
  )
}

const hoursAndMinutes = (minutes: number) => {
  const h = Math.floor(Math.round(minutes) / 60)
  const m = Math.round(minutes) % 60
  return h ? `${h} h ${m} min` : `${m} min`
}
