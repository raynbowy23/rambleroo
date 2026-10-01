import { Link } from 'react-router'
import { useHasStrip } from './data'
export function StripLink({ id }: { id: string }) {
  return useHasStrip(id) ? (
    <Link className="btn btn-primary" to={`/byway/${id}/strip`}>
      Drive it <span aria-hidden="true">→</span>
    </Link>
  ) : null
}
