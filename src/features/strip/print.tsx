import { Link, useParams, useSearchParams } from 'react-router'
import { useStrip } from './data'
import { buildRibbon, mappedIntervals } from './geometry'
import { printPanels } from './printPanels'
import s from './print.module.css'
export default function PrintStrip() {
  const { id = '' } = useParams()
  const [search] = useSearchParams()
  const { data, loading, error } = useStrip(id, search.get('part') ?? undefined)
  if (loading)
    return (
      <main className={s.page}>
        <p role="status">Preparing the printed strip…</p>
      </main>
    )
  if (!data)
    return (
      <main className={s.page}>
        <h1>{error ?? 'No strip map for this road yet'}</h1>
        <Link to={`/byway/${id}`}>Back to the road</Link>
      </main>
    )
  const panels = printPanels(data)
  const photos = [...new Map([...data.towns, ...data.moments].flatMap((p) => (p.photo ? [[p.photo.file, p.photo] as const] : []))).values()]
  return (
    <main className={s.page}>
      <div className={s.controls}>
        <Link className="btn" to={`/byway/${id}/strip${search.toString() ? `?${search}` : ''}`}>
          Back to the strip
        </Link>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Print this strip
        </button>
        <p>Letter · portrait. Each panel is a separate page.</p>
      </div>
      {panels.map((panel, index) => {
        const scale = 520 / Math.max(0.1, panel.to - panel.from)
        const ribbon = buildRibbon(panel.route, scale)
        return (
          <section className={s.panel} data-testid="print-panel" key={index}>
            <header>
              <span className="kicker">
                Rambleroo · strip map · {index + 1} / {panels.length}
              </span>
              <h1>{data.title}</h1>
              <p>
                {data.reviewed ? 'Reviewed strip map' : 'Draft · pending review'}
                {data.part ? ` · ${data.part.label}` : ''}
              </p>
              <h2>
                {panel.on === 'branch' ? 'Optional branch' : 'Main road'} · miles {panel.from.toFixed(1)}–{panel.to.toFixed(1)}
                {panel.continuation ? ' · continued' : ''}
              </h2>
              <p>{data.direction}</p>
            </header>
            <div className={s.body}>
              <svg viewBox="0 0 100 560" role="img" aria-label={`Ribbon from mile ${panel.from.toFixed(1)} to ${panel.to.toFixed(1)}`}>
                <g transform="translate(0 20)">
                  <path d={ribbon.path(panel.from, panel.to)} fill="none" stroke="#777" strokeWidth="2" strokeDasharray="3 5" />
                  {mappedIntervals(panel.route, panel.from, panel.to).map(([a, b]) => (
                    <path
                      key={a}
                      d={ribbon.path(a, b)}
                      transform={`translate(0 ${(a - panel.from) * scale})`}
                      fill="none"
                      stroke="#535c3d"
                      strokeWidth="9"
                    />
                  ))}
                  {panel.entries.map((entry, i) => (
                    <circle
                      key={i}
                      cx={50 + ribbon.offset(entry.mile)}
                      cy={(entry.mile - panel.from) * scale}
                      r="4"
                      fill="#d45b2c"
                      stroke="#fff"
                    />
                  ))}
                </g>
              </svg>
              <ol className={s.places}>
                {panel.entries.map((entry, i) => (
                  <li key={i}>
                    <strong>Mile {entry.mile.toFixed(1)}</strong>
                    <span>{entry.label}</span>
                  </li>
                ))}
              </ol>
            </div>
            <footer>
              Ribbon straightens the mapped road. Dotted breaks are unmapped. Places may be off route. Check conditions before travel.
            </footer>
          </section>
        )
      })}
      <section className={s.credits}>
        <h2>Sources & photo credits</h2>
        <p>Geometry: {data.sources.geometry}</p>
        <p>Town coordinates: {data.sources.towns}</p>
        <p>Drive times: {data.sources.driveTimes}</p>
        <p>This printed edition uses a diagram rather than photographs. Photo credits for the strip:</p>
        {photos.length ? (
          <ul>
            {photos.map((p) => (
              <li key={p.file}>
                {p.title} — {p.author}. <a href={p.licenseUrl}>{p.license}</a> · <a href={p.sourceUrl}>Source</a>
              </li>
            ))}
          </ul>
        ) : (
          <p>No photographs credited in this strip.</p>
        )}
      </section>
    </main>
  )
}
