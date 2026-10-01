import { useTrip } from '../../lib/store'
import { userPhotos } from '../../lib/userPhotos'
import { usePostcards } from '../../lib/postcards'
import { useState } from 'react'
import { usePassport } from '../../lib/passport'
import { mergePassport, parsePassport } from '../../lib/passport-transfer'
import { downloadBlob } from '../postcard/download'
import s from '../../components/ui/Content.module.css'

export function PassportData() {
  const [clearPhotos, setClearPhotos] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [message, setMessage] = useState('')
  return (
    <section className={s.section}>
      <h2>Your data</h2>
      <p>
        Saved in this browser. Added photos and postcard customizations are not included in the passport backup. Downloads make a local
        backup including your trip; imports merge into this browser’s passport and trip.
      </p>
      <div className={s.actions}>
        <button
          className="btn btn-ghost"
          onClick={() => {
            const { saved, visits, savedStretches, postcards } = usePassport.getState()
            downloadBlob(
              new Blob(
                [
                  JSON.stringify(
                    { version: 1, saved, visits, savedStretches, postcards, trip: { version: 1, roads: useTrip.getState().roads } },
                    null,
                    2,
                  ),
                ],
                { type: 'application/json' },
              ),
              'rambleroo-passport.json',
            )
          }}
        >
          Download my passport
        </button>
        <label className={`btn btn-ghost ${s.importFile}`}>
          Import passport
          <input
            aria-label="Import passport"
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              try {
                const incoming = parsePassport(JSON.parse(await file.text()))
                const result = mergePassport(usePassport.getState(), incoming)
                usePassport.setState({
                  saved: result.saved,
                  visits: result.visits,
                  savedStretches: result.savedStretches,
                  postcards: result.postcards,
                })
                if (incoming.trip) {
                  const roads = useTrip.getState().roads
                  const ids = new Set(roads.map((r) => r.bywayId))
                  useTrip.setState({ roads: [...roads, ...incoming.trip.roads.filter((r) => !ids.has(r.bywayId))] })
                }
                setMessage(
                  `Added ${result.savedAdded} saved roads, ${result.stretchesAdded} stretches and ${result.visitsAdded} visits. Saved in this browser.`,
                )
              } catch {
                setMessage('Could not import: choose a valid version 1 Rambleroo passport JSON file.')
              }
            }}
          />
        </label>
        {confirm ? (
          <div role="group" aria-label="Confirm clear passport">
            <p>Remove all saved roads, stretches, postcards, card customizations and visits from this browser?</p>
            <label className="studio-controls">
              <span>
                <input type="checkbox" checked={clearPhotos} onChange={(e) => setClearPhotos(e.target.checked)} /> Also remove photos you
                added to postcards
              </span>
            </label>
            <button
              className="btn btn-primary"
              disabled={clearing}
              onClick={async () => {
                setClearing(true)
                try {
                  if (clearPhotos) await userPhotos.clear()
                  usePassport.setState({ saved: {}, savedStretches: [], postcards: [], visits: [], lastStampId: null })
                  usePostcards.getState().clear()
                  setConfirm(false)
                  setMessage('Passport cleared in this browser.')
                } catch {
                  setMessage('Could not remove your photos. Please try again; your passport has not been cleared.')
                } finally {
                  setClearing(false)
                }
              }}
            >
              Yes, clear passport
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={() => setConfirm(true)}>
            Clear passport
          </button>
        )}
      </div>
      <p role="status">{message}</p>
    </section>
  )
}
