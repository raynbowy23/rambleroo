import { savedMessage } from '../../lib/account'
import { AddToTrip } from '../trip/AddToTrip'
import { useStrip } from '../strip/data'
import { RoadStats } from './RoadStats'
import { LoadingRoad, NotFound } from '../../components/ui/RoadStatus'
import roadStyle from './Byway.module.css'
import { StripLink } from '../strip/StripLink'
import { requireNetwork } from '../../lib/network'
import { PhotoGallery, MomentPhoto, PhotoCredit } from '../photos/Photos'
import { ShareControl } from '../share/ShareControl'
import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router'
import { useByway, useStory, usePhotos, stateChapters } from '../../lib/data'
import { illustrationCaption, listingDescription, shortDesignation } from '../../lib/format'
import { greatCircleMiles } from '../../lib/geo'
import { PostcardArt } from '../postcard/PostcardArt'
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
  const strip = useStrip(id ?? '')
  const photos = usePhotos(id)
  const photo = photos[0]
  const { byway: b, status, byways, meta } = useByway(id)
  const { story, status: storyStatus } = useStory(id)
  const saved = usePassport((p) => Boolean(id && p.saved[id]))
  const toggleSave = usePassport((p) => p.toggleSave)
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  useEffect(() => setNote(''), [id])
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
  const nearby = useMemo(
    () =>
      b
        ? byways
            .filter(
              (road) =>
                road.id !== b.id &&
                road.states.some((code) => b.states.includes(code) || b.states.some((state) => adjacent[state]?.includes(code))),
            )
            .map((road) => ({ road, miles: greatCircleMiles(b.center, road.center) }))
            .sort((a, c) => a.miles - c.miles || a.road.id.localeCompare(c.road.id))
            .slice(0, 4)
        : [],
    [b, byways],
  )
  if (status === 'loading') return <LoadingRoad title="Opening the road…" />
  if (status === 'error') return <PageStatus title="The catalog could not be loaded" error />
  if (!b) return <NotFound title="Road not found" />
  const point = start?.id === b.id ? start.point : b.center
  return (
    <main className={`${roadStyle.roadPage} ${story ? s.editorialPage : ''}`}>
      <Hero
        key={b.id}
        photo={photo}
        allowIllustration
        look={b.look}
        mobileArtBand
        region={b.region}
        motifs={story?.motifs}
        family={b.scene}
        seed={b.seed}
        title={b.name}
        kicker={shortDesignation(b)}
      >
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
      </Hero>
      <div className={roadStyle.summary}>
        <RoadStats byway={b} strip={strip.data} season={story?.season} />
        <div className={s.actions}>
          <AddToTrip bywayId={b.id} />
          <StripLink id={b.id} />
          <button
            className="btn btn-ghost"
            aria-pressed={saved}
            onClick={() => {
              toggleSave(b.id)
              toast(saved ? 'Road removed from saved roads' : savedMessage())
            }}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Record a visit
          </button>
          <ShareControl byway={b} story={story} note={note} photo={photo} />
          <Link viewTransition className="btn btn-ghost" to={`/?byway=${b.id}`}>
            Show on the map
          </Link>
        </div>
        {saved && <small>Saved in this browser</small>}
      </div>
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
                <PhotoGallery photos={photos} />
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
                      <MomentPhoto photo={photos.find((photo) => photo.moment === m.title)}>
                        <div className={s.momentArt}>
                          <Scene
                            look={b.look}
                            region={b.region}
                            motifs={m.motifs}
                            framed
                            title={illustrationCaption(m.title, b.region, m.motifs)}
                            family={m.scene}
                            seed={b.seed + i + 1}
                            variant="postcard"
                          />
                          <span className={s.credit} tabIndex={0} title={illustrationCaption(m.title, b.region, m.motifs)}>
                            Illustration · no photo yet
                            <span className="visually-hidden">: {illustrationCaption(m.title, b.region, m.motifs)}</span>
                          </span>
                        </div>
                      </MomentPhoto>
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
            {!story && <PhotoGallery photos={photos} />}
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
                onClick={requireNetwork}
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
        <section className={s.section}>
          <h2>A postcard from the road</h2>
          <PostcardArt photo={photo} key={b.id} byway={b} story={story} note={note} onNote={setNote} />
        </section>
        <section className={s.section}>
          <h2>Roads nearby</h2>
          <p className={s.muted}>Distances between mapped road centers, not driving distances.</p>
          <div className={s.rail}>
            {nearby.map(({ road, miles }) => (
              <div key={road.id}>
                <p>≈ {Math.round(miles).toLocaleString('en-US')} mi away (straight line)</p>
                <Postcard byway={road} layout="card" />
              </div>
            ))}
          </div>
        </section>
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
        <details className={s.listingInfo}>
          <summary>About this listing</summary>
          <dl>
            <div>
              <dt>Designations & issuing programs</dt>
              <dd>
                <ul>
                  {b.designations.map((designation) => (
                    <li key={designation}>
                      {designation} ·{' '}
                      {designation.includes('National Forest')
                        ? 'USDA Forest Service'
                        : /National Scenic|All-American/i.test(designation)
                          ? 'FHWA National Scenic Byways Program'
                          : 'Issuing program not specified in the source layer'}
                    </li>
                  ))}
                </ul>
                {Object.values(stateChapters).flatMap((chapter) =>
                  chapter.programs
                    .filter((program) => program.members.some((member) => member.bywayId === b.id))
                    .map((program) => (
                      <p key={program.label}>
                        {program.label} · {program.issuer}
                      </p>
                    )),
                )}
              </dd>
            </div>
            <div>
              <dt>Data source</dt>
              <dd>
                <a href={meta?.source.url}>USDOT Scenic Byways layer</a> · retrieved {meta?.retrievedAt.slice(0, 10) ?? 'Unavailable'}
              </dd>
            </div>
            <div>
              <dt>Editorial status</dt>
              <dd>{story ? (story.reviewed ? 'Reviewed story' : 'Draft story · pending review') : 'Listing'}</dd>
            </div>
            <div>
              <dt>Lead photo</dt>
              <dd>
                {photo ? (
                  <>
                    {photo.source === 'wikipedia-lead'
                      ? 'Wikipedia article lead image'
                      : photo.source === 'nara'
                        ? 'U.S. DOT America’s Byways collection'
                        : 'Curated story photograph'}
                    <PhotoCredit photo={photo} />
                  </>
                ) : (
                  'Illustration · no photo yet'
                )}
              </dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{meta?.builtAt.slice(0, 10) ?? 'Unavailable'}</dd>
            </div>
          </dl>
        </details>
      </div>
      {editing && <VisitEditor initialNote={note} key={b.id} byway={b} onClose={() => setEditing(false)} />}
    </main>
  )
}
