import { registerWorker } from '../../lib/registerWorker'
import { useEffect, useState } from 'react'
import { useOnline } from '../../lib/network'
import s from './AppStatus.module.css'

export function AppStatus() {
  const online = useOnline()
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => registerWorker((reload) => setUpdate(() => reload)), [])

  return (
    <div className={s.status}>
      {!online && <p role="status">You're offline. Saved roads and pages you've opened still work.</p>}
      {update && !dismissed && (
        <div className={s.update} role="status">
          <span>New version available ·</span>
          <button className="btn btn-primary" onClick={() => void update()}>
            Reload
          </button>
          <button className="btn btn-icon" aria-label="Dismiss update" onClick={() => setDismissed(true)}>
            ×
          </button>
        </div>
      )}
    </div>
  )
}
