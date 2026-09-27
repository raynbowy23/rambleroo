import { useMemo, useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { usePassport } from '../../lib/passport'
import type { BywaySummary } from '../../lib/types'
import { PostcardArt } from './PostcardArt'
import { milestones, type Milestone } from './cardData'
import { useStrip } from '../strip/data'
export function MilestoneToken({ byway, milestone }: { byway: BywaySummary; milestone: Milestone }) {
  const [open, setOpen] = useState(false)
  const kept = usePassport((state) => state.postcards.some((card) => card.bywayId === byway.id && card.milestoneId === milestone.id))
  return (
    <>
      <button
        className="postcard-token"
        aria-label={`Postcard from ${milestone.name}${kept ? ', kept' : ''}`}
        onClick={() => setOpen(true)}
      >
        ✉ {kept && <span aria-label="Kept">✓ </span>}Postcard from {milestone.name}
      </button>
      {open && (
        <Dialog title={`Postcard from ${milestone.name}`} onClose={() => setOpen(false)}>
          <PostcardArt byway={byway} milestone={milestone} note="" onNote={() => {}} />
          <button className="btn btn-primary" onClick={() => usePassport.getState().keepPostcard(byway.id, milestone.id)} disabled={kept}>
            {kept ? 'Kept in your passport' : 'Keep this postcard'}
          </button>
        </Dialog>
      )}
    </>
  )
}
export function KeptMilestoneCard({ byway, milestoneId }: { byway: BywaySummary; milestoneId: string }) {
  const { data, loading, error } = useStrip(byway.id)
  const milestone = useMemo(() => (data ? milestones(data).find((card) => card.id === milestoneId) : undefined), [data, milestoneId])
  return (
    <article>
      <h3>{milestone?.name ?? milestoneId}</h3>
      {milestone ? (
        <PostcardArt byway={byway} milestone={milestone} note="" onNote={() => {}} />
      ) : (
        <p role="status">{loading ? 'Loading postcard…' : (error ?? 'This milestone is no longer available.')}</p>
      )}
      <button className="btn btn-ghost" onClick={() => usePassport.getState().removePostcard(byway.id, milestoneId)}>
        Remove postcard
      </button>
    </article>
  )
}
