import { useTrip } from '../../lib/store'
export function AddToTrip({ bywayId }: { bywayId: string }) {
  const added = useTrip((s) => s.roads.some((r) => r.bywayId === bywayId))
  const add = useTrip((s) => s.add)
  return (
    <button className="btn btn-ghost" style={{ minHeight: 44 }} disabled={added} onClick={() => add(bywayId)}>
      {added ? 'In your trip' : 'Add to trip'}
    </button>
  )
}
