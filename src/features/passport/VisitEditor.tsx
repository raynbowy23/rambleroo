import { useState } from 'react'
import { Link } from 'react-router'
import { Dialog } from '../../components/ui/Dialog'
import { Stamp } from '../../components/art'
import { toast } from '../../components/ui/Toast'
import { usePassport } from '../../lib/passport'
import { useMotionEnabled } from '../../lib/motion'
import type { BywaySummary, Visit, VisitScope } from '../../lib/types'
import s from '../../components/ui/Dialog.module.css'
function localToday() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function VisitEditor({ byway, visit, onClose }: { byway: BywaySummary; visit?: Visit; onClose: () => void }) {
  const [date, setDate] = useState(visit?.date ?? localToday())
  const [scope, setScope] = useState<VisitScope>(visit?.scope ?? 'part')
  const [note, setNote] = useState(visit?.note ?? '')
  const [revealed, setRevealed] = useState(false)
  const motion = useMotionEnabled()
  return (
    <Dialog title={revealed ? 'A road to remember' : visit ? 'Edit your visit' : 'Record a visit'} onClose={onClose}>
      {revealed ? (
        <div className={s.reveal}>
          <Stamp
            family={byway.scene}
            seed={byway.seed}
            title={byway.name}
            subtitle={byway.states.join(' · ')}
            date={date}
            visited
            press={motion}
            size={220}
          />
          <small>Illustration</small>
          <p>Stamp added to your passport</p>
          <p>Saved in this browser</p>
          <div className={s.actions}>
            <Link className="btn btn-primary" to="/passport" onClick={onClose}>
              View passport
            </Link>
            <button className="btn btn-ghost" onClick={onClose}>
              Keep exploring
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!date || date > localToday() || note.length > 500) return
            if (visit) {
              usePassport.getState().updateVisit(visit.id, { date, scope, note: note.trim() })
              toast('Visit updated · Saved in this browser')
              onClose()
            } else {
              usePassport.getState().addVisit({ bywayId: byway.id, date, scope, note: note.trim() })
              toast('Stamp added to your passport')
              setRevealed(true)
            }
          }}
        >
          <p>{byway.name}</p>
          <label>
            Date
            <input type="date" required max={localToday()} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <fieldset>
            <legend>How much of the road?</legend>
            <label>
              <input type="radio" name="scope" value="part" checked={scope === 'part'} onChange={() => setScope('part')} />
              Part of the road
            </label>
            <label>
              <input type="radio" name="scope" value="whole" checked={scope === 'whole'} onChange={() => setScope('whole')} />
              The whole road
            </label>
            <p>A short stretch counts.</p>
          </fieldset>
          <label>
            Note (optional)
            <textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby="note-length" />
          </label>
          <small id="note-length">{note.length} / 500 characters</small>
          <p>Saved in this browser</p>
          <button className="btn btn-primary" type="submit">
            Save visit
          </button>
        </form>
      )}
    </Dialog>
  )
}
