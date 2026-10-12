import { applyPendingUpdate, registerWorker } from '../../lib/registerWorker'
import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useOnline } from '../../lib/network'
import s from './AppStatus.module.css'

export function AppStatus() {
  const online = useOnline()
  const { pathname } = useLocation()
  useEffect(() => registerWorker(), [])
  // A new version waiting in the background is switched to on the next page change.
  useEffect(() => applyPendingUpdate(), [pathname])

  return <div className={s.status}>{!online && <p role="status">You're offline. Saved roads and pages you've opened still work.</p>}</div>
}
