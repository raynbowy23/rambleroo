import { Link } from 'react-router'
import { usePassport, type SavedStretch } from '../../lib/passport'
import { useStrip } from './data'

function SavedEntry({ entry }: { entry: SavedStretch }) {
  const { data, loading, error } = useStrip(entry.bywayId)
  const remove = usePassport((state) => state.removeStretch)
  const stretch = data?.stretches.find((stretch) => stretch.id === entry.stretchId)
  return (
    <li style={{ marginBlock: 16 }}>
      <Link className="btn btn-ghost" to={`/byway/${entry.bywayId}/strip?stretch=${encodeURIComponent(entry.stretchId)}`}>
        {loading ? 'Opening saved stretch…' : `${data?.title ?? entry.bywayId} · ${stretch?.title ?? entry.stretchId}`}
      </Link>
      {error && <small>Details unavailable; your stretch is still saved.</small>}
      <button
        className="btn btn-ghost"
        aria-label={`Remove ${stretch?.title ?? entry.stretchId}`}
        onClick={() => remove(entry.bywayId, entry.stretchId)}
      >
        Remove
      </button>
    </li>
  )
}
export function SavedStretches() {
  const entries = usePassport((state) => state.savedStretches)
  return entries.length ? (
    <ul aria-label="Saved stretches" style={{ listStyle: 'none', padding: 0 }}>
      {entries.map((entry) => (
        <SavedEntry key={`${entry.bywayId}/${entry.stretchId}`} entry={entry} />
      ))}
    </ul>
  ) : null
}
