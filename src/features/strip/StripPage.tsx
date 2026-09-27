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
import { buildRibbon, clamp, coordinateAtMile, googleMapsUrl, PIXELS_PER_MILE } from './geometry'
import { InsetMap, type PositionSink } from './InsetMap'
import { Ribbon } from './Ribbon'
import type { Stretch, StripData } from './types'
import s from './Strip.module.css'

/** Each season card also gets its natural light, so the four read apart even when a road's own look is, say, a pink dawn. */
const seasonLight: Record<PostcardLook['season'], PostcardLook['time']> = { spring: 'dawn', summer: 'day', autumn: 'golden', winter: 'day' }

export default function StripPage() {
  const { id = '' } = useParams()
  const strip = useStrip(id)
  const { byway, status } = useByway(id)
  if (strip.loading || status === 'loading')
    return (
      <main className={s.page}>
        <p role="status">Unrolling the road…</p>
      </main>
    )
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
  return <StripExperience key={id} data={strip.data} byway={byway} />
}
function StripExperience({ data, byway }: { data: StripData; byway: BywaySummary }) {
  const garage = useGarage()
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
  const counter = useRef<HTMLOutputElement>(null)
  const car = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const position = useRef<PositionSink | undefined>(undefined)
  const registerPosition = useCallback((sink: PositionSink | undefined) => {
    position.current = sink
  }, [])
  const geometry = useMemo(() => ({ main: buildRibbon(data.main), branch: data.branch ? buildRibbon(data.branch) : undefined }), [data])
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
      const middle = window.innerHeight / 2
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
      const mile = clamp(from + (middle - active.rect.top) / PIXELS_PER_MILE, from, to)
      const inGap = !!route.gaps?.some((gap) => mile > gap.atMile && mile < gap.atMile + gap.miles)
      if (counter.current)
        counter.current.textContent = `${on === 'branch' ? 'Tip · mile' : 'Mile'} ${mile.toFixed(1)} of ${route.miles.toFixed(1)}${inGap ? ' · unmapped' : ''}`
      const ribbon = geometry[on]!
      if (car.current) {
        const angle = (Math.atan2(ribbon.offset(mile + 0.05) - ribbon.offset(mile - 0.05), 0.1 * PIXELS_PER_MILE) * 180) / Math.PI
        car.current.style.transform = `translate(${active.rect.left + active.rect.width / 2 + ribbon.offset(mile) - 15}px, ${active.rect.top + (mile - from) * PIXELS_PER_MILE - 26}px) rotate(${180 - angle}deg)`
        car.current.style.opacity = active.rect.top <= middle && active.rect.bottom >= middle ? (inGap ? '0.35' : '1') : '0'
      }
      position.current?.(coordinateAtMile(route, mile), inGap)
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
  }, [data, geometry, tipOpen])
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
  const selectedId = selected?.id
  useEffect(() => {
    if (!selectedId) return
    const stretch = data.stretches.find((entry) => entry.id === selectedId)
    if (!stretch) return
    const frame = requestAnimationFrame(() => {
      const sections = [...(ribbonArea.current?.querySelectorAll<HTMLElement>(`[data-ribbon="${stretch.on}"]`) ?? [])]
      const section = sections.find((el) => Number(el.dataset.from) <= stretch.fromMile && stretch.fromMile <= Number(el.dataset.to))
      if (!section) return
      const top = section.getBoundingClientRect().top + window.scrollY + (stretch.fromMile - Number(section.dataset.from)) * PIXELS_PER_MILE
      window.scrollTo({ top: Math.max(0, top - window.innerHeight / 2), behavior: motion ? 'smooth' : 'auto' })
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
      label: `${town.name}, town${town.offRouteMiles > 0.3 ? `, ${town.offRouteMiles} miles off the road` : ''}`,
    })),
    ...data.moments.map((moment) => ({
      on: moment.on,
      mile: moment.mile,
      label: `${moment.title}, ${moment.kind}, ${moment.offRouteMiles} miles off the road`,
    })),
    ...data.stretches.map((stretch) => ({
      on: stretch.on,
      mile: stretch.fromMile,
      label: `${stretch.title}, stretch to mile ${stretch.toMile}, about ${stretch.minutes} minutes driving`,
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
      selected={selected}
      select={select}
    />
  )
  return (
    <main className={s.page}>
      <header className={s.intro}>
        <Link className={s.back} to={`/byway/${byway.id}`}>
          ← Back to the road
        </Link>
        <span className="kicker">A road worth taking slowly</span>
        <h1>{data.title}</h1>
        <p className={s.draft}>{data.reviewed ? 'Reviewed strip map' : 'Draft · pending review'}</p>
        <p>{data.direction}</p>
        {/* Seasons at a glance: the same illustrated view of this road in all four seasons, side by side, so the difference is visible
            without toggling. Choosing one also repaints the illustrated stops along the ribbon. Photos never change with season. */}
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
          <small>Illustrated seasons · artwork, not photographs</small>
        </fieldset>
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
        <span aria-hidden="true">↟</span>
        <output ref={counter} data-testid="mile-counter">
          Mile 0.0 of {data.main.miles.toFixed(1)}
        </output>
        <button className="btn btn-ghost" onClick={() => setGarageOpen(true)}>
          Change your car
        </button>
      </div>
      <div className={s.mapDock}>
        <InsetMap data={data} registerPosition={registerPosition} />
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
                Out to the tip · +{data.branch.miles} mi <span aria-hidden="true">{tipOpen ? '−' : '+'}</span>
              </button>
              <small>Optional side branch · main road continues below</small>
            </div>
            {tipOpen && (
              <div id="tip-ribbon" className={s.branch}>
                <p className={s.branchHeading}>A little farther, to the tip →</p>
                {renderRibbon('branch', 0, data.branch.miles)}
                <p className={s.branchEnd}>Tip explored · return to the fork to continue</p>
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
            ≈ {selected.mappedMiles} mi · about {selected.minutes} min driving
          </strong>
          <small>Drive time routed with OpenStreetMap data (OSRM); excludes stops and traffic.</small>
          <div className={s.panelActions}>
            <a
              className="btn btn-primary"
              href={googleMapsUrl(selected.on === 'main' ? data.main : data.branch!, selected)}
              target="_blank"
              rel="noreferrer"
            >
              Drive this stretch
            </a>
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
