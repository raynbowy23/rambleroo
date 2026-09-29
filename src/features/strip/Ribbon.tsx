import { MilestoneToken } from '../postcard/MilestonePostcard'
import { milestones } from '../postcard/cardData'
import { useLayoutEffect, useRef, useMemo, type CSSProperties } from 'react'
import { Scene } from '../../components/art'
import type { BywaySummary, PostcardLook } from '../../lib/types'
import { PhotoChip, PhotoImage } from '../photos/Photos'
import { buildRibbon, clamp, mappedIntervals, milePostInterval, sideOfRoad } from './geometry'
import type { Stretch, StripData } from './types'
import s from './Strip.module.css'

// Stretch brackets use the same colour per landscape as the map's road strokes (tokens in src/styles/tokens.css).
const sceneColors = {
  coast: 'var(--map-route-water)',
  river: 'var(--map-route-water)',
  forest: 'var(--map-route-forest)',
  town: 'var(--map-route-town)',
  mountain: 'var(--map-route-mountain)',
  desert: 'var(--map-route-desert)',
  prairie: 'var(--map-route-prairie)',
}
export function Ribbon({
  data,
  byway,
  on,
  from,
  to,
  season,
  selected,
  select,
  geometry,
  scale,
}: {
  scale: number
  data: StripData
  byway: BywaySummary
  on: 'main' | 'branch'
  from: number
  to: number
  geometry: ReturnType<typeof buildRibbon>
  season: PostcardLook['season']
  selected?: Stretch
  select: (stretch: Stretch) => void
}) {
  const root = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const arrange = () => {
      let tail = 0
      for (const side of ['left', 'right']) {
        const labels = [...element.querySelectorAll<HTMLElement>(`[data-label-side="${side}"]`)].sort(
          (a, b) => Number(a.dataset.mile) - Number(b.dataset.mile),
        )
        let bottom = 0
        for (const label of labels) {
          const trueY = (Number(label.dataset.mile) - from) * scale
          const desired = trueY - (label.dataset.town ? label.offsetHeight : 0)
          const top = Math.max(bottom, desired)
          label.style.top = `${top}px`
          const leader = label.querySelector<HTMLElement>('[data-leader]')!
          leader.style.top = `${Math.min(0, trueY - top)}px`
          leader.style.height = `${Math.abs(trueY - top)}px`
          leader.style.width = `${49 + (side === 'left' ? 1 : -1) * geometry.offset(Number(label.dataset.mile))}px`
          leader.style.borderTopWidth = trueY <= top ? '1px' : '0'
          leader.style.borderBottomWidth = trueY > top ? '1px' : '0'
          bottom = top + label.offsetHeight + 14
          tail = Math.max(tail, bottom)
        }
      }
      element.style.marginBottom = `${Math.max(0, tail - (to - from) * scale)}px`
    }
    const observer = new ResizeObserver(arrange)
    element.querySelectorAll<HTMLElement>('[data-label-side]').forEach((label) => observer.observe(label))
    arrange()
    return () => observer.disconnect()
  }, [data, on, from, to, scale, geometry])
  const cards = useMemo(() => milestones(data), [data])
  const route = on === 'main' ? data.main : data.branch!
  const intervals = useMemo(() => mappedIntervals(route, from, to), [route, from, to])
  // Ferry ports sit beside the sailing lane, not a road.
  const offRoute = data.mode === 'ferry' ? 'from the ferry lane' : 'off the road'
  const postInterval = milePostInterval(scale)
  const height = (to - from) * scale
  const y = (mile: number) => (clamp(mile, from, to) - from) * scale
  const contains = (mile: number) => mile >= from && (mile < to || (to === route.miles && mile <= to + 0.1))
  const pathBetween = (a: number, b: number) => (
    <g key={a} transform={`translate(0 ${y(a)})`}>
      {data.mode === 'ferry' ? (
        // A sea lane: open water with a dashed ferry track, not a paved road.
        <>
          <path d={geometry.path(a, b)} stroke="var(--map-water-deep)" strokeWidth="26" strokeOpacity=".35" />
          <path d={geometry.path(a, b)} stroke="var(--map-water)" strokeWidth="18" />
          <path d={geometry.path(a, b)} stroke="var(--paper)" strokeWidth="2.4" strokeDasharray="3 9" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d={geometry.path(a, b)} stroke="var(--ink)" strokeWidth="22" />
          <path d={geometry.path(a, b)} stroke="#c49868" strokeWidth="17" />
          <path d={geometry.path(a, b)} stroke="var(--paper)" strokeWidth="2" strokeDasharray="9 12" />
        </>
      )}
    </g>
  )
  return (
    <section
      ref={root}
      className={`${s.ribbon} ${on === 'branch' ? s.branchRibbon : ''}`}
      style={{ height }}
      data-ribbon={on}
      data-from={from}
      data-to={to}
      aria-label={on === 'branch' ? 'Tip branch' : `Main road, miles ${from.toFixed(1)} to ${to.toFixed(1)}`}
    >
      <svg className={s.road} width="100" height={height} aria-hidden="true" fill="none" strokeLinejoin="round">
        {intervals.map(([a, b]) => pathBetween(a, b))}
        {selected?.on === on &&
          intervals.map(([a, b]) => {
            const start = Math.max(a, selected.fromMile),
              end = Math.min(b, selected.toMile)
            return (
              end > start && (
                <path
                  key={a}
                  transform={`translate(0 ${y(start)})`}
                  d={geometry.path(start, end)}
                  stroke="#ffe0a0"
                  strokeWidth="12"
                  opacity="0.85"
                />
              )
            )
          })}
        {(route.gaps ?? []).map((gap) => {
          const a = Math.max(from, gap.atMile),
            b = Math.min(to, gap.atMile + gap.miles)
          return (
            b > a && (
              <path
                key={gap.atMile}
                transform={`translate(0 ${y(a)})`}
                d={geometry.path(a, b)}
                stroke="var(--ink-muted)"
                strokeWidth="3"
                strokeDasharray="2 7"
                opacity="0.45"
              />
            )
          )
        })}
      </svg>
      {Array.from({ length: Math.floor(route.miles / postInterval) + 1 }, (_, i) => i * postInterval)
        .filter(contains)
        .map((mile) => (
          <span className={s.milepost} key={mile} style={{ top: y(mile) }}>
            <small>MILE</small>
            {mile}
          </span>
        ))}
      {(route.gaps ?? [])
        .filter((gap) => {
          const end = gap.atMile + gap.miles
          // A fork may split a gap; keep its label on the section containing its end.
          return gap.atMile < to && end > from && (end <= to || to === route.miles)
        })
        .map((gap) => (
          <p className={s.gap} key={gap.atMile} style={{ top: y(gap.atMile + gap.miles / 2) }}>
            Unmapped in the source data · {gap.miles.toFixed(1)} mi
          </p>
        ))}
      {data.stretches
        .filter((stretch) => stretch.on === on && stretch.toMile > from && stretch.fromMile < to)
        .map((stretch) => {
          const start = Math.max(from, stretch.fromMile),
            end = Math.min(to, stretch.toMile)
          return (
            <button
              key={stretch.id}
              className={s.bracket}
              style={
                { top: y(start), height: Math.max(44, y(end) - y(start)), '--stretch-color': sceneColors[stretch.scene] } as CSSProperties
              }
              aria-label={stretch.title}
              aria-pressed={selected?.id === stretch.id}
              onClick={() => select(stretch)}
            >
              {y(end) - y(start) > 120 && <span>{stretch.title}</span>}
            </button>
          )
        })}
      {data.towns
        .filter((town) => town.on === on)
        .map(
          (town, i) =>
            contains(town.mile) && (
              <div
                data-mile={town.mile}
                data-town="true"
                data-label-side={i % 2 ? 'right' : 'left'}
                key={town.name}
                className={`${s.town} ${i % 2 ? s.right : s.left}`}
                style={{ top: y(town.mile) }}
              >
                <span data-leader className={s.leader} aria-hidden="true" />
                {town.photo ? (
                  <div className={s.townPhoto}>
                    <PhotoImage photo={town.photo} />
                    <PhotoChip photo={town.photo} />
                  </div>
                ) : (
                  // Park and wilderness roads have landmarks (passes, lakes, peaks) instead of towns.
                  <span aria-hidden="true">{town.kind === 'landmark' ? '▲' : '⌂'}</span>
                )}
                <strong>{town.name}</strong>
                {/* One postcard per place: when a story stop shares the town's name (Ephraim), the stop's card, which has the photo, carries it. */}
                {(town.photo || !cards.some((card) => card.kind === 'moment' && card.name.toLowerCase() === town.name.toLowerCase())) && (
                  <MilestoneToken byway={byway} milestone={cards.find((card) => card.name === town.name && card.kind === 'town')!} />
                )}
                <a href={town.source} target="_blank" rel="noreferrer" aria-label={`${town.name} on Wikipedia`}>
                  ⓘ
                </a>
                {town.offRouteMiles > 0.3 && (
                  <small>
                    {town.offRouteMiles} mi {offRoute}
                  </small>
                )}
              </div>
            ),
        )}
      {data.moments
        .filter((moment) => moment.on === on && contains(moment.mile))
        .map((moment, i) => (
          <article
            data-mile={moment.mile}
            data-label-side={sideOfRoad(route, moment.mile, moment.at)}
            key={moment.title}
            className={`${s.moment} ${sideOfRoad(route, moment.mile, moment.at) === 'left' ? s.left : s.right}`}
            style={
              {
                top: y(moment.mile),
                '--spur-length': `${49 + (sideOfRoad(route, moment.mile, moment.at) === 'left' ? 1 : -1) * geometry.offset(moment.mile)}px`,
              } as CSSProperties
            }
          >
            <span data-leader className={s.leader} aria-hidden="true" />
            <div className={s.picture}>
              {moment.photo ? (
                <>
                  <PhotoImage photo={moment.photo} />
                  <PhotoChip photo={moment.photo} />
                </>
              ) : (
                <Scene
                  family={moment.scene}
                  motifs={moment.motifs}
                  region={byway.region}
                  look={{ ...byway.look, season }}
                  seed={byway.seed + i}
                  variant="postcard"
                />
              )}
            </div>
            <div className={s.momentText}>
              <small>
                {moment.kind} · mile {moment.mile.toFixed(1)}
              </small>
              <h3>{moment.title}</h3>
              <MilestoneToken byway={byway} milestone={cards.find((card) => card.name === moment.title && card.kind === 'moment')!} />
              <p>{moment.text}</p>
              {moment.offRouteMiles > 0.3 && (
                <strong className={s.detour}>
                  {moment.offRouteMiles} mi {offRoute}
                </strong>
              )}
            </div>
          </article>
        ))}
    </section>
  )
}
