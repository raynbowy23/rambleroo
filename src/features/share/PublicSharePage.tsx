import { useEffect, useState } from 'react'
import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router'
import { useCatalog } from '../../lib/data'
import type { ShareSnapshot } from '../../lib/shares'
import { Scene } from '../../components/art'
import { RouteMap } from '../../components/ui/RouteMap'
import s from './SnapshotShare.module.css'

export async function loader({
  params,
  request,
}: LoaderFunctionArgs): Promise<{ snapshot?: ShareSnapshot; missing?: boolean; error?: boolean }> {
  if (!/^[A-Za-z0-9_-]{12,128}$/.test(params.slug ?? '')) return { missing: true }
  try {
    const response = await fetch(`/api/public/shares/${params.slug}`, { signal: request.signal, credentials: 'omit' })
    if (response.status === 404) return { missing: true }
    if (!response.ok) return { error: true }
    return { snapshot: (await response.json()) as ShareSnapshot }
  } catch {
    return { error: true }
  }
}
export default function PublicSharePage() {
  const { snapshot, missing, error } = useLoaderData<typeof loader>()
  const catalog = useCatalog()
  const [map, setMap] = useState(false)
  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const meta = existing ?? document.createElement('meta')
    const previous = meta.getAttribute('content')
    meta.name = 'robots'
    meta.content = 'noindex'
    if (!existing) document.head.append(meta)
    return () => {
      if (!existing) meta.remove()
      else if (previous === null) meta.removeAttribute('content')
      else meta.content = previous
    }
  }, [])
  const roads =
    snapshot?.roads.flatMap((id) => {
      const road = catalog.byId.get(id)
      return road ? [road] : []
    }) ?? []
  return (
    <main className={s.page}>
      <Link to="/" className="kicker">
        Rambleroo · Scenic roads of America
      </Link>
      {missing ? (
        <>
          <h1>This link was turned off</h1>
          <p>It may have been removed, or the address may be incomplete.</p>
        </>
      ) : error ? (
        <>
          <h1>This trip couldn’t be loaded</h1>
          <p>Please refresh to try again.</p>
        </>
      ) : (
        snapshot && (
          <>
            <p className="kicker">A Rambleroo trip{snapshot.kind === 'passport' ? ' · Passport snapshot' : ''}</p>
            <h1>{snapshot.title || (snapshot.kind === 'passport' ? 'A road passport' : 'Roads worth taking')}</h1>
            <p>A snapshot in time. Road details come from today’s catalog.</p>
            {catalog.status === 'loading' ? (
              <p role="status">Opening the road catalog…</p>
            ) : catalog.status === 'error' ? (
              <p role="alert">The road catalog couldn’t be loaded. Please refresh to try again.</p>
            ) : (
              <>
                <p>
                  {snapshot.roads.length} roads · {Math.round(roads.reduce((total, road) => total + road.mappedMiles, 0)).toLocaleString()}{' '}
                  mapped miles
                </p>
                <p>
                  Miles cover catalog roads and exclude travel between them
                  {snapshot.kind === 'passport' ? '; visit dates may represent only part of a road' : ''}.
                </p>
                {roads.length < snapshot.roads.length && <p>Some roads are no longer in the catalog; their miles aren’t included.</p>}
                {!!roads.length && (
                  <button className="btn" aria-expanded={map} onClick={() => setMap(!map)}>
                    {map ? 'Hide map' : 'Show road map'}
                  </button>
                )}
                {map && <RouteMap byways={roads} label="Shared roads" />}
                <ol className={s.cards}>
                  {snapshot.roads.map((id) => {
                    const road = catalog.byId.get(id)
                    return (
                      <li key={id}>
                        <article>
                          {road && <Scene family={road.scene} look={road.look} region={road.region} seed={road.seed} variant="postcard" />}
                          <div>
                            <h2>{road?.name || 'Road no longer in catalog'}</h2>
                            {road && (
                              <p>
                                {road.states.join(' · ')} · {road.mappedMiles.toFixed(1)} mapped miles
                              </p>
                            )}
                            {snapshot.saved?.includes(id) && <p>Saved road</p>}
                            {snapshot.visits
                              ?.filter((visit) => visit.bywayId === id)
                              .map((visit, index) => (
                                <div key={index}>
                                  <p>
                                    Visited <time dateTime={visit.date}>{visit.date}</time>
                                  </p>
                                  {visit.note && <p>{visit.note}</p>}
                                </div>
                              ))}
                          </div>
                        </article>
                      </li>
                    )
                  })}
                </ol>
                <p>Postcard illustrations, not photographs.</p>
              </>
            )}
          </>
        )
      )}
      <Link className="btn btn-primary" to="/trip">
        Start your own trip on Rambleroo
      </Link>
    </main>
  )
}
