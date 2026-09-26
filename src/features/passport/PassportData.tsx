import { useState } from 'react'
import { usePassport } from '../../lib/passport'
import { mergePassport, parsePassport } from '../../lib/passport-transfer'
import { downloadBlob } from '../postcard/download'
import s from '../../components/ui/Content.module.css'

export function PassportData() {
  const [confirm, setConfirm] = useState(false)
  const [message, setMessage] = useState('')
  return (
    <section className={s.section}>
      <h2>Your data</h2>
      <p>Saved in this browser. Downloads make a local backup; imports merge into this browser’s passport.</p>
      <div className={s.actions}>
        <button
          className="btn btn-ghost"
          onClick={() => {
            const { saved, visits } = usePassport.getState()
            downloadBlob(
              new Blob([JSON.stringify({ version: 1, saved, visits }, null, 2)], { type: 'application/json' }),
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
                usePassport.setState({ saved: result.saved, visits: result.visits })
                setMessage(`Added ${result.savedAdded} saved roads and ${result.visitsAdded} visits. Saved in this browser.`)
              } catch {
                setMessage('Could not import: choose a valid version 1 Rambleroo passport JSON file.')
              }
            }}
          />
        </label>
        {confirm ? (
          <div role="group" aria-label="Confirm clear passport">
            <p>Remove all saved roads and visits from this browser?</p>
            <button
              className="btn btn-primary"
              onClick={() => {
                usePassport.setState({ saved: {}, visits: [], lastStampId: null })
                setConfirm(false)
                setMessage('Passport cleared in this browser.')
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
