import type { BywaySummary } from '../../lib/types'
import type { StripData } from '../strip/types'
import { formatMiles } from '../../lib/format'
import { stateNames } from '../../lib/states'
import s from './Byway.module.css'

export function RoadStats({ byway, strip, season }: { byway: BywaySummary; strip?: StripData; season?: string }) {
  const main = strip?.stretches.filter((stretch) => stretch.on === 'main').sort((a, b) => a.fromMile - b.fromMile) ?? []
  // Only total verified, contiguous stretches covering the entire main drive; branches and disconnected parts are separate trips.
  const timed =
    strip &&
    strip.mode !== 'ferry' &&
    main.length > 0 &&
    main.every((stretch, i) => stretch.minutes !== null && Math.abs(stretch.fromMile - (i ? main[i - 1].toMile : 0)) < 0.1) &&
    Math.abs(main.at(-1)!.toMile - strip.main.miles) < 0.1
  const places = strip
    ? new Set([
        ...strip.towns.map((town) => `${town.on}:${town.name.toLowerCase()}`),
        ...strip.moments.map((moment) => `${moment.on}:${moment.title.toLowerCase()}`),
      ]).size
    : undefined
  return (
    <dl className={s.stats} aria-label="Road facts">
      <div>
        <dt>Mapped distance</dt>
        <dd>
          {formatMiles(byway.mappedMiles)}
          <small className={s.statNote}>Sum of the mapped road, rounded. Not a driving route.</small>
        </dd>
      </div>
      {timed && (
        <div>
          <dt>{strip.part ? `${strip.part.label} drive` : 'Drive time'}</dt>
          <dd>About {Math.round(main.reduce((sum, stretch) => sum + stretch.minutes!, 0))} min · without stops</dd>
        </div>
      )}
      {places !== undefined && (
        <div>
          <dt>{strip?.part ? `${strip.part.label} strip` : 'On the strip'}</dt>
          <dd>{places} places</dd>
        </div>
      )}
      <div>
        <dt>States</dt>
        <dd>{stateNames(byway.states)}</dd>
      </div>
      <div>
        <dt>Designation</dt>
        <dd>{byway.designations.join(' · ')}</dd>
      </div>
      {season && (
        <div>
          <dt>Best season</dt>
          <dd>{season}</dd>
        </div>
      )}
    </dl>
  )
}
