import { Link } from 'react-router'
import { analyticsAvailable, useConsent } from '../../lib/analytics'
import s from './ConsentBanner.module.css'

/** Asks before any analytics cookie is set. Accept and Decline carry equal weight, as EU guidance requires. */
export function ConsentBanner({ force = false }: { force?: boolean }) {
  const { choice, open, decide } = useConsent()
  if (!force && (!analyticsAvailable() || (choice && !open))) return null
  return (
    <section className={s.banner} role="region" aria-label="Cookie choice">
      <p>
        <strong>May we count visits?</strong> With your OK, Rambleroo uses Google Analytics cookies to see which roads and pages people use.
        No advertising, and your trips and passport are never sent. <Link to="/privacy#cookies">Details</Link>
      </p>
      <div className={s.actions}>
        <button className="btn" onClick={() => decide(false)}>
          Decline
        </button>
        <button className="btn" onClick={() => decide(true)}>
          Accept
        </button>
      </div>
    </section>
  )
}

/** Lets people change their mind later (footer and privacy page). */
export function CookieSettingsButton({ className }: { className?: string }) {
  const reopen = useConsent((state) => state.reopen)
  if (!analyticsAvailable()) return null
  return (
    <button type="button" className={className} onClick={reopen}>
      Cookie settings
    </button>
  )
}
