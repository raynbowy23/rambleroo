import { Link, useParams, useSearchParams } from 'react-router'
import { useStrip } from './data'
import { buildRibbon, mappedIntervals } from './geometry'
import { layoutLabels, printPanels, type PrintPanel } from './printPanels'
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
            <PanelDiagram panel={panel} />
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

// Drawing space for one panel, in SVG units: the ribbon runs down the left, stretch brackets sit outside it, and labels sit to the right at their own mile.
const W = 720
const H = 600
const PAD = 24
const RIBBON_X = 170
const BRACKET_X = 64
const LABEL_X = 290
const LABEL_GAP = 52
const tickEvery = (span: number) => (span <= 6 ? 1 : span <= 15 ? 2 : span <= 30 ? 5 : 10)

function PanelDiagram({ panel }: { panel: PrintPanel }) {
  const span = Math.max(0.1, panel.to - panel.from)
  const scale = (H - PAD * 2) / span
  const ribbon = buildRibbon(panel.route, scale)
  const y = (mile: number) => PAD + (mile - panel.from) * scale
  const x = (mile: number) => RIBBON_X + ribbon.offset(mile)
  const labelYs = layoutLabels(
    panel.entries.map((e) => y(e.mile)),
    H,
    LABEL_GAP,
  )
  const every = tickEvery(span)
  const ticks = Array.from(
    { length: Math.floor(panel.to / every) - Math.ceil(panel.from / every) + 1 },
    (_, i) => (Math.ceil(panel.from / every) + i) * every,
  )
  return (
    <svg
      className={s.diagram}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Ribbon from mile ${panel.from.toFixed(1)} to ${panel.to.toFixed(1)} with places at their miles`}
    >
      <g transform={`translate(${RIBBON_X - 50} ${PAD})`}>
        <path d={ribbon.path(panel.from, panel.to)} fill="none" stroke="#8a8a80" strokeWidth="2" strokeDasharray="3 5" />
        {mappedIntervals(panel.route, panel.from, panel.to).map(([a, b]) => (
          <g key={a} transform={`translate(0 ${(a - panel.from) * scale})`}>
            <path d={ribbon.path(a, b)} fill="none" stroke="#2f3524" strokeWidth="13" strokeLinecap="round" />
            <path d={ribbon.path(a, b)} fill="none" stroke="#c8935a" strokeWidth="9" strokeLinecap="round" />
            <path d={ribbon.path(a, b)} fill="none" stroke="#fffdf4" strokeWidth="1" strokeDasharray="5 6" />
          </g>
        ))}
      </g>
      {ticks.map((mile) => (
        <g key={mile} className={s.tick}>
          <line x1={x(mile) + 10} x2={x(mile) + 18} y1={y(mile)} y2={y(mile)} stroke="#535c3d" />
          <text x={x(mile) + 22} y={y(mile) + 4}>
            {mile}
          </text>
        </g>
      ))}
      {panel.stretches.map((st) => {
        const top = y(st.from) + 3
        const bottom = y(st.to) - 3
        const mid = (top + bottom) / 2
        return (
          <g key={st.title + st.from} className={s.bracket}>
            <path
              d={`M${BRACKET_X + 10},${top} H${BRACKET_X} V${bottom} H${BRACKET_X + 10}`}
              fill="none"
              stroke="#535c3d"
              strokeWidth="1.5"
            />
            {bottom - top > 60 && (
              <text transform={`translate(${BRACKET_X - 8} ${mid}) rotate(-90)`} textAnchor="middle">
                {st.title}
              </text>
            )}
          </g>
        )
      })}
      {panel.entries.map((entry, i) => {
        const dotX = x(entry.mile)
        const dotY = y(entry.mile)
        const ly = labelYs[i]
        return (
          <g key={i} className={s[entry.kind]}>
            <polyline
              points={`${dotX},${dotY} ${LABEL_X - 30},${dotY} ${LABEL_X - 8},${ly}`}
              fill="none"
              stroke="#9a9a88"
              strokeWidth="1"
            />
            <circle
              cx={dotX}
              cy={dotY}
              r={entry.kind === 'gap' ? 3 : 5.5}
              fill={entry.kind === 'gap' ? '#fffdf4' : '#d45b2c'}
              stroke="#2f3524"
              strokeWidth="1.2"
            />
            <foreignObject x={LABEL_X} y={ly - LABEL_GAP / 2} width={W - LABEL_X} height={LABEL_GAP}>
              <div className={s.label}>
                <strong>Mile {entry.mile.toFixed(1)}</strong> <span>{entry.label}</span>
              </div>
            </foreignObject>
          </g>
        )
      })}
    </svg>
  )
}
