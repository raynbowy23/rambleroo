import { useId, useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { cardKey, creditedPhoto, letteringStyles, usePostcards } from '../../lib/postcards'
import { prepareUserPhoto, userPhotos } from '../../lib/userPhotos'
import { PhotoCredit } from '../photos/Photos'
import { CardFront, type CardFrontProps } from './CardFront'
export function PostcardStudio({ onClose, onNote, ...props }: CardFrontProps & { onClose: () => void; onNote: (note: string) => void }) {
  const { byway, choices, photo, milestone } = props
  const letteringId = useId()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const key = cardKey(byway.id, milestone?.id)
  const update = (patch: Partial<typeof choices>) => usePostcards.getState().update(key, patch, choices)
  const credit = creditedPhoto(choices, photo)
  return (
    <Dialog title="Customize postcard" onClose={onClose}>
      <div className="postcard-face">
        <CardFront {...props} />
      </div>
      {credit && (
        <div className="postcard-credit">
          <PhotoCredit photo={credit} />
        </div>
      )}
      <div className="studio-controls">
        <fieldset>
          <legend>Front image</legend>
          {(
            [
              ['photo', 'Photo'],
              ['illustration', 'Illustration'],
              ['own', 'Your photo'],
            ] as const
          )
            .filter(([value]) => value !== 'photo' || photo)
            .map(([value, label]) => (
              <label key={value}>
                <input type="radio" name="postcard-front" checked={choices.front === value} onChange={() => update({ front: value })} />
                {label}
              </label>
            ))}
        </fieldset>
        {choices.front === 'own' && (
          <label>
            Add your photo
            <input
              aria-label="Add your photo"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                setBusy(true)
                setError('')
                try {
                  const blob = await prepareUserPhoto(file)
                  const id = await userPhotos.add(blob)
                  update({ userPhotoId: id, front: 'own' })
                } catch (error) {
                  setError(error instanceof Error ? error.message : 'Could not save this photo.')
                } finally {
                  setBusy(false)
                }
              }}
            />
          </label>
        )}
        {busy && <p role="status">Saving photo in this browser…</p>}
        {error && <p role="alert">{error}</p>}
        {credit && <p>This photo's licence requires its credit. Choose your own photo or the illustration for a card without one.</p>}
        <p>Photos you add stay in this browser. They are never uploaded and are not included in passport backups.</p>
        <label>
          <input type="checkbox" checked={choices.route} onChange={(e) => update({ route: e.target.checked })} />
          Route overlay
        </label>
        <label>
          <input type="checkbox" checked={choices.car} onChange={(e) => update({ car: e.target.checked })} />
          Your car on the card
        </label>
        {/* Explicit label: a wrapping label would fold the selected option into the control's accessible name. */}
        <div>
          <label htmlFor={letteringId}>Lettering</label>
          <select
            id={letteringId}
            value={choices.lettering}
            onChange={(e) => update({ lettering: e.target.value as typeof choices.lettering })}
          >
            {letteringStyles.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <label>
          Message for the back
          <textarea
            maxLength={500}
            value={choices.note}
            onChange={(e) => {
              update({ note: e.target.value })
              onNote(e.target.value)
            }}
          />
        </label>
        <button className="btn btn-primary" onClick={onClose} disabled={busy}>
          Done
        </button>
      </div>
    </Dialog>
  )
}
