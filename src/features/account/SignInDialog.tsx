import { useEffect, useRef, useState } from 'react'
import { accountClient } from '../../lib/account'
import { Dialog } from '../../components/ui/Dialog'
import styles from './AccountControl.module.css'
import { passkeysSupported } from './Passkeys'

/** Public Turnstile site key for rambleroo.app (and localhost). The secret lives only in the Worker. */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFNPxH_0-wslQjiq'

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
  reset: (id: string) => void
}
let loading: Promise<Turnstile> | undefined
// The Turnstile script loads only when someone opens the email form, never on ordinary page views.
function loadTurnstile() {
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => resolve((window as unknown as { turnstile: Turnstile }).turnstile)
    script.onerror = () => {
      loading = undefined
      reject(new Error('The sign-in check could not load. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
  return loading
}

export function SignInDialog({ onClose, reason }: { onClose: () => void; reason?: string }) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  const widget = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)
  const turnstile = useRef<Turnstile | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    loadTurnstile()
      .then((api) => {
        if (cancelled || !widget.current) return
        turnstile.current = api
        widgetId.current = api.render(widget.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: 'magic-link',
          callback: (value: string) => setToken(value),
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken(''),
        })
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
    return () => {
      cancelled = true
      if (widgetId.current) turnstile.current?.remove(widgetId.current)
    }
  }, [])
  const sendLink = async () => {
    setError('')
    setState('sending')
    const result = await accountClient.signIn.magicLink(
      { email, callbackURL: window.location.pathname + window.location.search },
      { headers: { 'x-captcha-response': token } },
    )
    if (result.error) {
      setState('idle')
      setError(result.error.message ?? 'Could not send the link. Try again in a moment.')
      // A Turnstile token works once; get a fresh one for the next try.
      setToken('')
      if (widgetId.current) turnstile.current?.reset(widgetId.current)
      return
    }
    setState('sent')
  }
  return (
    <Dialog title="Sign in to Rambleroo" onClose={onClose}>
      {reason && <p>{reason}</p>}
      {state === 'sent' ? (
        <>
          <p>
            We sent a sign-in link to <strong>{email}</strong>. Open it on this device within 15 minutes. If it isn’t there, check your spam
            folder.
          </p>
          <div className={styles.actions}>
            <button className="btn" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Keep your passport and trip on every device. No password needed.</p>
          {passkeysSupported() && (
            <button
              className="btn"
              onClick={() =>
                void accountClient.signIn.passkey().then((result) => {
                  if (result?.error) setError(result.error.message ?? 'Passkey sign-in did not finish.')
                  else onClose()
                })
              }
            >
              Sign in with a passkey
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() =>
              void accountClient.signIn
                .social({ provider: 'google', callbackURL: window.location.href })
                .then((result) => result.error && setError(result.error.message ?? 'Could not sign in.'))
            }
          >
            Continue with Google
          </button>
          <p className={styles.or}>or</p>
          <form
            className={styles.emailForm}
            onSubmit={(event) => {
              event.preventDefault()
              void sendLink()
            }}
          >
            <label>
              Email
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <div ref={widget} className={styles.turnstile} />
            <button className="btn" type="submit" disabled={!email || !token || state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </Dialog>
  )
}
