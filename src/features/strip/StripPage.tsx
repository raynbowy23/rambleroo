import { LoadingRoad, NotFound } from '../../components/ui/RoadStatus'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useByway, useStory } from '../../lib/data'
import { GarageControls } from '../garage/GarageControls'
import { Dialog } from '../../components/ui/Dialog'
import { useGarage } from '../../lib/garage'
import { Scene, Vehicle } from '../../components/art'
import { usePassport } from '../../lib/passport'
import { useMotionEnabled } from '../../lib/motion'
import type { BywaySummary, PostcardLook } from '../../lib/types'
import { toast } from '../../components/ui/Toast'
import { useStrip } from './data'
import { buildRibbon, clamp, coordinateAtMile, googleMapsUrl, pixelsPerMile } from './geometry'
import { InsetMap, type PositionSink } from './InsetMap'
import { Ribbon } from './Ribbon'
import type { Stretch, StripData } from './types'
import s from './Strip.module.css'

/** Each season card also gets its natural light, so the four read apart even when a road's own look is, say, a pink dawn. */
const seasonLight: Record<PostcardLook['season'], PostcardLook['time']> = { spring: 'dawn', summer: 'day', autumn: 'golden', winter: 'day' }

export default function StripPage() {
  const { id = '' } = useParams()
  const [search] = useSearchParams()
  const strip = useStrip(id, search.get('part') ?? undefined)
  const { byway, status } = useByway(id)
  if (strip.loading || status === 'loading') return <LoadingRoad title="Unrolling the road…" />
  if (status !== 'error' && !byway) return <NotFound title="Road not found" />
  if (strip.error || status === 'error')
    return (
      <main className={s.page}>
        <h1>The road couldn’t load</h1>
        <p>{strip.error ?? 'Please refresh to try again.'}</p>
        <Link className="btn" to={`/byway/${id}`}>
          Back to the road
        </Link>
      </main>
    )
  if (!strip.data || !byway)
    return (
      <main className={s.page}>
        <h1>No strip map for this road yet</h1>
        <p>There are still good miles to discover.</p>
        <Link className="btn" to={`/byway/${id}`}>
          Back to the road
        </Link>
      </main>
    )
  // Keyed by part too, so switching sections starts a fresh drive (mile 0, no stale stretch).
  return <StripExperience key={`${id}.${strip.data.part?.key ?? ''}`} data={strip.data} byway={byway} />
}
function driveLine(relief: boolean, phone: boolean) {
  if (!relief || !phone) return window.innerHeight / 2
  const map = document.querySelector<HTMLElement>('[data-testid="strip-3d"]')
  if (!map?.parentElement) return window.innerHeight / 2
  const top = parseFloat(getComputedStyle(map.parentElement).top) || 0
  return Math.min(window.innerHeight - 100, Math.max(window.innerHeight / 2, top + map.clientHeight + 60))
}
function StripExperience({ data, byway }: { data: StripData; byway: BywaySummary }) {
  const garage = useGarage()
  const [relief, setRelief] = useState(() => {
    try {
      return localStorage.getItem('rambleroo.strip3d.v1') === 'true'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('rambleroo.strip3d.v1', String(relief))
    } catch {
      /* Session-only preference. */
    }
  }, [relief])
  const reliefFailed = useCallback(() => {
    setRelief(false)
    toast("3D terrain isn't available right now; showing the flat road map")
  }, [])
  const [phone, setPhone] = useState(() => window.innerWidth < 760)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 759px)')
    const update = () => setPhone(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const ferry = data.mode === 'ferry'
  // A 3,876-mile sea route needs a finer scale than any road to stay a readable scroll.
  const scale = pixelsPerMile(data.main.miles, phone, ferry ? 2.4 : 6)
  const [garageOpen, setGarageOpen] = useState(false)
  const [params, setParams] = useSearchParams()
  const selected = data.stretches.find((stretch) => stretch.id === params.get('stretch'))
  const [expandedTip, setTipOpen] = useState(selected?.on === 'branch')
  const tipOpen = expandedTip || selected?.on === 'branch'
  const [season, setSeason] = useState<PostcardLook['season']>(byway.look.season)
  const { story } = useStory(byway.id)
  const saved = usePassport((state) => state.savedStretches)
  const save = usePassport((state) => state.saveStretch)
  const unsave = usePassport((state) => state.removeStretch)
  const ribbonArea = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const progressCar = useRef<HTMLDivElement>(null)
  const counter = useRef<HTMLOutputElement>(null)
  const car = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const position = useRef<PositionSink | undefined>(undefined)
  const lastPosition = useRef<Parameters<PositionSink> | undefined>(undefined)
  const registerPosition = useCallback((sink: PositionSink | undefined) => {
    position.current = sink
    if (sink && lastPosition.current) sink(...lastPosition.current)
  }, [])
  const geometry = useMemo(
    () => ({ main: buildRibbon(data.main, scale), branch: data.branch ? buildRibbon(data.branch, scale) : undefined }),
    [data, scale],
  )
  useEffect(() => {
    if (selected) panel.current?.focus({ preventScroll: true })
  }, [selected])
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const elements = [...(ribbonArea.current?.querySelectorAll<HTMLElement>('[data-ribbon]') ?? [])]
      // Read all bounds first; the remainder only writes styles/text and the map source.
      const sections = elements.map((element) => ({ element, rect: element.getBoundingClientRect() }))
      const middle = driveLine(relief, phone)
      const active =
        sections.find(({ rect }) => rect.top <= middle && rect.bottom >= middle) ??
        sections.reduce<(typeof sections)[number] | undefined>(
          (best, section) =>
            !best ||
            Math.min(Math.abs(section.rect.top - middle), Math.abs(section.rect.bottom - middle)) <
              Math.min(Math.abs(best.rect.top - middle), Math.abs(best.rect.bottom - middle))
              ? section
              : best,
          undefined,
        )
      if (!active) return
      const on = active.element.dataset.ribbon as 'main' | 'branch'
      const route = on === 'main' ? data.main : data.branch!
      const from = Number(active.element.dataset.from),
        to = Number(active.element.dataset.to)
      const mile = clamp(from + (middle - active.rect.top) / scale, from, to)
      const inGap = !!route.gaps?.some((gap) => mile > gap.atMile && mile < gap.atMile + gap.miles)
      if (counter.current)
        counter.current.textContent = `${on === 'branch' ? (data.branch?.label ? 'Branch · mile' : 'Tip · mile') : 'Mile'} ${mile.toFixed(1)} of ${route.miles.toFixed(1)}${inGap ? ' · unmapped' : ''}`
      const mainMile = on === 'main' ? mile : (data.branch?.joinsAtMile ?? 0)
      const percent = data.main.miles ? (100 * mainMile) / data.main.miles : 0
      if (progress.current) {
        progress.current.style.setProperty('--progress', `${percent}%`)
        progress.current.setAttribute('aria-valuenow', mainMile.toFixed(1))
        progress.current.setAttribute(
          'aria-valuetext',
          `${on === 'branch' ? 'Exploring the branch from main mile' : 'Mile'} ${mainMile.toFixed(1)}`,
        )
      }
      if (progressCar.current) progressCar.current.style.left = `${percent}%`
      const ribbon = geometry[on]!
      if (car.current) {
        const angle = (Math.atan2(ribbon.offset(mile + 0.05) - ribbon.offset(mile - 0.05), 0.1 * scale) * 180) / Math.PI
        car.current.style.transform = `translate(${active.rect.left + active.rect.width / 2 + ribbon.offset(mile) - 15}px, ${active.rect.top + (mile - from) * scale - (garage.usePicture ? 15 : 26)}px) rotate(${garage.usePicture ? 0 : 180 - angle}deg)`
        car.current.style.opacity = active.rect.top <= middle && active.rect.bottom >= middle ? (inGap ? '0.35' : '1') : '0'
      }
      lastPosition.current = [coordinateAtMile(route, mile), inGap, route, mile]
      position.current?.(...lastPosition.current)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const observer = new ResizeObserver(schedule)
    if (ribbonArea.current) observer.observe(ribbonArea.current)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [data, geometry, tipOpen, scale, garage.usePicture, relief, phone])
  const select = (stretch: Stretch) => {
    trigger.current = document.activeElement as HTMLElement
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('stretch', stretch.id)
        return next
      },
      { preventScrollReset: true },
    )
  }
  // Choosing a stretch drives there: scroll so the car sits at the stretch's first mile. Runs after render so the tip
  // section exists when a tip stretch opens it, and also when a shared link arrives with ?stretch= already set.
  const motion = useMotionEnabled()
  const jumpToMile = useCallback(
    (on: 'main' | 'branch', mile: number) => {
      const sections = [...(ribbonArea.current?.querySelectorAll<HTMLElement>(`[data-ribbon="${on}"]`) ?? [])]
      const section = sections.find((el) => Number(el.dataset.from) <= mile && mile <= Number(el.dataset.to))
      if (!section) return
      const top = section.getBoundingClientRect().top + window.scrollY + (mile - Number(section.dataset.from)) * scale
      window.scrollTo({ top: Math.max(0, top - driveLine(relief, phone)), behavior: motion ? 'smooth' : 'auto' })
    },
    [scale, relief, phone, motion],
  )
  const selectedId = selected?.id
  useEffect(() => {
    if (!selectedId) return
    const stretch = data.stretches.find((entry) => entry.id === selectedId)
    if (!stretch) return
    const frame = requestAnimationFrame(() => {
      jumpToMile(stretch.on, stretch.fromMile)
    })
    return () => cancelAnimationFrame(frame)
    // Jump only when the chosen stretch changes, not on every scroll-driven re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])
  const close = () => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('stretch')
        return next
      },
      { preventScrollReset: true },
    )
    trigger.current?.focus({ preventScroll: true })
  }
  const entries = [
    ...data.towns.map((town) => ({
      on: town.on,
      mile: town.mile,
      label: `${town.name}, town${town.offRouteMiles > 0.3 ? `, ${town.offRouteMiles} miles ${ferry ? 'from the ferry lane' : 'off the road'}` : ''}`,
    })),
    ...data.moments.map((moment) => ({
      on: moment.on,
      mile: moment.mile,
      label: `${moment.title}, ${moment.kind}, ${moment.offRouteMiles} miles ${ferry ? 'from the ferry lane' : 'off the road'}`,
    })),
    ...data.stretches.map((stretch) => ({
      on: stretch.on,
      mile: stretch.fromMile,
      label: `${stretch.title}, stretch to mile ${stretch.toMile}${stretch.minutes === null ? '' : `, about ${stretch.minutes} minutes driving`}`,
    })),
  ].sort((a, b) => {
    const section = (entry: { on: string; mile: number }) =>
      entry.on === 'branch' ? 1 : entry.mile > (data.branch?.joinsAtMile ?? Infinity) ? 2 : 0
    return section(a) - section(b) || a.mile - b.mile
  })
  const lastTown = data.towns.filter((town) => town.on === 'main').sort((a, b) => b.mile - a.mile)[0]
  const renderRibbon = (on: 'main' | 'branch', from: number, to: number) => (
    <Ribbon
      data={data}
      byway={byway}
      on={on}
      from={from}
      to={to}
      season={season}
      geometry={geometry[on]!}
      scale={scale}
      selected={selected}
      select={select}
    />
  )
  return (
    <main className={`${s.page} ${relief ? s.reliefPage : ''}`}>
      <header className={s.intro}>
        <div className={s.introCopy}>
          <Link className={s.back} to={`/byway/${byway.id}`}>
            ← Back to the road
          </Link>
          <span className="kicker">A road worth taking slowly</span>
          <h1>{data.title}</h1>
          {/* Multi-part roads: one strip per disconnected section, in travel order. */}
          {data.parts && data.parts.length > 1 && (
            <nav className={s.parts} aria-label="Parts of this road">
              {data.parts.map((entry, i) => (
                <Link
                  key={entry.key}
                  to={i === 0 ? `/byway/${byway.id}/strip` : `/byway/${byway.id}/strip?part=${entry.key}`}
                  aria-current={(data.part?.key ?? data.parts![0].key) === entry.key ? 'page' : undefined}
                  viewTransition
                >
                  <strong>{entry.label}</strong>
                  <small>{Math.round(entry.miles)} mi</small>
                </Link>
              ))}
            </nav>
          )}
          <p className={s.draft}>{data.reviewed ? 'Reviewed strip map' : 'Draft · pending review'}</p>
          <p>{data.direction}</p>
          {/* Seasons at a glance: the same illustrated view of this road in all four seasons, side by side, so the difference is visible
            without toggling. Choosing one repaints the map and illustrated stops along the ribbon. Photos never change with season. */}
        </div>
        <div className={s.introOverview}>
          <fieldset className={s.seasonGlance}>
            <legend>The same road, four seasons</legend>
            <div className={s.seasonGrid}>
              {(['spring', 'summer', 'autumn', 'winter'] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={season === value}
                  onClick={() => setSeason(value)}
                  aria-label={`Show ${value} along the road`}
                >
                  <Scene
                    family={byway.scene}
                    region={byway.region}
                    seed={byway.seed}
                    motifs={story?.motifs}
                    look={{ ...byway.look, season: value, time: seasonLight[value] }}
                    variant="postcard"
                  />
                  <span>{value}</span>
                </button>
              ))}
            </div>
            <small>Choose a season for the illustrations and map · artwork, not photographs</small>
          </fieldset>
          <dl className={s.keyStats}>
            <div>
              <dt>Mapped route</dt>
              <dd>
                {data.main.miles.toFixed(1)} mi{ferry ? ' by sea' : ''}
              </dd>
            </div>
            <div>
              <dt>Places</dt>
              <dd>
                {
                  new Set([
                    ...data.towns.map((town) => `${town.on}:${town.name.toLowerCase()}`),
                    ...data.moments.map((moment) => `${moment.on}:${moment.title.toLowerCase()}`),
                  ]).size
                }
              </dd>
            </div>
            <div>
              <dt>Stretches</dt>
              <dd>{data.stretches.length}</dd>
            </div>
          </dl>
        </div>
        <p className={s.scrollHint}>
          Scroll to drive. Pick a stretch to make it yours. <span aria-hidden="true">↓</span>
        </p>
        <nav className={s.stretchChoices} aria-label="Choose a stretch">
          {data.stretches.map((stretch) => (
            <button key={stretch.id} onClick={() => select(stretch)} aria-pressed={selected?.id === stretch.id}>
              {stretch.title} ↘
            </button>
          ))}
        </nav>
      </header>
      <div className={s.odometer}>
        <nav className={s.progressNav} aria-label="Jump to a town">
          <div
            ref={progress}
            className={s.progressTrack}
            role="progressbar"
            aria-label="Main drive progress"
            aria-valuemin={0}
            aria-valuemax={data.main.miles}
            aria-valuenow={0}
          />
          {data.towns
            .filter((town) => town.on === 'main')
            .map((town) => (
              <button
                key={`${town.name}-${town.mile}`}
                className={s.progressTick}
                style={{ left: `${data.main.miles ? (town.mile / data.main.miles) * 100 : 0}%` }}
                title={`${town.name} · mile ${town.mile.toFixed(1)}`}
                aria-label={`Jump to ${town.name}, mile ${town.mile.toFixed(1)}`}
                onClick={() => jumpToMile('main', town.mile)}
              >
                <span />
              </button>
            ))}
          <div ref={progressCar} className={s.progressCar} aria-hidden="true">
            <Vehicle view="top" size={20} {...garage} />
          </div>
        </nav>
        <output ref={counter} data-testid="mile-counter">
          Mile 0.0 of {data.main.miles.toFixed(1)}
        </output>
        <button className="btn btn-ghost" onClick={() => setGarageOpen(true)}>
          Change your car
        </button>
        <button className={`btn btn-ghost ${s.reliefToggle}`} aria-pressed={relief} onClick={() => setRelief(!relief)}>
          <span className={s.reliefSwitch} aria-hidden="true" />
          3D view
        </button>
      </div>
      <div className={s.mapDock}>
        <InsetMap
          byway={byway}
          data={data}
          registerPosition={registerPosition}
          relief={relief}
          season={season}
          onSeasonChange={setSeason}
          scene={byway.scene}
          onFailure={reliefFailed}
        />
      </div>
      <div className={s.journey} ref={ribbonArea}>
        <div className={s.start}>
          Begin here <span>mile 0</span>
        </div>
        {data.branch ? (
          <>
            {renderRibbon('main', 0, data.branch.joinsAtMile)}
            <div className={s.fork}>
              <span aria-hidden="true">⑂</span>
              <button
                aria-expanded={tipOpen}
                aria-controls="tip-ribbon"
                onClick={() => {
                  if (tipOpen && selected?.on === 'branch') close()
                  setTipOpen(!tipOpen)
                }}
              >
                {data.branch.label ?? 'Out to the tip'} · +{data.branch.miles} mi <span aria-hidden="true">{tipOpen ? '−' : '+'}</span>
              </button>
              <small>Optional side branch · main road continues below</small>
            </div>
            {tipOpen && (
              <div id="tip-ribbon" className={s.branch}>
                <p className={s.branchHeading}>{data.branch.label ? `${data.branch.label} →` : 'A little farther, to the tip →'}</p>
                {renderRibbon('branch', 0, data.branch.miles)}
                <p className={s.branchEnd}>{data.branch.label ? 'Branch explored' : 'Tip explored'} · return to the fork to continue</p>
              </div>
            )}
            {renderRibbon('main', data.branch.joinsAtMile, data.main.miles)}
          </>
        ) : (
          renderRibbon('main', 0, data.main.miles)
        )}
        <div className={s.finish}>
          {/* Finish flag (replaces a star glyph that read like an assistant's logo). */}
          <svg className={s.finishFlag} viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
            <path d="M9 36V5" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M10 6h24l-5 8 5 8H10Z" fill="var(--card)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
            <path
              d="M10 6h6v4h-6Zm12 0h6v4h-6ZM16 10h6v4h-6Zm12 0h4l-2 4h-2ZM10 14h6v4h-6Zm12 0h6l1 2-1 2h-6ZM16 18h6v4h-6Zm12 0h3l1 4h-4Z"
              fill="var(--ink)"
            />
            <circle cx="9" cy="36" r="2.6" fill="var(--signal)" />
          </svg>
          <h2>End of the mapped byway</h2>
          {lastTown && (
            <p>
              {lastTown.name}
              {lastTown.offRouteMiles > 0.3 ? ` ${lastTown.offRouteMiles} mi ahead` : ''}
            </p>
          )}
          <p>Keep a little room for the unexpected.</p>
        </div>
      </div>
      <div ref={car} className={s.car} aria-hidden="true">
        <Vehicle view="top" size={30} {...garage} />
      </div>
      {garageOpen && (
        <Dialog title="Your car" onClose={() => setGarageOpen(false)}>
          <GarageControls />
        </Dialog>
      )}
      {selected && (
        <section
          ref={panel}
          tabIndex={-1}
          role="region"
          aria-label={`${selected.title} stretch`}
          className={s.stretchPanel}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close()
          }}
        >
          <button className={s.close} aria-label="Close stretch" onClick={close}>
            ×
          </button>
          <small className="kicker">Make a day of it</small>
          <h2>{selected.title}</h2>
          <p>{selected.line}</p>
          <strong>
            ≈ {selected.mappedMiles} mi
            {ferry
              ? ' by sea'
              : selected.minutes === null
                ? ' · drive time not verified for this stretch'
                : ` · about ${selected.minutes} min driving`}
          </strong>
          <small>
            {ferry
              ? 'A ferry route: sailings and times follow the ferry schedule, and your car can come aboard.'
              : selected.minutes === null
                ? 'We could not confirm a route that follows this exact stretch, so we show the mapped distance only.'
                : 'Drive time routed with OpenStreetMap data (OSRM); excludes stops and traffic.'}
          </small>
          <div className={s.panelActions}>
            {ferry ? (
              // Sea routes can't be handed to road navigation; link the operator's schedules instead.
              <a className="btn btn-primary" href="https://dot.alaska.gov/amhs/" target="_blank" rel="noreferrer">
                Ferry schedules
              </a>
            ) : (
              <a
                className="btn btn-primary"
                href={googleMapsUrl(selected.on === 'main' ? data.main : data.branch!, selected)}
                target="_blank"
                rel="noreferrer"
              >
                Drive this stretch
              </a>
            )}
            {/* A toggle like the road Save button: saved stretches can be unsaved right here, not only from the passport. */}
            {(() => {
              const isSaved = saved.some((entry) => entry.bywayId === byway.id && entry.stretchId === selected.id)
              return (
                <button
                  className="btn btn-ghost"
                  aria-pressed={isSaved}
                  onClick={() => {
                    if (isSaved) {
                      unsave(byway.id, selected.id)
                      toast('Stretch removed from your passport')
                    } else {
                      save(byway.id, selected.id)
                      toast('Stretch saved in this browser')
                    }
                  }}
                >
                  {isSaved ? 'Saved' : 'Save stretch'}
                </button>
              )
            })()}
            <button
              className="btn btn-ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href)
                  toast('Link copied')
                } catch {
                  toast('Could not copy. Copy the address from your browser.')
                }
              }}
            >
              Share
            </button>
          </div>
          <small>Opens Google Maps. Check that it follows this road.</small>
        </section>
      )}
      <ol className="visually-hidden" aria-label="Places and stretches by mile">
        {entries.map((entry, i) => (
          <li key={i}>
            {entry.on === 'branch' ? 'Tip' : 'Main road'} · mile {entry.mile.toFixed(1)}: {entry.label}
          </li>
        ))}
      </ol>
      <footer className={s.sources}>
        <h2>Behind the miles</h2>
        <p>This ribbon straightens the source geometry. Dotted breaks are unmapped; stops may be off the road.</p>
        <dl>
          <dt>Geometry</dt>
          <dd>{data.sources.geometry}</dd>
          <dt>Town coordinates</dt>
          <dd>{data.sources.towns}</dd>
          <dt>Drive times</dt>
          <dd>{data.sources.driveTimes}</dd>
        </dl>
        <p>Illustrations are artwork; photos are credited.</p>
        <Link className="btn" to={`/byway/${byway.id}`}>
          Back to the road
        </Link>
      </footer>
    </main>
  )
}
