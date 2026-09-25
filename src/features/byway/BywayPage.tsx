import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router'
import { useByway, useStory } from '../../lib/data'
import { formatMiles, listingDescription, shortDesignation } from '../../lib/format'
import { stateNames } from '../../lib/states'
import { usePassport } from '../../lib/passport'
import { Scene } from '../../components/art'
import { Hero, PageStatus, Sources } from '../../components/ui/Content'
import { RouteMap } from '../../components/ui/RouteMap'
import { toast } from '../../components/ui/Toast'
import { Postcard } from '../explore/Postcard'
import { VisitEditor } from '../passport/VisitEditor'
import { loadBywayGeometry } from '../map/layers'
import s from '../../components/ui/Content.module.css'
// Shared-boundary neighbors derived from the bundled us-atlas/states-10m.json topology.
import adjacentStates from './adjacent-states.json'
const adjacent: Record<string, string[]> = adjacentStates
// Great-circle length chooses the longest geometry part; it is never presented as catalog mileage.
function partLength(points: number[][]) {
  return points.slice(1).reduce((sum, p, i) => {
    const q = points[i],
      r = Math.PI / 180
    const a = Math.sin(((p[1] - q[1]) * r) / 2) ** 2 + Math.cos(q[1] * r) * Math.cos(p[1] * r) * Math.sin(((p[0] - q[0]) * r) / 2) ** 2
    return sum + 2 * Math.asin(Math.sqrt(Math.min(1, a)))
  }, 0)
}
export default function BywayPage() {
  const { id } = useParams()
  const { byway: b, status, byways } = useByway(id)
  const { story, status: storyStatus } = useStory(id)
  const saved = usePassport((p) => Boolean(id && p.saved[id]))
  const toggleSave = usePassport((p) => p.toggleSave)
  const [editing, setEditing] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const [start, setStart] = useState<{ id: string; point: number[] }>()
  useEffect(() => {
    let cancelled = false
    if (id)
      void loadBywayGeometry()
        .then((data) => {
          const parts = data.features.filter((f) => f.properties.id === id).flatMap((f) => f.geometry.coordinates)
          const longest = parts.reduce<number[][]>((best, p) => (partLength(p) > partLength(best) ? p : best), [])
          if (!cancelled && longest[0]) setStart({ id, point: longest[0] })
        })
        .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id])
  const roads = useMemo(() => (b ? [b] : []), [b])
  const related = useMemo(() => {
    if (!b) return []
    const neighbors = new Set(b.states.flatMap((code) => adjacent[code] ?? []))
    const rank = (codes: string[]) =>
      codes.some((code) => b.states.includes(code)) ? 2 : codes.some((code) => neighbors.has(code)) ? 1 : 0
    return byways
      .filter((other) => other.id !== b.id && other.themes.includes(b.themes[0]))
      .sort((a, c) => rank(c.states) - rank(a.states) || a.name.localeCompare(c.name))
      .slice(0, 4)
  }, [b, byways])
  if (status === 'loading') return <PageStatus title="Opening the road…" />
  if (status === 'error') return <PageStatus title="The catalog could not be loaded" error />
  if (!b) return <PageStatus title="Byway not found" />
  const point = start?.id === b.id ? start.point : b.center
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: b.name, url: window.location.href })
      else {
        await navigator.clipboard.writeText(window.location.href)
        toast('Link copied')
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        toast('Could not share. You can copy the address from your browser.')
    }
  }
  return (
    <main>
      <Hero family={b.scene} seed={b.seed} title={b.name} kicker={shortDesignation(b)}>
        <p className={s.subline}>{story?.tagline ?? listingDescription(b)}</p>
        <p className={s.muted}>
          {story
            ? !story.reviewed
              ? 'Draft story · pending review'
              : 'Reviewed story'
            : storyStatus === 'loading'
              ? 'Opening story…'
              : storyStatus === 'error'
                ? 'Story unavailable · showing listing'
                : 'Listing'}
        </p>
        <div className={s.facts}>
          <span>{stateNames(b.states)}</span>
          <span>{formatMiles(b.mappedMiles)} in total</span>
          {b.designations.map((d) => (
            <span key={d}>{d}</span>
          ))}
          {story?.season && <span>{story.season}</span>}
        </div>
        <div className={s.actions}>
          <button
            className="btn btn-primary"
            aria-pressed={saved}
            onClick={() => {
              toggleSave(b.id)
              toast(saved ? 'Road removed from saved roads' : 'Saved in this browser')
            }}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Record a visit
          </button>
          <button className="btn btn-ghost" onClick={() => void share()}>
            Share
          </button>
          <Link className="btn btn-ghost" to={`/?byway=${b.id}`}>
            Show on atlas
          </Link>
        </div>
        {saved && <small>Saved in this browser</small>}
      </Hero>
      <div className={s.page}>
        <div className={s.split}>
          <div className={s.body}>
            {story ? (
              <>
                <section className={s.intro}>
                  <span className="kicker">The story</span>
                  {story.intro.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </section>
                <section className={s.section}>
                  <h2>Signature moments</h2>
                  <p className={s.muted}>Numbers identify moments on the map, not a suggested stop order. Map anchors are approximate.</p>
                  {story.moments.map((m, i) => (
                    <article
                      className={s.moment}
                      id={`moment-${i}`}
                      key={`${b.id}-${i}`}
                      tabIndex={0}
                      onMouseEnter={() => setActive(i)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                    >
                      <div className={s.momentArt}>
                        <Scene family={m.scene} seed={b.seed + i + 1} variant="postcard" />
                        <span className={s.credit}>Illustration</span>
                      </div>
                      <div className={s.momentBody}>
                        <span className={s.badge}>{m.kind}</span>
                        <h3>
                          {i + 1}. {m.title}
                        </h3>
                        <p>{m.text}</p>
                      </div>
                    </article>
                  ))}
                </section>
                {!!story.practical?.length && (
                  <section className={s.section}>
                    <h2>Before you go</h2>
                    <ul>
                      {story.practical.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </section>
                )}
                <Sources sources={story.sources} />
              </>
            ) : (
              <section className={s.intro}>
                <span className="kicker">Listing</span>
                <p>{listingDescription(b)}</p>
                <h2>This road doesn't have a story yet</h2>
                <p>The mapped line and designations are available to explore.</p>
                <ul>
                  {b.designations.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <aside className={s.companion}>
            <RouteMap
              byways={roads}
              moments={story?.moments}
              activeMoment={active}
              onMoment={(i) => {
                setActive(i)
                const card = document.getElementById(`moment-${i}`)
                card?.scrollIntoView({ block: 'center', behavior: 'instant' })
                card?.focus({ preventScroll: true })
              }}
              label={`Map of ${b.name}`}
            />
            <div className={s.actions}>
              <a
                className="btn btn-ghost"
                href={`https://www.google.com/maps/dir/?api=1&destination=${point[1]},${point[0]}`}
                target="_blank"
                rel="noreferrer"
              >
                Directions to the start ↗
              </a>
            </div>
            <p className={s.muted}>Opens directions to one point on the road, not a route along the byway.</p>
          </aside>
        </div>
        {!!related.length && (
          <section className={s.section}>
            <h2>More roads like this</h2>
            <div className={s.rail}>
              {related.map((road) => (
                <Postcard layout="card" key={road.id} byway={road} />
              ))}
            </div>
          </section>
        )}
      </div>
      {editing && <VisitEditor key={b.id} byway={b} onClose={() => setEditing(false)} />}
    </main>
  )
}
